import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import { captureBackupPayload, restoreBackup, sealBackupPayload } from "./portable-backup.mjs";
import { legacyMigrationSql, legacyRecoveryDigest, legacySchemaSql } from "./prepare-legacy-recovery-startup.mjs";

const node20 = "/usr/local/bin/node";
const source = "/data/fixmydoor.db";
const media = "/data/uploads";
const revision = "025c5f9756aa8556af5a1a2a36e74fd0c3f33ddf";
const endpoint = "http://127.0.0.1:3059";
const env = { PATH: process.env.PATH, NODE_ENV: "production", PORT: "3059", DATABASE_URL: `file:${source}`,
  UPLOAD_DIR: media, CREATE_DEFAULT_ADMIN: "false", SESSION_SECRET: randomUUID() + randomUUID(), CHECKPOINT_DISABLE: "1" };

function signature() {
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    return {
      schema: db.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY type,name").all(),
      migrations: db.prepare('SELECT * FROM "_prisma_migrations" ORDER BY id').all(),
    };
  } finally { db.close(); }
}

async function withLegacyApp(check, { entry = "dist/index.js", overrides = {} } = {}) {
  const child = spawn(node20, [entry], { env: { ...env, ...overrides }, stdio: "inherit" });
  const ended = once(child, "exit");
  const started = performance.now();
  try {
    while (child.exitCode === null && performance.now() - started < 60_000) {
      const response = await fetch(`${endpoint}/api/health`, { signal: AbortSignal.timeout(1000) }).catch(() => null);
      if (response?.ok) {
        const health = await response.json();
        assert.equal(health.checks?.database, "connected");
        await check(Math.round(performance.now() - started));
        return;
      }
      await delay(250);
    }
    assert.fail("Legacy application did not become healthy");
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    const reap = setTimeout(() => child.kill("SIGKILL"), 3000);
    try { await ended; } finally { clearTimeout(reap); }
  }
}

async function verifyGuardedStartup(scratch, before, fixture) {
  const db = new DatabaseSync(source);
  db.prepare('UPDATE Booking SET clientId = NULL, reminderAt = ?, reminderSentAt = NULL WHERE id = ?')
    .run(new Date(Date.now() - 60_000).toISOString(), fixture);
  const digest = legacyRecoveryDigest(db.prepare(legacySchemaSql).all(), db.prepare(legacyMigrationSql).all());
  db.close();
  const entry = "dist/recovery-index.js";
  const startupApproval = { FMD_LEGACY_RECOVERY_STARTUP: "approved", FMD_LEGACY_RECOVERY_CONTROL_DIR: scratch };
  const reject = spawn(node20, [entry], { env: { ...env, ...startupApproval, FMD_LEGACY_RECOVERY_SCHEMA_SHA256: "0".repeat(64) }, stdio: "inherit" });
  const deadline = setTimeout(() => reject.kill("SIGKILL"), 8000);
  try { assert.equal((await once(reject, "exit"))[0], 1); } finally { clearTimeout(deadline); }
  assert.deepEqual(signature(), before);

  const calls = path.join(scratch, "mock-mail.log");
  const mock = path.join(scratch, "mock-mail.mjs");
  await writeFile(mock, `import { appendFileSync } from "node:fs";
globalThis.fetch = async (url, options) => {
  const request = new URL(url);
  if (request.origin !== "https://api.resend.com") throw new Error("Unexpected provider");
  appendFileSync(process.env.FMD_MOCK_EMAIL_CALLS, (options?.method ?? "GET") + " " + request.pathname + "\\n");
  return Response.json({ id: "synthetic-provider-id", data: [] });
};
`, { mode: 0o600 });
  const observed = () => readFile(calls, "utf8").catch(error => { if (error.code !== "ENOENT") throw error; return ""; });
  await withLegacyApp(async healthMs => {
    assert.deepEqual(signature(), before);
    assert.equal((await observed()).includes("POST "), false, "Guarded startup made an outbound write");
    const startupDb = new DatabaseSync(source, { readOnly: true });
    try {
      const pending = startupDb.prepare("SELECT clientId, reminderSentAt FROM Booking WHERE id = ?").get(fixture);
      assert.equal(pending.clientId, null);
      assert.equal(pending.reminderSentAt, null);
    } finally { startupDb.close(); }
    const email = "guarded-recovery@example.invalid";
    const response = await fetch(`${endpoint}/api/bookings`, { method: "POST", signal: AbortSignal.timeout(12000),
      headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Synthetic recovery", phone: "5145550112",
        email, address: "2 Test Street", repairType: "Door repair", photos: [], customerConsent: true,
        securityAnswer: "verified-customer", submittedAt: new Date(Date.now() - 3000).toISOString(), website: "" }) });
    assert.equal(response.status, 201);
    await response.body?.cancel();
    assert.deepEqual((await observed()).split("\n").filter(line => line.startsWith("POST ")), ["POST /emails", "POST /emails"]);
    const check = new DatabaseSync(source, { readOnly: true });
    try { assert.equal(check.prepare("SELECT count(*) AS n FROM Booking WHERE email=?").get(email).n, 1); }
    finally { check.close(); }
    assert.deepEqual(signature(), before);
    console.log("GUARDED_LEGACY_RECOVERY_PASS", JSON.stringify({ healthMs, driftRejected: true, schemaUnchanged: true,
      startupSends: 0, startupBackfillHeld: true, dueReminderHeld: true, mockedTransactionalSends: 2, syntheticBookingCount: 1 }));
  }, { entry, overrides: { ...startupApproval, FMD_LEGACY_RECOVERY_SCHEMA_SHA256: digest,
    NODE_OPTIONS: `--import=${mock}`, FMD_MOCK_EMAIL_CALLS: calls, RESEND_API_KEY: "synthetic-key",
    RESEND_FROM_EMAIL: "sender@example.invalid", ADMIN_EMAIL: "admin@example.invalid", RESEND_AUDIENCE_ID: "synthetic-audience" } });
}

