import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

process.env.NODE_ENV = "test";
delete process.env.STAGING_MODE;
delete process.env.PORTAL_PUBLIC_BASE_URL;
const dbDir = mkdtempSync(path.join(os.tmpdir(), "fmd-portal-"));
const dbFile = path.join(dbDir, "portal.sqlite");
const prismaRelative = path.relative(path.resolve("prisma"), dbFile).replaceAll("\\", "/");
process.env.DATABASE_URL = `file:${prismaRelative}`;

const { prisma } = await import("../server/prisma.ts");
const { registerPortal } = await import("../server/portal.ts");
const { registerCommercial } = await import("../server/commercial.ts");
const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
const migrationDb = new DatabaseSync(dbFile);
for (const name of migrations) migrationDb.exec(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
// The deployed application intentionally reconciles legacy SQLite installations
// at startup; these objects predate Prisma's checked-in migration history.
const bookingColumns = new Set(migrationDb.prepare('PRAGMA table_info("Booking")').all().map(column => column.name));
if (!bookingColumns.has("clientId")) migrationDb.exec('ALTER TABLE "Booking" ADD COLUMN "clientId" TEXT');
if (!bookingColumns.has("emailOptOut")) migrationDb.exec('ALTER TABLE "Booking" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT 0');
migrationDb.exec(`CREATE TABLE IF NOT EXISTS "SmsDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT,
  "bookingId" TEXT,
  "clientName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" DATETIME
)`);
migrationDb.close();

function businessRecord(id, name, category, email) {
  return prisma.customer.create({ data: { id, name, category, email, phone: "5145550101", preferredContactMethod: "Email", notes: "STAFF PRIVATE NOTES" } });
}
async function addProperty(id, customerId, label) {
  return prisma.property.create({ data: { id, customerId, label, type: "Residential", address: `${id} Example Street`, city: "Montréal", province: "QC", postalCode: "H2X 1Y4", country: "Canada", accessInstructions: "STAFF PRIVATE ACCESS", notes: "STAFF PROPERTY NOTES" } });
}
async function addQuote(id, customerId, bookingId, status, description) {
  return prisma.quotation.create({ data: { id, customerId, bookingId, description, notes: "PRIVATE QUOTATION MARGIN", status, expiresOn: "2099-01-01", taxLabel: "QC tax", taxCents: 100, subtotalCents: 1000, totalCents: 1100, lines: { create: [{ id: `${id}-line`, position: 0, kind: "Labour", description: "Service labour", quantity: 1, unitCents: 1000 }] } } });
}
async function addTechnician(id, name, email, status = "APPROVED") {
  const technician = await prisma.technician.create({ data: { id, name, phone: "5145550200", email, province: "QC", city: "MONTREAL", experience: "Synthetic fixture", notes: "PRIVATE TECH NOTES", available: true, status } });
  if (status === "APPROVED") await prisma.serviceGrant.create({ data: { id: `${id}-grant`, technicianId: id, category: "MAINTENANCE", province: "QC", city: "MONTREAL", evidence: "synthetic verification", expiresOn: "2099-01-01", reviewer: "fixture-staff" } });
  return technician;
}

await prisma.$connect();
const individualA = await businessRecord("customer-a", "Customer A", "Individual", "customer.a@example.invalid");
const individualB = await businessRecord("customer-b", "Customer B", "Individual", "customer.b@example.invalid");
const businessA = await businessRecord("business-a", "Business A", "Business", "office.a@example.invalid");
const businessB = await businessRecord("business-b", "Business B", "Business", "office.b@example.invalid");
const propertyA = await addProperty("property-a", individualA.id, "Customer home");
const propertyB = await addProperty("property-b", individualB.id, "Other home");
const businessPropertyA = await addProperty("property-business-a", businessA.id, "Business site A");
await addProperty("property-business-b", businessB.id, "Business site B");
const bookingA = await prisma.booking.create({ data: { id: "booking-a", name: individualA.name, phone: individualA.phone, email: individualA.email, address: propertyA.address, city: propertyA.city, country: propertyA.country, repairType: "Furniture assembly", message: "Please assemble a cabinet", status: "CONFIRMED", customerToken: "legacy-customer-a-token", adminNotes: "PRIVATE ADMIN BOOKING NOTES", customerId: individualA.id, propertyId: propertyA.id } });
await prisma.booking.create({ data: { id: "booking-b", name: individualB.name, phone: individualB.phone, email: individualB.email, address: propertyB.address, city: propertyB.city, country: propertyB.country, repairType: "Door repair", message: "Other customer request", status: "CONFIRMED", customerToken: "legacy-customer-b-token", customerId: individualB.id, propertyId: propertyB.id } });
const customerQuote = await addQuote("quote-customer-a", individualA.id, bookingA.id, "SENT", "Customer A service quote");
const businessQuote = await addQuote("quote-business-a", businessA.id, null, "SENT", "Business A agreement quote");
await prisma.invoice.create({ data: { id: "invoice-business-a", number: "INV-PORTAL-A", quoteId: businessQuote.id, customerName: businessA.name, description: "Business A invoice", lines: "[]", subtotalCents: 1000, taxLabel: "QC tax", taxCents: 100, totalCents: 1100, dueOn: "2099-01-01", status: "PARTIALLY_PAID", issuedAt: new Date(), paidCents: 250, createdBy: "synthetic-staff" } });
for (const data of [{ invoiceId: "invoice-business-a", method: "CASH", cents: 200, reference: "SYNTHETIC-CASH", actor: "synthetic-staff" }, { invoiceId: "invoice-business-a", method: "SYNTHETIC", cents: 50, reference: "SANDBOX", actor: "sandbox-adapter" }]) await prisma.invoicePayment.create({ data });
const technicianA = await addTechnician("technician-a", "Technician A", "tech.a@example.invalid");
const technicianB = await addTechnician("technician-b", "Technician B", "tech.b@example.invalid");
const technicianQuoteA = await addQuote("quote-tech-a", individualA.id, bookingA.id, "ACCEPTED", "Technician A assigned work");
const technicianQuoteB = await addQuote("quote-tech-b", individualB.id, "booking-b", "ACCEPTED", "Technician B assigned work");
const futureStart = new Date(Date.now() + 86_400_000);
const futureEnd = new Date(Date.now() + 90_000_000);
const jobA = await prisma.job.create({ data: { id: "job-a", reference: "FMD-PORTAL-A", quoteId: technicianQuoteA.id, agreement: "{}", category: "MAINTENANCE", province: "QC", city: "MONTREAL", location: propertyA.address, description: "Perform an authorized maintenance task", internalNotes: "PRIVATE QUOTE MARGIN AND STAFF NOTES", status: "SCHEDULED", technicianId: technicianA.id, startsAt: futureStart, endsAt: futureEnd } });
const jobB = await prisma.job.create({ data: { id: "job-b", reference: "FMD-PORTAL-B", quoteId: technicianQuoteB.id, agreement: "{}", category: "MAINTENANCE", province: "QC", city: "MONTREAL", location: propertyB.address, description: "Another customer's work", internalNotes: "DO NOT DISCLOSE", status: "SCHEDULED", technicianId: technicianB.id, startsAt: futureStart, endsAt: futureEnd } });

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(session({ name: "fixmydoor.sid", secret: "synthetic-test-session-secret-32-bytes", resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: "lax", secure: false } }));
const staffAuth = (req, res, next) => {
  if (req.get("x-test-staff") !== "synthetic-staff-only") { res.sendStatus(401); return; }
  req.session.adminId = "synthetic-staff";
  next();
};
registerCommercial(app, staffAuth);
const recoveryLinks = new Map();
registerPortal(app, staffAuth, undefined, async (email, url) => { recoveryLinks.set(email, url); return true; });
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function call(route, { method = "GET", body, cookie, staff = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (staff) headers["x-test-staff"] = "synthetic-staff-only";
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  const setCookie = response.headers.get("set-cookie");
  return { status: response.status, data, cookie: setCookie?.split(";")[0], contentType: response.headers.get("content-type") };
}
async function invite(kind, entityId, email, organizationRole) {
  const result = await call("/api/admin/portal/invitations", { method: "POST", staff: true, body: { kind, entityId, ...(email ? { email } : {}), ...(organizationRole ? { organizationRole } : {}) } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.status, "COPY_LINK");
  const token = new URL(result.data.invitationUrl).hash.slice(1);
  const record = await prisma.portalInvitation.findUnique({ where: { id: result.data.id } });
  assert.notEqual(record.tokenHash, token, "bearer invitation token must only be stored as a hash");
  const accepted = await call("/api/portal/invitations/accept", { method: "POST", body: { token, name: "Synthetic Portal User", password: "Portal-User-2026!Secure" } });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.data));
  return accepted.data.email;
}
async function login(email) {
  const result = await call("/api/portal/auth/login", { method: "POST", body: { email, password: "Portal-User-2026!Secure" } });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.cookie;
}

