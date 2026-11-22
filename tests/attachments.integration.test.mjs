import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import session from "express-session";

let root;
let databasePath;
let uploadDir;
let server;
let baseUrl;
let prisma;
let sharp;
let saveWithAttachments;
let registerAttachmentRoutes;
let appProcess;
let appUrl;
let smtpServer;
let smtpMessages = [];

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "fixmydoor-attachments-"));
  uploadDir = path.join(root, "uploads");
  const smtpPortProbe = createNetServer();
  await new Promise(resolve => smtpPortProbe.listen(0, "127.0.0.1", resolve));
  const smtpPort = smtpPortProbe.address().port;
  await new Promise(resolve => smtpPortProbe.close(resolve));
  smtpServer = createNetServer(socket => {
    socket.setEncoding("utf8");
    socket.write("220 synthetic.test ESMTP\r\n");
    let input = "";
    let message = "";
    let dataMode = false;
    socket.on("data", chunk => {
      input += chunk;
      let boundary;
      while ((boundary = input.indexOf("\r\n")) >= 0) {
        const line = input.slice(0, boundary);
        input = input.slice(boundary + 2);
        if (dataMode) {
          if (line === ".") {
            smtpMessages.push(message);
            message = "";
            dataMode = false;
            socket.write("250 message accepted by synthetic test provider\r\n");
          } else {
            message += `${line}\n`;
          }
          continue;
        }
        const command = line.split(" ", 1)[0].toUpperCase();
        if (command === "EHLO" || command === "HELO") socket.write("250-synthetic.test\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 10000000\r\n");
        else if (command === "AUTH") socket.write("235 authenticated\r\n");
        else if (command === "MAIL" || command === "RCPT" || command === "RSET") socket.write("250 accepted\r\n");
        else if (command === "DATA") { dataMode = true; socket.write("354 end with dot\r\n"); }
        else if (command === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 accepted\r\n");
      }
    });
  });
  await new Promise(resolve => smtpServer.listen(smtpPort, "127.0.0.1", resolve));
  databasePath = path.join(process.cwd(), "prisma", `attachments-test-${process.pid}.db`);
  process.env.DATABASE_URL = `file:./attachments-test-${process.pid}.db`;
  const cli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const initialized = spawnSync(process.execPath, [cli, "db", "push", "--skip-generate"], { encoding: "utf8", env: { ...process.env, CI: "true", RUST_LOG: "debug" } });
  assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);

  ({ prisma } = await import("../server/prisma.ts"));
  ({ saveWithAttachments, registerAttachmentRoutes } = await import("../server/attachments.ts"));
  sharp = (await import("sharp")).default;
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use(session({ secret: "synthetic-test-secret-at-least-32-characters", resave: false, saveUninitialized: false }));
  const requireStaff = (req, res, next) => req.header("x-test-staff") === "yes" ? next() : res.sendStatus(401);
  registerAttachmentRoutes(app, requireStaff, uploadDir);
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const portProbe = createNetServer();
  await new Promise(resolve => portProbe.listen(0, "127.0.0.1", resolve));
  const appPort = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const { createAdminUser } = await import("../server/auth.ts");
  await createAdminUser("synthetic-admin", "SyntheticPass2026");
  appUrl = `http://127.0.0.1:${appPort}`;
  appProcess = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(appPort), NODE_ENV: "test", PUBLIC_SITE_URL: `http://127.0.0.1:${appPort}`, SESSION_SECRET: "synthetic-session-secret-at-least-thirty-two-characters", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtpPort), SMTP_USER: "synthetic@example.invalid", SMTP_PASS: "synthetic-test-password", FROM_EMAIL: "FixMyDoor Test <synthetic@example.invalid>", ADMIN_EMAIL: "admin@example.invalid", RESEND_API_KEY: "", RESEND_SETUP_AUTOMATION_EVENTS: "" },
    stdio: "ignore",
  });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (appProcess.exitCode !== null) throw new Error(`Synthetic app exited with ${appProcess.exitCode}`);
    try {
      const response = await fetch(`${appUrl}/api/health`);
      if (response.ok && (await response.json()).checks.database === "connected") { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, "real Express app must start on the disposable database");
});

