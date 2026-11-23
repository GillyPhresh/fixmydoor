import { calculateDepositCents } from "./deposit-amount";
import { deliveryRoutes } from "./delivery";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import express, { RequestHandler, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { sandboxKey } from "./payment-sandbox";

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
  invoice:{select:{id:true,status:true}},
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
function periodDate(startOn: string, months: number, period: number) {
  const anchor = new Date(startOn + "T00:00:00Z");
  const first = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months * period, 1)
  );
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
  ).getUTCDate();
  first.setUTCDate(Math.min(anchor.getUTCDate(), last));
  return first.toISOString().slice(0, 10);
}
export function registerCommercial(app: express.Express, auth: RequestHandler) {
  const r = express.Router();
  app.use("/api/admin/commercial", r);
  r.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  }, auth);
  r.use("/delivery", deliveryRoutes());
  r.put("/quotes/:id/deposit-request", route(async (req, res) => {
    const input = z.object({
      terms: z.discriminatedUnion("type", [
        z.object({ type: z.literal("FIXED"), cents: z.number().int() }).strict(),
        z.object({ type: z.literal("PERCENTAGE"), basisPoints: z.number().int() }).strict(),
      ]),
      dueOn: z.iso.date(),
      agreedTermsReference: z.string().trim().min(3).max(160),
    }).strict().parse(req.body);
    const quoteId = id.parse(req.params.id);
    const request = await prisma.$transaction(async tx => {
      const quote = await tx.quotation.findUniqueOrThrow({
        where: { id: quoteId },
        select: { status: true, currency: true, totalCents: true },
      });
      if (quote.status !== "ACCEPTED" || quote.currency !== "CAD") {
        throw new Conflict("Choose an accepted CAD quotation.");
      }
      let amountCents: number;
      try {
        amountCents = calculateDepositCents(quote.totalCents, input.terms);
      } catch (error) {
        if (error instanceof RangeError) throw new Conflict(error.message);
        throw error;
      }
      const basisPoints = input.terms.type === "PERCENTAGE" ? input.terms.basisPoints : null;
      const record = await tx.quotationDeposit.upsert({
        where: { quoteId },
        update: {},
        create: { quoteId, amountCents, basisPoints, dueOn: input.dueOn, agreedTermsReference: input.agreedTermsReference, createdBy: String(req.session.adminId) },
      });
      if (record.amountCents !== amountCents || record.basisPoints !== basisPoints || record.dueOn !== input.dueOn || record.agreedTermsReference !== input.agreedTermsReference) {
        throw new Conflict("These terms differ from the existing deposit request.");
      }
      return record;
    });
    res.json({ amountCents: request.amountCents, dueOn: request.dueOn, createdAt: request.createdAt });
  }));
  r.post(
    "/bookings/:id/consultation",
    route(async (req, res) => {
      const config = z
        .object({
          quoteId: id,
          serviceType: required(120),
          durationMinutes: z.number().int().min(5).max(480),
          requiresPayment: z.boolean(),
          availability: optional(400),
          scheduledAt: z.iso.datetime(),
        })
        .strict()
        .parse(req.body);
      const bookingId = req.params.id;
      const consult = await prisma.$transaction(async tx => {
        const quote = await tx.quotation.findFirst({
          where: {
            id: config.quoteId,
            bookingId,
            status: "ACCEPTED",
            booking: { visitMode: "REMOTE" },
          },
          include: { invoice: true },
        });
        if (!quote)
          throw new Conflict(
            "Select an accepted quotation for this remote request."
          );
        if (config.requiresPayment && quote.invoice?.status !== "PAID")
          throw new Conflict(
            "Payment is required before confirming this appointment."
          );
        if (new Date(config.scheduledAt) <= new Date())
          throw new Conflict("Choose a future appointment.");
        if (await tx.remoteConsultation.findUnique({ where: { bookingId } }))
          throw new Conflict("Consultation already confirmed.");
        return tx.remoteConsultation.create({ data: { ...config, bookingId } });
      });
      res.status(201).json(consult);
    })
  );
  r.post(
    "/bookings/:id/consultation/complete",
    route(async (req, res) => {
      const { outcome } = z
        .object({ outcome: required(2000) })
        .strict()
        .parse(req.body);
      const result = await prisma.remoteConsultation.updateMany({
        where: {
          bookingId: req.params.id,
          completedAt: null,
          scheduledAt: { lte: new Date() },
        },
        data: { outcome, completedAt: new Date() },
      });
      if (!result.count)
        throw new Conflict(
          "A confirmed consultation must have started before completion."
        );
      res.sendStatus(204);
    })
  );
  r.get(
    "/properties/:id/agreements",
    route(async (req, res) => {
      const records = await prisma.maintenanceAgreement.findMany({
        where: { propertyId: req.params.id },
        include: {
          occurrences: {
            orderBy: { period: "asc" },
            include: {
              quote: {
                select: {
                  invoice: { select: { id: true } },
                  job: { select: { id: true, status: true } },
                },
              },
            },
          },
        },
      });
      res.json(
        records.map(a => ({
          ...a,
          nextOn: periodDate(a.startOn, a.months, a.occurrences.length),
        }))
      );
    })
  );
  r.post(
    "/properties/:id/agreements",
    route(async (req, res) => {
      const input = z
        .object({
          scope: required(1000),
          startOn: z.iso.date(),
          endOn: z.iso.date(),
          months: z.union([
            z.literal(1),
            z.literal(3),
            z.literal(6),
            z.literal(12),
          ]),
          cents: z.number().int().positive().max(2000000000),
          notes: optional(2000),
          authorization: required(200),
        })
        .strict()
        .parse(req.body);
      if (input.endOn < input.startOn)
        throw new Conflict("End date precedes start.");
      await prisma.property.findUniqueOrThrow({ where: { id: req.params.id } });
      res.status(201).json(
        await prisma.maintenanceAgreement.create({
          data: {
            ...input,
            propertyId: req.params.id,
            staff: String(req.session.adminId),
          },
        })
      );
    })
  );
  r.patch(
    "/agreements/:id",
    route(async (req, res) => {
      const input = z
        .object({
          status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED"]),
          endOn: z.iso.date().optional(),
        })
        .strict()
        .parse(req.body);
      const saved = await prisma.maintenanceAgreement.updateMany({
        where: {
          id: req.params.id,
          status: { not: "CANCELLED" },
          ...(input.endOn ? { endOn: { lte: input.endOn } } : {}),
        },
        data: input,
      });
      if (!saved.count)
        throw new Conflict("Agreement closed or renewal date invalid.");
      res.sendStatus(204);
    })
  );
  r.post(
    "/agreements/:id/occurrences",
    route(async (req, res) => {
      const { period } = z
        .object({ period: z.number().int().min(0).max(1200) })
        .strict()
        .parse(req.body);
      const record = await prisma.$transaction(async tx => {
        const a = await tx.maintenanceAgreement.findUniqueOrThrow({
          where: { id: req.params.id },
          include: {
            property: true,
            _count: { select: { occurrences: true } },
          },
        });
        const previous = await tx.maintenanceOccurrence.findUnique({
          where: { agreementId_period: { agreementId: a.id, period } },
        });
        if (previous) return previous;
        const dueOn = periodDate(a.startOn, a.months, period);
        if (
          a.status !== "ACTIVE" ||
          dueOn > a.endOn ||
          period !== a._count.occurrences
        )
          throw new Conflict(
            "This occurrence is outside the active agreement."
          );
        const quote = await tx.quotation.create({
          data: {
            customerId: a.property.customerId,
            propertyId: a.propertyId,
            description: a.scope,
            notes: "",
            status: "ACCEPTED",
            expiresOn: a.endOn,
            taxLabel: "",
            taxCents: 0,
            subtotalCents: a.cents,
            totalCents: a.cents,
            lines: {
              create: {
                position: 0,
                kind: "Labour",
                description: a.scope,
                quantity: 1,
                unitCents: a.cents,
              },
            },
          },
          include: { lines: true },
        });
        const { notes, ...snapshot } = quote;
        await tx.job.create({
          data: {
            quoteId: quote.id,
            reference: "FMD-" + randomUUID(),
            category: "MAINTENANCE",
            province: a.property.province.trim().normalize("NFC").toUpperCase(),
            city: a.property.city.trim().normalize("NFC").toUpperCase(),
            location: a.property.address,
            description: a.scope,
            agreement: JSON.stringify(snapshot),
            history: {
              create: { status: "DRAFT", actor: String(req.session.adminId) },
            },
          },
        });
        return tx.maintenanceOccurrence.create({
          data: { agreementId: a.id, period, dueOn, quoteId: quote.id },
        });
      });
      res.json(record);
    })
  );
  r.get(
    "/invoices",
    route(async (req, res) => {
      const f = z
        .object({
          q: z.string().max(150).default(""),
          status: z
            .enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID"])
            .optional(),
          page: z.coerce.number().int().min(0).max(100000).default(0),
        })
        .parse(req.query);
      const invoices = await prisma.invoice.findMany({
        where: {
          status: f.status,
          OR: [
            { number: { contains: f.q } },
            { customerName: { contains: f.q } },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 25,
        skip: f.page * 25,
        select: {
          id: true,
          number: true,
          status: true,
          customerName: true,
          totalCents: true,
          paidCents: true,
        },
      });
      res.json(invoices);
    })
  );
  r.post(
    "/invoices/:id/sandbox-attempts",
    route(async (req, res) => {
      if (!sandboxKey()) {
        res.sendStatus(404);
        return;
      }
      const { requestKey } = z
        .object({ requestKey: required(120) })
        .strict()
        .parse(req.body);
      const a = await prisma.$transaction(async tx => {
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: req.params.id },
        });
        const prior = await tx.paymentAttempt.findUnique({
          where: {
            invoiceId_requestKey: { invoiceId: invoice.id, requestKey },
          },
        });
        if (prior) return prior;
        const cents = invoice.totalCents - invoice.paidCents;
        if (
          !["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) ||
          cents <= 0
        )
          throw new Conflict("Invoice has no payable balance.");
        return tx.paymentAttempt.create({
          data: {
            invoiceId: invoice.id,
            requestKey,
            provider: "SYNTHETIC",
            cents,
          },
        });
      });
      res.json(a);
    })
  );
  r.get(
    "/overview",
    route(async (_req, res) => {
      const [
        requests,
        remote,
        pendingQuotes,
        acceptedQuotes,
        ready,
        scheduled,
        unbilled,
        outstanding,
        paid,
        agreements,
      ] = await prisma.$transaction([
        prisma.booking.count({ where: { status: "PENDING" } }),
        prisma.booking.count({
          where: {
            visitMode: "REMOTE",
            consultation: null,
            status: { notIn: ["CANCELLED", "COMPLETED"] },
          },
        }),
        prisma.quotation.count({
          where: { status: { in: ["DRAFT", "SENT"] } },
        }),
        prisma.quotation.count({ where: { status: "ACCEPTED" } }),
        prisma.job.count({
          where: { status: { in: ["DRAFT", "READY"] }, technicianId: null },
        }),
        prisma.job.count({ where: { status: "SCHEDULED" } }),
        prisma.job.count({
          where: { status: "COMPLETED", quote: { invoice: null } },
        }),
        prisma.invoice.count({
          where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
        }),
        prisma.invoice.count({ where: { status: "PAID" } }),
        prisma.maintenanceAgreement.findMany({
          where: { status: "ACTIVE" },
          select: {
            startOn: true,
            endOn: true,
            months: true,
            scope: true,
            propertyId: true,
            property: { select: { customerId: true } },
            _count: { select: { occurrences: true } },
          },
        }),
      ]);
      const upcoming = agreements
        .map(a => ({
          due: periodDate(a.startOn, a.months, a._count.occurrences),
          end: a.endOn,
          scope: a.scope,
          customerId: a.property.customerId,
          propertyId: a.propertyId,
        }))
        .filter(a => a.due <= a.end)
        .sort((a, b) => a.due.localeCompare(b.due));
      res.json({
        counts: [
          requests,
          remote,
          pendingQuotes,
          acceptedQuotes,
          ready,
          scheduled,
          unbilled,
          outstanding,
          paid,
        ],
        upcoming,
      });
    })
  );
  r.patch(
    "/invoices/:id/draft",
    route(async (req, res) => {
      const data = z
        .object({
          description: required(2000),
          dueOn: z.iso.date(),
          gstRegistration: optional(80),
          qstRegistration: optional(80),
          gstCents: amount.default(0),
          qstCents: amount.default(0),
        })
        .strict()
        .parse(req.body);
      const totalTax = data.gstCents + data.qstCents;
      if (
        (data.gstCents && !data.gstRegistration) ||
        (data.qstCents && !data.qstRegistration)
      )
        throw new Conflict(
          "Enter the verified registration for each applicable tax."
        );
      const updated = await prisma.invoice.updateMany({
        where: {
          id: req.params.id,
          status: "DRAFT",
          ...(totalTax ? { taxCents: totalTax } : {}),
        },
        data,
      });
      if (!updated.count) throw new Conflict("Only drafts can be edited.");
      res.sendStatus(204);
    })
  );
  r.post(
    "/invoices/:id/void",
    route(async (req, res) => {
      const updated = await prisma.invoice.updateMany({
        where: {
          id: req.params.id,
          status: { in: ["DRAFT", "ISSUED"] },
          paidCents: 0,
          payments: { none: {} },
        },
        data: { status: "VOIDED" },
      });
      if (!updated.count)
        throw new Conflict(
          "Only unpaid invoices without receipts can be voided."
        );
      res.sendStatus(204);
    })
  );
  const signInvoice = (payload: string) =>
    createHmac("sha256", process.env.SESSION_SECRET!)
      .update("invoice-view-v1/" + payload)
      .digest("base64url");
  r.post(
    "/invoices/:id/link",
    route(async (req, res) => {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: req.params.id },
      });
      if (!["ISSUED", "PAID", "PARTIALLY_PAID"].includes(invoice.status))
        throw new Conflict("Issue the invoice before sharing.");
      const payload = invoice.id + "." + String(Date.now() + 7 * 86400000);
      res.json({
        path: "/api/invoice-view#" + payload + "." + signInvoice(payload),
      });
    })
  );
  app.post(
    "/api/invoice-view",
    route(async (req, res) => {
      res.set({
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      });
      const { token } = z
        .object({ token: required(220) })
        .strict()
        .parse(req.body);
      const parts = token.split(".");
      const [invoiceId, expires, sig] = parts;
      const expected = Buffer.from(signInvoice(invoiceId + "." + expires));
      if (
        parts.length !== 3 ||
        !/^\d{13}$/.test(expires) ||
        Number(expires) <= Date.now() ||
        Buffer.byteLength(sig) !== expected.length ||
        !timingSafeEqual(expected, Buffer.from(sig))
      ) {
        res.sendStatus(403);
        return;
      }
      res.json(
        await prisma.invoice.findFirstOrThrow({
          where: {
            id: invoiceId,
            status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] },
          },
          select: {
            number: true,
            customerName: true,
            description: true,
            lines: true,
            currency: true,
            subtotalCents: true,
            taxCents: true,
            taxLabel: true,
            gstRegistration: true,
            qstRegistration: true,
            gstCents: true,
            qstCents: true,
            issuedAt: true,
            totalCents: true,
            paidCents: true,
            dueOn: true,
          },
        })
      );
    })
  );
  app.get("/api/invoice-view", (_req, res) => {
    const nonce = randomUUID();
    res.set({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'nonce-" +
        nonce +
        "'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    });
    res.type("html")
      .send(`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FixMyDoor · Invoice / Facture</title><main><h1>FixMyDoor Services</h1><h2>Invoice / Facture</h2><section id="details"></section><button id="print">Print / Imprimer</button></main><script nonce="${nonce}">
    const token=location.hash.slice(1);history.replaceState(null,"",location.pathname);
    document.getElementById("print").onclick=()=>window.print();
    function line(text){const p=document.createElement("p");p.textContent=text;document.getElementById("details").append(p)}
    const cad=cents=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(cents/100);
    fetch(location.pathname,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).then(async r=>{if(!r.ok)throw Error();const v=await r.json();line(v.number);line(v.customerName);line("Issued / Émise "+v.issuedAt.slice(0,10));if(v.gstRegistration)line("GST / TPS "+v.gstRegistration+" "+cad(v.gstCents));if(v.qstRegistration)line("QST / TVQ "+v.qstRegistration+" "+cad(v.qstCents));line(v.description);line("Due / Échéance "+v.dueOn);for(const x of JSON.parse(v.lines))line(x.description+" · "+x.quantity+" × "+cad(x.unitCents));line("Subtotal / Sous-total "+cad(v.subtotalCents));line((v.taxLabel||"Tax / Taxe")+" "+cad(v.taxCents));line("Total CAD "+cad(v.totalCents));line("Paid / Payé "+cad(v.paidCents));line("Balance / Solde "+cad(v.totalCents-v.paidCents));line("Online payment unavailable / Paiement en ligne indisponible")}).catch(()=>line("Link unavailable / Lien indisponible"));
    </script></html>`);
  });
  r.get(
    "/invoices/:id",
    route(async (req, res) => {
      res.json(
        await prisma.invoice.findUniqueOrThrow({
          where: { id: req.params.id },
          include: { payments: { orderBy: { createdAt: "asc" } }, quote: { select: { depositRequest: { select: { amountCents: true, dueOn: true } } } } },
        })
      );
    })
  );
  r.post(
    "/invoices",
    route(async (req, res) => {
      const { quoteId, dueOn } = z
        .object({ quoteId: id, dueOn: z.iso.date() })
        .strict()
        .parse(req.body);
      const invoice = await prisma.$transaction(async tx => {
        const quote = await tx.quotation.findUniqueOrThrow({
          where: { id: quoteId },
          include: {
            customer: { select: { name: true } },
            lines: { orderBy: { position: "asc" } },
          },
        });
        if (quote.status !== "ACCEPTED")
          throw new Conflict("Accept the quotation before billing.");
        return tx.invoice.upsert({
          where: { quoteId },
          update: {},
          create: {
            number: "INV-" + randomUUID().toUpperCase(),
            quoteId,
            customerName: quote.customer.name,
            description: quote.description,
            lines: JSON.stringify(
              quote.lines.map(({ kind, description, quantity, unitCents }) => ({
                kind,
                description,
                quantity,
                unitCents,
              }))
            ),
            subtotalCents: quote.subtotalCents,
            taxLabel: quote.taxLabel,
            taxCents: quote.taxCents,
            totalCents: quote.totalCents,
            dueOn,
            createdBy: String(req.session.adminId),
          },
        });
      });
      res.json(invoice);
    })
  );
  r.post(
    "/invoices/:id/offline",
    route(async (req, res) => {
      const input = z
        .object({
          method: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]),
          reference: required(100),
          cents: z.number().int().positive().max(2000000000),
        })
        .strict()
        .parse(req.body);
      await prisma.$transaction(async tx => {
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: req.params.id },
        });
        const previous = await tx.invoicePayment.findUnique({
          where: {
            method_reference: {
              method: input.method,
              reference: input.reference,
            },
          },
        });
        if (previous) {
          if (
            previous.invoiceId === invoice.id &&
            previous.cents === input.cents
          )
            return;
          throw new Conflict("Payment reference already recorded.");
        }
        if (
          !["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) ||
          input.cents > invoice.totalCents - invoice.paidCents
        )
          throw new Conflict(
            "Payment exceeds the open balance or invoice is closed."
          );
        const paidCents = invoice.paidCents + input.cents;
        const saved = await tx.invoice.updateMany({
          where: {
            id: invoice.id,
            status: invoice.status,
            paidCents: invoice.paidCents,
          },
          data: {
            paidCents,
            status:
              paidCents === invoice.totalCents ? "PAID" : "PARTIALLY_PAID",
          },
        });
        if (!saved.count)
          throw new Conflict("Invoice changed. Refresh the balance.");
        await tx.invoicePayment.create({
          data: {
            ...input,
            invoiceId: invoice.id,
            actor: String(req.session.adminId),
          },
        });
      });
      res.sendStatus(204);
    })
  );
  r.post(
    "/invoices/:id/issue",
    route(async (req, res) => {
      const result = await prisma.invoice.updateMany({
        where: { id: req.params.id, status: "DRAFT" },
        data: { status: "ISSUED", issuedAt: new Date() },
      });
      if (!result.count)
        throw new Conflict("Only draft invoices can be issued.");
      res.sendStatus(204);
    })
  );
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
      res.status(201).json(
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
          consultation: true,
          quotations: {
            where: { status: "ACCEPTED" },
            select: {
              id: true,
              description: true,
              totalCents: true,
              invoice: { select: { id: true, status: true } },
            },
          },
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
            property: { select: { id: true, label: true } }, depositRequest: { select: { amountCents: true, dueOn: true, agreedTermsReference: true } },
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
