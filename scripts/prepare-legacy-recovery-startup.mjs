import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const legacySourceDigest = "358d75cbdcbdda8d71053197a930a090161168fbeec6e65871faff43aa61ebd9";
export const legacySchemaSql = "SELECT type, name, sql FROM sqlite_schema ORDER BY type, name";
export const legacyMigrationSql = `SELECT migration_name, checksum, CASE WHEN rolled_back_at IS NOT NULL THEN 'rolled-back' WHEN finished_at IS NOT NULL THEN 'applied' ELSE 'pending' END AS state FROM "_prisma_migrations" ORDER BY migration_name, id`;
export const legacyRecoveryDigest = (schema, migrations) => createHash("sha256")
  .update(JSON.stringify({ schema, migrations })).digest("hex");

export function guardLegacySource(input) {
  let source = input.replaceAll("\r\n", "\n");
  assert.equal(createHash("sha256").update(source).digest("hex"), legacySourceDigest, "Unexpected legacy application source");
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, "Unexpected legacy patch location");
    source = source.replace(before, after);
  };
  const replaceRange = (first, next, replacement = "") => {
    assert.equal(source.split(first).length, 2, "Unexpected legacy patch location");
    const start = source.indexOf(first);
    const end = source.indexOf(next, start + first.length);
    assert.ok(end > start, "Unexpected legacy patch boundary");
    source = source.slice(0, start) + replacement + source.slice(end);
  };
  replace('import { execSync } from "child_process";', 'import { createHash } from "node:crypto";');
  const start = source.indexOf("async function startServer() {");
  const express = source.indexOf("  const app = express();", start);
  assert.ok(start >= 0 && express > start);
  source = source.slice(0, start) + `async function startServer() {
  const expected = process.env.FMD_LEGACY_RECOVERY_SCHEMA_SHA256;
  if (process.env.FMD_LEGACY_RECOVERY_STARTUP !== "approved" || !/^[a-f0-9]{64}$/.test(expected ?? "")) {
    throw new Error("Legacy recovery startup requires approval and an expected schema fingerprint");
  }
  const control = process.env.FMD_LEGACY_RECOVERY_CONTROL_DIR ?? "";
  const controlInfo = new RegExp("^/tmp/fmd-[A-Za-z0-9-]+$").test(control) ? fs.lstatSync(control, { throwIfNoEntry: false }) : undefined;
  if (!controlInfo?.isDirectory() || (controlInfo.mode & 0o077) || controlInfo.uid !== process.getuid?.() ||
      fs.existsSync(path.join(control, "release-reminders"))) throw new Error("Legacy recovery control directory is not private and clean");
  const schema = await prisma.$queryRawUnsafe(${JSON.stringify(legacySchemaSql)});
  const migrations = await prisma.$queryRawUnsafe(${JSON.stringify(legacyMigrationSql)});
  if ((migrations as Array<{ state: string }>).some((migration) => migration.state === "pending")) {
    throw new Error("Legacy recovery found an unfinished migration");
  }
  const digest = createHash("sha256").update(JSON.stringify({ schema, migrations })).digest("hex");
  if (digest !== expected) throw new Error("Legacy recovery schema fingerprint mismatch");
  console.log("LEGACY_RECOVERY_SCHEMA_CHECK_PASSED");

` + source.slice(express);
  replace(`  // Initialize admin user
  await initializeAdminUser();

  // Initialize email service
  emailService.initialize();
  startBookingReminderSweep();
  startWeekendPromotionSweep();`, `  // Preserve request-driven transactional email. Release scheduled reminders separately.
  emailService.initialize();
  startBookingReminderSweep(control);`);
  replace(`function startBookingReminderSweep() {
  void sendDueBookingReminders();
  const reminderTimer = setInterval(() => {
    void sendDueBookingReminders();`, `function startBookingReminderSweep(control: string) {
  const reminderTimer = setInterval(() => {
    if (fs.existsSync(path.join(control, "release-reminders"))) void sendDueBookingReminders();`);
  replaceRange(`async function sendCustomerEmailBroadcast(`, `function isInternationalBooking(`,
    `async function sendCustomerEmailBroadcast(_payload: PushPayload, _type: "advert" | "notification") {
  // Bulk communication is held in the recovery-only artifact.
}

`);
  replaceRange(`      emailService.syncResendContactForBooking(savedBooking)`, `      const emailPromise =`);
  replaceRange(`      emailService.syncResendContactForBooking(normalizedBooking)`, `      if (status && status !== previousStatus && !normalizedBooking.emailOptOut)`);
  replaceRange(`        if (nextStatus === "COMPLETED") {\n          emailService.sendResendAutomationEvent`, `      } else if (status && status !== previousStatus && normalizedBooking.emailOptOut)`);
  replace(`startServer().catch(console.error);`, `startServer().catch((error) => {
  console.error(error instanceof Error ? error.message : "Legacy recovery startup failed");
  process.exitCode = 1;
});`);
  return source;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, output] = process.argv.slice(2);
  assert.ok(source && output && source !== output, "Expected separate source and output paths");
  await writeFile(output, guardLegacySource(await readFile(source, "utf8")), { flag: "wx" });
}
