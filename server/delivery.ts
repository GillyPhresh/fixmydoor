import {
  Router,
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import { Prisma, type Job } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { randomBytes } from "node:crypto";
import { decodeDataUrl } from "./attachments";
import { nextStates, categories } from "../shared/delivery";

const text = (n: number) => z.string().trim().min(1).max(n);
const note = z.string().trim().max(2000).default("");
const area = text(100).transform(s =>
  s.normalize("NFC").toLocaleUpperCase("en-CA")
);
const category = z.enum(categories);
const technician = z
  .object({
    name: text(120),
    phone: text(40),
    email: z.email().max(180),
    province: area,
    city: area,
    experience: note,
    notes: note,
    available: z.boolean(),
  })
  .strict();
const statuses = z.enum([
  "APPLICANT",
  "PENDING_VERIFICATION",
  "APPROVED",
  "SUSPENDED",
  "INACTIVE",
]);
const grant = z
  .object({
    category,
    province: area,
    city: area,
    evidence: text(500),
    expiresOn: z.iso.date(),
    scopeReviewed: z.literal(true),
    licensingReviewed: z.literal(true),
  })
  .strict();
const jobInput = z
  .object({
    quoteId: text(100),
    category,
    province: area,
    city: area,
    location: text(300),
    internalNotes: note,
  })
  .strict();

const action = z
  .object({
    version: z.number().int().positive(),
    status: text(30),
    technicianId: text(100).optional(),
    startsAt: z.iso.datetime().optional(),
    endsAt: z.iso.datetime().optional(),
    workPerformed: note,
    materials: note,
    customerSummary: note,
    labourMinutes: z.number().int().nonnegative().max(100000).default(0),
  })
  .strict();
class Denied extends Error {}
function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Denied(message);
}
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof Denied) {
        res.status(409).json({ error: e.message });
        return;
      }
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid fields" });
        return;
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2025") {
          res.sendStatus(404);
          return;
        }
        if (["P2002", "P2034", "P2028"].includes(e.code)) {
          res.status(409).json({ error: "Record changed. Refresh and retry." });
          return;
        }
      }
      res.status(500).json({ error: "Delivery operation failed" });
    }
  };