test("customer, organization, technician, AI and membership portal workflows enforce account boundaries", async t => {
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
    rmSync(dbDir, { recursive: true, force: true });
  });

  assert.equal((await call("/api/portal/dashboard")).status, 401, "anonymous users cannot access portal data");

  const customerEmail = await invite("CUSTOMER", individualA.id);
  const customerCookie = await login(customerEmail);
  const depositPath = "/api/admin/commercial/quotes/quote-tech-a/deposit-request";
  const depositTerms = { terms: { type: "PERCENTAGE", basisPoints: 2500 }, dueOn: "2099-01-01", agreedTermsReference: "Synthetic agreed terms" };
  assert.equal((await call(depositPath, { method: "PUT", body: depositTerms })).status, 401);
  const requestedDeposit = await call(depositPath, { method: "PUT", body: depositTerms, staff: true });
  assert.equal(requestedDeposit.status, 200);
  assert.ok(requestedDeposit.data.amountCents > 0);
  assert.deepEqual((await call(depositPath, { method: "PUT", body: depositTerms, staff: true })).data, requestedDeposit.data);
  assert.equal((await call(depositPath, { method: "PUT", body: { ...depositTerms, dueOn: "2099-02-01" }, staff: true })).status, 409);
  assert.equal((await call("/api/admin/commercial/quotes/quote-customer-a/deposit-request", { method: "PUT", body: depositTerms, staff: true })).status, 409);
  const customerDashboard = await call("/api/portal/dashboard", { cookie: customerCookie });
  assert.deepEqual(customerDashboard.data.quotations.find(quote => quote.id === "quote-tech-a").depositRequest, { amountCents: requestedDeposit.data.amountCents, dueOn: depositTerms.dueOn });
  assert.equal(customerDashboard.status, 200);
  assert.deepEqual(customerDashboard.data.bookings.map(booking => booking.id), ["booking-a"]);
  assert.deepEqual(customerDashboard.data.quotations.map(quote => quote.id).sort(), [customerQuote.id, technicianQuoteA.id].sort());
  assert.equal(JSON.stringify(customerDashboard.data).includes("customer.b@example.invalid"), false);
  assert.equal(JSON.stringify(customerDashboard.data).includes("PRIVATE ADMIN BOOKING NOTES"), false);
  assert.equal(JSON.stringify(customerDashboard.data).includes("PRIVATE QUOTATION MARGIN"), false);
  assert.equal(JSON.stringify(customerDashboard.data).includes("STAFF PRIVATE NOTES"), false);
  assert.equal(JSON.stringify(customerDashboard.data).includes("STAFF PRIVATE ACCESS"), false);
  assert.equal(customerDashboard.data.invoices.every(invoice => invoice.onlinePaymentAvailable === false), true);

  const acceptedQuote = await call(`/api/portal/quotations/${customerQuote.id}/decision`, { method: "POST", cookie: customerCookie, body: { decision: "ACCEPTED", version: customerQuote.version } });
  assert.equal(acceptedQuote.status, 204);
  assert.equal((await prisma.quotation.findUnique({ where: { id: customerQuote.id } })).status, "ACCEPTED");
  const crossCustomerRequest = await call("/api/portal/requests", { method: "POST", cookie: customerCookie, body: { propertyId: propertyB.id, service: "Door repair", visitMode: "ONSITE" } });
  assert.equal(crossCustomerRequest.status, 409);
  const customerRequest = await call("/api/portal/requests", { method: "POST", cookie: customerCookie, body: { propertyId: propertyA.id, service: "Furniture touch-up", visitMode: "ONSITE", message: "Synthetic new service request" } });
  assert.equal(customerRequest.status, 201, JSON.stringify(customerRequest.data));
  const createdBooking = await prisma.booking.findUnique({ where: { id: customerRequest.data.id } });
  assert.equal(createdBooking.customerId, individualA.id);
  assert.equal(createdBooking.propertyId, propertyA.id);
  assert.equal(createdBooking.requestedByPortalAccountId, (await prisma.portalAccount.findUnique({ where: { email: customerEmail } })).id);
  await call("/api/portal/communication-preferences", { method: "PUT", cookie: customerCookie, body: { emailMarketing: false, smsMarketing: false } }).then(result => assert.equal(result.status, 200));
  assert.equal(await prisma.communicationConsent.count({ where: { customerId: individualA.id, purpose: "MARKETING", granted: true } }), 0);

  const orgAResult = await call("/api/admin/portal/organizations", { method: "POST", staff: true, body: { customerId: businessA.id, name: "Business A Organization", externalId: "FMD-BIZ-A", email: "office.a@example.invalid", phone: "5145550101", status: "ACTIVE" } });
  const orgBResult = await call("/api/admin/portal/organizations", { method: "POST", staff: true, body: { customerId: businessB.id, name: "Business B Organization", externalId: "FMD-BIZ-B", email: "office.b@example.invalid", phone: "5145550102", status: "ACTIVE" } });
  assert.equal(orgAResult.status, 201); assert.equal(orgBResult.status, 201);
  const requesterEmail = await invite("ORGANIZATION", orgAResult.data.id, "requester.a@example.invalid", "REQUESTER");
  const requesterCookie = await login(requesterEmail);
  const otherOrganization = await call(`/api/portal/dashboard?organizationId=${orgBResult.data.id}`, { cookie: requesterCookie });
  assert.equal(otherOrganization.status, 409);
  const wrongProperty = await call("/api/portal/requests", { method: "POST", cookie: requesterCookie, body: { organizationId: orgAResult.data.id, propertyId: "property-business-b", service: "Maintenance" } });
  assert.equal(wrongProperty.status, 409);
  const businessRequest = await call("/api/portal/requests", { method: "POST", cookie: requesterCookie, body: { organizationId: orgAResult.data.id, propertyId: businessPropertyA.id, service: "Office maintenance", visitMode: "ONSITE" } });
  assert.equal(businessRequest.status, 201, JSON.stringify(businessRequest.data));
  const requesterDashboard = await call(`/api/portal/dashboard?organizationId=${orgAResult.data.id}`, { cookie: requesterCookie });
  assert.equal(requesterDashboard.status, 200);
  assert.deepEqual(requesterDashboard.data.bookings.map(booking => booking.id), [businessRequest.data.id]);

  const billingEmail = await invite("ORGANIZATION", orgAResult.data.id, "billing.a@example.invalid", "BILLING");
  const billingCookie = await login(billingEmail);
  const billingDashboard = await call(`/api/portal/dashboard?organizationId=${orgAResult.data.id}`, { cookie: billingCookie });
  assert.equal(billingDashboard.status, 200);
  assert.equal(billingDashboard.data.properties.length, 0);
  assert.equal(billingDashboard.data.bookings.length, 0);
  assert.equal(billingDashboard.data.jobs.length, 0);
  const businessInvoice = billingDashboard.data.invoices.find(invoice => invoice.id === "invoice-business-a");
  assert.deepEqual(businessInvoice.payments.map(({ reference, cents, actor }) => ({ reference, cents, actor })), [{ reference: "SYNTHETIC-CASH", cents: 200, actor: undefined }]);
  assert.ok(customerDashboard.data.invoices.every(invoice => invoice.id !== businessInvoice.id));
  const billingRequest = await call("/api/portal/requests", { method: "POST", cookie: billingCookie, body: { organizationId: orgAResult.data.id, propertyId: businessPropertyA.id, service: "Maintenance" } });
  assert.equal(billingRequest.status, 409);

  const aiResult = await call(`/api/admin/portal/ai/bookings/${bookingA.id}/classify`, { method: "POST", staff: true, body: {} });
  assert.equal(aiResult.status, 200);
  assert.equal(aiResult.data.provider, "deterministic-demo");
  assert.equal(aiResult.data.modelClaim, false);
  assert.equal(aiResult.data.nextAction.includes("Staff review required"), true);
  const aiRecord = await prisma.aIInteraction.findUnique({ where: { id: aiResult.data.id } });
  assert.equal(aiRecord.output.includes("customer.a@example.invalid"), false);
  assert.equal((await call(`/api/admin/portal/ai/${aiResult.data.id}/review`, { method: "POST", staff: true, body: { decision: "ACKNOWLEDGED" } })).status, 204);

  const techEmail = await invite("TECHNICIAN", technicianA.id);
  const techCookie = await login(techEmail);
  const techDashboard = await call("/api/portal/dashboard", { cookie: techCookie });
  assert.equal(techDashboard.status, 200);
  assert.deepEqual(techDashboard.data.jobs.map(job => job.id), [jobA.id]);
  assert.equal(JSON.stringify(techDashboard.data).includes("DO NOT DISCLOSE"), false);
  assert.equal(JSON.stringify(techDashboard.data).includes("PRIVATE QUOTE MARGIN AND STAFF NOTES"), false);
  assert.equal(JSON.stringify(techDashboard.data).includes("customer.b@example.invalid"), false);
  const scheduled = techDashboard.data.jobs[0];
  assert.equal((await call(`/api/portal/technician/jobs/${jobA.id}/response`, { method: "POST", cookie: techCookie, body: { response: "ACCEPTED", version: scheduled.version } })).status, 204);
  assert.equal((await call(`/api/portal/technician/jobs/${jobA.id}/start`, { method: "POST", cookie: techCookie, body: { version: scheduled.version + 1 } })).status, 204);
  const invalidPhoto = await call(`/api/portal/jobs/${jobA.id}/photos`, { method: "POST", cookie: techCookie, body: { kind: "AFTER", image: "data:image/png;base64,SGVsbG8=" } });
  assert.equal(invalidPhoto.status, 400);
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 120, g: 80, b: 40 } } }).png().toBuffer();
  const uploadedPhoto = await call(`/api/portal/jobs/${jobA.id}/photos`, { method: "POST", cookie: techCookie, body: { kind: "AFTER", image: `data:image/png;base64,${png.toString("base64")}` } });
  assert.equal(uploadedPhoto.status, 201, JSON.stringify(uploadedPhoto.data));
  const privatePhoto = await call(`/api/portal/jobs/${jobA.id}/photos/${uploadedPhoto.data.id}`, { cookie: techCookie });
  assert.equal(privatePhoto.status, 200);
  assert.equal(privatePhoto.contentType, "image/jpeg");
  const techJobAfterStart = await prisma.job.findUnique({ where: { id: jobA.id } });
  const completion = await call(`/api/portal/technician/jobs/${jobA.id}/complete`, { method: "POST", cookie: techCookie, body: { version: techJobAfterStart.version, workPerformed: "Completed the synthetic maintenance work.", materials: "One synthetic fastener", customerSummary: "The fixture work is complete.", labourMinutes: 45 } });
  assert.equal(completion.status, 204);
  assert.equal((await prisma.job.findUnique({ where: { id: jobA.id } })).status, "COMPLETED");
  const duplicateCompletion = await call(`/api/portal/technician/jobs/${jobA.id}/complete`, { method: "POST", cookie: techCookie, body: { version: techJobAfterStart.version, workPerformed: "Duplicate completion", materials: "", customerSummary: "Duplicate", labourMinutes: 1 } });
  assert.equal(duplicateCompletion.status, 409);

  const techBEmail = await invite("TECHNICIAN", technicianB.id);
  const techBCookie = await login(techBEmail);
  const techBDashboard = await call("/api/portal/dashboard", { cookie: techBCookie });
  assert.deepEqual(techBDashboard.data.jobs.map(job => job.id), [jobB.id]);
  const crossTechPhoto = await call(`/api/portal/jobs/${jobA.id}/photos/${uploadedPhoto.data.id}`, { cookie: techBCookie });
  assert.equal(crossTechPhoto.status, 404);
  const techBAccount = await prisma.portalAccount.findUnique({ where: { email: techBEmail } });
  const membershipSave = await call(`/api/admin/portal/technicians/${technicianB.id}/membership`, { method: "PUT", staff: true, body: { plan: "Founding Provider", status: "ACTIVE", billingPeriod: "NONE", startsOn: "", renewsOn: "", includedBenefits: ["Profile listing"], details: "Synthetic non-billing record" } });
  assert.equal(membershipSave.status, 200);
  const membershipDashboard = await call("/api/portal/dashboard", { cookie: techBCookie });
  assert.equal(membershipDashboard.data.membership.status, "ACTIVE");
  assert.equal(membershipDashboard.data.membership.billingPeriod, "NONE");
  assert.equal(await prisma.technicianMembershipEvent.count({ where: { membershipId: (await prisma.technicianMembership.findUnique({ where: { technicianId: technicianB.id } })).id } }), 1);
  await prisma.technician.update({ where: { id: technicianB.id }, data: { status: "SUSPENDED" } });
  assert.equal((await call("/api/portal/me", { cookie: techBCookie })).status, 401);
  assert.equal((await prisma.portalAccount.findUnique({ where: { id: techBAccount.id } })).status, "ACTIVE", "technician status alone blocks the portal without changing account status");

  await t.test("verified Stripe payment settles once and leaves incorrect attempts untouched", async () => {
    const { settleVerifiedStripeCheckout } = await import("../server/stripe-test-settlement.ts");
    const attempt = await prisma.paymentAttempt.create({ data: {
      invoiceId: "invoice-business-a", requestKey: "synthetic-stripe-settlement",
      provider: "STRIPE_TEST", cents: 400, checkoutSessionId: "cs_test_Settlement",
    } });
    const event = { eventId: "evt_Settlement", attemptId: attempt.id, sessionId: "cs_test_Settlement", paymentIntentId: "pi_Settlement", cents: 400, kind: "SUCCEEDED" };
    await assert.rejects(settleVerifiedStripeCheckout({ ...event, cents: 399 }), /does not match/);
    assert.equal(await settleVerifiedStripeCheckout(event), "recorded");
    assert.equal(await settleVerifiedStripeCheckout(event), "duplicate");
    assert.equal(await settleVerifiedStripeCheckout({ ...event, eventId: "evt_AnotherDelivery" }), "already-settled");
    assert.equal(await settleVerifiedStripeCheckout({ ...event, eventId: "evt_LateExpiry", kind: "EXPIRED", paymentIntentId: null }), "already-settled");
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: "invoice-business-a" } })).paidCents, 650);
    assert.equal(await prisma.invoicePayment.count({ where: { method: "STRIPE_TEST", reference: "pi_Settlement" } }), 1);
  });

  await t.test("password recovery is enumerating-safe, one-time, expiring and revokes existing sessions", async () => {
    const unknown = await call("/api/portal/auth/recovery", { method: "POST", body: { email: "unknown@example.invalid" } });
    const requested = await call("/api/portal/auth/recovery", { method: "POST", body: { email: customerEmail } });
    assert.equal(unknown.status, 202);
    assert.deepEqual(requested.data, unknown.data, "unknown and eligible addresses receive the same response");
    const recoveryUrl = recoveryLinks.get(customerEmail);
    assert.ok(recoveryUrl);
    const token = new URL(recoveryUrl).hash.slice(1);
    const customerAccount = await prisma.portalAccount.findUniqueOrThrow({ where: { email: customerEmail } });
    const resetRecord = await prisma.portalPasswordReset.findFirstOrThrow({ where: { accountId: customerAccount.id } });
    assert.notEqual(resetRecord.tokenHash, token, "only a hash of the bearer recovery token is stored");
    assert.ok(resetRecord.expiresAt.getTime() - Date.now() <= 30 * 60 * 1000);

    const changed = await call("/api/portal/auth/recovery/complete", { method: "POST", body: { token, password: "Portal-Recovered-2026!Secure" } });
    assert.equal(changed.status, 204);
    assert.equal((await call("/api/portal/me", { cookie: customerCookie })).status, 401, "existing sessions fail after credential version changes");
    assert.equal((await call("/api/portal/auth/login", { method: "POST", body: { email: customerEmail, password: "Portal-User-2026!Secure" } })).status, 401);
    assert.equal((await call("/api/portal/auth/login", { method: "POST", body: { email: customerEmail, password: "Portal-Recovered-2026!Secure" } })).status, 200);
    assert.equal((await call("/api/portal/auth/recovery/complete", { method: "POST", body: { token, password: "Portal-Recovered-2026!Secure" } })).status, 409, "recovery tokens are single-use");

    await call("/api/portal/auth/recovery", { method: "POST", body: { email: customerEmail } });
    const expiredToken = new URL(recoveryLinks.get(customerEmail)).hash.slice(1);
    const expiredRecord = await prisma.portalPasswordReset.findFirstOrThrow({ where: { accountId: customerAccount.id }, orderBy: { createdAt: "desc" } });
    await prisma.portalPasswordReset.update({ where: { id: expiredRecord.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call("/api/portal/auth/recovery/complete", { method: "POST", body: { token: expiredToken, password: "Portal-Another-2026!Secure" } })).status, 409, "expired recovery tokens cannot change credentials");
  });
});
