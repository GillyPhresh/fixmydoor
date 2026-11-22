import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, cp, link, lstat, mkdir, mkdtemp, open, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { DatabaseSync, backup } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { fileHash, isStagingRecoveryTarget, mediaManifest } from "./rehearse-staging-recovery.mjs";

const magic = Buffer.from("FMD-BACKUP-1\n");
const headerSize = magic.length + 12;
const tagSize = 16;
const maxBytes = 8 * 1024 ** 3;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = code => { throw Object.assign(new Error(code), { code }); };

async function privateDirectory(parent) {
  const dir = await mkdtemp(path.join(parent, ".fmd-backup-"));
  await chmod(dir, 0o700);
  return dir;
}

async function tar(args) {
  await new Promise((resolve, reject) => {
    const child = spawn("tar", args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(Object.assign(new Error("Archive operation failed"), { code: "ARCHIVE_FAILED" })));
  });
}

function sqliteMetadata(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    assert.deepEqual(db.prepare("PRAGMA integrity_check").all().map(row => row.integrity_check), ["ok"]);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
    const migrations = db.prepare('SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name').all();
    assert.ok(migrations.length, "Missing migration history");
    assert.equal(db.prepare('SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL').get().n, 0);
    const hasAttachment = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Attachment'").get();
    return { migrations, bookings: db.prepare("SELECT count(*) AS n FROM Booking").get().n,
      attachments: hasAttachment ? db.prepare("SELECT count(*) AS n FROM Attachment").get().n : null };
  } finally {
    db.close();
  }
}

export async function verifyBackupPayload(directory) {
  const db = path.join(directory, "snapshot.db");
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  if (manifest.version !== 1 || await fileHash(db) !== manifest.databaseHash ||
      !same(await mediaManifest(path.join(directory, "uploads")), manifest.media) ||
      !same(sqliteMetadata(db), manifest.database)) fail("MANIFEST_MISMATCH");
  return manifest;
}

function validateKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) fail("INVALID_KEY");
}

async function encrypt(archive, envelope, key) {
  const size = (await stat(archive)).size;
  if (!size || size > maxBytes) fail("ARCHIVE_SIZE_OUT_OF_RANGE");
  const nonce = randomBytes(12);
  const header = Buffer.concat([magic, nonce]);
  await writeFile(envelope, header, { mode: 0o600, flag: "wx" });
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(header);
  await pipeline(createReadStream(archive), cipher, createWriteStream(envelope, { flags: "a" }));
  await writeFile(envelope, cipher.getAuthTag(), { flag: "a" });
}

async function decrypt(envelope, archive, key) {
  const input = await open(envelope, "r");
  try {
    const { size } = await input.stat();
    const encryptedSize = size - headerSize - tagSize;
    if (encryptedSize <= 0 || encryptedSize > maxBytes) fail("ARCHIVE_SIZE_OUT_OF_RANGE");
    const header = Buffer.alloc(headerSize), tag = Buffer.alloc(tagSize);
    if ((await input.read(header, 0, headerSize, 0)).bytesRead !== headerSize ||
        (await input.read(tag, 0, tagSize, size - tagSize)).bytesRead !== tagSize ||
        !header.subarray(0, magic.length).equals(magic)) fail("INVALID_ENVELOPE");
    const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(magic.length));
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    try {
      await pipeline(input.createReadStream({ start: headerSize, end: size - tagSize - 1, autoClose: false }),
        decipher, createWriteStream(archive, { mode: 0o600, flags: "wx" }));
    } catch {
      fail("DECRYPT_FAILED");
    }
  } finally {
    await input.close();
  }
}