assert.equal(process.env.FMD_LOCAL_LEGACY_PROBE, "synthetic-only");
assert.ok(!process.env.RAILWAY_PROJECT_ID && /^v24\./.test(process.version));
assert.match(execFileSync(node20, ["--version"], { encoding: "utf8" }).trim(), /^v20\./);
const mounts = (await readFile("/proc/self/mountinfo", "utf8")).split("\n");
assert.ok(mounts.some(line => line.split(" ")[4] === "/data" && line.split(" - ")[1]?.startsWith("tmpfs ")));
assert.deepEqual(await stat(source).catch(error => error.code), "ENOENT");

const scratch = await mkdtemp("/tmp/fmd-legacy-test-");
const key = randomBytes(32);
const fixture = randomUUID();
try {
  await mkdir(media, { mode: 0o700 });
  await withLegacyApp(async () => {});
  await assert.rejects(fetch(`${endpoint}/api/health`, { signal: AbortSignal.timeout(1000) }));
  const before = signature();
  const db = new DatabaseSync(source);
  try {
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0");
    db.prepare("INSERT INTO Booking (id,name,phone,email,address,repairType,customerToken,clientId,updatedAt) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
      .run(fixture, "Synthetic legacy recovery", "5145550110", "legacy-recovery@example.invalid", "Synthetic", "Door repair", randomUUID(), "SYNTHETIC-CLIENT");
    assert.ok((await stat(`${source}-wal`)).size > 32);
    await writeFile(path.join(media, "synthetic.jpg"), "synthetic legacy media", { mode: 0o600, flag: "wx" });
    await captureBackupPayload({ source, media, directory: scratch, revision, environment: "synthetic", writersQuiesced: true });
  } finally { db.close(); }
  await withLegacyApp(async healthMs => {
    assert.deepEqual(signature(), before);
    const homepage = await fetch(endpoint, { signal: AbortSignal.timeout(2000) });
    assert.equal(homepage.status, 200);
    await homepage.body?.cancel();
    const output = path.join(scratch, "sealed.fmd");
    await sealBackupPayload({ directory: scratch, output, key });
    const result = await restoreBackup({ input: output, key, parent: scratch, inspect: async restored => {
      const copy = new DatabaseSync(path.join(restored, "snapshot.db"), { readOnly: true });
      try { assert.equal(copy.prepare("SELECT count(*) AS n FROM Booking WHERE id=?").get(fixture).n, 1); }
      finally { copy.close(); }
      assert.equal(await readFile(path.join(restored, "uploads", "synthetic.jpg"), "utf8"), "synthetic legacy media");
    } });
    console.log("LEGACY_SOURCE_PREFLIGHT_PASS", JSON.stringify({ healthMs, schemaUnchangedOnRestart: true, committedWal: true, ...result }));
  });
  if (process.env.FMD_LOCAL_LEGACY_GUARDED_PROBE === "synthetic-only") await verifyGuardedStartup(scratch, before, fixture);
} finally { key.fill(0); await rm(scratch, { recursive: true, force: true }); }
