import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, lstat, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readBackupKey, restoreBackup } from "./portable-backup.mjs";
import { fileHash } from "./rehearse-staging-recovery.mjs";

const maxBytes = 5_000_000_000;
const environments = new Set(["synthetic", "staging", "production"]);
const sha256 = /^[a-f0-9]{64}$/;
const sortableTime = /^\d{8}T\d{9}Z$/;
const error = code => Object.assign(new Error(code), { code });
const httpStatus = e => e?.$metadata?.httpStatusCode;
const transient = e => [408, 429, 500, 502, 503, 504].includes(httpStatus(e)) ||
  ["AbortError", "TimeoutError", "ECONNRESET", "ETIMEDOUT", "EPIPE", "EAI_AGAIN", "ENETUNREACH", "TRANSFER_INCOMPLETE",
    "RequestTimeout", "SlowDown", "Throttling", "InternalError", "ServiceUnavailable"].some(value => value === e?.name || value === e?.code);

async function retry(operation) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation(AbortSignal.timeout(180_000));
    } catch (e) {
      if (attempt === 2 || !transient(e)) throw e;
      await delay(250 * 2 ** attempt + randomBytes(1)[0]);
    }
  }
}

function scope(environment) {
  if (!environments.has(environment)) throw error("INVALID_ENVIRONMENT");
  return `sqlite-media/v1/${environment}/`;
}

export function retentionPlan(environment) {
  if (environment === "production") throw error("PRODUCTION_RETENTION_REQUIRES_REVIEW");
  return { Rules: [{ ID: "fixmydoor-expire-v1", Filter: { Prefix: scope(environment) },
    Status: "Enabled", Expiration: { Days: 30 } }] };
}

function keyDetails(environment, key) {
  const prefix = scope(environment);
  const segments = key.startsWith(prefix) ? key.slice(prefix.length).split("/") : [];
  const digest = segments[1]?.slice(0, -4);
  if (segments.length !== 2 || !sortableTime.test(segments[0]) || !segments[1].endsWith(".fmd") || !sha256.test(digest)) {
    throw error("INVALID_OBJECT_KEY");
  }
  const stamp = segments[0];
  const time = Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}.${stamp.slice(15, 18)}Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().replace(/[-:.]/g, "") !== stamp) throw error("INVALID_OBJECT_TIME");
  return { digest, time };
}

// A reviewed receipt is an independently restored object plus any active rollback hold.
// This policy returns review candidates. Routine credentials never delete objects.
export function retentionCandidates(environment, { objects, receipts, now = Date.now(), retentionDays = 30 }) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || !Number.isFinite(now)) throw error("INVALID_RETENTION_POLICY");
  const present = new Map(objects.map(key => [key, keyDetails(environment, key)]));
  if (present.size !== objects.length) throw error("DUPLICATE_RETENTION_OBJECT");
  const verified = new Map();
  for (const receipt of receipts) {
    const source = present.get(receipt.key);
    if (!source || source.digest !== receipt.sha256 || !Number.isFinite(receipt.verifiedAt) ||
        receipt.verifiedAt < source.time || receipt.verifiedAt > now || typeof receipt.rollbackHold !== "boolean" ||
        verified.has(receipt.key)) throw error("INVALID_RECOVERY_RECEIPT");
    verified.set(receipt.key, receipt);
  }
  const newest = [...verified.keys()].sort((a, b) => present.get(b).time - present.get(a).time || b.localeCompare(a))[0];
  const cutoff = now - retentionDays * 86_400_000;
  return {
    newestVerified: newest ?? null,
    review: newest ? [...verified.keys()].filter(key => key !== newest && !verified.get(key).rollbackHold && present.get(key).time <= cutoff) : [],
    unverified: [...present.keys()].filter(key => !verified.has(key)),
  };
}