after(async () => {
  if (appProcess && appProcess.exitCode === null) {
    appProcess.kill();
    await new Promise(resolve => appProcess.once("exit", resolve));
  }
  if (server) await new Promise(resolve => server.close(resolve));
  if (smtpServer) await new Promise(resolve => smtpServer.close(resolve));
  if (prisma) await prisma.$disconnect();
  if (root) await rm(root, { recursive: true, force: true });
  if (databasePath) await rm(databasePath, { force: true });
  if (databasePath) await rm(`${databasePath}-journal`, { force: true });
  await Promise.all(["batch2-synthetic.db", "migration-history-test.db"].flatMap(name => ["", "-journal", "-wal", "-shm"].map(suffix => rm(path.join(process.cwd(), "prisma", `${name}${suffix}`), { force: true }))));
});

async function newSession(target = baseUrl) {
  const response = await fetch(`${target}/api/media/session`, { method: "POST" });
  assert.equal(response.status, 204);
  return response.headers.get("set-cookie").split(";")[0];
}

async function upload(cookie, images, replace = [], target = baseUrl) {
  return fetch(`${target}/api/media`, {
    method: "POST", headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ images, replace }),
  });
}

function bookingRequest(photos) {
  return { name: "Synthetic Test", phone: "5145550100", email: "test@example.invalid", address: "1 Test Street", repairType: "Door repair", photos, customerConsent: false };
}

test("upload session and actual image validation", async () => {
  const jpeg = await sharp({ create: { width: 12, height: 12, channels: 3, background: "red" } }).jpeg().toBuffer();
  const data = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const oversized = Buffer.alloc(1_800_001).toString("base64");
  const excessiveDimensions = await sharp({ create: { width: 8193, height: 1, channels: 3, background: "red" } }).jpeg().toBuffer();
  assert.equal((await upload("", [data])).status, 403);
  const cookie = await newSession();
  assert.equal((await upload(cookie, ["data:image/jpeg;base64,SGVsbG8="])).status, 400);
  assert.equal((await upload(cookie, [`data:image/png;base64,${jpeg.toString("base64")}`])).status, 400);
  assert.equal((await upload(cookie, [`data:image/jpeg;base64,${oversized}`])).status, 400);
  assert.equal((await upload(cookie, [`data:image/jpeg;base64,${excessiveDimensions.toString("base64")}`])).status, 400);
  assert.equal((await upload(cookie, ["data:image/svg+xml;base64,PHN2Zz4="])).status, 400);
  assert.equal((await upload(cookie, [data, data, data, data])).status, 400);
  assert.equal((await upload(cookie, [data])).status, 201);
});

test("claims are session-bound, atomic, and cannot be repeated", async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } }).png().toBuffer();
  const cookie = await newSession();
  const response = await upload(cookie, [`data:image/png;base64,${png.toString("base64")}`]);
  const { refs } = await response.json();
  const attachmentId = refs[0].slice("attachment:".length);
  const owner = (await prisma.attachment.findUnique({ where: { id: attachmentId } })).owner;
  await assert.rejects(saveWithAttachments(bookingRequest(refs), "wrong-session"), /select the photos again/);
  assert.equal(await prisma.booking.count(), 0);
  assert.equal((await prisma.attachment.findUnique({ where: { id: attachmentId } })).owner, owner);
  const booking = await saveWithAttachments(bookingRequest(refs), owner);
  assert.equal(booking.photos.length, 1);
  const imageUrl = `${baseUrl}${booking.photos[0]}`;
  assert.equal((await fetch(imageUrl)).status, 401);
  assert.equal((await fetch(imageUrl, { headers: { "x-test-staff": "yes" } })).status, 200);
  await assert.rejects(saveWithAttachments(bookingRequest(refs), owner), /select the photos again/);
  assert.equal(await prisma.booking.count(), 1);

  const expiredResponse = await upload(cookie, [`data:image/png;base64,${png.toString("base64")}`]);
  const { refs: expiredRefs } = await expiredResponse.json();
  await prisma.attachment.update({ where: { id: expiredRefs[0].slice(11) }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
  await assert.rejects(saveWithAttachments(bookingRequest(expiredRefs), owner), /select the photos again/);
  assert.equal(await prisma.booking.count(), 1);
  await prisma.booking.delete({ where: { id: booking.id } });
  assert.equal(await prisma.attachment.count({ where: { id: attachmentId } }), 0, "booking deletion cascades only its private attachment records");
});

