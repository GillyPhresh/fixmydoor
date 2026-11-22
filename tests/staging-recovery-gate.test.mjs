import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { makeStartupGate, runBoundedChild } from "../scripts/staging-recovery-gate.mjs";
import { configuredBackupBucket, configuredR2Client, createS3BackupClient, verifySyntheticR2Privacy } from "../scripts/backup-object-store.mjs";

test("startup gate waits and shares a single recovery run across callers", async () => {
  let count = 0;
  const gate = makeStartupGate(async () => { count++; return "pass"; }, { waitMs: 20 });
  const first = gate();
  assert.equal(gate(), first);
  assert.equal(count, 0);
  assert.equal(await first, "pass");
  assert.equal(await gate(), "pass");
  assert.equal(count, 1);
});

test("maintenance deadline reaps the child before releasing the startup gate", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "fmd-gate-test-"));
  try {
    const child = path.join(dir, "child.mjs");
    await writeFile(child, "setInterval(() => {}, 1000);");
    assert.equal(await runBoundedChild(child, 150, process.env, "ignore"), "timeout");
    await writeFile(child, "process.exitCode = 1;");
    assert.equal(await runBoundedChild(child, 2000, process.env, "ignore"), "failed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("R2 preflight uses the dedicated bucket, scoped sessions and unsigned privacy checks", async () => {
  const endpoint = "https://" + "a".repeat(32) + ".us.r2.cloudflarestorage.com";
  const bucket = "fixmydoor-staging-backups";
  const key = "sqlite-media/v1/staging/20261122T120000000Z/" + "b".repeat(64) + ".fmd";
  assert.equal(configuredBackupBucket("production", { FMD_S3_BUCKET: "fixmydoor-production-backups" }), "fixmydoor-production-backups");
  assert.throws(() => configuredBackupBucket("staging", { FMD_S3_BUCKET: "fixmydoor-production-backups" }), { code: "UNAPPROVED_BUCKET" });
  assert.throws(() => configuredR2Client("READ", {}), { code: "TEMPORARY_CREDENTIALS_REQUIRED" });
  const client = createS3BackupClient({ endpoint, accessKeyId: "synthetic", secretAccessKey: "synthetic-only" });
  client.destroy();
  const writer = { send: async () => { throw { $metadata: { httpStatusCode: 403 } }; } };
  const request = async (url, options) => {
    assert.equal(url.origin, endpoint);
    assert.equal(options.method, "HEAD");
    assert.equal(options.headers, undefined);
    return { status: 403 };
  };
  assert.deepEqual(await verifySyntheticR2Privacy({ endpoint, bucket, key, writer, request }), { anonymousHttp: 403, writerReadDenied: true });
  await assert.rejects(verifySyntheticR2Privacy({ endpoint, bucket, key, writer,
    request: async () => ({ status: 200 }) }), { code: "ANONYMOUS_OBJECT_ACCESS_NOT_DENIED" });
  await assert.rejects(verifySyntheticR2Privacy({ endpoint, bucket, key, writer: { send: async () => ({}) }, request }), { code: "WRITER_CAN_READ" });
});
