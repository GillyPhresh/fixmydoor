import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import { captureBackupPayload, restoreBackup, sealBackupPayload } from "./portable-backup.mjs";

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

async function withLegacyApp(check) {
  const child = spawn(node20, ["dist/index.js"], { env, stdio: "inherit" });
  const ended = once(child, "exit");
  const started = performance.now();
  try {
    for (let i = 0; i < 60 && child.exitCode === null; ++i) {
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
} finally { key.fill(0); await rm(scratch, { recursive: true, force: true }); }