test("private image route requires staff and public paths deny orphan files", async () => {
  const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: "green" } }).jpeg().toBuffer();
  const booking = await saveWithAttachments(bookingRequest([]));
  await prisma.booking.update({ where: { id: booking.id }, data: { photos: JSON.stringify([`data:image/jpeg;base64,${jpeg.toString("base64")}`]) } });
  const privateUrl = `${baseUrl}/api/admin/bookings/${booking.id}/photos/0`;
  assert.equal((await fetch(privateUrl)).status, 401);
  const staffResponse = await fetch(privateUrl, { headers: { "x-test-staff": "yes" } });
  assert.equal(staffResponse.status, 200);
  assert.match(staffResponse.headers.get("cache-control"), /no-store/);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, "orphan.jpg"), jpeg);
  assert.equal((await fetch(`${baseUrl}/uploads/orphan.jpg`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/uploads/%2e%2e%2fsecret.jpg`)).status, 404);

  await writeFile(path.join(uploadDir, "legacy-private.jpg"), jpeg);
  await prisma.booking.update({ where: { id: booking.id }, data: { photos: JSON.stringify(["/uploads/legacy-private.jpg"]) } });
  assert.equal((await fetch(privateUrl)).status, 401);
  assert.equal((await fetch(privateUrl, { headers: { "x-test-staff": "yes" } })).status, 200);
  await prisma.booking.update({ where: { id: booking.id }, data: { photos: JSON.stringify(["/uploads/missing-legacy.jpg"]) } });
  assert.equal((await fetch(privateUrl, { headers: { "x-test-staff": "yes" } })).status, 404);

  await mkdir(path.join(uploadDir, "published"), { recursive: true });
  await writeFile(path.join(uploadDir, "published", "approved.jpg"), jpeg);
  assert.equal((await fetch(`${baseUrl}/uploads/approved.jpg`)).status, 200);
  await prisma.contentItem.create({ data: { category: "gallery", title: "Approved synthetic image", image: "/uploads/orphan.jpg", active: true } });
  assert.equal((await fetch(`${baseUrl}/uploads/orphan.jpg`)).status, 200);
});

test("real app preserves booking, tracking, admin auth, and private-photo workflows", async () => {
  const badLogin = await fetch(`${appUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "synthetic-admin", password: "wrong" }) });
  assert.equal(badLogin.status, 401);
  assert.equal((await fetch(`${appUrl}/api/bookings`)).status, 401);

  const login = await fetch(`${appUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "synthetic-admin", password: "SyntheticPass2026" }) });
  assert.equal(login.status, 200);
  const adminCookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await fetch(`${appUrl}/api/bookings`, { headers: { cookie: adminCookie } })).status, 200);
  assert.equal((await fetch(`${appUrl}/api/admin/notifications`, { headers: { cookie: adminCookie } }).then(response => response.json())).enabled, false);
  assert.equal((await fetch(`${appUrl}/api/admin/notifications/send`, { method: "POST", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ title: "test", message: "test" }) })).status, 503);

  const bookingBody = (overrides = {}) => ({
    name: "Synthetic Booking", phone: "5145550101", email: "synthetic@example.invalid", address: "2 Test Street",
    repairType: "Door repair", photos: [], customerConsent: true, securityAnswer: "verified-customer",
    submittedAt: new Date(Date.now() - 2500).toISOString(), website: "", ...overrides,
  });
  const noPhoto = await fetch(`${appUrl}/api/bookings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(bookingBody({ name: "No Photo Synthetic", email: "no-photo@example.invalid" })) });
  assert.equal(noPhoto.status, 201);
  const noPhotoConfirmation = await noPhoto.json();
  assert.match(noPhotoConfirmation.trackingUrl, /\/track\/[a-f0-9]+$/);
  assert.equal((await prisma.booking.findUnique({ where: { customerToken: noPhotoConfirmation.trackingUrl.split("/").at(-1) } })).photos, null);
  const legacyToken = "legacy".padEnd(64, "a");
  await prisma.booking.create({ data: {
    name: "Synthetic Legacy Booking", phone: "5145550099", email: "legacy@example.invalid", address: "Legacy test address",
    repairType: "Door repair", customerToken: legacyToken, adminNotes: "SECRET legacy internal note", staffAssigned: "SECRET legacy technician",
    photos: JSON.stringify(["/uploads/legacy-private.jpg"]),
    statusHistory: JSON.stringify([{ status: "PENDING", changedAt: new Date().toISOString(), note: "SECRET legacy history note" }]),
  } });
  const legacyTracking = await fetch(`${appUrl}/api/bookings/track/${legacyToken}`);
  const legacyTrackingText = await legacyTracking.text();
  assert.equal(legacyTracking.status, 200);
  assert.doesNotMatch(legacyTrackingText, /SECRET|legacy-private\.jpg|technician/);
  assert.match(legacyTrackingText, /PENDING/);
  const noPhotoTrackingPage = await fetch(noPhotoConfirmation.trackingUrl);
  assert.equal(noPhotoTrackingPage.status, 200);
  assert.match(noPhotoTrackingPage.headers.get("cache-control"), /no-store/);
  assert.match(noPhotoTrackingPage.headers.get("referrer-policy"), /no-referrer/);
  assert.match(noPhotoTrackingPage.headers.get("x-robots-tag"), /noindex/);
  assert.ok(smtpMessages.some(message => message.includes("no-photo@example.invalid") && message.includes("Booking Confirmation")), "booking acknowledgement reaches the synthetic SMTP provider");

  const jpeg = await sharp({ create: { width: 20, height: 16, channels: 3, background: "orange" } }).jpeg().toBuffer();
  const customerCookie = await newSession(appUrl);
  const png = await sharp({ create: { width: 18, height: 18, channels: 3, background: "purple" } }).png().toBuffer();
  const webp = await sharp({ create: { width: 14, height: 14, channels: 3, background: "yellow" } }).webp().toBuffer();
  const uploadResponse = await upload(customerCookie, [`data:image/jpeg;base64,${jpeg.toString("base64")}`, `data:image/png;base64,${png.toString("base64")}`, `data:image/webp;base64,${webp.toString("base64")}`], [], appUrl);
  const { refs } = await uploadResponse.json();
  assert.equal(refs.length, 3);
  const request = bookingBody({ photos: refs, phone: "5145550102", email: "with-photo@example.invalid" });
  const submitted = await fetch(`${appUrl}/api/bookings`, { method: "POST", headers: { "content-type": "application/json", cookie: customerCookie }, body: JSON.stringify(request) });
  assert.equal(submitted.status, 201);
  const confirmation = await submitted.json();
  assert.equal(confirmation.success, true);
  assert.match(confirmation.trackingUrl, /\/track\/[a-f0-9]+$/);
  const token = confirmation.trackingUrl.split("/").at(-1);
  const record = await prisma.booking.findUnique({ where: { customerToken: token } });
  await prisma.booking.update({ where: { id: record.id }, data: { adminNotes: "SECRET synthetic internal note", staffAssigned: "SECRET technician assignment", statusHistory: JSON.stringify([{ status: "PENDING", changedAt: new Date().toISOString(), note: "SECRET historical note" }]) } });
  const tracking = await fetch(`${appUrl}/api/bookings/track/${token}`);
  const trackingText = await tracking.text();
  const trackingData = JSON.parse(trackingText);
  assert.equal(tracking.status, 200);
  assert.deepEqual(Object.keys(trackingData.booking).sort(), ["appointmentTime", "invoiceStatus", "paymentStatus", "preferredDate", "quoteAmount", "repairType", "status", "statusHistory"].sort());
  assert.doesNotMatch(trackingText, /SECRET|attachment:|\/api\/admin\/bookings/);
  assert.match(tracking.headers.get("cache-control"), /no-store/);
  assert.equal(tracking.headers.get("referrer-policy"), "no-referrer");

  const bookings = await (await fetch(`${appUrl}/api/bookings`, { headers: { cookie: adminCookie } })).json();
  const saved = bookings.bookings.find(item => item.name === "Synthetic Booking");
  assert.ok(saved);
  assert.equal(saved.photos.length, 3);
  const statusUpdate = await fetch(`${appUrl}/api/bookings/${saved.id}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ status: "IN_PROGRESS" }) });
  assert.equal(statusUpdate.status, 200);
  for (let attempt = 0; attempt < 20 && !smtpMessages.some(message => message.includes("with-photo@example.invalid") && message.includes("request update")); attempt += 1) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(smtpMessages.some(message => message.includes("with-photo@example.invalid") && message.includes("request update")), "transactional service updates reach the synthetic SMTP provider");
  const photoPath = saved.photos[0];
  assert.equal((await fetch(`${appUrl}${photoPath}`)).status, 401);
  assert.equal((await fetch(`${appUrl}${photoPath}`, { headers: { cookie: adminCookie } })).status, 200);
  assert.equal((await fetch(`${appUrl}/api/push/public-key`)).status, 503);
  assert.equal((await fetch(`${appUrl}/api/admin/push/subscribe`, { method: "POST" })).status, 401);
  assert.equal((await fetch(`${appUrl}/api/admin/notifications/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "test", message: "test" }) })).status, 401);
  const badClaim = await fetch(`${appUrl}/api/bookings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(bookingBody({ photos: [refs[0]], phone: "5145550103", email: "cross-session@example.invalid" })) });
  assert.equal(badClaim.status, 400);
  const countBeforeFailedClaims = await prisma.booking.count();
  const invalidClaim = await fetch(`${appUrl}/api/bookings`, { method: "POST", headers: { "content-type": "application/json", cookie: customerCookie }, body: JSON.stringify(bookingBody({ photos: ["attachment:not-a-uuid"], phone: "5145550104", email: "invalid-attachment@example.invalid" })) });
  assert.equal(invalidClaim.status, 400);
  assert.equal(await prisma.booking.count(), countBeforeFailedClaims, "failed photo claims do not leave partial booking records");

  const { serviceSeoPages, seoRouteAliases, ghanaBranchSeoPage, privacyPolicySeoPage, termsConditionsSeoPage } = await import("../shared/seo.ts");
  const canonicalRoutes = ["/", ...Object.keys(serviceSeoPages), ghanaBranchSeoPage.path, privacyPolicySeoPage.path, termsConditionsSeoPage.path];
  for (const route of [...canonicalRoutes, "/robots.txt", "/sitemap.xml", "/googlef79b6298ae0d5ae1.html"]) {
    assert.equal((await fetch(`${appUrl}${route}`)).status, 200, `public route ${route} remains available`);
  }
  for (const [alias, target] of Object.entries(seoRouteAliases)) {
    const redirect = await fetch(`${appUrl}${alias}`, { redirect: "manual" });
    assert.equal(redirect.status, 301, `alias ${alias} remains redirected`);
    assert.equal(redirect.headers.get("location"), target, `alias ${alias} points to its canonical route`);
  }
  const canonicalRedirect = await fetch(`${appUrl}/door-repair/`, { redirect: "manual" });
  assert.equal(canonicalRedirect.status, 301);
  assert.equal(canonicalRedirect.headers.get("location"), "/door-repair");
  const appSource = await readFile(path.join(process.cwd(), "client/src/App.tsx"), "utf8");
  const workerSource = await readFile(path.join(process.cwd(), "client/public/sw.js"), "utf8");
  assert.match(appSource, /if \(isPrivatePath \|\| !GA_MEASUREMENT_ID/);
  assert.ok(workerSource.includes("const isPrivate = /^\\/(?:track\\/|admin(?:\\/|$))/.test(requestUrl.pathname);"));
  assert.ok(workerSource.includes("if (isPrivate) return;"));

  const logout = await fetch(`${appUrl}/api/auth/logout`, { method: "POST", headers: { cookie: adminCookie } });
  assert.equal(logout.status, 200);
  assert.equal((await fetch(`${appUrl}/api/bookings`, { headers: { cookie: adminCookie } })).status, 401);

  const renewedLogin = await fetch(`${appUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "synthetic-admin", password: "SyntheticPass2026" }) });
  const expiringCookie = renewedLogin.headers.get("set-cookie").split(";")[0];
  const session = await prisma.session.findFirst({ orderBy: { updatedAt: "desc" } });
  await prisma.session.update({ where: { sid: session.sid }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await fetch(`${appUrl}/api/bookings`, { headers: { cookie: expiringCookie } })).status, 401);
});

test("promotional email provider methods fail closed", async () => {
  const { emailService } = await import("../server/email.ts");
  const messageCount = smtpMessages.length;
  assert.equal(await emailService.syncResendContactForBooking({}), false);
  assert.equal(await emailService.sendResendAutomationEvent("fixmydoor.booking_created", {}), false);
  assert.equal(await emailService.sendReviewRequest({}), false);
  assert.equal(await emailService.sendCustomerBroadcastEmail("synthetic@example.invalid", { title: "Test", message: "Test" }), false);
  assert.equal(smtpMessages.length, messageCount, "promotional operations do not reach the provider");
});
