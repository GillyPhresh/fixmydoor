import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { BookingRequest } from "../shared/types";
import { privatePhotoPattern, saveBooking } from "./bookings";
import { prisma } from "./prisma";

export class AttachmentError extends Error {}
const maxBytes = 1_800_000;
const lifetime = 60 * 60 * 1000;
const cutoff = () => new Date(Date.now() - lifetime);
const legacyImage = /^\/uploads\/([a-z0-9-]+\.(?:png|jpe?g|webp))$/i;
const publicFile = /^[a-z0-9-]+\.(?:png|jpe?g|webp|mp4|webm|ogg|pdf|docx?)$/i;

async function normalizeImage(bytes: Buffer, declared?: string, maxImageBytes = maxBytes) {
  if (!bytes.length || bytes.length > maxImageBytes) throw new AttachmentError("Invalid image size");
  const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
  const { format, width, height, pages } = await image.metadata();
  if (!format || !["jpeg", "png", "webp"].includes(format) || (declared && declared !== format) ||
      !width || !height || width > 8192 || height > 8192 || (pages || 1) !== 1) {
    throw new AttachmentError("Unsupported image");
  }
  return image.rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
}

export async function decodeDataUrl(value: unknown, maxImageBytes = maxBytes) {
  if (typeof value !== "string" || value.length > Math.ceil(maxImageBytes * 4 / 3) + 64) throw new AttachmentError("Invalid image");
  const match = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) throw new AttachmentError("Invalid image");
  return normalizeImage(Buffer.from(match[2], "base64"), match[1].toLowerCase().replace("jpg", "jpeg"), maxImageBytes);
}

export function startAttachmentCleanup() {
  const sweep = () => prisma.attachment.deleteMany({ where: { bookingId: null, createdAt: { lt: cutoff() } } })
    .catch(() => console.error("Pending attachment cleanup failed"));
  void sweep();
  setInterval(sweep, 15 * 60 * 1000).unref();
}

export async function saveWithAttachments(booking: BookingRequest, owner?: string) {
  const photos = booking.photos || [];
  if (!photos.length) return saveBooking(booking);
  if (!owner) throw new AttachmentError("Upload session expired");
  return prisma.$transaction(async tx => {
    const saved = await saveBooking(booking, tx);
    const claimed = await tx.attachment.updateMany({
      where: { id: { in: photos.map(ref => ref.slice("attachment:".length)) }, bookingId: null, owner, createdAt: { gte: cutoff() } },
      data: { owner: null, bookingId: saved.id },
    });
    if (claimed.count !== photos.length) throw new AttachmentError("Please select the photos again");
    return saved;
  });
}

export function registerAttachmentRoutes(app: Express, staff: RequestHandler, legacyDir: string) {
  app.post("/api/media/session", (req, res) => {
    req.session.uploadOwner ??= randomUUID();
    res.sendStatus(204);
  });

  // Replace one selection atomically. A tab can discard only its own unclaimed refs.
  app.post("/api/media", async (req, res) => {
    const owner = req.session.uploadOwner;
    if (!owner) return res.sendStatus(403);
    const { images, replace = [] } = req.body || {};
    if (!Array.isArray(images) || !images.length || images.length > 3 ||
        !Array.isArray(replace) || replace.length > 3 || !replace.every(ref => typeof ref === "string" && privatePhotoPattern.test(ref))) {
      return res.status(400).json({ error: "Invalid photo selection" });
    }
    const buffers: Buffer[] = [];
    try {
      for (const image of images) buffers.push(await decodeDataUrl(image));
    } catch { return res.status(400).json({ error: "Unsupported or invalid image" }); }
    try {
      const refs = await prisma.$transaction(async tx => {
        await tx.attachment.deleteMany({ where: { owner, bookingId: null, id: { in: replace.map(ref => ref.slice(11)) } } });
        const count = await tx.attachment.count({ where: { owner, bookingId: null, createdAt: { gte: cutoff() } } });
        if (count + buffers.length > 9) throw new AttachmentError("Too many pending photos");
        const refs: string[] = [];
        for (const image of buffers) {
          const id = randomUUID();
          await tx.attachment.create({ data: { id, owner, image } });
          refs.push("attachment:" + id);
        }
        return refs;
      });
      return res.status(201).json({ refs });
    } catch (error) {
      return res.sendStatus(error instanceof AttachmentError ? 429 : 503);
    }
  });

  app.get("/api/admin/bookings/:id/photos/:index", staff, async (req, res) => {
    if (!/^[0-2]$/.test(req.params.index)) return res.sendStatus(404);
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { photos: true } });
      const ref = JSON.parse(booking?.photos || "[]")[Number(req.params.index)];
      if (typeof ref !== "string") return res.sendStatus(404);
      let image: Buffer;
      if (privatePhotoPattern.test(ref)) {
        const entry = await prisma.attachment.findFirst({ where: { id: ref.slice(11), bookingId: req.params.id }, select: { image: true } });
        if (!entry) return res.sendStatus(404);
        image = entry.image;
      } else if (legacyImage.test(ref)) {
        const file = path.join(legacyDir, path.basename(ref));
        const info = await lstat(file);
        if (!info.isFile() || info.size > 2_000_000) return res.sendStatus(404);
        image = await normalizeImage(await readFile(file), undefined, 2_000_000);
      } else {
        // The legacy booking validator allowed up to 2.5 MB of base64, about 1.875 MB decoded.
        image = await decodeDataUrl(ref, 2_000_000);
      }
      res.type("image/jpeg").set("Cache-Control", "private, no-store").send(image);
    } catch { res.sendStatus(404); }
  });

  // Only staff CMS writes into published/. Legacy mixed storage requires positive publication evidence.
  app.get("/uploads/:file", async (req, res) => {
    const file = req.params.file;
    if (!publicFile.test(file)) return res.sendStatus(404);
    try {
      const published = path.resolve(legacyDir, "published", file);
      const info = await lstat(published).catch(() => null);
      if (info?.isFile()) return res.sendFile(published);
      const url = "/uploads/" + file;
      const item = await prisma.contentItem.findFirst({ where: { active: true, OR: [{ image: url }, { accentImage: url }] }, select: { id: true } });
      if (!item || await prisma.booking.findFirst({ where: { photos: { contains: url } }, select: { id: true } })) return res.sendStatus(404);
      const legacy = path.resolve(legacyDir, file);
      if (!(await lstat(legacy)).isFile()) return res.sendStatus(404);
      return res.sendFile(legacy);
    } catch { return res.sendStatus(404); }
  });
  app.use("/uploads", (_req, res) => res.sendStatus(404));
}
