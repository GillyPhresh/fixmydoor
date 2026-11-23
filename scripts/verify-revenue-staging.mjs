import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
const base = "https://fixmydoor-staging-staging.up.railway.app";
const env = process.env;
for (const name of [
  "STAGING_BASIC_AUTH_USERNAME",
  "STAGING_BASIC_AUTH_PASSWORD",
  "DEFAULT_ADMIN_USERNAME",
  "DEFAULT_ADMIN_PASSWORD",
  "FMD_SANDBOX_SIGNING_SECRET",
])
  assert.ok(env[name], name + " is required");
const headers = {
  Authorization:
    "Basic " +
    Buffer.from(
      env.STAGING_BASIC_AUTH_USERNAME + ":" + env.STAGING_BASIC_AUTH_PASSWORD
    ).toString("base64"),
  "Content-Type": "application/json",
};
async function request(path, method = "GET", body, expected = 200, extra = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { ...headers, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(r.status, expected, method + " " + path.split("?")[0]);
  return r;
}
const login = await request("/api/auth/login", "POST", {
  username: env.DEFAULT_ADMIN_USERNAME,
  password: env.DEFAULT_ADMIN_PASSWORD,
});
headers.cookie = login.headers
  .getSetCookie()
  .map(s => s.split(";")[0])
  .join("; ");
const root = "/api/admin/commercial";
const api = async (p, m, b, status) => await request(root + p, m, b, status);
const name = "Revenue QA " + randomUUID(),
  person = {
    name,
    email: "revenue@example.invalid",
    phone: "5145550100",
    preferredContactMethod: "Phone",
  };
const c = await (
  await api(
    "/customers",
    "POST",
    { ...person, category: "Business", notes: "Synthetic" },
    201
  )
).json();
const site = await (
  await api(
    "/customers/" + c.id + "/properties",
    "POST",
    {
      label: "Synthetic facility",
      type: "Commercial",
      address: "123 Test",
      city: "Montréal",
      province: "QC",
      country: "CA",
    },
    201
  )
).json();
await request(
  "/api/bookings",
  "POST",
  {
    ...person,
    repairType: "Door",
    visitMode: "REMOTE",
    address: "",
    customerConsent: true,
    securityAnswer: "verified-customer",
    submittedAt: new Date(Date.now() - 5000).toISOString(),
    message: "Synthetic remote assessment",
  },
  201
);
const [b] = await (
  await api("/bookings?remote=yes&q=" + encodeURIComponent(name))
).json();
const assoc = { customerId: c.id, propertyId: site.id };
await api("/bookings/" + b.id + "/link", "PUT", assoc, 204);
const quote = await (
  await api(
    "/quotes",
    "POST",
    {
      ...assoc,
      bookingId: b.id,
      description: "Synthetic QA",
      taxLabel: "",
      taxCents: 0,
      notes: "PRIVATE",
      expiresOn: "2099-01-01",
      lines: [
        {
          kind: "Labour",
          description: "Assessment",
          quantity: 1,
          unitCents: 3703,
        },
      ],
    },
    201
  )
).json();
for (const [i, status] of ["SENT", "ACCEPTED"].entries())
  await api(
    "/quotes/" + quote.id + "/status",
    "PATCH",
    { status, version: i + 1 },
    204
  );
const bill = { quoteId: quote.id, dueOn: "2099-01-01" };
const invoice = await (await api("/invoices", "POST", bill)).json(),
  url = "/invoices/" + invoice.id;
assert.equal(
  (await (await api("/invoices", "POST", bill)).json()).id,
  invoice.id
);
await api(url + "/issue", "POST", {}, 204);
const share = await (await api(url + "/link", "POST", {})).json();
const token = share.path.split("#")[1];
await request("/api/invoice-view", "POST", { token: token + "x" }, 403);
const attempt = await (
  await api(url + "/sandbox-attempts", "POST", { requestKey: "staging-smoke" })
).json();
async function event(id, kind, cents, valid = true) {
  const data = { id, kind, cents, currency: "CAD", attemptId: attempt.id },
    timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac(
    "sha256",
    valid ? env.FMD_SANDBOX_SIGNING_SECRET : "invalid"
  )
    .update(timestamp + "." + JSON.stringify(data))
    .digest("hex");
  await request(
    "/api/payment-sandbox/events",
    "POST",
    data,
    valid ? 204 : 403,
    { "x-fmd-timestamp": timestamp, "x-fmd-signature": signature }
  );
}
const eventId = randomUUID();
await event(eventId, "SUCCEEDED", 3703, false);
await event(eventId, "SUCCEEDED", 3703);
await event(eventId, "SUCCEEDED", 3703);
assert.equal((await (await api(url)).json()).payments.length, 1);
const consult = "/bookings/" + b.id + "/consultation";
await api(
  consult,
  "POST",
  {
    quoteId: quote.id,
    serviceType: "Assessment",
    availability: "Weekdays",
    durationMinutes: 30,
    requiresPayment: true,
    scheduledAt: "2090-01-01T12:00:00Z",
  },
  201
);
await event(randomUUID(), "REFUND", 300);
const view = await (
  await request("/api/invoice-view", "POST", { token })
).json();
assert.equal(view.paidCents, 3403);
assert.equal(view.createdBy, undefined);
const agreement = await (
  await api(
    "/properties/" + site.id + "/agreements",
    "POST",
    {
      scope: "Synthetic maintenance",
      authorization: "Synthetic agreement",
      months: 1,
      startOn: "2028-01-31",
      endOn: "2028-12-31",
      cents: 5000,
    },
    201
  )
).json();
const path = "/agreements/" + agreement.id + "/occurrences",
  occ = await (await api(path, "POST", { period: 0 })).json();
assert.equal(
  (await (await api(path, "POST", { period: 0 })).json()).id,
  occ.id
);
assert.equal(
  (await (await api(path, "POST", { period: 1 })).json()).dueOn,
  "2028-02-29"
);
const history = await (
  await api("/properties/" + site.id + "/agreements")
).json();
const job = history[0].occurrences[0].quote.job;
assert.equal(job.status, "DRAFT");
const tech = await (
  await api(
    "/delivery/technicians",
    "POST",
    {
      name,
      phone: person.phone,
      email: person.email,
      city: "Montréal",
      province: "QC",
      available: true,
    },
    201
  )
).json();
const staffPath = "/delivery/technicians/" + tech.id;
for (const status of ["PENDING_VERIFICATION", "APPROVED"])
  await api(staffPath + "/review", "POST", { status }, 204);
await api(staffPath + "/grants", "POST", {
  category: "MAINTENANCE",
  city: "Montréal",
  province: "QC",
  scopeReviewed: true,
  licensingReviewed: true,
  evidence: "Synthetic QA",
  expiresOn: "2099-12-31",
});
const actions = "/delivery/jobs/" + job.id + "/actions";
const start = new Date(Date.now() + 7200000),
  end = new Date(start.valueOf() + 1800000);
for (const [i, a] of [
  { status: "READY" },
  { status: "ASSIGNED", technicianId: tech.id },
  {
    status: "SCHEDULED",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  },
  { status: "IN_PROGRESS" },
  {
    status: "COMPLETED",
    workPerformed: "Synthetic inspection",
    customerSummary: "Inspection complete",
    labourMinutes: 30,
  },
].entries())
  await api(actions, "POST", { ...a, version: i + 1 }, 204);
const serviceInvoice = await (
  await api("/invoices", "POST", { quoteId: occ.quoteId, dueOn: "2099-01-01" })
).json();
await api("/invoices/" + serviceInvoice.id + "/issue", "POST", {}, 204);
await api(
  "/invoices/" + serviceInvoice.id + "/offline",
  "POST",
  { method: "CASH", reference: randomUUID(), cents: 5000 },
  204
);
assert.equal(
  (await (await api("/invoices/" + serviceInvoice.id)).json()).status,
  "PAID"
);
const overview = await (await api("/overview")).json();
assert.ok(overview.counts[8] >= 1);
console.log(
  "PASS: staged synthetic intake, quote, invoice, scoped access, signed simulated payment, replay, refund, consultation confirmation, maintenance and dispatch links."
);