function eligible(job: Job, through: Date): Prisma.TechnicianWhereInput {
  // Regulated trades stay closed until individual and business licensing policies are established.
  if (!["ASSEMBLY", "MAINTENANCE"].includes(job.category))
    return { id: { in: [] } };
  return {
    status: "APPROVED",
    available: true,
    grants: {
      some: {
        category: job.category,
        city: job.city,
        province: job.province,
        expiresOn: { gte: through.toISOString().slice(0, 10) },
      },
    },
  };
}
export function deliveryRoutes() {
  const r = Router();
  r.get(
    "/technicians",
    handle(async (req, res) => {
      const q = z
        .object({
          category: category.optional(),
          city: area.optional(),
          available: z.enum(["true", "false"]).optional(),
          name: z.string().max(120).optional(),
        })
        .parse(req.query);
      res.json(
        await prisma.technician.findMany({
          where: {
            name: { contains: q.name },
            available:
              q.available === undefined ? undefined : q.available === "true",
            ...(q.category || q.city
              ? { grants: { some: { category: q.category, city: q.city } } }
              : {}),
          },
          orderBy: { name: "asc" },
          include: {
            grants: true,
            jobs: {
              select: {
                id: true,
                status: true,
                description: true,
                completedAt: true,
              },
            },
          },
        })
      );
    })
  );
  r.post(
    "/technicians",
    handle(async (req, res) =>
      res
        .status(201)
        .json(
          await prisma.technician.create({ data: technician.parse(req.body) })
        )
    )
  );
  r.put(
    "/technicians/:id",
    handle(async (req, res) =>
      res.json(
        await prisma.technician.update({
          where: { id: req.params.id },
          data: technician.parse(req.body),
        })
      )
    )
  );
  r.post(
    "/technicians/:id/review",
    handle(async (req, res) => {
      const { status } = z
        .object({ status: statuses })
        .strict()
        .parse(req.body);
      const from: Record<string, string[]> = {
        PENDING_VERIFICATION: ["APPLICANT", "SUSPENDED", "INACTIVE"],
        APPROVED: ["PENDING_VERIFICATION"],
        SUSPENDED: ["APPROVED"],
        INACTIVE: [
          "APPLICANT",
          "PENDING_VERIFICATION",
          "APPROVED",
          "SUSPENDED",
        ],
      };
      requireCondition(from[status], "Invalid review decision");
      const n = await prisma.technician.updateMany({
        where: { id: req.params.id, status: { in: from[status] } },
        data: { status },
      });
      requireCondition(n.count, "Invalid technician transition");
      res.sendStatus(204);
    })
  );
  r.post(
    "/technicians/:id/grants",
    handle(async (req, res) => {
      const { scopeReviewed, licensingReviewed, ...data } = grant.parse(
        req.body
      );
      requireCondition(
        data.expiresOn >= new Date().toISOString().slice(0, 10),
        "Verification expired"
      );
      const identity = {
        technicianId: req.params.id,
        category: data.category,
        city: data.city,
        province: data.province,
      };
      const reviewer = String(req.session.adminId);
      res.json(
        await prisma.serviceGrant.upsert({
          where: { technicianId_category_province_city: identity },
          create: { ...identity, ...data, reviewer },
          update: {
            evidence: data.evidence,
            expiresOn: data.expiresOn,
            reviewedAt: new Date(),
            reviewer,
          },
        })
      );
    })
  );
  r.get(
    "/jobs",
    handle(async (_req, res) =>
      res.json(
        await prisma.job.findMany({
          include: {
            photos: { select: { id: true, kind: true } },
            history: { orderBy: { createdAt: "asc" } },
            quote: {
              select: { customerId: true, propertyId: true, bookingId: true },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      )
    )
  );
  r.post(
    "/jobs/:id/photos",
    handle(async (req, res) => {
      const { kind, image } = z
        .object({
          kind: z.enum(["BEFORE", "AFTER"]),
          image: z.string().max(2400064),
        })
        .strict()
        .parse(req.body);
      let bytes: Buffer;
      try {
        bytes = await decodeDataUrl(image);
      } catch {
        res.status(400).json({ error: "Invalid job photo" });
        return;
      }
      await prisma.$transaction(async tx => {
        const job = await tx.job.findUniqueOrThrow({
          where: { id: req.params.id },
        });
        requireCondition(
          !["CANCELLED", "COMPLETED"].includes(job.status),
          "Job closed"
        );
        requireCondition(
          (await tx.jobPhoto.count({ where: { jobId: job.id } })) < 12,
          "Photo limit reached"
        );
        await tx.jobPhoto.create({
          data: { jobId: job.id, kind, image: bytes },
        });
      });
      res.sendStatus(201);
    })
  );
  r.get(
    "/jobs/:id/photos/:photoId",
    handle(async (req, res) => {
      const photo = await prisma.jobPhoto.findFirstOrThrow({
        where: { jobId: req.params.id, id: req.params.photoId },
      });
      res
        .type("image/jpeg")
        .set("X-Content-Type-Options", "nosniff")
        .send(Buffer.from(photo.image));
    })
  );
  r.post(
    "/jobs",
    handle(async (req, res) => {
      const data = jobInput.parse(req.body);
      const job = await prisma.$transaction(async tx => {
        const existing = await tx.job.findUnique({
          where: { quoteId: data.quoteId },
        });
        if (existing) return existing;
        const quote = await tx.quotation.findUniqueOrThrow({
          where: { id: data.quoteId },
          include: { lines: { orderBy: { position: "asc" } } },
        });
        requireCondition(
          quote.status === "ACCEPTED",
          "Only accepted quotations can become jobs"
        );
        const { notes, ...agreement } = quote;
        return tx.job.create({
          data: {
            ...data,
            reference: "FMD-" + randomBytes(8).toString("hex").toUpperCase(),
            description: quote.description,
            agreement: JSON.stringify(agreement),
            history: {
              create: { status: "DRAFT", actor: String(req.session.adminId) },
            },
          },
        });
      });
      res.json(job);
    })
  );
  r.get(
    "/jobs/:id/eligible",
    handle(async (req, res) => {
      const job = await prisma.job.findUniqueOrThrow({
        where: { id: req.params.id },
      });
      res.json(
        await prisma.technician.findMany({
          where: eligible(job, new Date()),
          select: { id: true, name: true },
        })
      );
    })
  );
  r.post(
    "/jobs/:id/actions",
    handle(async (req, res) => {
      const a = action.parse(req.body);
      await prisma.$transaction(async tx => {
        const j = await tx.job.findUniqueOrThrow({
          where: { id: req.params.id },
        });
        requireCondition(
          j.version === a.version && nextStates[j.status]?.includes(a.status),
          "Invalid or stale job transition"
        );
        let technicianId = j.technicianId,
          startsAt = j.startsAt,
          endsAt = j.endsAt;
        if (a.status === "ASSIGNED") {
          technicianId = a.technicianId ?? null;
          startsAt = endsAt = null;
        }
        if (["READY", "CANCELLED"].includes(a.status)) {
          technicianId = null;
          startsAt = endsAt = null;
        }
        if (a.status === "SCHEDULED") {
          requireCondition(
            a.startsAt && a.endsAt,
            "Enter a start and end time"
          );
          startsAt = new Date(a.startsAt);
          endsAt = new Date(a.endsAt);
          requireCondition(
            endsAt > startsAt && endsAt > new Date(),
            "Invalid appointment interval"
          );
          requireCondition(
            !(await tx.job.count({
              where: {
                id: { not: j.id },
                technicianId,
                status: { in: ["SCHEDULED", "IN_PROGRESS"] },
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
              },
            })),
            "Technician already scheduled"
          );
        }
        if (["ASSIGNED", "SCHEDULED", "IN_PROGRESS"].includes(a.status)) {
          requireCondition(
            technicianId &&
              (await tx.technician.count({
                where: {
                  id: technicianId,
                  ...eligible(
                    j,
                    new Date(Math.max(Date.now(), endsAt?.valueOf() ?? 0))
                  ),
                },
              })),
            "Technician lacks current approval, availability or verified service coverage"
          );
        }
        const done = a.status === "COMPLETED";
        if (done)
          requireCondition(
            a.workPerformed && a.customerSummary,
            "Record work and customer summary"
          );
        const saved = await tx.job.updateMany({
          where: { id: j.id, version: a.version },
          data: {
            status: a.status,
            technicianId,
            startsAt,
            endsAt,
            version: { increment: 1 },
            ...(done
              ? {
                  completedAt: new Date(),
                  workPerformed: a.workPerformed,
                  customerSummary: a.customerSummary,
                  materials: a.materials,
                  labourMinutes: a.labourMinutes,
                }
              : {}),
          },
        });
        requireCondition(saved.count, "Job changed");
        await tx.jobEvent.create({
          data: {
            jobId: j.id,
            status: a.status,
            actor: String(req.session.adminId),
            technicianId,
            startsAt,
            endsAt,
          },
        });
      });
      res.sendStatus(204);
    })
  );
  return r;
}