export async function createBackup({ source, media, output, key, revision, environment, writersQuiesced }) {
  validateKey(key);
  if (writersQuiesced !== true || !/^[0-9a-f]{40}$/.test(revision) ||
      !["synthetic", "staging", "production"].includes(environment)) fail("CAPTURE_CONTEXT_REQUIRED");
  if (!(await lstat(source)).isFile() || path.resolve(source) !== await realpath(source) ||
      !(await lstat(media)).isDirectory() || path.resolve(media) !== await realpath(media)) fail("UNSAFE_SOURCE_PATH");
  const mediaRelative = path.relative(media, path.resolve(output));
  if (mediaRelative === "" || (!mediaRelative.startsWith(".." + path.sep) && !path.isAbsolute(mediaRelative))) fail("OUTPUT_INSIDE_MEDIA");
  const parent = await realpath(path.dirname(output));
  if (parent !== path.resolve(path.dirname(output))) fail("UNSAFE_OUTPUT_PATH");
  const dir = await privateDirectory(parent);
  let db;
  try {
    const payload = path.join(dir, "payload");
    await mkdir(payload, { mode: 0o700 });
    const before = await mediaManifest(media);
    const snapshot = path.join(payload, "snapshot.db");
    db = new DatabaseSync(source, { readOnly: true });
    db.exec("PRAGMA busy_timeout=5000; BEGIN");
    // Establish the read snapshot before invoking SQLite's online backup API.
    db.prepare("SELECT count(*) FROM sqlite_master").get();
    await backup(db, snapshot);
    db.exec("ROLLBACK");
    await cp(media, path.join(payload, "uploads"), { recursive: true, errorOnExist: true, force: false });
    if (!same(before, await mediaManifest(media))) fail("MEDIA_CHANGED_DURING_CAPTURE");
    const manifest = { version: 1, createdAt: new Date().toISOString(), revision, environment,
      databaseHash: await fileHash(snapshot), database: sqliteMetadata(snapshot), media: before };
    await writeFile(path.join(payload, "manifest.json"), JSON.stringify(manifest), { mode: 0o600, flag: "wx" });
    await verifyBackupPayload(payload);
    const archive = path.join(dir, "payload.tar");
    const envelope = path.join(dir, "backup.fmd");
    await tar(["-cf", archive, "-C", payload, "manifest.json", "snapshot.db", "uploads"]);
    await encrypt(archive, envelope, key);
    // Publish only a complete encrypted envelope. Hard links refuse replacement.
    await link(envelope, output);
    return { createdAt: manifest.createdAt, revision, environment, mediaFiles: before.length,
      migrations: manifest.database.migrations.length, encryptedBytes: (await stat(envelope)).size };
  } finally {
    db?.close();
    await rm(dir, { recursive: true, force: true });
  }
}

export async function restoreBackup({ input, key, parent = tmpdir(), inspect }) {
  validateKey(key);
  const dir = await privateDirectory(parent);
  try {
    const archive = path.join(dir, "payload.tar");
    const payload = path.join(dir, "payload");
    // Authenticate the entire encrypted envelope before extracting our own tar format.
    await decrypt(input, archive, key);
    await mkdir(payload, { mode: 0o700 });
    await tar(["-xf", archive, "-C", payload]);
    const manifest = await verifyBackupPayload(payload);
    await inspect?.(payload, manifest);
    return { createdAt: manifest.createdAt, revision: manifest.revision, environment: manifest.environment,
      mediaFiles: manifest.media.length, migrations: manifest.database.migrations.length, integrity: "ok", foreignKeys: "ok" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function captureTarget(mode, env) {
  if (mode === "staging" && isStagingRecoveryTarget(env)) return;
  if (mode === "production" && env.FMD_ALLOW_PRODUCTION_CAPTURE === "approved" &&
      env.STAGING_MODE !== "true" &&
      env.RAILWAY_PROJECT_ID === "a6e2306d-dca7-4dd6-8cb8-2be65b72bcd9" &&
      env.RAILWAY_ENVIRONMENT_ID === "29134135-d1e0-4cc7-a9c2-3d376c692b74" &&
      env.RAILWAY_SERVICE_ID === "3f70cb91-a528-4931-80b3-5b2e47839a48" &&
      env.DATABASE_URL === "file:/data/fixmydoor.db" &&
      (env.UPLOAD_DIR ?? "/data/uploads") === "/data/uploads") return;
  fail("UNAPPROVED_CAPTURE_TARGET");
}

async function main([operation, mode, artifact, keyFile], env) {
  if (!artifact || !keyFile) fail("USAGE: capture staging|production <artifact> <keyfile> OR verify disposable <artifact> <keyfile>");
  if (operation === "capture") {
    captureTarget(mode, env);
    const target = path.resolve(artifact);
    if (!target.startsWith(path.resolve(tmpdir()) + path.sep)) fail("CAPTURE_OUTPUT_MUST_BE_TEMPORARY");
    const key = await readKeyFile(keyFile);
    try {
      return await createBackup({ source: "/data/fixmydoor.db", media: "/data/uploads", output: target,
        key, revision: env.RAILWAY_GIT_COMMIT_SHA, environment: mode, writersQuiesced: env.FMD_WRITERS_QUIESCED === "yes" });
    } finally {
      key.fill(0);
    }
  }
  if (operation !== "verify" || mode !== "disposable") fail("UNKNOWN_OPERATION");
  const key = await readKeyFile(keyFile);
  try {
    return await restoreBackup({ input: artifact, key });
  } finally {
    key.fill(0);
  }
}

async function readKeyFile(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.size !== 32 ||
      (process.platform !== "win32" && (info.mode & 0o077))) fail("UNSAFE_KEY_FILE");
  return readFile(file);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log("BACKUP_OK", JSON.stringify(await main(process.argv.slice(2), process.env)));
  } catch (error) {
    const code = typeof error.code === "string" && /^[A-Z_]+$/.test(error.code) ? error.code : "VERIFICATION_FAILED";
    console.error("BACKUP_FAILED", code);
    process.exitCode = 1;
  }
}
