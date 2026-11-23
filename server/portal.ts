import express, { type Request, type RequestHandler, type Response } from "express";
import rateLimit from "express-rate-limit";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./auth";
import { emailService, getPublicBaseUrl } from "./email";
import { decodeDataUrl } from "./attachments";
import { isStagingMode } from "./staging";
import { getClientIdForContact, toBooking } from "./bookings";

const emailSchema = z.email().trim().max(180).transform(value => value.toLowerCase());
const passwordSchema = z.string().min(12).max(100).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);
const organizationRoles = ["ORG_ADMIN", "PROPERTY_MANAGER", "REQUESTER", "BILLING"] as const;
function portalBaseUrl() {
  if (isStagingMode && process.env.RAILWAY_PUBLIC_DOMAIN) {
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
    return new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`).origin;
  }
  if (process.env.NODE_ENV !== "production") return process.env.PORTAL_PUBLIC_BASE_URL || "http://localhost:4173";
  return getPublicBaseUrl();
}
const emailLink = (token: string) => `${portalBaseUrl()}/portal/invite#${token}`;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

class PortalDenied extends Error {}
const deny: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new PortalDenied(message);
};

const safeRoute = (action: (req: Request, res: Response) => Promise<unknown>): RequestHandler => async (req, res) => {
  try {
    await action(req, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Check the supplied fields." });
      return;
    }
    if (error instanceof PortalDenied) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") { res.sendStatus(404); return; }
      if (error.code === "P2002" || error.code === "P2034" || error.code === "P2028") {
        res.status(409).json({ error: "The record changed. Refresh and retry." });
        return;
      }
    }
    res.status(500).json({ error: "The requested portal action failed." });
  }
};

function auditData(actorType: string, actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, string | number | boolean> = {}) {
  return { id: randomUUID(), actorType, actorId, action, entityType, entityId, metadata: JSON.stringify(metadata) };
}

async function accountFor(req: Request) {
  if (!req.session.portalAccountId) return null;
  const account = await prisma.portalAccount.findUnique({
    where: { id: req.session.portalAccountId },
    include: {
      customer: true,
      technician: { select: { id: true, name: true, email: true, phone: true, city: true, province: true, experience: true, available: true, status: true } },
      organizationMemberships: {
        where: { status: "ACTIVE", revokedAt: null },
        include: { organization: { include: { customer: { select: { id: true } } } } },
      },
    },
  });
  if (!account || account.status !== "ACTIVE") return null;
  if (account.kind === "TECHNICIAN" && account.technician?.status !== "APPROVED") return null;
  if (account.kind === "ORGANIZATION" && !account.organizationMemberships.length) return null;
  return account;
}

async function activeScope(account: NonNullable<Awaited<ReturnType<typeof accountFor>>>, requestedOrganizationId?: string, canRequest = false) {
  if (account.kind === "CUSTOMER") {
    deny(account.customerId, "Customer account is not linked.");
    if (!requestedOrganizationId) return { customerId: account.customerId, organizationId: null, role: "CUSTOMER" as const };
  }
  const membership = account.organizationMemberships.find(item =>
    requestedOrganizationId ? item.organizationId === requestedOrganizationId : true
  );
  if (membership) {
    deny(membership.organization.status === "ACTIVE", "Organization access is unavailable.");
    if (canRequest) deny(["ORG_ADMIN", "PROPERTY_MANAGER", "REQUESTER"].includes(membership.role), "This organization role cannot submit service requests.");
    return { customerId: membership.organization.customerId, organizationId: membership.organizationId, role: membership.role };
  }
  deny(account.kind === "CUSTOMER" && !requestedOrganizationId, "Organization access is unavailable.");
  throw new PortalDenied("Organization access is unavailable.");
}

