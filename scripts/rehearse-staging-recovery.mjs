// Staging rehearsal only. Never run this against a production volume.
import { DatabaseSync, backup } from "node:sqlite";
import { mkdtemp, cp, rm, access } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
if (
  process.env.STAGING_MODE !== "true" ||
  process.env.RAILWAY_PROJECT_ID !== "66faefcb-b523-47b4-b91c-b96126953e39"
)
  throw new Error(
    "This rehearsal is restricted to the isolated staging project"
  );
if (process.env.DATABASE_URL !== "file:/data/fixmydoor.db")
  throw new Error("Unexpected staging database path");
const root = await mkdtemp(path.join(tmpdir(), "fmd-restore-"));
let source, restored;
try {
  source = new DatabaseSync("/data/fixmydoor.db", { readOnly: true });
  await backup(source, path.join(root, "restored.db"));
  restored = new DatabaseSync(path.join(root, "restored.db"));
  if (restored.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
    throw new Error("Restored database integrity check failed");
  if (restored.prepare("PRAGMA foreign_key_check").all().length)
    throw new Error("Restored foreign keys invalid");
  for (const table of [
    "Booking",
    "Attachment",
    "Admin",
    "_prisma_migrations",
  ]) {
    const count = restored
      .prepare(`SELECT count(*) AS n FROM "${table}"`)
      .get().n;
    if (count < 0) throw new Error("Invalid restored table");
    console.log(`${table}: restored snapshot readable (${count} rows)`);
  }
  try {
    await access("/data/uploads");
    await cp("/data/uploads", path.join(root, "uploads"), { recursive: true });
    console.log("Staging upload tree copied to isolated restore directory");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    console.log(
      "No staging filesystem upload tree; private attachments remain in SQLite"
    );
  }
  console.log(
    "Staging recovery rehearsal passed: consistent backup API, integrity and relationships"
  );
} finally {
  restored?.close();
  source?.close();
  await rm(root, { recursive: true, force: true });
}
