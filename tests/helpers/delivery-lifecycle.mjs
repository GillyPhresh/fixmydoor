import assert from "node:assert/strict";
import sharp from "sharp";
export async function verifyDelivery(call, endpoint, baseline, quoteInput) {
  const request = (path, method, body) =>
    call("/delivery" + path, method, body);
  async function check(response, code) {
    const r = await response;
    assert.equal(r.status, code);
    return r;
  }
  async function json(response, code = 200) {
    return (await check(response, code)).json();
  }
  for (const path of ["/technicians", "/jobs"]) {
    await check(fetch(endpoint + "/delivery" + path), 401);
  }
  const techData = {
    name: "Synthetic Technician",
    phone: "5145550101",
    email: "tech@example.invalid",
    province: "QC",
    city: "Montréal",
    available: true,
    experience: "Assembly",
    notes: "PRIVATE TECH",
  };
  const tech = await json(request("/technicians", "POST", techData), 201),
    technicianId = tech.id;
  assert.equal(tech.status, "APPLICANT");
  const review = status =>
    request("/technicians/" + tech.id + "/review", "POST", { status });
  const coverage = { city: tech.city, province: "QC", category: "ASSEMBLY" };
  const create = (quoteId, category = coverage.category) =>
    request("/jobs", "POST", {
      ...coverage,
      category,
      quoteId,
      location: "Synthetic location",
      internalNotes: "PRIVATE JOB",
    });
  const job = await json(create(baseline.id));
  assert.equal((await json(create(baseline.id))).id, job.id);
  assert.equal(JSON.parse(job.agreement).totalCents, 3703);
  assert.ok(job.reference.startsWith("FMD-"));
  const action = (j, version, status, extra = {}) =>
    request("/jobs/" + j.id + "/actions", "POST", {
      version,
      status,
      ...extra,
    });
  await check(action(job, 1, "COMPLETED"), 409);
  await check(action(job, 1, "READY"), 204);
  await check(action(job, 2, "ASSIGNED", { technicianId }), 409);
  await check(review("APPROVED"), 409);
  await check(review("PENDING_VERIFICATION"), 204);
  await check(review("APPROVED"), 204);
  await check(action(job, 2, "ASSIGNED", { technicianId }), 409);
  const grant = {
    ...coverage,
    expiresOn: "2099-01-01",
    scopeReviewed: true,
    licensingReviewed: true,
    evidence: "Synthetic staff verification",
  };
  await check(
    request("/technicians/" + tech.id + "/grants", "POST", {
      ...grant,
      licensingReviewed: false,
    }),
    400
  );
  await check(
    request("/technicians/" + tech.id + "/grants", "POST", grant),
    200
  );
  assert.deepEqual(
    (await json(request("/jobs/" + job.id + "/eligible"))).map(t => t.id),
    [tech.id]
  );
  await check(action(job, 2, "ASSIGNED", { technicianId }), 204);
  const slot = {
    startsAt: "2090-01-01T08:00:00.000Z",
    endsAt: "2090-01-01T09:00:00.000Z",
  };
  await check(action(job, 2, "SCHEDULED", slot), 409);
  await check(action(job, 3, "SCHEDULED", slot), 204);
  async function another(category) {
    const quote = await json(call("/quotes", "POST", quoteInput), 201);
    await check(create(quote.id, category), 409);
    for (const [i, status] of ["SENT", "ACCEPTED"].entries())
      await check(
        call("/quotes/" + quote.id + "/status", "PATCH", {
          version: i + 1,
          status,
        }),
        204
      );
    return json(create(quote.id, category));
  }
  const second = await another("ASSEMBLY");
  await check(action(second, 1, "READY"), 204);
  await check(action(second, 2, "ASSIGNED", { technicianId }), 204);
  await check(action(second, 3, "SCHEDULED", slot), 409);
  const regulated = await another("ELECTRICAL");
  await check(
    request("/technicians/" + tech.id + "/grants", "POST", {
      ...grant,
      category: "ELECTRICAL",
    }),
    200
  );
  assert.deepEqual(
    await json(request("/jobs/" + regulated.id + "/eligible")),
    []
  );
  await check(review("SUSPENDED"), 204);
  await check(action(job, 4, "IN_PROGRESS"), 409);
  await check(review("PENDING_VERIFICATION"), 204);
  await check(review("APPROVED"), 204);
  await check(action(job, 4, "IN_PROGRESS"), 204);
  const photos = "/jobs/" + job.id + "/photos";
  await check(request(photos, "POST", { kind: "BEFORE", image: "bad" }), 400);
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await check(
    request(photos, "POST", {
      kind: "AFTER",
      image: "data:image/png;base64," + bytes.toString("base64"),
    }),
    201
  );
  await check(action(job, 5, "COMPLETED"), 409);
  await check(
    action(job, 5, "COMPLETED", {
      workPerformed: "Assembled",
      labourMinutes: 25,
      materials: "Screws",
      customerSummary: "Work finished",
    }),
    204
  );
  const finished = (await json(request("/jobs"))).find(r => r.id === job.id);
  assert.deepEqual(
    finished.history.map(h => h.status),
    ["DRAFT", "READY", "ASSIGNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"]
  );
  assert.equal(finished.labourMinutes, 25);
  assert.equal(finished.quote.bookingId, quoteInput.bookingId);
  const file = photos + "/" + finished.photos[0].id;
  await check(fetch(endpoint + "/delivery" + file), 401);
  const photo = await check(request(file), 200);
  assert.equal(photo.headers.get("content-type"), "image/jpeg");
  await check(
    request("/jobs/" + second.id + "/photos/" + finished.photos[0].id),
    404
  );
  await check(action(job, 6, "READY"), 409);
}
