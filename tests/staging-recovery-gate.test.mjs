import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { makeStartupGate, runBoundedChild } from "../scripts/staging-recovery-gate.mjs";
import { configuredBackupBucket, configuredR2Client, createS3BackupClient, verifySyntheticR2Privacy } from "../scripts/backup-object-store.mjs";
import { stagingSessions } from "../scripts/prepare-r2-staging-sessions.mjs";
import { approvedAcceptanceTarget } from "../scripts/r2-acceptance-target.mjs";

test("EU provider acceptance is confined to its named bucket, endpoint and synthetic prefix", () => {
  const id = "a".repeat(32);
  const env = {
    FMD_S3_BUCKET: "fixmydoor-production-backups-eu",
    FMD_S3_ENDPOINT: `https://${id}.eu.r2.cloudflarestorage.com`,
    FMD_ALLOW_R2_EU_SYNTHETIC_TEST: "approved",
    FMD_R2_PARENT_WRITE_ID: "b".repeat(32), FMD_R2_PARENT_WRITE_SECRET: "c".repeat(64),
    FMD_R2_PARENT_READ_ID: "d".repeat(32), FMD_R2_PARENT_READ_SECRET: "e".repeat(64),
  };
  assert.equal(approvedAcceptanceTarget(env).jurisdiction, "eu");
  const sessions = stagingSessions(env, 1795300000);
  assert.equal(sessions.FMD_ALLOW_R2_EU_SYNTHETIC_TEST, "approved");
  for (const role of ["READ", "WRITE"]) {
    const [, payload] = Buffer.from(sessions[`FMD_S3_${role}_TOKEN`], "base64").toString().split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url"));
    assert.deepEqual(claims.paths.prefixPaths, ["sqlite-media/v1/synthetic/"]);
    assert.deepEqual(claims.actions, role === "WRITE" ? ["PutObject"] : ["HeadObject", "GetObject"]);
    assert.equal(claims.bucket, env.FMD_S3_BUCKET);
    assert.equal(claims.aud, `${id}.eu.r2.cloudflarestorage.com`);
  }
  for (const changed of [
    { FMD_S3_BUCKET: "fixmydoor-production-backups" },
    { FMD_S3_ENDPOINT: `https://${id}.r2.cloudflarestorage.com` },
    { FMD_S3_ENDPOINT: `https://${id}.us.r2.cloudflarestorage.com` },
    { FMD_ALLOW_R2_STAGING_TEST: "approved" },
    { FMD_ALLOW_PRODUCTION_CAPTURE: "approved" },
    { FMD_ALLOW_PRODUCTION_TRANSFER: "approved" },
    { FMD_ALLOW_R2_EU_SYNTHETIC_TEST: "" },
  ]) assert.throws(() => approvedAcceptanceTarget({ ...env, ...changed }));
});

