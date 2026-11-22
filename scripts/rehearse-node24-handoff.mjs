import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { lstat, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { captureBackupPayload, restoreBackup, sealBackupPayload } from "./portable-backup.mjs";
import { isStagingRecoveryTarget, smoke } from "./rehearse-staging-recovery.mjs";
import { runBoundedChild } from "./staging-recovery-gate.mjs";

const dbPath = "/data/fixmydoor.db";
const uploads = "/data/uploads";
const executable = "/opt/fmd-node20/bin/node";
const entry = fileURLToPath(import.meta.url);
const fingerprint = db => createHash("sha256").update(JSON.stringify(
  db.prepare("SELECT id, customerToken FROM Booking ORDER BY id").all(),
)).digest("hex");

async function capture(directory, fixture, file) {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0");
    const baseline = fingerprint(db);
    await writeFile(path.join(directory, "baseline"), baseline, { mode: 0o600, flag: "wx" });
    db.prepare("INSERT INTO Booking (id,name,phone,email,address,repairType,customerToken,updatedAt) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
      .run(fixture, "Synthetic handoff", "5145550110", "handoff@example.invalid", "Synthetic", "Door repair", randomUUID());
    assert.ok((await stat(`${dbPath}-wal`)).size > 32);
    await writeFile(file, Buffer.alloc(120 * 1024 ** 2, 0x41), { mode: 0o600, flag: "wx" });
    const committed = fingerprint(db);
    const phases = await captureBackupPayload({ source: dbPath, media: uploads, directory,
      revision: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.FMD_DRILL_REVISION, environment: "staging", writersQuiesced: true });
    await writeFile(path.join(directory, "committed"), committed, { mode: 0o600, flag: "wx" });
    console.log("HANDOFF_SNAPSHOT", JSON.stringify({ ...phases, committedWal: true, syntheticMiB: 120 }));
  } finally { db.close(); }
}

async function rehearse() {
  const begin = performance.now();
  const directory = await mkdtemp("/tmp/fmd-handoff-");
  const fixture = randomUUID();
  const file = path.join(uploads, `${fixture}.handoff`);
  const key = randomBytes(32);
  let capturePassed = false;
  let app;
  try {
    try {
      const mounts = (await readFile("/proc/self/mountinfo", "utf8")).split("\n");
      assert.ok(mounts.some(line => line.split(" ")[4] === "/data"));
      assert.ok((await lstat(dbPath)).isFile());
      await mkdir(uploads, { recursive: true, mode: 0o700 });
      const child = (mode, budget) => runBoundedChild(entry, budget, { ...process.env, FMD_HANDOFF_MODE: mode,
        FMD_HANDOFF_DIR: directory, FMD_HANDOFF_ID: fixture });
      assert.equal(await child("fail", 5000), "failed");
      assert.equal(await child("timeout", 750), "timeout");
      assert.equal(await child("capture", 150_000), "pass");
      capturePassed = true;
    } catch {
      console.error("HANDOFF_CAPTURE_FAILED_RESUMING_APP");
    } finally {
      try {
        const baseline = await readFile(path.join(directory, "baseline"), "utf8").catch(() => null);
        if (baseline) {
          const db = new DatabaseSync(dbPath);
          try {
            db.prepare("DELETE FROM Booking WHERE id=?").run(fixture);
            assert.equal(fingerprint(db), baseline);
          } finally { db.close(); }
        }
        await rm(file, { force: true });
      } catch { capturePassed = false; console.error("HANDOFF_FIXTURE_CLEANUP_FAILED"); }
    }
    console.log("HANDOFF_WRITERS_RELEASED", JSON.stringify({ elapsedMs: Math.round(performance.now() - begin), capturePassed }));
    app = spawn(executable, ["dist/index.js"], { stdio: "inherit", env: process.env });
    const ended = once(app, "exit");
    const onSignal = signal => app.kill(signal);
    process.on("SIGTERM", onSignal);
    process.on("SIGINT", onSignal);
    try {
      if (capturePassed) {
        let live = false;
        for (let tries = 0; tries < 60 && app.exitCode === null; tries++) {
          const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/health`,
            { signal: AbortSignal.timeout(1000) }).catch(() => null);
          if (response?.ok) { live = true; await response.body?.cancel(); break; }
          await delay(250);
        }
        assert.ok(live);
        console.log("HANDOFF_NODE20_HEALTHY", Math.round(performance.now() - begin));
        const output = path.join(directory, "snapshot.fmd");
        const sealed = await sealBackupPayload({ directory, output, key });
        const restored = await restoreBackup({ input: output, key, parent: directory, inspect: async snapshot => {
          const db = new DatabaseSync(path.join(snapshot, "snapshot.db"), { readOnly: true });
          try { assert.equal(fingerprint(db), await readFile(path.join(directory, "committed"), "utf8")); }
          finally { db.close(); }
          await smoke(snapshot);
        } });
        console.log("HANDOFF_OFFLINE_SNAPSHOT_ONLINE_SEAL_VERIFIED", JSON.stringify({ ...sealed, ...restored }));
      }
    } catch { console.error("HANDOFF_POST_RESUME_VERIFICATION_FAILED"); }
    finally { key.fill(0); await rm(directory, { recursive: true, force: true }); }
    const [code] = await ended;
    process.exitCode = code ?? 0;
  } finally { key.fill(0); }
}

assert.ok(isStagingRecoveryTarget(process.env), "Expected isolated staging target");
const mode = process.env.FMD_HANDOFF_MODE;
if (mode === "fail") process.exitCode = 1;
else if (mode === "timeout") await delay(60_000);
else if (mode === "capture") {
  const { FMD_HANDOFF_DIR: directory, FMD_HANDOFF_ID: fixture } = process.env;
  assert.ok(/^\/tmp\/fmd-handoff-[A-Za-z0-9]+$/.test(directory) && /^[0-9a-f-]{36}$/.test(fixture));
  await capture(directory, fixture, path.join(uploads, `${fixture}.handoff`));
} else await rehearse();
