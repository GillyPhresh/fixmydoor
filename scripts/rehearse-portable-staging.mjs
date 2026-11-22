import { randomBytes } from "node:crypto";
import { lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBackup, restoreBackup } from "./portable-backup.mjs";
import { isStagingRecoveryTarget, smoke } from "./rehearse-staging-recovery.mjs";

async function run() {
  if (!isStagingRecoveryTarget(process.env)) throw new Error("Expected isolated staging IDs");
  const directory = await mkdtemp(path.join(tmpdir(), "fmd-portable-staging-"));
  const key = randomBytes(32);
  try {
    const output = path.join(directory, "staging.fmd");
    let media = "/data/uploads";
    const status = await lstat(media).catch(error => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (status === null) {
      media = path.join(directory, "empty-media");
      await mkdir(media, { mode: 0o700 });
    }
    const capture = await createBackup({ source: "/data/fixmydoor.db", media, output, key,
      revision: process.env.RAILWAY_GIT_COMMIT_SHA, environment: "staging", writersQuiesced: true });
    const restored = await restoreBackup({ input: output, key, parent: directory, inspect: smoke });
    console.log("PORTABLE_STAGING_PASS", JSON.stringify({ ...capture, ...restored, appSmoke: true }));
  } finally {
    key.fill(0);
    await rm(directory, { recursive: true, force: true });
  }
}

try {
  await run();
} catch (error) {
  const code = typeof error.code === "string" && /^[A-Z_]+$/.test(error.code) ? error.code : "VERIFICATION_FAILED";
  console.error("PORTABLE_STAGING_FAIL", code);
  process.exitCode = 1;
}