test("R2 local signer issues separate staging-only 15-minute sessions", () => {
  const account = "a".repeat(32);
  const host = `${account}.us.r2.cloudflarestorage.com`;
  const env = {
    FMD_S3_ENDPOINT: `https://${host}`,
    FMD_S3_BUCKET: "fixmydoor-staging-backups",
    FMD_ALLOW_R2_STAGING_TEST: "approved",
    FMD_R2_PARENT_WRITE_ID: "b".repeat(32), FMD_R2_PARENT_WRITE_SECRET: "c".repeat(64),
    FMD_R2_PARENT_READ_ID: "d".repeat(32), FMD_R2_PARENT_READ_SECRET: "e".repeat(64),
  };
  const issuedAt = 1795300000;
  const sessions = stagingSessions(env, issuedAt);
  for (const [role, actions] of [["WRITE", ["PutObject"]], ["READ", ["HeadObject", "GetObject"]]]) {
    const token = Buffer.from(sessions[`FMD_S3_${role}_TOKEN`], "base64").toString();
    assert.ok(token.startsWith("jwt/"));
    const jwt = token.slice(4);
    const [header, claims, signature] = jwt.split(".");
    const parse = value => JSON.parse(Buffer.from(value, "base64url"));
    assert.deepEqual(parse(header), { alg: "HS256", typ: "JWT" });
    assert.deepEqual(parse(claims), { bucket: env.FMD_S3_BUCKET, actions,
      paths: { prefixPaths: ["sqlite-media/v1/staging/"], objectPaths: [] }, sub: account,
      iss: sessions[`FMD_S3_${role}_ID`], aud: host, iat: issuedAt, exp: issuedAt + 900 });
    assert.equal(signature, createHmac("sha256", env[`FMD_R2_PARENT_${role}_SECRET`]).update(`${header}.${claims}`).digest("base64url"));
    assert.equal(sessions[`FMD_S3_${role}_SECRET`], createHash("sha256").update(jwt).digest("hex"));
  }
  assert.ok(Object.keys(sessions).every(name => !name.includes("PARENT")));
  assert.throws(() => stagingSessions({ ...env, FMD_S3_BUCKET: "fixmydoor-production-backups" }));
  assert.throws(() => stagingSessions({ ...env, FMD_ALLOW_PRODUCTION_TRANSFER: "approved" }));
  assert.throws(() => stagingSessions({ ...env, FMD_R2_PARENT_READ_ID: env.FMD_R2_PARENT_WRITE_ID }));
});

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
  const eu = { FMD_S3_BUCKET: "fixmydoor-production-backups-eu", FMD_ALLOW_PRODUCTION_TRANSFER: "approved",
    FMD_S3_ENDPOINT: `https://${"a".repeat(32)}.eu.r2.cloudflarestorage.com` };
  assert.equal(configuredBackupBucket("production", eu), eu.FMD_S3_BUCKET);
  assert.throws(() => configuredBackupBucket("production", { ...eu, FMD_ALLOW_PRODUCTION_TRANSFER: "" }), { code: "UNAPPROVED_BUCKET" });
  assert.throws(() => configuredBackupBucket("production", { ...eu, FMD_S3_ENDPOINT: endpoint }), { code: "UNAPPROVED_BUCKET" });
  assert.throws(() => configuredBackupBucket("staging", { FMD_S3_BUCKET: "fixmydoor-production-backups" }), { code: "UNAPPROVED_BUCKET" });
  assert.throws(() => configuredR2Client("READ", {}), { code: "TEMPORARY_CREDENTIALS_REQUIRED" });
  const client = createS3BackupClient({ endpoint, accessKeyId: "synthetic", secretAccessKey: "synthetic-only" });
  client.destroy();
  const operations = [];
  const denied = { send: async command => {
    operations.push([command.constructor.name, command.input]);
    throw { $metadata: { httpStatusCode: 403 } };
  } };
  const request = async (url, options) => {
    assert.equal(url.origin, endpoint);
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Range, "bytes=0-0");
    return { status: 403 };
  };
  const options = { endpoint, bucket, key, writer: denied, reader: denied, request };
  assert.deepEqual(await verifySyntheticR2Privacy(options), { anonymousHttp: 403, writerReadDenied: true, readerWriteDenied: true });
  assert.deepEqual(operations, [
    ["GetObjectCommand", { Bucket: bucket, Key: key, Range: "bytes=0-0" }],
    ["PutObjectCommand", { Bucket: bucket, Key: key + ".reader-permission-probe", IfNoneMatch: "*", Body: Buffer.alloc(0) }],
  ]);
  await assert.rejects(verifySyntheticR2Privacy({ ...options,
    request: async () => ({ status: 200 }) }), { code: "ANONYMOUS_OBJECT_ACCESS_NOT_DENIED" });
  const allowed = { send: async () => ({}) };
  await assert.rejects(verifySyntheticR2Privacy({ ...options, writer: allowed }), { code: "WRITER_CAN_READ" });
  await assert.rejects(verifySyntheticR2Privacy({ ...options, reader: allowed }), { code: "READER_CAN_WRITE" });
});
