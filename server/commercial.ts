import express, { RequestHandler, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";

const required = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default("");
const id = required(100);
const customer = z
  .object({
    name: required(120),
    category: z.enum(["Individual", "Business"]),
    email: z.union([z.email().max(160), z.literal("")]),
    phone: optional(35),
    preferredContactMethod: optional(80),
    notes: optional(3000),
  })
  .strict()
  .refine(c => Boolean(c.phone || c.email));
const property = z
  .object({
    label: required(120),
    type: z.enum(["Residential", "Commercial", "Multi-unit", "Other"]),
    address: required(250),
    city: required(100),
    province: required(100),
    postalCode: optional(20),
    country: required(80),
    accessInstructions: optional(1500),
    notes: optional(3000),
  })
  .strict();
const link = z.object({ customerId: id, propertyId: id.nullable() }).strict();
const amount = z.number().int().min(0).max(2_000_000_000);
const draft = z
  .object({
    customerId: id,
    propertyId: id.nullable(),
    bookingId: id.nullable(),
    description: required(2000),
    notes: optional(3000),
    expiresOn: z.iso.date(),
    taxLabel: optional(100),
    taxCents: amount,
    lines: z
      .array(
        z
          .object({
            kind: z.enum(["Labour", "Material"]),
            description: required(300),
            quantity: z.number().int().min(1).max(10000),
            unitCents: amount,
          })
          .strict()
      )
      .min(1)
      .max(100),
    version: z.number().int().positive().optional(),
  })
  .strict();
const summary = {
  id: true,
  name: true,
  repairType: true,
  visitMode: true,
  status: true,
  createdAt: true,
  customerId: true,
  propertyId: true,
  preferredDate: true,
  appointmentTime: true,
} as const;
const quoteSummary = {
  id: true,
  description: true,
  status: true,
  totalCents: true,
  customerId: true,
  propertyId: true,
} as const;
class Conflict extends Error {}
const route =
  (action: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res) => {
    try {
      await action(req, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Check the form fields." });
        return;
      }
      if (error instanceof Conflict) {
        res.status(409).json({ error: error.message });
        return;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        res.sendStatus(404);
        return;
      }
      res
        .status(500)
        .json({ error: "The record could not be saved or loaded." });
    }
  };
async function checkLinks(
  tx: Prisma.TransactionClient,
  data: z.infer<typeof link>,
  bookingId?: string | null
) {
  await tx.customer.findUniqueOrThrow({
    where: { id: data.customerId },
    select: { id: true },
  });
  if (
    data.propertyId &&
    !(await tx.property.count({
      where: { id: data.propertyId, customerId: data.customerId },
    }))
  )
    throw new Conflict("Choose a property belonging to this customer.");
  if (
    bookingId &&
    !(await tx.booking.count({
      where: {
        id: bookingId,
        customerId: data.customerId,
        propertyId: data.propertyId,
      },
    }))
  )
    throw new Conflict("Link the booking to this customer and property first.");
}
export function registerCommercial(app: express.Express, auth: RequestHandler) {
  const r = express.Router();
  app.use("/api/admin/commercial", r);
  r.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  }, auth);
  r.get(
    "/customers",
    route(async (req, res) => {
      const { q, category, page } = z
        .object({
          q: optional(120),
          category: z.enum(["Individual", "Business"]).optional(),
          page: z.coerce.number().int().min(0).max(100000).default(0),
        })
        .parse(req.query);
      res.json(
        await prisma.customer.findMany({
          where: {
            category,
            OR: ["name", "email", "phone"].map(key => ({
              [key]: { contains: q },
            })),
          },
          select: { id: true, name: true, category: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: page * 40,
          take: 40,
        })
      );
    })
  );
  r.post(
    "/customers",
    route(async (req, res) =>
      res
        .status(201)
        .json(await prisma.customer.create({ data: customer.parse(req.body) }))
    )
  );
  r.put(
    "/customers/:id",
    route(async (req, res) =>
      res.json(
        await prisma.customer.update({
          where: { id: req.params.id },
          data: customer.parse(req.body),
        })
      )
    )
  );
  r.get(
    "/customers/:id",
    route(async (req, res) =>
      res.json(
        await prisma.customer.findUniqueOrThrow({
          where: { id: req.params.id },
          include: {
            properties: { orderBy: { label: "asc" } },
            bookings: { select: summary, orderBy: { createdAt: "desc" } },
            quotations: {
              select: quoteSummary,
              orderBy: { createdAt: "desc" },
            },
          },
        })
      )
    )
  );
  r.post(
    "/customers/:id/properties",
    route(async (req, res) =>
      res
        .status(201)
        .json(
          await prisma.property.create({
            data: {
              ...property.parse(req.body),
              customer: { connect: { id: req.params.id } },
            },
          })
        )
    )
  );
  r.put(
    "/properties/:id",
    route(async (req, res) =>
      res.json(
        await prisma.property.update({
          where: { id: req.params.id },
          data: property.parse(req.body),
        })
      )
    )
  );
  const directoryQuery = z.object({
    q: optional(120),
    page: z.coerce.number().int().min(0).max(100000).default(0),
  });
  r.get(
    "/properties",
    route(async (req, res) => {
      const { q, page } = directoryQuery.parse(req.query);
      res.json(
        await prisma.property.findMany({
          where: {
            OR: [{ label: { contains: q } }, { address: { contains: q } }],
          },
          select: { id: true, label: true, customerId: true, address: true },
          orderBy: [{ label: "asc" }, { id: "asc" }],
          skip: page * 40,
          take: 40,
        })
      );
    })
  );
  r.get(
    "/quotes",
    route(async (req, res) => {
      const { q, page } = directoryQuery.parse(req.query);
      res.json(
        await prisma.quotation.findMany({
          where: {
            OR: [{ description: { contains: q } }, { id: { contains: q } }],
          },
          select: quoteSummary,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: page * 40,
          take: 40,
        })
      );
    })
  );
  r.get(
    "/bookings",
    route(async (req, res) => {
      const { remote, q, page } = z
        .object({
          remote: z.enum(["yes", "no"]).default("no"),
          q: optional(120),
          page: z.coerce.number().int().min(0).max(100000).default(0),
        })
        .parse(req.query);
      res.json(
        await prisma.booking.findMany({
          where: {
            visitMode: remote === "yes" ? "REMOTE" : undefined,
            OR: [{ name: { contains: q } }, { id: { contains: q } }],
          },
          select: summary,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 40,
          skip: page * 40,
        })
      );
    })
  );
  r.get(
    "/bookings/:id",
    route(async (req, res) => {
      const b = await prisma.booking.findUniqueOrThrow({
        where: { id: req.params.id },
        select: {
          ...summary,
          email: true,
          phone: true,
          address: true,
          message: true,
          preferredContactMethod: true,
          photos: true,
          adminNotes: true,
        },
      });
      const photos: unknown = b.photos ? JSON.parse(b.photos) : [];
      res.json({
        ...b,
        photos: Array.isArray(photos)
          ? photos.map(
              (_, i) =>
                "/api/admin/bookings/" +
                encodeURIComponent(b.id) +
                "/photos/" +
                i
            )
          : [],
      });
    })
  );
  r.put(
    "/bookings/:id/link",
    route(async (req, res) => {
      const data = link.parse(req.body);
      await prisma.$transaction(async tx => {
        await checkLinks(tx, data);
        if (await tx.quotation.count({ where: { bookingId: req.params.id } }))
          throw new Conflict(
            "A quotation already uses this booking association."
          );
        await tx.booking.update({ where: { id: req.params.id }, data });
      });
      res.sendStatus(204);
    })
  );
  r.get(
    "/quotes/:id",
    route(async (req, res) =>
      res.json(
        await prisma.quotation.findUniqueOrThrow({
          where: { id: req.params.id },
          include: {
            lines: { orderBy: { position: "asc" } },
            customer: { select: { id: true, name: true } },
            property: { select: { id: true, label: true } },
          },
        })
      )
    )
  );
  const saveDraft = route(async (req, res) => {
    const data = draft.parse(req.body);
    const { lines, version, ...header } = data;
    const subtotalCents = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitCents,
      0
    );
    const totalCents = subtotalCents + header.taxCents;
    amount.parse(totalCents);
    if (header.taxCents && !header.taxLabel)
      throw new Conflict("Identify the tax being applied.");
    const result = await prisma.$transaction(async tx => {
      await checkLinks(tx, header, header.bookingId);
      const record = { ...header, subtotalCents, totalCents };
      const items = lines.map((line, position) => ({ ...line, position }));
      if (!req.params.id)
        return tx.quotation.create({
          data: { ...record, lines: { create: items } },
        });
      if (
        !version ||
        !(
          await tx.quotation.updateMany({
            where: { id: req.params.id, status: "DRAFT", version },
            data: { ...record, version: { increment: 1 } },
          })
        ).count
      )
        throw new Conflict("This draft has changed. Reload the quotation.");
      await tx.quoteLine.deleteMany({ where: { quotationId: req.params.id } });
      return tx.quotation.update({
        where: { id: req.params.id },
        data: { lines: { create: items } },
      });
    });
    res.status(req.params.id ? 200 : 201).json(result);
  });
  r.post("/quotes", saveDraft);
  r.put("/quotes/:id", saveDraft);
  r.patch(
    "/quotes/:id/status",
    route(async (req, res) => {
      const { status, version } = z
        .object({
          status: z.enum(["SENT", "ACCEPTED", "DECLINED", "EXPIRED"]),
          version: z.number().int().positive(),
        })
        .strict()
        .parse(req.body);
      const today = new Date().toISOString().slice(0, 10);
      const expiry =
        status === "EXPIRED"
          ? { lt: today }
          : status === "DECLINED"
            ? undefined
            : { gte: today };
      const result = await prisma.quotation.updateMany({
        where: {
          id: req.params.id,
          status: status === "SENT" ? "DRAFT" : "SENT",
          expiresOn: expiry,
          version,
        },
        data: { status, version: { increment: 1 } },
      });
      if (!result.count)
        throw new Conflict(
          "This status change is unavailable. Check the expiry and reload."
        );
      res.sendStatus(204);
    })
  );
}
