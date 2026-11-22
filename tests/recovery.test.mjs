import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isStagingRecoveryTarget, rehearse } from "../scripts/rehearse-staging-recovery.mjs";

test("rehearsal preserves a committed WAL snapshot and rejects damaged restores", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fixmydoor-recovery-tool-"));
  const file = path.join(root, "source.db");
  const db = new DatabaseSync(file);
  try {
    db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA wal_autocheckpoint=0;
      CREATE TABLE Booking(id TEXT PRIMARY KEY, customerToken TEXT, photos TEXT);
      CREATE TABLE Attachment(id TEXT PRIMARY KEY, bookingId TEXT REFERENCES Booking(id), image BLOB);
      CREATE TABLE ContentItem(id TEXT, image TEXT, accentImage TEXT);
      CREATE TABLE _prisma_migrations(migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);
      INSERT INTO Booking VALUES ('synthetic', 'synthetic-token', '[]');
      INSERT INTO Attachment VALUES ('photo', 'synthetic', X'0123');
      INSERT INTO _prisma_migrations VALUES ('synthetic', 'checksum', 'done', NULL);
    `);
    assert.ok((await readFile(file + "-wal")).length > 32);
    const media = path.join(root, "media");
    await mkdir(path.join(media, "published"), { recursive: true });
    await writeFile(path.join(media, "legacy.jpg"), "legacy fixture");
    await writeFile(path.join(media, "published", "public.jpg"), "public fixture");
    assert.deepEqual(await rehearse(file, media, { runApp: false }), {
      bookings: 1, attachments: 1, migrations: 1, mediaFiles: 2,
      integrity: "ok", foreignKeys: "ok", corruptAndIncompleteRejected: true, appSmoke: false,
    });
    assert.equal(db.prepare("SELECT customerToken FROM Booking").get().customerToken, "synthetic-token");
    assert.equal(isStagingRecoveryTarget({ STAGING_MODE: "true", DATABASE_URL: "file:/data/fixmydoor.db" }), false);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("consistent online SQLite backup restores committed WAL, attachment bytes and quiesced media", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fixmydoor-recovery-"));
  let live, restored;
  try {
    live = new DatabaseSync(path.join(root, "live.db"));
    live.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE Booking(id TEXT PRIMARY KEY, token TEXT UNIQUE); CREATE TABLE Attachment(id TEXT PRIMARY KEY, bookingId TEXT REFERENCES Booking(id), bytes BLOB);"
    );
    live
      .prepare("INSERT INTO Booking VALUES (?,?)")
      .run("synthetic-id", "synthetic-preserved-token");
    live
      .prepare("INSERT INTO Attachment VALUES (?,?,?)")
      .run(
        "synthetic-photo",
        "synthetic-id",
        Buffer.from("synthetic-private-photo")
      );
    const source = path.join(root, "uploads");
    await mkdir(path.join(source, "published"), { recursive: true });
    await writeFile(path.join(source, "legacy.jpg"), "synthetic-legacy");
    await writeFile(
      path.join(source, "published", "public.jpg"),
      "synthetic-public"
    );
    // No filesystem writers are active during this combined rehearsal.
    await backup(live, path.join(root, "restored.db"));
    await cp(source, path.join(root, "restored-uploads"), { recursive: true });
    restored = new DatabaseSync(path.join(root, "restored.db"));
    assert.equal(
      restored.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok"
    );
    assert.deepEqual(restored.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      restored.prepare("SELECT token FROM Booking").get().token,
      "synthetic-preserved-token"
    );
    assert.equal(
      Buffer.from(
        restored.prepare("SELECT bytes FROM Attachment").get().bytes
      ).toString(),
      "synthetic-private-photo"
    );
    assert.equal(
      await readFile(path.join(root, "restored-uploads", "legacy.jpg"), "utf8"),
      "synthetic-legacy"
    );
    assert.equal(
      await readFile(
        path.join(root, "restored-uploads", "published", "public.jpg"),
        "utf8"
      ),
      "synthetic-public"
    );
  } finally {
    restored?.close();
    live?.close();
    await rm(root, { recursive: true, force: true });
  }
});
