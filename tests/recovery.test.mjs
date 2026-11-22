import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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
