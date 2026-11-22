import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createBackupWindow } from "../server/backup-window.ts";
import { createBackup, restoreBackup } from "../scripts/portable-backup.mjs";

test("media gate is single flight, releases on failure, and preserves booking writes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fmd-online-test-"));
  const source = path.join(root, "source.db"), media = path.join(root, "media"), output = path.join(root, "capture.fmd");
  const key = randomBytes(32);
  const db = new DatabaseSync(source);
  const gate = createBackupWindow();
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
      CREATE TABLE Booking(id TEXT PRIMARY KEY);
      CREATE TABLE _prisma_migrations(migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);
      INSERT INTO _prisma_migrations VALUES ('example','hash','done',NULL);
      INSERT INTO Booking VALUES ('existing');`);
    await mkdir(media);
    await writeFile(path.join(media, "cms.jpg"), "media fixture");
    const first = gate.capture(() => createBackup({ source, media, output, key, revision: "a".repeat(40),
      environment: "staging", stagingMediaGate: true }));
    assert.equal(gate.mediaPaused, true);
    await assert.rejects(gate.capture(async () => {}), /already active/);
    db.prepare("INSERT INTO Booking VALUES (?)").run("accepted-during-window");
    await first;
    assert.equal(gate.mediaPaused, false);
    await restoreBackup({ input: output, key, parent: root, inspect: (_directory, manifest) => {
      assert.equal(manifest.database.bookings, 2);
      assert.equal(manifest.media.length, 1);
    } });
    assert.equal(db.prepare("SELECT count(*) AS total FROM Booking").get().total, 2);
    await assert.rejects(gate.capture(async () => { throw new Error("capture failed"); }), /capture failed/);
    assert.equal(gate.mediaPaused, false);
    await assert.rejects(createBackup({ source, media, output, key, revision: "a".repeat(40),
      environment: "production", stagingMediaGate: true }), { code: "CAPTURE_CONTEXT_REQUIRED" });
  } finally {
    db.close();
    key.fill(0);
    await rm(root, { recursive: true, force: true });
  }
});
