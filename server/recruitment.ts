import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";

const application = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().max(180).transform(value => value.toLowerCase()),
  city: z.string().trim().min(2).max(100),
  province: z.enum(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]),
  experience: z.string().trim().min(10).max(2000),
}).strict();

const review = z.object({
  status: z.enum(["SCREENING", "INTERVIEW", "CLOSED"]),
  note: z.string().trim().min(5).max(1000),
  version: z.number().int().positive(),
}).strict();

export function registerRecruitment(app: Express, staff: RequestHandler) {
  const root = "/api/technician-applications";
  const admin = "/api/admin/technician-applications";
  const limit = rateLimit({ windowMs: 60 * 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false });
  app.post(root, limit, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const result = application.safeParse(req.body);
    if (!result.success) { res.sendStatus(400); return; }
    try {
      await prisma.technicianApplication.upsert({
        where: { email: result.data.email },
        create: result.data,
        update: {},
      });
      res.sendStatus(202);
    } catch {
      res.sendStatus(503);
    }
  });

  app.use(admin, (_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); }, staff);
  app.get(admin, async (req, res) => {
    const query = z.object({
      page: z.coerce.number().int().min(0).max(10000).default(0),
      status: z.enum(["NEW", "SCREENING", "INTERVIEW", "CLOSED"]).default("NEW"),
    }).safeParse(req.query);
    if (!query.success) { res.sendStatus(400); return; }
    try {
      const rows = await prisma.technicianApplication.findMany({
        where: { status: query.data.status }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 26, skip: query.data.page * 25,
      });
      res.json({ records: rows.slice(0, 25), hasMore: rows.length > 25 });
    } catch {
      res.sendStatus(503);
    }
  });

  app.patch(admin + "/:id", async (req, res) => {
    const input = review.safeParse(req.body);
    if (!input.success || !req.session.adminId) { res.sendStatus(400); return; }
    try {
      const changed = await prisma.$transaction(async tx => {
        const { status, note, version } = input.data;
        const result = await tx.technicianApplication.updateMany({
          where: { id: req.params.id, version, status: { not: "CLOSED" } },
          data: { status, reviewNote: note, version: { increment: 1 } },
        });
        if (!result.count) return false;
        await tx.auditEvent.create({ data: {
          id: randomUUID(), actorType: "admin", actorId: String(req.session.adminId),
          action: "TECHNICIAN_APPLICATION_" + status, entityType: "technician_application",
          entityId: req.params.id, metadata: "{}",
        } });
        return true;
      });
      res.sendStatus(changed ? 204 : 409);
    } catch {
      res.sendStatus(503);
    }
  });
}
