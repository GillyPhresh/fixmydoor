import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isStagingRecoveryTarget } from "./rehearse-staging-recovery.mjs";

// A single boot maintenance window. No API server or background writer has started.
export function makeStartupGate(task, { waitMs = 500, budgetMs = 110_000 } = {}) {
  let run;
  return () => run ??= (async () => {
    await delay(waitMs);
    return task(budgetMs);
  })();
}

export function runBoundedChild(file, budgetMs, env = process.env, stdio = "inherit") {
  return new Promise((resolve, reject) => {
    const group = process.platform !== "win32";
    const child = spawn(process.execPath, [file], { detached: group, stdio, env });
    let timedOut = false;
    const timer = setTimeout(() => {
      if (!child.pid) return;
      timedOut = true;
      try {
        if (group) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") reject(error);
      }
    }, budgetMs);
    child.once("close", code => {
      clearTimeout(timer);
      resolve(timedOut ? "timeout" : code === 0 ? "pass" : "failed");
    });
    child.once("error", error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!isStagingRecoveryTarget(process.env)) {
    console.error("STAGING_GATE_REJECTED_TARGET");
    process.exitCode = 1;
  } else {
    const script = fileURLToPath(new URL("./rehearse-portable-staging.mjs", import.meta.url));
    const gate = makeStartupGate(budget => {
      console.log("STAGING_GATE_WRITERS_OFFLINE");
      return runBoundedChild(script, budget);
    });
    try {
      const result = await gate();
      console.log("STAGING_GATE_RELEASED", result);
      if (result !== "pass") process.exitCode = 1;
    } catch {
      console.error("STAGING_GATE_FAILED");
      process.exitCode = 1;
    }
  }
}
