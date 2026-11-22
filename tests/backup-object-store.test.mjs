import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createBackup, restoreBackup } from "../scripts/portable-backup.mjs";
import { createBackupStore, createS3BackupClient, retentionPlan } from "../scripts/backup-object-store.mjs";
import { startFakeS3 } from "./support/backup-s3-fake.mjs";

test("S3 transfer retries interrupted streams and verifies immutable encrypted recovery points", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fmd-s3-test-"));
  const fake = await startFakeS3();
  const config = { endpoint: fake.endpoint, accessKeyId: "synthetic-test-id", secretAccessKey: "synthetic-test-only" };
  const writer = createS3BackupClient(config, { allowLoopback: true });
  const reader = createS3BackupClient(config, { allowLoopback: true });
  const store = createBackupStore({ writer, reader, bucket: fake.bucket, environment: "staging" });
  const key = randomBytes(32);
  const source = path.join(root, "source.db");
  const media = path.join(root, "media");
  const encrypted = path.join(root, "backup.fmd");
  const destination = path.join(root, "retrieved.fmd");
  const db = new DatabaseSync(source);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
      CREATE TABLE Booking (id TEXT PRIMARY KEY, customerToken TEXT);
      CREATE TABLE Attachment (id TEXT PRIMARY KEY, bookingId TEXT REFERENCES Booking(id), image BLOB);
      CREATE TABLE _prisma_migrations (migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);
      INSERT INTO Booking VALUES ('synthetic-booking','synthetic-tracking');
      INSERT INTO Attachment VALUES ('synthetic-photo','synthetic-booking',X'1234');
      INSERT INTO _prisma_migrations VALUES ('first','fixture-checksum','done',NULL);`);
    await mkdir(path.join(media, "published"), { recursive: true });
    await writeFile(path.join(media, "legacy.jpg"), "legacy-private");
    await writeFile(path.join(media, "published", "cms.jpg"), "public-cms");
    assert.ok((await readFile(source + "-wal")).length > 32);
    const options = { source, media, output: encrypted, key, revision: "a".repeat(40), environment: "staging", writersQuiesced: true };
    const captured = await createBackup(options);
    assert.equal((await store.inventory()).status, "missing");
    assert.throws(() => createS3BackupClient(config), { code: "INVALID_STORAGE_ENDPOINT" });
    await assert.rejects(store.upload(encrypted, randomBytes(32)), { code: "DECRYPT_FAILED" });
    assert.equal(fake.calls.put, 0);
    fake.faults.putUnavailable = 3;
    await assert.rejects(store.upload(encrypted, key));
    assert.equal((await store.inventory()).count, 0);
    fake.faults.putUnavailable = 1;
    fake.faults.putLostResponse = 1;
    const uploaded = await store.upload(encrypted, key);
    assert.ok(fake.calls.put >= 6);
    assert.equal(fake.objects.size, 1);
    assert.equal((await store.upload(encrypted, key)).key, uploaded.key);
    assert.equal(fake.objects.size, 1);
    fake.faults.getInterrupted = 1;
    await store.download(uploaded.key, destination);
    assert.deepEqual(await readFile(destination), await readFile(encrypted));
    assert.equal((await restoreBackup({ input: destination, key, parent: root, inspect: async snapshot => {
      const restored = new DatabaseSync(path.join(snapshot, "snapshot.db"), { readOnly: true });
      try {
        assert.equal(restored.prepare("SELECT customerToken FROM Booking WHERE id='synthetic-booking'").get().customerToken, "synthetic-tracking");
        assert.deepEqual(Buffer.from(restored.prepare("SELECT image FROM Attachment").get().image), Buffer.from([0x12, 0x34]));
      } finally { restored.close(); }
      assert.equal(await readFile(path.join(snapshot, "uploads", "legacy.jpg"), "utf8"), "legacy-private");
      assert.equal(await readFile(path.join(snapshot, "uploads", "published", "cms.jpg"), "utf8"), "public-cms");
    } })).foreignKeys, "ok");
    fake.faults.corruptRead = true;
    const corruptOutput = path.join(root, "corrupt.fmd");
    await assert.rejects(store.download(uploaded.key, corruptOutput), { code: "OBJECT_HASH_MISMATCH" });
    await assert.rejects(readFile(corruptOutput), { code: "ENOENT" });
    fake.faults.corruptRead = false;
    const secondArchive = path.join(root, "second.fmd");
    await createBackup({ ...options, output: secondArchive });
    await store.upload(secondArchive, key);
    assert.equal((await store.inventory()).count, 2);
    const later = Date.parse(captured.createdAt) + 48 * 3_600_000;
    assert.equal((await store.inventory(later)).status, "stale");
    assert.deepEqual(retentionPlan("production").Rules[0], { ID: "fixmydoor-expire-v1",
      Filter: { Prefix: "sqlite-media/v1/production/" }, Status: "Enabled", Expiration: { Days: 30 } });
    fake.objects.clear(); // Simulate the provider expiring objects. The backup client has no delete command.
    assert.equal((await store.inventory(later)).status, "missing");
  } finally {
    db.close();
    writer.destroy();
    reader.destroy();
    await fake.close();
    key.fill(0);
    await rm(root, { recursive: true, force: true });
  }
});
