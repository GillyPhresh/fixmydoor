import { execSync } from "node:child_process";

type StartupLogger = Pick<Console, "log" | "error">;

export function runStartupMigrations(
  nodeEnv: string | undefined,
  runMigration: () => void = () => {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  },
  logger: StartupLogger = console,
): void {
  if (nodeEnv !== "production") return;

  logger.log("Running database migrations...");
  try {
    runMigration();
  } catch {
    logger.error("Database migration failed; startup aborted.");
    throw new Error("Required database migration failed; application startup aborted.");
  }
  logger.log("Database migrations completed.");
}
