import assert from "node:assert/strict";
import { lstat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBackup, readBackupKey, restoreBackup } from "./portable-backup.mjs";
import { isStagingRecoveryTarget, smoke } from "./rehearse-staging-recovery.mjs";

const [phase, directory] = process.argv.slice(2);
try {
  if (!isStagingRecoveryTarget(process.env) ||
      !directory || path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
      !path.basename(directory).startsWith(".fmd-backup-online-")) throw new Error("Unapproved staging drill");
  const backup = path.join(directory, "snapshot.fmd");
  const key = await readBackupKey(path.join(directory, "fmd-backup-key"));
  try {
    if (phase === "capture") {
      let media = "/data/uploads";
      if (!await lstat(media).catch(cause => {
        if (cause.code !== "ENOENT") throw cause;
        return null;
      })) {
        media = path.join(directory, "empty-media");
        await mkdir(media, { mode: 0o700 });
      }
      const manifest = await createBackup({ source: "/data/fixmydoor.db", media, output: backup,
        key, revision: process.env.RAILWAY_GIT_COMMIT_SHA, environment: "staging", stagingMediaGate: true });
      console.log("ONLINE_BACKUP_CAPTURED", JSON.stringify(manifest));
    } else if (phase === "verify") {
      const restore = await restoreBackup({ input: backup, key, parent: directory, inspect: smoke });
      assert.equal(restore.environment, "staging");
      console.log("ONLINE_BACKUP_RESTORED", JSON.stringify(restore));
    } else throw new Error("Unknown staging drill phase");
  } finally { key.fill(0); }
} catch {
  console.error("ONLINE_BACKUP_CHILD_FAILED");
  process.exitCode = 1;
}