function storageAddress(endpoint, allowLoopback) {
  const address = new URL(endpoint);
  const allowedR2 = address.protocol === "https:" && !address.port &&
    /^[a-f0-9]{32}(?:\.(?:eu|fedramp|us))?\.r2\.cloudflarestorage\.com$/.test(address.hostname);
  const allowedTest = allowLoopback && address.protocol === "http:" && address.hostname === "127.0.0.1" && address.port;
  if (!(allowedR2 || allowedTest) || address.username || address.password ||
      address.pathname !== "/" || address.search || address.hash) throw error("INVALID_STORAGE_ENDPOINT");
  return address;
}

export function createS3BackupClient(config, { allowLoopback = false } = {}) {
  const address = storageAddress(config.endpoint, allowLoopback);
  if (!config.accessKeyId || !config.secretAccessKey) throw error("STORAGE_CREDENTIALS_REQUIRED");
  return new S3Client({
    endpoint: address.origin, region: "auto", forcePathStyle: true, maxAttempts: 1,
    followRegionRedirects: false, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, sessionToken: config.sessionToken },
  });
}

export function configuredBackupBucket(environment, env) {
  scope(environment);
  const expected = environment === "synthetic" ? "fixmydoor-recovery-synthetic" : `fixmydoor-${environment}-backups`;
  if (environment === "production" && env.FMD_S3_BUCKET === "fixmydoor-production-backups-eu" &&
      env.FMD_ALLOW_PRODUCTION_TRANSFER === "approved" &&
      /^https:\/\/[a-f0-9]{32}\.eu\.r2\.cloudflarestorage\.com\/?$/.test(env.FMD_S3_ENDPOINT ?? "")) return env.FMD_S3_BUCKET;
  if (env.FMD_S3_BUCKET !== expected) throw error("UNAPPROVED_BUCKET");
  return expected;
}

export function configuredR2Client(role, env) {
  if (!["READ", "WRITE"].includes(role) || !env[`FMD_S3_${role}_TOKEN`]) throw error("TEMPORARY_CREDENTIALS_REQUIRED");
  return createS3BackupClient({ endpoint: env.FMD_S3_ENDPOINT, accessKeyId: env[`FMD_S3_${role}_ID`],
    secretAccessKey: env[`FMD_S3_${role}_SECRET`], sessionToken: env[`FMD_S3_${role}_TOKEN`] });
}

async function expectRoleDenial(send, unexpectedGrant) {
  try {
    const result = await send();
    result?.Body?.destroy?.();
  } catch (cause) {
    if ([401, 403].includes(httpStatus(cause))) return;
    throw cause;
  }
  throw error(unexpectedGrant);
}

