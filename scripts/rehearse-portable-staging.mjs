import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBackup, restoreBackup } from "./portable-backup.mjs";
import { isStagingRecoveryTarget, smoke } from "./rehearse-staging-recovery.mjs";
import { createBackupStore, createS3BackupClient } from "./backup-object-store.mjs";
import { startFakeS3 } from "../tests/support/backup-s3-fake.mjs";

async function run() {
  if (!isStagingRecoveryTarget(process.env)) throw new Error("Expected isolated staging IDs");
  const directory = await mkdtemp(path.join(tmpdir(), "fmd-portable-staging-"));
  const key = randomBytes(32);
  let fake, writer, reader;
  try {
    const output = path.join(directory, "staging.fmd");
    let media = "/data/uploads";
    const status = await lstat(media).catch(error => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (status === null) {
      media = path.join(directory, "empty-media");
      await mkdir(media, { mode: 0o700 });
    }
    const capture = await createBackup({ source: "/data/fixmydoor.db", media, output, key,
      revision: process.env.RAILWAY_GIT_COMMIT_SHA, environment: "staging", writersQuiesced: true });
    fake = await startFakeS3();
    const config = { endpoint: fake.endpoint, accessKeyId: "synthetic-stage-id", secretAccessKey: "synthetic-stage-only" };
    writer = createS3BackupClient(config, { allowLoopback: true });
    reader = createS3BackupClient(config, { allowLoopback: true });
    const store = createBackupStore({ writer, reader, bucket: fake.bucket, environment: "staging" });
    assert.equal((await store.inventory()).status, "missing");
    fake.faults.putLostResponse = 1;
    const remote = await store.upload(output, key);
    const retrieved = path.join(directory, "retrieved.fmd");
    fake.faults.getInterrupted = 1;
    await store.download(remote.key, retrieved);
    assert.equal((await store.inventory()).count, 1);
    const restored = await restoreBackup({ input: retrieved, key, parent: directory, inspect: smoke });
    console.log("PORTABLE_STAGING_PASS", JSON.stringify({ ...capture, ...restored, appSmoke: true, fakeS3: true, retries: fake.calls }));
  } finally {
    writer?.destroy();
    reader?.destroy();
    await fake?.close();
    key.fill(0);
    await rm(directory, { recursive: true, force: true });
  }
}

try {
  await run();
} catch (error) {
  const code = typeof error.code === "string" && /^[A-Z_]+$/.test(error.code) ? error.code : "VERIFICATION_FAILED";
  console.error("PORTABLE_STAGING_FAIL", code);
  process.exitCode = 1;
}
