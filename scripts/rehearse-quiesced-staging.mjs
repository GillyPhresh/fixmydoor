import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createBackup, restoreBackup } from "./portable-backup.mjs";
import { fileHash, isStagingRecoveryTarget, smoke } from "./rehearse-staging-recovery.mjs";
import { runBoundedChild } from "./staging-recovery-gate.mjs";

const source = "/data/fixmydoor.db";
const media = "/data/uploads";
const script = fileURLToPath(import.meta.url);
const bookingFingerprint = db => createHash("sha256").update(JSON.stringify(
  db.prepare("SELECT id, customerToken FROM Booking ORDER BY id").all(),
)).digest("hex");

async function capture() {
  const directory = await mkdtemp(path.join(tmpdir(), "fmd-quiesced-stage-"));
  const key = randomBytes(32);
  const fixture = randomUUID();
  const fixturePath = path.join(media, `${fixture}.rehearsal`);
  let db;
  try {
    await mkdir(media, { recursive: true, mode: 0o700 });
    db = new DatabaseSync(source);
    db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; PRAGMA foreign_keys=ON");
    const baseline = bookingFingerprint(db);
    db.prepare("INSERT INTO Booking (id,name,phone,email,address,repairType,customerToken,updatedAt) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
      .run(fixture, "Synthetic maintenance drill", "5145550110", "maintenance@example.invalid", "Synthetic", "Door repair", randomUUID());
    await writeFile(fixturePath, randomBytes(256), { mode: 0o600, flag: "wx" });
    const committed = bookingFingerprint(db);
    assert.ok((await stat(`${source}-wal`)).size > 32);
    const output = path.join(directory, "snapshot.fmd");
    const manifest = await createBackup({ source, media, output, key,
      revision: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.FMD_DRILL_REVISION, environment: "staging", writersQuiesced: true });
    console.log("QUIESCED_STAGE_CAPTURED", JSON.stringify({ ...manifest, committedWal: true }));
    const restore = await restoreBackup({ input: output, key, parent: directory, inspect: async restored => {
      const snapshot = new DatabaseSync(path.join(restored, "snapshot.db"), { readOnly: true });
      try { assert.equal(bookingFingerprint(snapshot), committed); } finally { snapshot.close(); }
      assert.equal(await fileHash(path.join(restored, "uploads", path.basename(fixturePath))), await fileHash(fixturePath));
      await smoke(restored);
    } });
    db.prepare("DELETE FROM Booking WHERE id=?").run(fixture);
    assert.equal(bookingFingerprint(db), baseline);
    console.log("QUIESCED_STAGE_RESTORED", JSON.stringify({ ...restore, bookingsPreserved: true, appSmoke: true }));
  } finally {
    try { db?.prepare("DELETE FROM Booking WHERE id=?").run(fixture); }
    finally {
      db?.close();
      key.fill(0);
      await rm(fixturePath, { force: true });
      await rm(directory, { recursive: true, force: true });
    }
  }
}

try {
  if (!isStagingRecoveryTarget(process.env)) throw new Error("Unapproved maintenance drill target");
  const phase = process.env.FMD_QUIESCED_DRILL_CHILD;
  if (phase === "fail") process.exitCode = 1;
  else if (phase === "timeout") await new Promise(resolve => setTimeout(resolve, 60_000));
  else if (phase === "capture") await capture();
  else {
    const started = performance.now();
    console.log("QUIESCED_STAGE_WRITERS_OFFLINE");
    try {
      const child = (mode, budget) => runBoundedChild(script, budget, { ...process.env, FMD_QUIESCED_DRILL_CHILD: mode });
      assert.equal(await child("fail", 5000), "failed");
      assert.equal(await child("timeout", 1000), "timeout");
      console.log("QUIESCED_STAGE_FAILURE_AND_TIMEOUT_REAPED");
      assert.equal(await child("capture", 30_000), "pass");
    } finally {
      console.log("QUIESCED_STAGE_STARTUP_RELEASED", JSON.stringify({ elapsedMs: Math.round(performance.now() - started) }));
    }
  }
} catch (cause) {
  console.error("QUIESCED_STAGE_FAILED", typeof cause.code === "string" && /^[A-Z_]+$/.test(cause.code) ? cause.code : "VERIFICATION_FAILED");
  process.exitCode = 1;
}