export async function verifySyntheticR2Privacy({ endpoint, bucket, key, writer, reader, request = fetch }) {
  keyDetails("staging", key);
  if (bucket !== "fixmydoor-staging-backups") throw error("UNAPPROVED_BUCKET");
  const address = storageAddress(endpoint, false);
  const objectUrl = new URL("/" + bucket + "/" + key.split("/").map(encodeURIComponent).join("/"), address);
  const response = await request(objectUrl, {
    method: "GET", headers: { Range: "bytes=0-0" }, redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  if (response.status === 400) {
    // R2's US S3 endpoint can reject a missing authorization header with a 400.
    const xml = await response.text();
    if (!/<Code>InvalidArgument<\/Code>/.test(xml) || !/<Message>Authorization<\/Message>/.test(xml)) {
      throw error("ANONYMOUS_OBJECT_ACCESS_NOT_DENIED");
    }
  } else {
    await response.body?.cancel();
    if (![401, 403, 404].includes(response.status)) throw error("ANONYMOUS_OBJECT_ACCESS_NOT_DENIED");
  }
  await expectRoleDenial(() => writer.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-0" }),
    { abortSignal: AbortSignal.timeout(15000) }), "WRITER_CAN_READ");
  // Use a separate probe key and conditional PUT so this cannot replace a backup.
  await expectRoleDenial(() => reader.send(new PutObjectCommand({
    Bucket: bucket, Key: key + ".reader-permission-probe", IfNoneMatch: "*", Body: Buffer.alloc(0),
  }), { abortSignal: AbortSignal.timeout(15000) }), "READER_CAN_WRITE");
  return { anonymousHttp: response.status, writerReadDenied: true, readerWriteDenied: true };
}

export function createBackupStore({ writer, reader, bucket, environment }) {
  const prefix = scope(environment);
  if (!reader || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw error("INVALID_STORAGE_CONFIG");

  async function head(key, digest) {
    const object = await retry(signal => reader.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal }));
    const size = object.ContentLength;
    if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes || object.Metadata?.sha256 !== digest || !object.ETag) {
      throw error("OBJECT_METADATA_MISMATCH");
    }
    return { size, etag: object.ETag };
  }

  async function read(key, destination) {
    const { digest } = keyDetails(environment, key);
    const { size, etag } = await head(key, digest);
    if (destination && await realpath(path.dirname(destination)) !== path.resolve(path.dirname(destination))) throw error("UNSAFE_OUTPUT_PATH");
    const directory = destination ? await mkdtemp(path.join(path.dirname(destination), ".fmd-backup-download-")) : undefined;
    try {
      const partial = directory && path.join(directory, "partial");
      await retry(async signal => {
        const reply = await reader.send(new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: etag }), { abortSignal: signal });
        const hash = createHash("sha256");
        let count = 0;
        if (!reply.Body || reply.ContentLength !== size || reply.ETag !== etag) {
          reply.Body?.destroy?.();
          throw error("OBJECT_METADATA_MISMATCH");
        }
        const meter = new Transform({ transform(chunk, _encoding, done) {
          count += chunk.length;
          if (count > size) return done(error("OBJECT_SIZE_MISMATCH"));
          hash.update(chunk);
          done(null, partial ? chunk : undefined);
        } });
        if (partial) await pipeline(reply.Body, meter, createWriteStream(partial, { mode: 0o600 }), { signal });
        else await pipeline(reply.Body, meter, { signal });
        if (count !== size) throw error("TRANSFER_INCOMPLETE");
        if (hash.digest("hex") !== digest) throw error("OBJECT_HASH_MISMATCH");
      });
      if (partial) await link(partial, destination);
      return { key, bytes: size, sha256: digest };
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }

  return {
    async upload(archive, encryptionKey) {
      if (!writer) throw error("WRITER_REQUIRED");
      const info = await lstat(archive);
      if (!info.isFile() || info.size < 1 || info.size > maxBytes) throw error("INVALID_ARTIFACT");
      const digest = await fileHash(archive);
      // Authenticate and check that the archive belongs to this environment before sending bytes.
      const { createdAt, environment: captured } = await restoreBackup({ input: archive, key: encryptionKey });
      if (captured !== environment || digest !== await fileHash(archive)) throw error("ARTIFACT_CONTEXT_MISMATCH");
      const key = prefix + createdAt.replace(/[-:.]/g, "") + "/" + digest + ".fmd";
      keyDetails(environment, key);
      try {
        await retry(async signal => {
          const body = createReadStream(archive);
          try {
            return await writer.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body,
              ContentLength: info.size, ContentType: "application/octet-stream", Metadata: { sha256: digest },
              IfNoneMatch: "*" }), { abortSignal: signal });
          } finally {
            body.destroy();
          }
        });
      } catch (e) {
        // A committed upload can lose its response. Accept an existing key only after full byte verification.
        if (httpStatus(e) !== 412 && !transient(e)) throw e;
      }
      return read(key);
    },
    download: read,
    async inventory(current = Date.now(), maxAgeHours = 36) {
      if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 720) throw error("INVALID_MAX_AGE");
      let token, latest, count = 0;
      for (let page = 0; page < 100; page++) {
        const reply = await retry(signal => reader.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }), { abortSignal: signal }));
        for (const object of reply.Contents ?? []) {
          let entry;
          try { entry = keyDetails(environment, object.Key ?? ""); } catch { continue; }
          if (entry.time > current + 300_000 || !Number.isSafeInteger(object.Size) || object.Size < 1 || object.Size > maxBytes) continue;
          count++;
          if (!latest || entry.time >= latest.time) latest = { key: object.Key, time: entry.time, bytes: object.Size };
        }
        if (!reply.IsTruncated) {
          const ageHours = latest ? Math.max(0, current - latest.time) / 3_600_000 : null;
          return { count, latest, ageHours, status: !latest ? "missing" : ageHours > maxAgeHours ? "stale" : "recent" };
        }
        if (!reply.NextContinuationToken || reply.NextContinuationToken === token) throw error("INVALID_INVENTORY");
        token = reply.NextContinuationToken;
      }
      throw error("INVENTORY_LIMIT");
    },
  };
}

