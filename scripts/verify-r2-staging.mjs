import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import sharp from "sharp";
import { createBackup, readBackupKey, restoreBackup } from "./portable-backup.mjs";
import { fileHash, smoke } from "./rehearse-staging-recovery.mjs";
import { configuredBackupBucket, configuredR2Client, createBackupStore, verifySyntheticR2Privacy } from "./backup-object-store.mjs";

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const hash = data => createHash("sha256").update(data).digest("hex");

async function verify() {
  const env = process.env;
  if (env.FMD_ALLOW_R2_STAGING_TEST !== "approved" || env.FMD_ALLOW_PRODUCTION_TRANSFER ||
      env.FMD_S3_WRITE_ID === env.FMD_S3_READ_ID) throw new Error("Staging approval and separate roles required");
  const [keyFile, revision] = process.argv.slice(2);
  if (!keyFile || !/^[a-f0-9]{40}$/.test(revision ?? "")) throw new Error("Expected a staging key file and exact commit");
  const bucket = configuredBackupBucket("staging", env);
  const key = await readBackupKey(keyFile);
  let root, db, reader, writer;
  try {
    root = await mkdtemp(path.join(tmpdir(), "fmd-r2-staging-"));
    reader = configuredR2Client("READ", env);
    writer = configuredR2Client("WRITE", env);
    const source = path.join(root, "fixture.db"), media = path.join(root, "uploads");
    const output = path.join(root, "fixture.fmd"), downloaded = path.join(root, "retrieved.fmd");
    const prisma = path.join(path.dirname(require.resolve("prisma/package.json")), "build/index.js");
    await exec(process.execPath, [prisma, "migrate", "deploy"], {
      env: { PATH: env.PATH, DATABASE_URL: "file:" + source.replaceAll("\\", "/"), CHECKPOINT_DISABLE: "1" },
      timeout: 45_000,
    });
    const id = randomUUID(), tracking = randomUUID(), photo = randomUUID();
    const image = await sharp({ create: { width: 12, height: 12, channels: 3, background: "orange" } }).jpeg().toBuffer();
    await mkdir(path.join(media, "published"), { recursive: true });
    await writeFile(path.join(media, "legacy.jpg"), image);
    await writeFile(path.join(media, "published", "cms.jpg"), image);
    db = new DatabaseSync(source);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; PRAGMA foreign_keys=ON;");
    db.prepare("INSERT INTO Booking (id,name,phone,email,address,repairType,customerToken,photos,updatedAt) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
      .run(id, "Synthetic R2 test", "5145550110", "r2-test@example.invalid", "Synthetic", "Door repair", tracking,
        JSON.stringify(["attachment:" + photo, "/uploads/legacy.jpg"]));
    db.prepare("INSERT INTO Attachment (id,bookingId,image) VALUES (?,?,?)").run(photo, id, image);
    await createBackup({ source, media, output, key, revision, environment: "staging", writersQuiesced: true });
    const store = createBackupStore({ reader, writer, bucket, environment: "staging" });
    const result = await store.upload(output, key);
    assert.equal((await store.upload(output, key)).key, result.key);
    const privacy = await verifySyntheticR2Privacy({ endpoint: env.FMD_S3_ENDPOINT, bucket, key: result.key, writer });
    await store.download(result.key, downloaded);
    assert.equal(await fileHash(downloaded), await fileHash(output));
    const restored = await restoreBackup({ input: downloaded, key, parent: root, inspect: async snapshot => {
      const copy = new DatabaseSync(path.join(snapshot, "snapshot.db"), { readOnly: true });
      try {
        assert.equal(copy.prepare("SELECT customerToken FROM Booking WHERE id=?").get(id).customerToken, tracking);
        assert.equal(hash(copy.prepare("SELECT image FROM Attachment WHERE id=? AND bookingId=?").get(photo, id).image), hash(image));
      } finally { copy.close(); }
      assert.equal(await fileHash(path.join(snapshot, "uploads", "legacy.jpg")), hash(image));
      assert.equal(await fileHash(path.join(snapshot, "uploads", "published", "cms.jpg")), hash(image));
      await smoke(snapshot);
    } });
    console.log("R2_STAGING_VERIFIED", JSON.stringify({ key: result.key, bytes: result.bytes, ...privacy, ...restored, appSmoke: true }));
  } finally {
    db?.close();
    reader?.destroy();
    writer?.destroy();
    key.fill(0);
    if (root) await rm(root, { recursive: true, force: true });
  }
}

try {
  await verify();
} catch (cause) {
  const code = typeof cause.code === "string" && /^[A-Z_]+$/.test(cause.code) ? cause.code : "VERIFICATION_FAILED";
  console.error("R2_STAGING_FAILED", code, cause?.$metadata?.httpStatusCode ?? "");
  process.exitCode = 1;
}
