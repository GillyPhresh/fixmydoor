import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createBackup, restoreBackup, verifyBackupPayload } from "../scripts/portable-backup.mjs";

test("portable backup preserves committed WAL, legacy and public media through authenticated restore", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fmd-portable-test-"));
  const source = path.join(root, "source.db"), media = path.join(root, "media");
  const output = path.join(root, "synthetic.fmd"), key = randomBytes(32);
  const db = new DatabaseSync(source);
  try {
    db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA wal_autocheckpoint=0;
      PRAGMA foreign_keys=ON;
      CREATE TABLE Booking(id TEXT PRIMARY KEY, customerToken TEXT);
      CREATE TABLE Attachment(id TEXT PRIMARY KEY, bookingId TEXT REFERENCES Booking(id), image BLOB);
      CREATE TABLE _prisma_migrations(migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);
      INSERT INTO Booking VALUES ('booking-synthetic','tracking-synthetic');
      INSERT INTO Attachment VALUES ('attachment-synthetic','booking-synthetic',X'0123');
      INSERT INTO _prisma_migrations VALUES ('synthetic','checksum','done',NULL);
    `);
    assert.ok((await readFile(source + "-wal")).length > 32);
    await mkdir(path.join(media, "published"), { recursive: true });
    await writeFile(path.join(media, "legacy.jpg"), "legacy media bytes");
    await writeFile(path.join(media, "published", "cms.jpg"), "published media bytes");
    const options = { source, media, output, key, revision: "a".repeat(40), environment: "synthetic", writersQuiesced: true };
    await assert.rejects(createBackup({ ...options, writersQuiesced: false }), { code: "CAPTURE_CONTEXT_REQUIRED" });
    await assert.rejects(createBackup({ ...options, output: path.join(media, "bad.fmd") }), { code: "OUTPUT_INSIDE_MEDIA" });
    assert.equal((await createBackup(options)).mediaFiles, 2);
    const ciphertext = await readFile(output);
    assert.ok(!ciphertext.includes(Buffer.from("tracking-synthetic")));
    await assert.rejects(createBackup(options), { code: "EEXIST" });
    assert.deepEqual(await readFile(output), ciphertext);
    const result = await restoreBackup({ input: output, key, parent: root, inspect: async (restored, manifest) => {
      assert.equal(manifest.database.bookings, 1);
      const copy = new DatabaseSync(path.join(restored, "snapshot.db"), { readOnly: true });
      try {
        assert.equal(copy.prepare("SELECT customerToken FROM Booking").get().customerToken, "tracking-synthetic");
        assert.deepEqual(Buffer.from(copy.prepare("SELECT image FROM Attachment").get().image), Buffer.from([1, 35]));
      } finally {
        copy.close();
      }
      assert.equal(await readFile(path.join(restored, "uploads", "legacy.jpg"), "utf8"), "legacy media bytes");
      const publicPhoto = path.join(restored, "uploads", "published", "cms.jpg");
      assert.equal(await readFile(publicPhoto, "utf8"), "published media bytes");
      await unlink(publicPhoto);
      await assert.rejects(verifyBackupPayload(restored), { code: "MANIFEST_MISMATCH" });
    } });
    assert.equal(result.integrity, "ok");
    assert.equal(result.foreignKeys, "ok");
    await assert.rejects(restoreBackup({ input: output, key: randomBytes(32), parent: root }), { code: "DECRYPT_FAILED" });
    const damaged = path.join(root, "damaged.fmd");
    const modified = Buffer.from(ciphertext);
    modified[Math.floor(modified.length / 2)] ^= 1;
    for (const invalid of [modified, ciphertext.subarray(0, ciphertext.length - 1)]) {
      await writeFile(damaged, invalid);
      await assert.rejects(restoreBackup({ input: damaged, key, parent: root }), { code: "DECRYPT_FAILED" });
    }
    assert.equal(db.prepare("SELECT count(*) AS n FROM Booking").get().n, 1);
  } finally {
    db.close();
    key.fill(0);
    await rm(root, { recursive: true, force: true });
  }
});

test("capture CLI rejects a production target before opening files", () => {
  const run = spawnSync(process.execPath, ["scripts/portable-backup.mjs", "capture", "production", "unused", "unused"], {
    encoding: "utf8", env: { ...process.env, FMD_ALLOW_PRODUCTION_CAPTURE: "" },
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /BACKUP_FAILED UNAPPROVED_CAPTURE_TARGET/);
});