async function main([operation, environment, ...args], env) {
  if (operation === "keygen" && environment && args.length === 0) {
    const filename = path.resolve(environment);
    const parent = await realpath(path.dirname(filename));
    const project = await realpath(fileURLToPath(new URL("../", import.meta.url)));
    const relative = path.relative(project, parent);
    if (relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) {
      throw error("KEY_FILE_INSIDE_PROJECT");
    }
    const key = randomBytes(32);
    try { await writeFile(path.join(parent, path.basename(filename)), key, { mode: 0o600, flag: "wx" }); }
    finally { key.fill(0); }
    return { generated: true };
  }
  if (operation === "retention-plan") return retentionPlan(environment);
  if (operation === "retention-review" && args.length === 1) {
    const manifest = JSON.parse(await readFile(args[0], "utf8"));
    return retentionCandidates(environment, manifest);
  }
  const [first, second] = args;
  if (!["upload", "download", "inventory", "check"].includes(operation)) throw error("UNKNOWN_OPERATION");
  if (environment === "production" && env.FMD_ALLOW_PRODUCTION_TRANSFER !== "approved") throw error("UNAPPROVED_TRANSFER_TARGET");
  scope(environment);
  const bucket = configuredBackupBucket(environment, env);
  const reader = configuredR2Client("READ", env);
  let writer;
  try {
    if (operation === "upload") {
      if (env.FMD_S3_WRITE_ID === env.FMD_S3_READ_ID) throw error("DISTINCT_STORAGE_ROLES_REQUIRED");
      writer = configuredR2Client("WRITE", env);
    }
    const store = createBackupStore({ reader, writer, bucket, environment });
    if (operation === "inventory") {
      const result = await store.inventory(Date.now(), Number(first ?? "36"));
      if (result.status !== "recent") process.exitCode = 2;
      return result;
    }
    if (operation === "check") {
      if (!first) throw error("KEY_FILE_REQUIRED");
      const result = await store.inventory(Date.now(), Number(second ?? "36"));
      if (result.status !== "recent") {
        process.exitCode = 2;
        return result;
      }
      const directory = await mkdtemp(path.join(tmpdir(), ".fmd-backup-check-"));
      let key;
      try {
        key = await readBackupKey(first);
        const artifact = path.join(directory, "recovery.fmd");
        await store.download(result.latest.key, artifact);
        const verified = await restoreBackup({ input: artifact, key, parent: directory });
        if (verified.environment !== environment ||
            Date.parse(verified.createdAt) !== result.latest.time) throw error("ARTIFACT_CONTEXT_MISMATCH");
        return { ...result, verified };
      } finally {
        key?.fill(0);
        await rm(directory, { recursive: true, force: true });
      }
    }
    if (!first || !second) throw error("ARTIFACT_ARGUMENTS_REQUIRED");
    if (operation === "download") return await store.download(first, path.resolve(second));
    const key = await readBackupKey(second);
    try { return await store.upload(path.resolve(first), key); }
    finally { key.fill(0); }
  } finally {
    writer?.destroy();
    reader.destroy();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log("BACKUP_STORAGE", JSON.stringify(await main(process.argv.slice(2), process.env)));
  } catch (e) {
    const safeCode = /^[A-Z][A-Z_]+$/.test(e?.code ?? "") ? e.code : "STORAGE_OPERATION_FAILED";
    console.error("BACKUP_STORAGE_FAILED", safeCode, httpStatus(e) ?? "");
    process.exitCode = 1;
  }
}
