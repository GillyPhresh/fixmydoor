import assert from "node:assert/strict";
import test from "node:test";
import { runStartupMigrations } from "../server/startup.ts";

function createLogger() {
  const messages = [];
  return {
    messages,
    log: (...values) => messages.push(values.join(" ")),
    error: (...values) => messages.push(values.join(" ")),
  };
}

test("does not run deployment migrations outside production", () => {
  const logger = createLogger();
  let migrationCalls = 0;

  runStartupMigrations("test", () => {
    migrationCalls += 1;
  }, logger);

  assert.equal(migrationCalls, 0);
  assert.deepEqual(logger.messages, []);
});

test("reports successful production migrations before startup proceeds", () => {
  const logger = createLogger();
  let migrationCalls = 0;

  runStartupMigrations("production", () => {
    migrationCalls += 1;
  }, logger);

  assert.equal(migrationCalls, 1);
  assert.deepEqual(logger.messages, [
    "Running database migrations...",
    "Database migrations completed.",
  ]);
});

test("fails closed and never reports readiness after a migration error", () => {
  const logger = createLogger();

  assert.throws(
    () => runStartupMigrations("production", () => {
      throw new Error("synthetic migration failure");
    }, logger),
    /Required database migration failed; application startup aborted\./,
  );
  assert.deepEqual(logger.messages, [
    "Running database migrations...",
    "Database migration failed; startup aborted.",
  ]);
});
