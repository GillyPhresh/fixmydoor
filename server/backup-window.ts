import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export function createBackupWindow() {
  let active = false;
  return {
    get mediaPaused() { return active; },
    async capture<T>(operation: () => Promise<T>): Promise<T> {
      if (active) throw new Error("Backup window already active");
      active = true;
      try { return await operation(); }
      finally { active = false; }
    },
  };
}

type BackupWindow = ReturnType<typeof createBackupWindow>;

function stageTarget(env: NodeJS.ProcessEnv) {
  return env.STAGING_MODE === "true" &&
    env.RAILWAY_PROJECT_ID === "66faefcb-b523-47b4-b91c-b96126953e39" &&
    env.RAILWAY_ENVIRONMENT_ID === "78c4b506-61e1-4792-937c-c4ca7133d3a4" &&
    env.RAILWAY_SERVICE_ID === "76e8013f-fb71-4aad-8e3b-4c852a3e07c3";
}

function runDrill(phase: "capture" | "verify", directory: string, timeout: number) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/rehearse-live-capture.mjs", phase, directory], {
      detached: true, stdio: "inherit",
      env: { PATH: process.env.PATH, STAGING_MODE: process.env.STAGING_MODE,
        RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID: process.env.RAILWAY_ENVIRONMENT_ID,
        RAILWAY_SERVICE_ID: process.env.RAILWAY_SERVICE_ID, RAILWAY_GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
        DATABASE_URL: process.env.DATABASE_URL, UPLOAD_DIR: process.env.UPLOAD_DIR },
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); }
        catch { child.kill("SIGKILL"); }
      }
    }, timeout);
    child.once("error", () => { clearTimeout(timer); reject(new Error("Could not start backup drill")); });
    child.once("close", code => {
      clearTimeout(timer);
      if (timedOut || code !== 0) reject(new Error(timedOut ? "Backup drill timeout" : "Backup drill failed"));
      else resolve();
    });
  });
}

export function scheduleStagingBackupDrill(window: BackupWindow) {
  if (process.platform !== "linux" || process.env.FMD_STAGING_ONLINE_BACKUP_DRILL !== "true" || !stageTarget(process.env)) return;
  // One attempt after staging starts serving requests. No trigger is exposed over HTTP.
  setTimeout(() => {
    void (async () => {
      const directory = await mkdtemp(path.join(tmpdir(), ".fmd-backup-online-"));
      try {
        await writeFile(path.join(directory, "fmd-backup-key"), randomBytes(32), { mode: 0o600, flag: "wx" });
        await window.capture(async () => {
          console.log("ONLINE_BACKUP_MEDIA_PAUSED");
          await runDrill("capture", directory, 30_000);
        });
        console.log("ONLINE_BACKUP_MEDIA_AVAILABLE");
        await runDrill("verify", directory, 100_000);
        console.log("ONLINE_BACKUP_DRILL_PASS");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    })().catch(() => console.error("ONLINE_BACKUP_DRILL_FAILED"));
  }, 1000).unref();
}