function privateJson(res: Response) {
  res.set({ "Cache-Control": "private, no-store, no-cache, must-revalidate", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet", "X-Content-Type-Options": "nosniff" });
}

function classifyRequest(repairType: string, message: string) {
  const input = `${repairType} ${message}`.normalize("NFKC").toLocaleLowerCase("en-CA");
  const has = (terms: string[]) => terms.some(term => input.includes(term));
  const category = has(["electrical", "wiring", "outlet", "breaker"])
    ? "ELECTRICAL"
    : has(["locksmith", "rekey", "lock", "key", "deadbolt"])
      ? "LOCKSMITH"
      : has(["alarm", "security system", "access control"])
        ? "SECURITY_SYSTEM"
        : has(["assemble", "assembly", "furniture", "cabinet", "shelf"])
          ? "ASSEMBLY" : "MAINTENANCE";
  return {
    provider: "deterministic-demo",
    suggestedCategory: category,
    confidence: "rule-based, uncalibrated",
    nextAction: "Staff review required before eligibility, scheduling, pricing or customer communication.",
    modelClaim: false,
  };
}

async function hasCurrentTechnicianGrant(db: Pick<Prisma.TransactionClient, "serviceGrant">, technicianId: string, job: { category: string; province: string; city: string }) {
  if (!["ASSEMBLY", "MAINTENANCE"].includes(job.category)) return false;
  return (await db.serviceGrant.count({ where: { technicianId, category: job.category, province: job.province, city: job.city, expiresOn: { gte: new Date().toISOString().slice(0, 10) } } })) > 0;
}

export function registerPortal(app: express.Express, requireAdmin: RequestHandler, sendInvitation = (to: string, url: string, kind: "CUSTOMER" | "TECHNICIAN" | "ORGANIZATION") => emailService.sendPortalInvitation(to, url, kind)) {
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });
  const invitationAcceptLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });
  const invitationCreateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });
  const portal = express.Router();
  app.use("/api/portal", portal);
  portal.use((_req, res, next) => { privateJson(res); next(); });

  portal.post("/invitations/accept", invitationAcceptLimit, safeRoute(async (req, res) => {
    const input = z.object({ token: z.string().min(40).max(120), name: z.string().trim().min(1).max(120), password: passwordSchema }).strict().parse(req.body);
    const now = new Date();
    const invitation = await prisma.portalInvitation.findUnique({ where: { tokenHash: tokenHash(input.token) } });
    deny(invitation && !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > now, "This invitation is invalid or expired.");
    if (invitation.kind === "TECHNICIAN") {
      const tech = await prisma.technician.findUnique({ where: { id: invitation.technicianId ?? "" }, select: { status: true, email: true } });
      deny(tech?.status === "APPROVED" && tech.email.toLowerCase() === invitation.email.toLowerCase(), "Technician access is not currently approved.");
    }
    if (invitation.kind === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({ where: { id: invitation.customerId ?? "" }, select: { email: true, category: true } });
      deny(customer?.category === "Individual" && customer.email.toLowerCase() === invitation.email.toLowerCase(), "Customer invitation is no longer valid.");
    }
    if (invitation.kind === "ORGANIZATION") {
      const organization = await prisma.organization.findUnique({ where: { id: invitation.organizationId ?? "" }, select: { status: true } });
      deny(organization?.status === "ACTIVE" && invitation.organizationRole && organizationRoles.includes(invitation.organizationRole as typeof organizationRoles[number]), "Organization invitation is no longer valid.");
    }
    const passwordHash = await hashPassword(input.password);
    const account = await prisma.$transaction(async tx => {
      const used = await tx.portalInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { acceptedAt: now } });
      deny(used.count === 1, "This invitation was already used or expired.");
      deny(!(await tx.portalAccount.findUnique({ where: { email: invitation.email } })), "An account already exists for this email address.");
      const created = await tx.portalAccount.create({ data: {
        email: invitation.email,
        name: input.name,
        passwordHash,
        kind: invitation.kind,
        ...(invitation.kind === "CUSTOMER" ? { customerId: invitation.customerId } : {}),
        ...(invitation.kind === "TECHNICIAN" ? { technicianId: invitation.technicianId } : {}),
      } });
      if (invitation.kind === "ORGANIZATION") {
        await tx.organizationMembership.create({ data: { accountId: created.id, organizationId: invitation.organizationId!, role: invitation.organizationRole!, invitedBy: invitation.createdBy } });
      }
      await tx.auditEvent.create({ data: auditData("portal", created.id, "INVITATION_ACCEPTED", "portal_account", created.id, { kind: invitation.kind }) });
      return created;
    });
    res.status(201).json({ success: true, email: account.email, kind: account.kind });
  }));

  portal.post("/auth/login", authLimit, safeRoute(async (req, res) => {
    const input = z.object({ email: emailSchema, password: z.string().min(1).max(100) }).strict().parse(req.body);
    const account = await prisma.portalAccount.findUnique({ where: { email: input.email }, include: { technician: { select: { status: true } }, organizationMemberships: { where: { status: "ACTIVE", revokedAt: null }, include: { organization: { select: { status: true } } } } } });
    const matches = account ? await verifyPassword(input.password, account.passwordHash) : false;
    const eligible = !!account && account.status === "ACTIVE" &&
      (account.kind !== "TECHNICIAN" || account.technician?.status === "APPROVED") &&
      (account.kind !== "ORGANIZATION" || account.organizationMemberships.some(m => m.organization.status === "ACTIVE"));
    if (!matches || !eligible) { res.status(401).json({ error: "Email or password is incorrect, or portal access is inactive." }); return; }
    await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.portalAccountId = account.id;
    req.session.portalKind = account.kind as "CUSTOMER" | "TECHNICIAN" | "ORGANIZATION";
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    await prisma.portalAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    res.json({ success: true, kind: account.kind });
  }));

  portal.post("/auth/logout", (req, res) => req.session.destroy(error => {
    if (error) { res.sendStatus(500); return; }
    res.clearCookie("fixmydoor.sid", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    res.sendStatus(204);
  }));

  portal.use(async (req, res, next) => {
    const account = await accountFor(req).catch(() => null);
    if (!account) { res.status(401).json({ error: "Portal sign-in required." }); return; }
    next();
  });

  portal.get("/me", safeRoute(async (req, res) => {
    const account = await accountFor(req);
    if (!account) { res.sendStatus(401); return; }
    res.json({ id: account.id, name: account.name, email: account.email, kind: account.kind, organizations: account.organizationMemberships.map(m => ({ id: m.organization.id, name: m.organization.name, role: m.role })) });
  }));

  portal.get("/dashboard", safeRoute(async (req, res) => {
    const account = await accountFor(req);
    if (!account) { res.sendStatus(401); return; }
    if (account.kind === "TECHNICIAN") {
      const assignedJobs = await prisma.job.findMany({ where: { technicianId: account.technicianId }, include: { photos: { select: { id: true, kind: true } }, quote: { include: { customer: { select: { name: true, phone: true } }, property: { select: { address: true, city: true, province: true } }, booking: { select: { phone: true, address: true, appointmentTime: true } } } } }, orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }] });
      const jobs = [] as typeof assignedJobs;
      for (const job of assignedJobs) if (await hasCurrentTechnicianGrant(prisma, account.technicianId!, job)) jobs.push(job);
      const membership = await prisma.technicianMembership.findUnique({ where: { technicianId: account.technicianId! }, select: { plan: true, status: true, billingPeriod: true, startsOn: true, renewsOn: true, includedBenefits: true } });
      res.json({ kind: "TECHNICIAN", profile: account.technician && { id: account.technician.id, name: account.technician.name, phone: account.technician.phone, city: account.technician.city, province: account.technician.province, experience: account.technician.experience, available: account.technician.available }, membership, jobs: jobs.map(job => ({ id: job.id, reference: job.reference, category: job.category, status: job.status, technicianResponse: job.technicianResponse, startsAt: job.startsAt, endsAt: job.endsAt, location: job.location, description: job.description, version: job.version, customer: { name: job.quote.customer.name, phone: job.quote.customer.phone || job.quote.booking?.phone || "" }, property: job.quote.property ? { address: job.quote.property.address, city: job.quote.property.city, province: job.quote.property.province } : null, photos: job.photos })) });
      return;
    }
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const scope = await activeScope(account, organizationId);
    const requesterOnly = scope.role === "REQUESTER";
    const billingOnly = scope.role === "BILLING";
    const quotationWhere = { customerId: scope.customerId, ...(requesterOnly ? { booking: { requestedByPortalAccountId: account.id } } : {}) };
    const bookingWhere = { customerId: scope.customerId, ...(requesterOnly ? { requestedByPortalAccountId: account.id } : {}) };
    const [customer, properties, bookings, quotations, invoices, jobs, agreements, consents] = await Promise.all([
      scope.organizationId ? prisma.organization.findUnique({ where: { id: scope.organizationId }, select: { id: true, name: true, email: true, phone: true, status: true } }) : prisma.customer.findUnique({ where: { id: scope.customerId }, select: { id: true, name: true, email: true, phone: true, preferredContactMethod: true, category: true } }),
      billingOnly ? Promise.resolve([]) : prisma.property.findMany({ where: { customerId: scope.customerId }, select: { id: true, label: true, type: true, address: true, city: true, province: true, postalCode: true, country: true }, orderBy: { label: "asc" } }),
      billingOnly ? Promise.resolve([]) : prisma.booking.findMany({ where: bookingWhere, select: { id: true, visitMode: true, name: true, repairType: true, status: true, preferredDate: true, appointmentTime: true, createdAt: true, propertyId: true }, orderBy: { createdAt: "desc" } }),
      prisma.quotation.findMany({ where: quotationWhere, select: { id: true, bookingId: true, propertyId: true, description: true, status: true, currency: true, expiresOn: true, subtotalCents: true, taxLabel: true, taxCents: true, totalCents: true, version: true, lines: { orderBy: { position: "asc" }, select: { id: true, kind: true, description: true, quantity: true, unitCents: true } }, job: { select: { id: true, reference: true, status: true, startsAt: true, endsAt: true, customerSummary: true, photos: { select: { id: true, kind: true } } } } }, orderBy: { createdAt: "desc" } }),
      prisma.invoice.findMany({ where: { quote: quotationWhere }, select: { id: true, number: true, description: true, lines: true, subtotalCents: true, taxLabel: true, taxCents: true, gstCents: true, qstCents: true, totalCents: true, paidCents: true, currency: true, status: true, dueOn: true, issuedAt: true, updatedAt: true }, orderBy: { createdAt: "desc" } }),
      billingOnly ? Promise.resolve([]) : prisma.job.findMany({ where: { quote: { customerId: scope.customerId, ...(requesterOnly ? { booking: { requestedByPortalAccountId: account.id } } : {}) } }, select: { id: true, reference: true, category: true, status: true, startsAt: true, endsAt: true, customerSummary: true, photos: { select: { id: true, kind: true } } }, orderBy: { createdAt: "desc" } }),
      billingOnly || requesterOnly ? Promise.resolve([]) : prisma.maintenanceAgreement.findMany({ where: { property: { customerId: scope.customerId } }, select: { id: true, propertyId: true, scope: true, startOn: true, endOn: true, months: true, cents: true, status: true, occurrences: { select: { period: true, dueOn: true, quote: { select: { status: true } } }, orderBy: { dueOn: "asc" } } }, orderBy: { createdAt: "desc" } }),
      scope.organizationId ? Promise.resolve([]) : prisma.communicationConsent.findMany({ where: { customerId: scope.customerId, purpose: "MARKETING" }, orderBy: { capturedAt: "desc" }, select: { channel: true, granted: true, capturedAt: true } }),
    ]);
    if (!customer) { res.sendStatus(404); return; }
    const currentConsent: Record<string, { granted: boolean; capturedAt: Date }> = {};
    for (const consent of consents) if (!currentConsent[consent.channel]) currentConsent[consent.channel] = { granted: consent.granted, capturedAt: consent.capturedAt };
    res.json({ kind: account.kind, scope, customer, properties, bookings, quotations, invoices: invoices.map(i => ({ ...i, balanceCents: Math.max(0, i.totalCents - i.paidCents), onlinePaymentAvailable: false })), jobs, agreements, communicationPreferences: currentConsent, memberships: account.organizationMemberships.map(m => ({ id: m.organization.id, name: m.organization.name, role: m.role })) });
  }));

  portal.patch("/profile", safeRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().max(35), preferredContactMethod: z.enum(["Email", "Phone", "SMS", "Email or phone"]) }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account?.kind === "CUSTOMER" && account.customerId, "A personal customer account is required.");
    const customer = await prisma.customer.update({ where: { id: account.customerId! }, data: { name: input.name, phone: input.phone, preferredContactMethod: input.preferredContactMethod }, select: { id: true, name: true, phone: true, preferredContactMethod: true } });
    await prisma.auditEvent.create({ data: auditData("portal", account.id, "PROFILE_UPDATED", "customer", customer.id) });
    res.json(customer);
  }));

  portal.put("/communication-preferences", safeRoute(async (req, res) => {
    const input = z.object({ emailMarketing: z.boolean(), smsMarketing: z.boolean() }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account?.kind === "CUSTOMER" && account.customerId, "A personal customer account is required.");
    await prisma.$transaction(async tx => {
      for (const [channel, granted] of [["EMAIL", input.emailMarketing], ["SMS", input.smsMarketing]] as const) {
        await tx.communicationConsent.create({ data: { id: randomUUID(), customerId: account.customerId!, channel, purpose: "MARKETING", granted, source: "CUSTOMER_PORTAL" } });
      }
      await tx.auditEvent.create({ data: auditData("portal", account.id, "MARKETING_PREFERENCES_UPDATED", "customer", account.customerId!, { email: input.emailMarketing, sms: input.smsMarketing }) });
    });
    res.json({ emailMarketing: input.emailMarketing, smsMarketing: input.smsMarketing, promotionalDeliveryEnabled: false });
  }));

  portal.post("/requests", safeRoute(async (req, res) => {
    const input = z.object({ organizationId: z.string().max(100).optional(), propertyId: z.string().min(1).max(100), service: z.string().trim().min(2).max(160), visitMode: z.enum(["ONSITE", "REMOTE"]).default("ONSITE"), preferredDate: z.iso.date().optional(), message: z.string().trim().max(5000).default("") }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account && account.kind !== "TECHNICIAN", "Technician accounts cannot submit customer service requests.");
    const scope = await activeScope(account, input.organizationId, true);
    const property = await prisma.property.findFirst({ where: { id: input.propertyId, customerId: scope.customerId }, select: { id: true, address: true, city: true, country: true } });
    deny(property, "Choose a property authorized for this account.");
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: scope.customerId }, select: { name: true, email: true, phone: true } });
    const customerToken = randomBytes(32).toString("base64url");
    const booking = await prisma.booking.create({ data: { name: customer.name, phone: customer.phone, email: customer.email, address: property.address, city: property.city, country: property.country, repairType: input.service, visitMode: input.visitMode, preferredDate: input.preferredDate, message: input.message, customerConsent: false, status: "PENDING", customerToken, clientId: getClientIdForContact({ phone: customer.phone, email: customer.email }), customerId: scope.customerId, propertyId: property.id, requestedByPortalAccountId: account.id } });
    await prisma.auditEvent.create({ data: auditData("portal", account.id, "SERVICE_REQUEST_CREATED", "booking", booking.id, { visitMode: input.visitMode, organizationId: scope.organizationId ?? "" }) });
    if (process.env.NODE_ENV === "production" && !isStagingMode) {
      try { await emailService.sendBookingConfirmation(toBooking(booking)); } catch { /* The durable request remains available in the portal; mail is retried by existing operations. */ }
    }
    res.status(201).json({ id: booking.id, status: booking.status, trackingUrl: `/track/${customerToken}` });
  }));

  portal.post("/quotations/:id/decision", safeRoute(async (req, res) => {
    const input = z.object({ organizationId: z.string().max(100).optional(), decision: z.enum(["ACCEPTED", "DECLINED"]), version: z.number().int().positive() }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account && account.kind !== "TECHNICIAN", "Technician accounts cannot respond to quotations.");
    const scope = await activeScope(account, input.organizationId);
    const today = new Date().toISOString().slice(0, 10);
    const updated = await prisma.quotation.updateMany({ where: { id: req.params.id, customerId: scope.customerId, status: "SENT", expiresOn: { gte: today }, version: input.version }, data: { status: input.decision, version: { increment: 1 } } });
    deny(updated.count === 1, "This quotation is unavailable, expired or already answered.");
    await prisma.auditEvent.create({ data: auditData("portal", account.id, "QUOTATION_DECISION", "quotation", req.params.id, { decision: input.decision }) });
    res.sendStatus(204);
  }));

  portal.patch("/organizations/:id", safeRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(160), email: emailSchema, phone: z.string().trim().max(35) }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account, "Portal sign-in required.");
    const membership = account?.organizationMemberships.find(m => m.organizationId === req.params.id && m.role === "ORG_ADMIN");
    deny(membership, "Organization administrator access required.");
    const organization = await prisma.organization.update({ where: { id: req.params.id }, data: input, select: { id: true, name: true, email: true, phone: true, status: true } });
    await prisma.auditEvent.create({ data: auditData("portal", account.id, "ORGANIZATION_PROFILE_UPDATED", "organization", organization.id) });
    res.json(organization);
  }));

  portal.patch("/technician/profile", safeRoute(async (req, res) => {
    const input = z.object({ phone: z.string().trim().min(7).max(35), city: z.string().trim().min(2).max(100), province: z.string().trim().min(2).max(100), experience: z.string().trim().max(2000), available: z.boolean() }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account?.kind === "TECHNICIAN" && account.technicianId, "Approved technician account required.");
    const profile = await prisma.technician.update({ where: { id: account.technicianId! }, data: input, select: { id: true, phone: true, city: true, province: true, experience: true, available: true } });
    await prisma.auditEvent.create({ data: auditData("technician", account.id, "PROFILE_UPDATED", "technician", profile.id) });
    res.json(profile);
  }));

  portal.post("/technician/jobs/:id/response", safeRoute(async (req, res) => {
    const { response, version } = z.object({ response: z.enum(["ACCEPTED", "DECLINED"]), version: z.number().int().positive() }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account?.kind === "TECHNICIAN" && account.technicianId, "Approved technician account required.");
    await prisma.$transaction(async tx => {
      const job = await tx.job.findFirst({ where: { id: req.params.id, technicianId: account.technicianId }, select: { id: true, status: true, version: true, technicianId: true, startsAt: true, endsAt: true } });
      deny(job && job.version === version && ["ASSIGNED", "SCHEDULED"].includes(job.status), "This assignment cannot be changed.");
      if (response === "ACCEPTED") deny(await hasCurrentTechnicianGrant(tx, account.technicianId!, await tx.job.findUniqueOrThrow({ where: { id: job.id }, select: { category: true, province: true, city: true } })), "Current verified service eligibility is required to accept this assignment.");
      if (response === "DECLINED") {
        const changed = await tx.job.updateMany({ where: { id: job.id, technicianId: account.technicianId, version }, data: { status: "READY", technicianId: null, startsAt: null, endsAt: null, technicianResponse: "DECLINED", technicianResponseAt: new Date(), version: { increment: 1 } } });
        deny(changed.count === 1, "The assignment changed. Refresh and retry.");
        await tx.jobEvent.create({ data: { jobId: job.id, status: "READY", technicianId: account.technicianId, actor: account.id } });
      } else {
        const changed = await tx.job.updateMany({ where: { id: job.id, technicianId: account.technicianId, version }, data: { technicianResponse: "ACCEPTED", technicianResponseAt: new Date(), version: { increment: 1 } } });
        deny(changed.count === 1, "The assignment changed. Refresh and retry.");
        await tx.jobEvent.create({ data: { jobId: job.id, status: job.status, technicianId: account.technicianId, actor: account.id, startsAt: job.startsAt, endsAt: job.endsAt } });
      }
      await tx.auditEvent.create({ data: auditData("technician", account.id, `ASSIGNMENT_${response}`, "job", job.id) });
    });
    res.sendStatus(204);
  }));

  portal.post("/technician/jobs/:id/start", safeRoute(async (req, res) => {
    const { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account?.kind === "TECHNICIAN" && account.technicianId, "Approved technician account required.");
    await prisma.$transaction(async tx => {
      const job = await tx.job.findFirst({ where: { id: req.params.id, technicianId: account.technicianId, version, status: "SCHEDULED", technicianResponse: "ACCEPTED" }, select: { id: true, category: true, province: true, city: true } });
      deny(job && await hasCurrentTechnicianGrant(tx, account.technicianId!, job), "Current verified service eligibility is required to start this assignment.");
      const changed = await tx.job.updateMany({ where: { id: job.id, technicianId: account.technicianId, version, status: "SCHEDULED", technicianResponse: "ACCEPTED" }, data: { status: "IN_PROGRESS", version: { increment: 1 } } });
      deny(changed.count === 1, "Accept the scheduled assignment before starting it.");
      await tx.jobEvent.create({ data: { jobId: req.params.id, status: "IN_PROGRESS", technicianId: account.technicianId, actor: account.id } });
      await tx.auditEvent.create({ data: auditData("technician", account.id, "JOB_STARTED", "job", req.params.id) });
    });
    res.sendStatus(204);
  }));

  portal.post("/technician/jobs/:id/complete", safeRoute(async (req, res) => {
    const input = z.object({ version: z.number().int().positive(), workPerformed: z.string().trim().min(5).max(4000), materials: z.string().trim().max(2000), customerSummary: z.string().trim().min(5).max(2000), labourMinutes: z.number().int().min(0).max(100000) }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account?.kind === "TECHNICIAN" && account.technicianId, "Approved technician account required.");
    await prisma.$transaction(async tx => {
      const job = await tx.job.findFirst({ where: { id: req.params.id, technicianId: account.technicianId, version: input.version, status: "IN_PROGRESS", technicianResponse: "ACCEPTED" }, select: { id: true, category: true, province: true, city: true } });
      deny(job && await hasCurrentTechnicianGrant(tx, account.technicianId!, job), "Current verified service eligibility is required to complete this assignment.");
      const changed = await tx.job.updateMany({ where: { id: job.id, technicianId: account.technicianId, version: input.version, status: "IN_PROGRESS", technicianResponse: "ACCEPTED" }, data: { status: "COMPLETED", workPerformed: input.workPerformed, materials: input.materials, customerSummary: input.customerSummary, labourMinutes: input.labourMinutes, completedAt: new Date(), version: { increment: 1 } } });
      deny(changed.count === 1, "This job is not in progress or was already submitted.");
      await tx.jobEvent.create({ data: { jobId: req.params.id, status: "COMPLETED", technicianId: account.technicianId, actor: account.id } });
      await tx.auditEvent.create({ data: auditData("technician", account.id, "JOB_COMPLETION_SUBMITTED", "job", req.params.id) });
    });
    res.sendStatus(204);
  }));

  portal.post("/jobs/:id/photos", safeRoute(async (req, res) => {
    const input = z.object({ kind: z.enum(["BEFORE", "AFTER"]), image: z.string().max(2_400_064) }).strict().parse(req.body);
    const account = await accountFor(req);
    deny(account && account.kind === "TECHNICIAN", "Only an assigned technician can upload work photographs.");
    let bytes: Buffer;
    try { bytes = await decodeDataUrl(input.image); } catch { res.status(400).json({ error: "Unsupported or invalid image." }); return; }
    const saved = await prisma.$transaction(async tx => {
      const job = await tx.job.findUnique({ where: { id: req.params.id }, include: { quote: { select: { customerId: true } } } });
      deny(job, "Job not found.");
      const technicianId = account.technicianId;
      const authorized = account.kind === "TECHNICIAN" && technicianId !== null && job.technicianId === technicianId && job.technicianResponse === "ACCEPTED" && ["SCHEDULED", "IN_PROGRESS"].includes(job.status) && await hasCurrentTechnicianGrant(tx, technicianId, job);
      deny(authorized, "This job is not available to this account.");
      deny(input.kind !== "AFTER" || job.status === "IN_PROGRESS" || job.status === "COMPLETED", "After-work photos are available during or after work.");
      deny(await tx.jobPhoto.count({ where: { jobId: job.id } }) < 12, "Photo limit reached.");
      const photo = await tx.jobPhoto.create({ data: { id: randomUUID(), jobId: job.id, kind: input.kind, image: bytes }, select: { id: true, kind: true } });
      await tx.auditEvent.create({ data: auditData(account.kind === "TECHNICIAN" ? "technician" : "portal", account.id, "JOB_PHOTO_ADDED", "job", job.id, { kind: input.kind }) });
      return photo;
    });
    res.status(201).json(saved);
  }));

  portal.get("/jobs/:id/photos/:photoId", safeRoute(async (req, res) => {
    const account = await accountFor(req);
    if (!account) { res.sendStatus(401); return; }
    const photo = await prisma.jobPhoto.findFirst({ where: { id: req.params.photoId, jobId: req.params.id }, include: { job: { include: { quote: { select: { customerId: true } } } } } });
    if (!photo) { res.sendStatus(404); return; }
    let authorized = account.kind === "TECHNICIAN" && photo.job.technicianId === account.technicianId;
    if (account.kind !== "TECHNICIAN") {
      try { authorized = (await activeScope(account, typeof req.query.organizationId === "string" ? req.query.organizationId : undefined)).customerId === photo.job.quote.customerId; } catch { authorized = false; }
    }
    if (!authorized) { res.sendStatus(404); return; }
    res.type("image/jpeg").set("Cache-Control", "private, no-store").send(Buffer.from(photo.image));
  }));

  const admin = express.Router();
  app.use("/api/admin/portal", admin);
  admin.use((_req, res, next) => { privateJson(res); next(); }, requireAdmin);

  admin.get("/directory", safeRoute(async (_req, res) => {
    const [customers, technicians, organizations, accounts] = await Promise.all([
      prisma.customer.findMany({ select: { id: true, name: true, category: true, email: true }, orderBy: { name: "asc" } }),
      prisma.technician.findMany({ select: { id: true, name: true, email: true, status: true, membership: { select: { plan: true, status: true, billingPeriod: true, startsOn: true, renewsOn: true, includedBenefits: true } } }, orderBy: { name: "asc" } }),
      prisma.organization.findMany({ select: { id: true, customerId: true, name: true, email: true, status: true, memberships: { select: { id: true, role: true, status: true, account: { select: { email: true, name: true } } } } }, orderBy: { name: "asc" } }),
      prisma.portalAccount.findMany({ select: { id: true, email: true, name: true, kind: true, status: true }, orderBy: { createdAt: "desc" }, take: 250 }),
    ]);
    res.json({ customers, technicians, organizations, accounts });
  }));

  admin.post("/organizations", safeRoute(async (req, res) => {
    const input = z.object({ customerId: z.string().min(1).max(100), name: z.string().trim().min(2).max(160), externalId: z.string().trim().max(100).optional(), email: z.union([emailSchema, z.literal("")]), phone: z.string().trim().max(35), status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]).default("ACTIVE") }).strict().parse(req.body);
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId }, select: { id: true, category: true } });
    deny(customer?.category === "Business", "Choose a business customer record.");
    const organization = await prisma.organization.upsert({ where: { customerId: input.customerId }, create: { id: randomUUID(), customerId: input.customerId, name: input.name, externalId: input.externalId || null, email: input.email, phone: input.phone, status: input.status }, update: { name: input.name, externalId: input.externalId || null, email: input.email, phone: input.phone, status: input.status }, select: { id: true, customerId: true, name: true, externalId: true, email: true, phone: true, status: true } });
    await prisma.auditEvent.create({ data: auditData("admin", String(req.session.adminId), "ORGANIZATION_SAVED", "organization", organization.id) });
    res.status(201).json(organization);
  }));

  admin.post("/invitations", invitationCreateLimit, safeRoute(async (req, res) => {
    const input = z.object({ kind: z.enum(["CUSTOMER", "TECHNICIAN", "ORGANIZATION"]), entityId: z.string().min(1).max(100), email: z.union([emailSchema, z.literal("")]).optional(), organizationRole: z.enum(organizationRoles).optional() }).strict().parse(req.body);
    const creator = String(req.session.adminId);
    let email: string;
    let customerId: string | undefined;
    let technicianId: string | undefined;
    let organizationId: string | undefined;
    if (input.kind === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({ where: { id: input.entityId }, select: { id: true, email: true, category: true } });
      deny(customer?.category === "Individual" && customer.email.includes("@"), "Only an individual customer with a contact email can be invited this way.");
      email = customer.email.toLowerCase(); customerId = customer.id;
    } else if (input.kind === "TECHNICIAN") {
      const technician = await prisma.technician.findUnique({ where: { id: input.entityId }, select: { id: true, email: true, status: true } });
      deny(technician?.status === "APPROVED" && technician.email.includes("@"), "Only an approved technician with a contact email can be invited.");
      email = technician.email.toLowerCase(); technicianId = technician.id;
    } else {
      const organization = await prisma.organization.findUnique({ where: { id: input.entityId }, select: { id: true, status: true } });
      deny(organization?.status === "ACTIVE" && input.email && input.email.includes("@") && input.organizationRole, "Choose an active organization, invitation email and role.");
      email = input.email!.toLowerCase(); organizationId = organization.id;
    }
    const existing = await prisma.portalAccount.findUnique({ where: { email } });
    if (existing) {
      deny(input.kind === "ORGANIZATION" && existing.kind === "ORGANIZATION", "A portal account already uses this email.");
      const membership = await prisma.organizationMembership.upsert({ where: { accountId_organizationId: { accountId: existing.id, organizationId: organizationId! } }, create: { accountId: existing.id, organizationId: organizationId!, role: input.organizationRole!, invitedBy: creator }, update: { role: input.organizationRole!, status: "ACTIVE", revokedAt: null, invitedBy: creator } });
      await prisma.auditEvent.create({ data: auditData("admin", creator, "ORGANIZATION_ACCESS_GRANTED", "organization_membership", membership.id, { role: membership.role }) });
      res.status(200).json({ membershipId: membership.id, status: "ACTIVE", email });
      return;
    }
    const rawToken = randomBytes(32).toString("base64url");
    const invitation = await prisma.$transaction(async tx => {
      await tx.portalInvitation.updateMany({ where: { email, kind: input.kind, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.portalInvitation.create({ data: { id: randomUUID(), email, kind: input.kind, customerId, technicianId, organizationId, organizationRole: input.organizationRole, tokenHash: tokenHash(rawToken), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), createdBy: creator } });
    });
    let sent = false;
    if (process.env.NODE_ENV === "production" && !isStagingMode) {
      try { sent = await sendInvitation(email, emailLink(rawToken), input.kind); } catch { sent = false; }
    }
    if (!sent && process.env.NODE_ENV === "production" && !isStagingMode) {
      await prisma.portalInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
      res.status(503).json({ error: "Invitation email could not be sent. No active invitation was left behind." });
      return;
    }
    await prisma.auditEvent.create({ data: auditData("admin", creator, "PORTAL_INVITATION_CREATED", "portal_invitation", invitation.id, { kind: input.kind, emailDelivered: sent }) });
    res.status(201).json({ id: invitation.id, status: sent ? "SENT" : "COPY_LINK", expiresAt: invitation.expiresAt, ...(sent ? {} : { invitationUrl: emailLink(rawToken) }) });
  }));

  admin.get("/invitations", safeRoute(async (_req, res) => {
    res.json(await prisma.portalInvitation.findMany({ select: { id: true, email: true, kind: true, organizationRole: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }));
  }));
  admin.post("/invitations/:id/revoke", safeRoute(async (req, res) => {
    const changed = await prisma.portalInvitation.updateMany({ where: { id: req.params.id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    deny(changed.count === 1, "Invitation is already used, expired or revoked.");
    await prisma.auditEvent.create({ data: auditData("admin", String(req.session.adminId), "PORTAL_INVITATION_REVOKED", "portal_invitation", req.params.id) });
    res.sendStatus(204);
  }));
  admin.post("/accounts/:id/suspend", safeRoute(async (req, res) => {
    const { status } = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict().parse(req.body);
    const account = await prisma.portalAccount.update({ where: { id: req.params.id }, data: { status }, select: { id: true, kind: true, status: true } });
    await prisma.auditEvent.create({ data: auditData("admin", String(req.session.adminId), `PORTAL_ACCOUNT_${status}`, "portal_account", account.id) });
    res.json(account);
  }));
  admin.post("/memberships/:id/revoke", safeRoute(async (req, res) => {
    const changed = await prisma.organizationMembership.updateMany({ where: { id: req.params.id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
    deny(changed.count === 1, "Organization access is already inactive.");
    await prisma.auditEvent.create({ data: auditData("admin", String(req.session.adminId), "ORGANIZATION_ACCESS_REVOKED", "organization_membership", req.params.id) });
    res.sendStatus(204);
  }));

  admin.put("/technicians/:id/membership", safeRoute(async (req, res) => {
    const input = z.object({ plan: z.string().trim().min(2).max(100), status: z.enum(["INACTIVE", "ACTIVE", "SUSPENDED", "CANCELLED"]), billingPeriod: z.enum(["NONE", "MONTHLY", "ANNUAL"]), startsOn: z.union([z.iso.date(), z.literal("")]), renewsOn: z.union([z.iso.date(), z.literal("")]), includedBenefits: z.array(z.string().trim().min(1).max(160)).max(20), details: z.string().trim().max(1000).default("") }).strict().parse(req.body);
    const technician = await prisma.technician.findUnique({ where: { id: req.params.id }, select: { id: true } });
    deny(technician, "Technician not found.");
    const actor = String(req.session.adminId);
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.technicianMembership.findUnique({ where: { technicianId: req.params.id } });
      const data = { plan: input.plan, status: input.status, billingPeriod: input.billingPeriod, startsOn: input.startsOn || null, renewsOn: input.renewsOn || null, includedBenefits: JSON.stringify(input.includedBenefits) };
      const membership = existing
        ? await tx.technicianMembership.update({ where: { id: existing.id }, data })
        : await tx.technicianMembership.create({ data: { ...data, technicianId: req.params.id } });
      await tx.technicianMembershipEvent.create({ data: { id: randomUUID(), membershipId: membership.id, action: input.status, actor, details: input.details } });
      await tx.auditEvent.create({ data: auditData("admin", actor, "TECHNICIAN_MEMBERSHIP_UPDATED", "technician_membership", membership.id, { status: input.status, billingPeriod: input.billingPeriod }) });
      return membership;
    });
    res.json({ id: result.id, plan: result.plan, status: result.status, billingPeriod: result.billingPeriod, startsOn: result.startsOn, renewsOn: result.renewsOn, includedBenefits: JSON.parse(result.includedBenefits) });
  }));

  admin.get("/ai/bookings", safeRoute(async (_req, res) => {
    const records = await prisma.booking.findMany({ select: { id: true, repairType: true, status: true, createdAt: true, message: true }, orderBy: { createdAt: "desc" }, take: 40 });
    res.json(records.map(({ message, ...booking }) => ({ ...booking, summary: (message || "").slice(0, 240) })));
  }));
  admin.post("/ai/bookings/:id/classify", safeRoute(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { id: true, repairType: true, message: true } });
    if (!booking) { res.sendStatus(404); return; }
    const suggestion = classifyRequest(booking.repairType, booking.message || "");
    const saved = await prisma.aIInteraction.create({ data: { id: randomUUID(), purpose: "SERVICE_REQUEST_TRIAGE", entityType: "booking", entityId: booking.id, provider: suggestion.provider, output: JSON.stringify(suggestion) } });
    await prisma.auditEvent.create({ data: auditData("admin", String(req.session.adminId), "AI_SUGGESTION_CREATED", "booking", booking.id, { provider: suggestion.provider }) });
    res.json({ id: saved.id, ...suggestion });
  }));
  admin.post("/ai/:id/review", safeRoute(async (req, res) => {
    const { decision } = z.object({ decision: z.enum(["ACKNOWLEDGED", "DISMISSED"]) }).strict().parse(req.body);
    const saved = await prisma.aIInteraction.update({ where: { id: req.params.id }, data: { reviewedAt: new Date(), reviewedBy: `${req.session.adminId}:${decision}` }, select: { id: true, entityType: true, entityId: true } });
    await prisma.auditEvent.create({ data: auditData("admin", String(req.session.adminId), `AI_SUGGESTION_${decision}`, saved.entityType, saved.entityId) });
    res.sendStatus(204);
  }));
}
