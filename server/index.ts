import express, { type Response } from "express";
import session from "express-session";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createCipheriv, createECDH, createHmac, createPrivateKey, createSign, generateKeyPairSync, randomBytes, randomUUID } from "crypto";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { parseStatusHistory, saveBooking, saveManualBooking, serializeStatusHistory, toBooking, validateBooking, validateBookingStatus, validateManualBooking } from "./bookings";
import { listAdminReviews, listReviews, saveReview, validateReview, validateReviewStatus } from "./reviews";
import { createContentItem, listAdminContent, listPublicContent, updateContentItem, validateContentItem } from "./content";
import { prisma } from "./prisma";
import { findAdminByUsername, initializeAdminUser, verifyPassword, hashPassword } from "./auth";
import { emailService, getPublicBaseUrl } from "./email";
import type { Booking, BookingStatusHistoryEntry, BookingUpdateRequest } from "@shared/types";
import { formatBookingDisplayId } from "@shared/booking-code";
import { serviceCatalog } from "@shared/services";
import { normalizeSeoPath, resolveSeoPage, seoRouteAliases, serviceSeoPages, sitemapRoutes } from "@shared/seo";

if (fs.existsSync(".env")) {
  process.loadEnvFile?.(".env");
}

declare module "express-session" {
  interface SessionData {
    adminId?: string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultUploadDir =
  process.env.NODE_ENV === "production" && process.platform !== "win32"
    ? "/data/uploads"
    : path.resolve(process.cwd(), "uploads");
const uploadDir = process.env.UPLOAD_DIR || defaultUploadDir;
const PUBLIC_SITE_URL_TOKEN = "__PUBLIC_SITE_URL__";
const PUBLIC_IMAGE_URL_TOKEN = "__PUBLIC_IMAGE_URL__";
type SiteEventPayload = {
  type: "advert" | "review" | "notification";
  title: string;
  message: string;
  url?: string;
};
type PushPayload = {
  title: string;
  message: string;
  url?: string;
  icon?: string;
  badge?: string;
};
const siteEventClients = new Set<Response>();
type PushAudience = "visitor" | "admin";
type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  audiences?: PushAudience[];
  audience?: PushAudience;
  createdAt: string;
  updatedAt: string;
};
type PushNotificationLogEntry = {
  id: string;
  title: string;
  message: string;
  audience?: PushAudience | "all";
  sentAt: string;
  delivered: number;
  failed: number;
};
const socialPlatformLabels = {
  instagram: "Instagram",
  x: "X (Twitter)",
  facebook: "Facebook",
} as const;
const socialClickNoticeCooldown = new Map<string, number>();
const SOCIAL_CLICK_NOTICE_COOLDOWN_MS = 2 * 60 * 1000;
const mediaTypes: Record<string, { extension: string; kind: "image" | "video" | "document" }> = {
  "image/png": { extension: "png", kind: "image" },
  "image/jpeg": { extension: "jpg", kind: "image" },
  "image/jpg": { extension: "jpg", kind: "image" },
  "image/webp": { extension: "webp", kind: "image" },
  "video/mp4": { extension: "mp4", kind: "video" },
  "video/webm": { extension: "webm", kind: "video" },
  "video/ogg": { extension: "ogg", kind: "video" },
  "application/pdf": { extension: "pdf", kind: "document" },
  "application/msword": { extension: "doc", kind: "document" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: "docx", kind: "document" },
};

function broadcastSiteEvent(event: SiteEventPayload) {
  const payload = JSON.stringify({
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sentAt: new Date().toISOString(),
  });

  siteEventClients.forEach((client) => {
    client.write(`event: site-update\ndata: ${payload}\n\n`);
  });
}

function saveDataUrlMedia(dataUrl: unknown, options: { allowVideo: boolean; allowDocument?: boolean; maxBytes: number }) {
  if (typeof dataUrl !== "string") {
    throw new Error("Missing media data");
  }

  const match = dataUrl.match(/^data:([^;]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error("Invalid media data");
  }

  const mimeType = match[1].toLowerCase();
  const mediaType = mediaTypes[mimeType];
  if (
    !mediaType ||
    (!options.allowVideo && mediaType.kind === "video") ||
    (!options.allowDocument && mediaType.kind === "document")
  ) {
    throw new Error("Unsupported media type");
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.byteLength <= 0 || buffer.byteLength > options.maxBytes) {
    throw new Error("Media file is too large");
  }

  fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${mediaType.extension}`;
  fs.writeFileSync(path.join(uploadDir, fileName), buffer, { flag: "wx" });

  return {
    url: `/uploads/${fileName}`,
    kind: mediaType.kind,
    mimeType,
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

function getPushStorePath(fileName: string) {
  fs.mkdirSync(uploadDir, { recursive: true });
  return path.join(uploadDir, fileName);
}

function loadJsonFile<T>(fileName: string, fallback: T): T {
  try {
    const filePath = getPushStorePath(fileName);
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    console.error(`Failed to load ${fileName}:`, error);
    return fallback;
  }
}

function saveJsonFile<T>(fileName: string, data: T) {
  fs.writeFileSync(getPushStorePath(fileName), JSON.stringify(data, null, 2), "utf8");
}

function getVapidKeys() {
  const existing = loadJsonFile<{ publicKey: string; privateKey: string } | null>("push-vapid-keys.json", null);
  if (existing?.publicKey && existing?.privateKey) {
    return existing;
  }

  const generated = (generateKeyPairSync as any)("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { format: "jwk" },
    privateKeyEncoding: { format: "jwk" },
  }) as { publicKey: JsonWebKey; privateKey: JsonWebKey };

  const publicKey = Buffer.concat([
    Buffer.from([4]),
    base64UrlDecode(generated.publicKey.x || ""),
    base64UrlDecode(generated.publicKey.y || ""),
  ]).toString("base64url");
  const privateKey = generated.privateKey.d || "";
  const keys = { publicKey, privateKey };
  saveJsonFile("push-vapid-keys.json", keys);
  return keys;
}

function loadPushSubscriptions() {
  const savedSubscriptions = loadJsonFile<StoredPushSubscription[]>("push-subscriptions.json", []);
  const subscriptions = dedupePushSubscriptions(savedSubscriptions);
  if (subscriptions.length !== savedSubscriptions.length) {
    saveJsonFile("push-subscriptions.json", subscriptions);
  }
  return subscriptions;
}

function savePushSubscriptions(subscriptions: StoredPushSubscription[]) {
  saveJsonFile("push-subscriptions.json", dedupePushSubscriptions(subscriptions));
}

function loadPushNotificationLog() {
  return loadJsonFile<PushNotificationLogEntry[]>("push-notification-log.json", []);
}

function savePushNotificationLog(entries: PushNotificationLogEntry[]) {
  saveJsonFile("push-notification-log.json", entries.slice(0, 20));
}

function isValidPushSubscription(value: any): value is Omit<StoredPushSubscription, "createdAt" | "updatedAt"> {
  return Boolean(
    value &&
    typeof value.endpoint === "string" &&
    value.endpoint.startsWith("https://") &&
    value.keys &&
    typeof value.keys.p256dh === "string" &&
    typeof value.keys.auth === "string"
  );
}

function normalizePushAudience(value: unknown): PushAudience {
  return value === "admin" ? "admin" : "visitor";
}

function getPushAudiences(subscription: StoredPushSubscription): PushAudience[] {
  const audiences = subscription.audiences?.length ? subscription.audiences : [subscription.audience || "visitor"];
  return Array.from(new Set(audiences.map(normalizePushAudience)));
}

function dedupePushSubscriptions(subscriptions: StoredPushSubscription[]) {
  const uniqueSubscriptions = new Map<string, StoredPushSubscription>();

  subscriptions.forEach((subscription) => {
    if (!subscription?.endpoint) {
      return;
    }

    const endpoint = subscription.endpoint.trim();
    const existing = uniqueSubscriptions.get(endpoint);
    const audiences = Array.from(new Set([
      ...(existing ? getPushAudiences(existing) : []),
      ...getPushAudiences(subscription),
    ]));

    uniqueSubscriptions.set(endpoint, {
      ...existing,
      ...subscription,
      endpoint,
      audiences,
      audience: subscription.audience || existing?.audience || audiences[0] || "visitor",
      createdAt: existing?.createdAt || subscription.createdAt || new Date().toISOString(),
      updatedAt: subscription.updatedAt || existing?.updatedAt || new Date().toISOString(),
    });
  });

  return Array.from(uniqueSubscriptions.values());
}

function getPushSubscriberCounts(subscriptions = loadPushSubscriptions()) {
  return {
    subscriberCount: subscriptions.length,
    visitorSubscriberCount: subscriptions.filter((subscription) => matchesPushAudience(subscription, "visitor")).length,
    adminSubscriberCount: subscriptions.filter((subscription) => matchesPushAudience(subscription, "admin")).length,
  };
}

function matchesPushAudience(subscription: StoredPushSubscription, audience?: PushAudience | "all") {
  if (!audience || audience === "all") {
    return true;
  }

  return getPushAudiences(subscription).includes(audience);
}

function hkdfExpand(prk: Buffer, info: Buffer | string, length: number) {
  const buffers: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let counter = 1;

  while (Buffer.concat(buffers).length < length) {
    previous = createHmac("sha256", prk)
      .update(previous)
      .update(typeof info === "string" ? Buffer.from(info) : info)
      .update(Buffer.from([counter++]))
      .digest();
    buffers.push(previous);
  }

  return Buffer.concat(buffers).subarray(0, length);
}

function createVapidJwt(subscriptionEndpoint: string) {
  const { publicKey, privateKey } = getVapidKeys();
  const audience = new URL(subscriptionEndpoint).origin;
  const header = base64UrlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:info.fixmydoor@gmail.com",
  }));
  const signingInput = `${header}.${payload}`;
  const publicKeyBuffer = base64UrlDecode(publicKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: publicKeyBuffer.subarray(1, 33).toString("base64url"),
    y: publicKeyBuffer.subarray(33, 65).toString("base64url"),
    d: privateKey,
  };
  const key = createPrivateKey({ key: jwk, format: "jwk" });
  const signature = createSign("sha256").update(signingInput).end().sign({ key, dsaEncoding: "ieee-p1363" });

  return {
    publicKey,
    token: `${signingInput}.${base64UrlEncode(signature)}`,
  };
}

function encryptPushPayload(subscription: StoredPushSubscription, payload: string) {
  const receiverPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);
  const salt = randomBytes(16);
  const localCurve = createECDH("prime256v1");
  localCurve.generateKeys();
  const senderPublicKey = localCurve.getPublicKey();
  const sharedSecret = localCurve.computeSecret(receiverPublicKey);
  const prkKey = createHmac("sha256", authSecret).update(sharedSecret).digest();
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    receiverPublicKey,
    senderPublicKey,
  ]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);
  const prk = createHmac("sha256", salt).update(ikm).digest();
  const cek = hkdfExpand(prk, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdfExpand(prk, "Content-Encoding: nonce\0", 12);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, recordSize, Buffer.from([senderPublicKey.length]), senderPublicKey]);

  return Buffer.concat([header, encrypted]);
}

async function sendPushNotification(subscription: StoredPushSubscription, payload: PushPayload) {
  const vapid = createVapidJwt(subscription.endpoint);
  const body = encryptPushPayload(subscription, JSON.stringify(payload));
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${vapid.token}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body,
  });

  return response;
}

async function sendPushNotificationToSubscribers(
  payload: PushPayload,
  options: { audience?: PushAudience | "all"; log?: boolean } = {},
) {
  const subscriptions = loadPushSubscriptions();
  const targetSubscriptions = subscriptions.filter((subscription) => matchesPushAudience(subscription, options.audience));
  let delivered = 0;
  let failed = 0;
  const deadEndpoints = new Set<string>();

  await Promise.all(targetSubscriptions.map(async (subscription) => {
    try {
      const response = await sendPushNotification(subscription, payload);
      if (response.ok) {
        delivered += 1;
        return;
      }

      failed += 1;
      if ([404, 410].includes(response.status)) {
        deadEndpoints.add(subscription.endpoint);
      }
    } catch (error) {
      failed += 1;
      console.error("Push send error:", error);
    }
  }));

  if (deadEndpoints.size > 0) {
    savePushSubscriptions(subscriptions.filter((subscription) => !deadEndpoints.has(subscription.endpoint)));
  }

  const logEntry: PushNotificationLogEntry = {
    id: randomUUID(),
    title: payload.title,
    message: payload.message,
    audience: options.audience || "all",
    sentAt: new Date().toISOString(),
    delivered,
    failed,
  };

  if (options.log) {
    savePushNotificationLog([logEntry, ...loadPushNotificationLog()]);
  }

  return {
    ...logEntry,
    subscriberCount: loadPushSubscriptions().filter((subscription) => matchesPushAudience(subscription, options.audience)).length,
  };
}

function queuePushNotification(
  payload: PushPayload,
  options: { audience?: PushAudience | "all"; log?: boolean } = {},
) {
  sendPushNotificationToSubscribers(payload, options).catch((error) => {
    console.error("Queued push notification failed:", error);
  });
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const WEEKEND_PROMOTION_STATE_FILE = "weekend-promotion-state.json";
const WEEKEND_PROMOTION_CHECK_MS = 60 * 60 * 1000;
const WEEKEND_PROMOTION_START_HOUR = 9;

let bookingReminderSweepRunning = false;
let weekendPromotionSweepRunning = false;

type WeekendPromotionState = {
  lastSentWeekendKey?: string;
  lastSentAt?: string;
};

async function sendDueBookingReminders() {
  if (bookingReminderSweepRunning) {
    return;
  }

  bookingReminderSweepRunning = true;
  try {
    const reminderCandidates = (await prisma.booking.findMany({
      where: {
        reminderAt: { not: null },
        reminderSentAt: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { reminderAt: "asc" },
      take: 25,
    } as any)).map(toBooking).filter((booking) => isReminderDue(booking));

    for (const booking of reminderCandidates) {
      const displayId = formatBookingDisplayId(booking);
      const appointmentReminder = isTwoHourAppointmentReminder(booking);
      queuePushNotification({
        title: appointmentReminder ? `Job in 2 hours: ${booking.name}` : `Reminder: ${booking.name}`,
        message: buildAdminReminderMessage(booking, displayId),
        url: "/admin",
        icon: "/icons/admin-icon-v2-192x192.png",
        badge: "/icons/admin-icon-v2-96x96.png",
      }, { audience: "admin", log: true });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date().toISOString() } as any,
      });
    }
  } catch (error) {
    console.error("Booking reminder sweep failed:", error);
  } finally {
    bookingReminderSweepRunning = false;
  }
}

function startBookingReminderSweep() {
  void sendDueBookingReminders();
  const reminderTimer = setInterval(() => {
    void sendDueBookingReminders();
  }, 60 * 1000);
  reminderTimer.unref?.();
}

function getMontrealDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    weekday: parts.weekday || "",
    year: parts.year || "",
    month: parts.month || "",
    day: parts.day || "",
    hour: Number(parts.hour || 0),
  };
}

function getCurrentMontrealWeekendKey(date = new Date()) {
  const parts = getMontrealDateParts(date);
  if (!["Sat", "Sun"].includes(parts.weekday) || parts.hour < WEEKEND_PROMOTION_START_HOUR) {
    return null;
  }

  const saturdayDate = parts.weekday === "Sun"
    ? new Date(date.getTime() - 24 * 60 * 60 * 1000)
    : date;
  const saturdayParts = getMontrealDateParts(saturdayDate);

  return `${saturdayParts.year}-${saturdayParts.month}-${saturdayParts.day}`;
}

async function sendWeekendPromotionIfDue() {
  if (weekendPromotionSweepRunning) {
    return;
  }

  weekendPromotionSweepRunning = true;
  try {
    const weekendKey = getCurrentMontrealWeekendKey();
    if (!weekendKey) {
      return;
    }

    const state = loadJsonFile<WeekendPromotionState>(WEEKEND_PROMOTION_STATE_FILE, {});
    if (state.lastSentWeekendKey === weekendKey) {
      return;
    }

    const { visitorSubscriberCount } = getPushSubscriberCounts();
    if (visitorSubscriberCount <= 0) {
      return;
    }

    const payload: PushPayload = {
      title: "Weekend home fix reminder",
      message: "It is weekend. A good time to fix loose doors, locks, cabinets, furniture, or source the right hardware. FixMyDoor Services can help.",
      url: "/#booking-form",
      icon: "/icons/main-icon-v2-192x192.png",
      badge: "/icons/main-icon-v2-96x96.png",
    };

    const logEntry = await sendPushNotificationToSubscribers(payload, { audience: "visitor", log: true });
    if (logEntry.delivered > 0 || logEntry.failed > 0) {
      saveJsonFile<WeekendPromotionState>(WEEKEND_PROMOTION_STATE_FILE, {
        lastSentWeekendKey: weekendKey,
        lastSentAt: new Date().toISOString(),
      });
      broadcastSiteEvent({ type: "notification", title: payload.title, message: payload.message, url: payload.url });
    }
  } catch (error) {
    console.error("Weekend promotion sweep failed:", error);
  } finally {
    weekendPromotionSweepRunning = false;
  }
}

function startWeekendPromotionSweep() {
  void sendWeekendPromotionIfDue();
  const weekendTimer = setInterval(() => {
    void sendWeekendPromotionIfDue();
  }, WEEKEND_PROMOTION_CHECK_MS);
  weekendTimer.unref?.();
}

const CUSTOMER_EMAIL_BROADCAST_LIMIT = Math.max(1, Math.min(500, Number(process.env.CUSTOMER_EMAIL_BROADCAST_LIMIT || 120)));

function queueCustomerEmailBroadcast(
  payload: Pick<PushPayload, "title" | "message" | "url">,
  type: "advert" | "notification" = "notification",
) {
  setTimeout(() => {
    sendCustomerEmailBroadcast(payload, type).catch((error) => {
      console.error("Queued customer email broadcast failed:", error);
    });
  }, 0);
}

async function sendCustomerEmailBroadcast(
  payload: Pick<PushPayload, "title" | "message" | "url">,
  type: "advert" | "notification",
) {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      email: true,
      customerConsent: true,
    },
    take: 1000,
  });
  const uniqueEmails = Array.from(new Set(
    bookings
      .filter((booking) => booking.customerConsent && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email || ""))
      .map((booking) => booking.email.trim().toLowerCase()),
  )).slice(0, CUSTOMER_EMAIL_BROADCAST_LIMIT);

  let sent = 0;
  let failed = 0;
  for (const email of uniqueEmails) {
    const ok = await emailService.sendCustomerBroadcastEmail(email, {
      title: payload.title,
      message: payload.message,
      url: payload.url,
      type,
    });
    if (ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  console.log("Customer email broadcast finished", { type, sent, failed, total: uniqueEmails.length });
}

function isInternationalBooking(booking: Booking) {
  const country = (booking.country || "").trim().toLowerCase();
  const scope = (booking.requestScope || "").trim().toLowerCase();
  return Boolean(
    scope.includes("international") ||
    (country && !["canada", "ca", "can"].includes(country))
  );
}

function getDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function isBookingInDateRange(booking: Booking, days: number) {
  const now = new Date();
  const todayKey = getDateKey(now);
  const startTime = new Date(`${todayKey}T00:00:00.000Z`).getTime();
  const endTime = startTime + days * 24 * 60 * 60 * 1000;
  const preferredTime = booking.preferredDate ? new Date(`${booking.preferredDate}T12:00:00.000Z`).getTime() : NaN;
  const createdTime = new Date(booking.createdAt).getTime();

  return (
    (!Number.isNaN(preferredTime) && preferredTime >= startTime && preferredTime < endTime) ||
    (!Number.isNaN(createdTime) && createdTime >= startTime && createdTime < endTime)
  );
}

function getBookingReminderTime(booking: Pick<Booking, "reminderAt">) {
  const reminderAt = booking.reminderAt?.trim();
  if (!reminderAt) {
    return Number.NaN;
  }

  const reminderTime = Date.parse(reminderAt);
  return Number.isFinite(reminderTime) ? reminderTime : Number.NaN;
}

function isReminderActive(booking: Pick<Booking, "reminderAt" | "status">) {
  return Boolean(booking.reminderAt) && !["COMPLETED", "CANCELLED"].includes(booking.status);
}

function isReminderDue(booking: Pick<Booking, "reminderAt" | "status">, now = Date.now()) {
  const reminderTime = getBookingReminderTime(booking);
  return isReminderActive(booking) && Number.isFinite(reminderTime) && reminderTime <= now;
}

function getDateTimeMs(value?: string | null) {
  const text = value?.trim();
  if (!text) {
    return Number.NaN;
  }

  const parsedTime = Date.parse(text);
  return Number.isFinite(parsedTime) ? parsedTime : Number.NaN;
}

function getTwoHourAppointmentReminderAt(appointmentTime?: string | null) {
  const appointmentMs = getDateTimeMs(appointmentTime);
  if (!Number.isFinite(appointmentMs)) {
    return "";
  }

  return new Date(Math.max(Date.now(), appointmentMs - TWO_HOURS_MS)).toISOString();
}

function isTwoHourAppointmentReminder(booking: Pick<Booking, "appointmentTime" | "reminderAt">) {
  const appointmentMs = getDateTimeMs(booking.appointmentTime);
  const reminderMs = getBookingReminderTime(booking);

  return (
    Number.isFinite(appointmentMs) &&
    Number.isFinite(reminderMs) &&
    Math.abs(reminderMs - (appointmentMs - TWO_HOURS_MS)) <= 90_000
  );
}

function buildDefaultAppointmentReminderNote(booking: Pick<Booking, "repairType">) {
  return `About 2 hours left to go and do the ${booking.repairType || "job"}. Check the customer details, route, tools, and parts before leaving.`;
}

function buildAdminReminderMessage(booking: Pick<Booking, "appointmentTime" | "reminderAt" | "reminderNote" | "repairType">, displayId: string) {
  const reminderText = booking.reminderNote?.trim() || (
    isTwoHourAppointmentReminder(booking)
      ? buildDefaultAppointmentReminderNote(booking)
      : "Follow up with this customer request."
  );

  if (isTwoHourAppointmentReminder(booking)) {
    return `${displayId} - ${reminderText}${booking.appointmentTime ? ` Appointment: ${booking.appointmentTime}.` : ""}`;
  }

  return `${displayId} - ${reminderText}`;
}

function matchesWorkflowFilter(booking: Booking, workflow: string) {
  switch (workflow) {
    case "TODAY":
      return isBookingInDateRange(booking, 1);
    case "THIS_WEEK":
      return isBookingInDateRange(booking, 7);
    case "INTERNATIONAL":
      return isInternationalBooking(booking);
    case "URGENT":
      return /urgent|same-day|emergency/i.test(booking.urgency || "");
    case "NEEDS_QUOTE":
      return !booking.quoteAmount;
    case "QUOTED":
      return Boolean(booking.quoteAmount);
    case "SCHEDULED":
      return Boolean(booking.appointmentTime);
    case "REMINDERS":
      return isReminderDue(booking);
    case "PAYMENT_PENDING":
      return Boolean(booking.quoteAmount) && !/^\s*paid\s*$/i.test(booking.paymentStatus || "");
    default:
      return true;
  }
}

async function sendBookingEmailsWithStatus(booking: Booking) {
  const results = await Promise.allSettled([
    emailService.sendBookingConfirmation(booking),
    emailService.sendAdminNotification(booking),
  ]);
  const [customerResult, adminResult] = results;
  const customerEmailSent = customerResult.status === "fulfilled" && customerResult.value === true;
  const adminEmailSent = adminResult.status === "fulfilled" && adminResult.value === true;

  if (!customerEmailSent || !adminEmailSent) {
    console.error("Booking saved, but one or more emails failed.", {
      bookingId: booking.id,
      customerEmailSent,
      adminEmailSent,
    });
  }

  return {
    queued: false,
    customer: customerEmailSent,
    admin: adminEmailSent,
  };
}

function emailStatusTimeout(ms: number) {
  return new Promise<{ queued: true; customer?: boolean; admin?: boolean }>((resolve) => {
    setTimeout(() => resolve({ queued: true }), ms);
  });
}

async function executeSchemaStatement(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error: any) {
    const message = String(error?.message || error);
    if (!/duplicate column name|already exists/i.test(message)) {
      throw error;
    }
  }
}

async function ensureDatabaseCompatibility() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "Booking" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "email" TEXT NOT NULL DEFAULT '',
      "address" TEXT NOT NULL,
      "city" TEXT,
      "country" TEXT,
      "timeZone" TEXT,
      "preferredContactMethod" TEXT,
      "urgency" TEXT,
      "requestScope" TEXT,
      "currency" TEXT,
      "repairType" TEXT NOT NULL,
      "preferredDate" TEXT,
      "message" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "customerToken" TEXT,
      "photos" TEXT,
      "dimensions" TEXT,
      "quantity" TEXT,
      "material" TEXT,
      "color" TEXT,
      "swingDirection" TEXT,
      "deliveryNeeded" TEXT,
      "installationNeeded" TEXT,
      "budget" TEXT,
      "customerConsent" BOOLEAN NOT NULL DEFAULT 0,
      "appointmentTime" TEXT,
      "quoteAmount" TEXT,
      "quoteNotes" TEXT,
      "invoiceStatus" TEXT,
      "paymentStatus" TEXT,
      "staffAssigned" TEXT,
      "adminNotes" TEXT,
      "reminderAt" TEXT,
      "reminderWindow" TEXT,
      "reminderNote" TEXT,
      "reminderSentAt" TEXT,
      "statusHistory" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "Booking" ADD COLUMN "email" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Booking" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING'`,
    `ALTER TABLE "Booking" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `ALTER TABLE "Booking" ADD COLUMN "customerToken" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "photos" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "dimensions" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "quantity" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "material" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "color" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "swingDirection" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "deliveryNeeded" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "installationNeeded" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "budget" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "customerConsent" BOOLEAN NOT NULL DEFAULT 0`,
    `ALTER TABLE "Booking" ADD COLUMN "appointmentTime" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "quoteAmount" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "quoteNotes" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "invoiceStatus" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "paymentStatus" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "staffAssigned" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "adminNotes" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "reminderAt" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "reminderWindow" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "reminderNote" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "statusHistory" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "city" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "country" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "timeZone" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "preferredContactMethod" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "urgency" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "requestScope" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "currency" TEXT`,
    `CREATE TABLE IF NOT EXISTS "Admin" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Session" (
      "sid" TEXT NOT NULL PRIMARY KEY,
      "data" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "Session" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `ALTER TABLE "Session" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `CREATE TABLE IF NOT EXISTS "Review" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "location" TEXT,
      "rating" INTEGER NOT NULL DEFAULT 5,
      "quote" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'APPROVED',
      "adminNotes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "Review" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED'`,
    `ALTER TABLE "Review" ADD COLUMN "adminNotes" TEXT`,
    `CREATE TABLE IF NOT EXISTS "ContentItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "category" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "tag" TEXT,
      "image" TEXT,
      "accentImage" TEXT,
      "items" TEXT,
      "bookingValue" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "ContentItem" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Admin_username_key" ON "Admin"("username")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Booking_customerToken_key" ON "Booking"("customerToken")`,
    `CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status")`,
    `CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Booking_name_idx" ON "Booking"("name")`,
    `CREATE INDEX IF NOT EXISTS "Booking_email_idx" ON "Booking"("email")`,
    `CREATE INDEX IF NOT EXISTS "Booking_phone_idx" ON "Booking"("phone")`,
    `CREATE INDEX IF NOT EXISTS "Booking_customerToken_idx" ON "Booking"("customerToken")`,
    `CREATE INDEX IF NOT EXISTS "Booking_reminderAt_idx" ON "Booking"("reminderAt")`,
    `CREATE INDEX IF NOT EXISTS "Booking_country_idx" ON "Booking"("country")`,
    `CREATE INDEX IF NOT EXISTS "Booking_urgency_idx" ON "Booking"("urgency")`,
    `CREATE INDEX IF NOT EXISTS "Booking_invoiceStatus_idx" ON "Booking"("invoiceStatus")`,
    `CREATE INDEX IF NOT EXISTS "Booking_paymentStatus_idx" ON "Booking"("paymentStatus")`,
    `CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt")`,
    `CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Review_rating_idx" ON "Review"("rating")`,
    `CREATE INDEX IF NOT EXISTS "Review_status_idx" ON "Review"("status")`,
    `CREATE INDEX IF NOT EXISTS "ContentItem_category_idx" ON "ContentItem"("category")`,
    `CREATE INDEX IF NOT EXISTS "ContentItem_active_idx" ON "ContentItem"("active")`,
    `CREATE INDEX IF NOT EXISTS "ContentItem_sortOrder_idx" ON "ContentItem"("sortOrder")`,
  ];

  for (const statement of statements) {
    await executeSchemaStatement(statement);
  }
}

class PrismaSessionStore extends session.Store {
  get(sid: string, callback: (err: any, session?: session.SessionData | null) => void) {
    prisma.session.findUnique({ where: { sid } })
      .then(async (record) => {
        if (!record) {
          callback(null, null);
          return;
        }

        if (record.expiresAt <= new Date()) {
          await prisma.session.delete({ where: { sid } }).catch(() => undefined);
          callback(null, null);
          return;
        }

        callback(null, JSON.parse(record.data));
      })
      .catch((error) => callback(error));
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    prisma.session.upsert({
      where: { sid },
      create: { sid, data: JSON.stringify(sessionData), expiresAt },
      update: { data: JSON.stringify(sessionData), expiresAt },
    })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    prisma.session.deleteMany({ where: { sid } })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    prisma.session.updateMany({ where: { sid }, data: { expiresAt } })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
}

function normalizeOrigin(value?: string) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return "";
  }
}

function allowedOriginsForRequest(req: express.Request) {
  const host = req.get("host");
  const origins = new Set([
    normalizeOrigin(process.env.PUBLIC_SITE_URL),
    normalizeOrigin(process.env.ADMIN_URL),
    normalizeOrigin(process.env.VITE_PUBLIC_SITE_URL),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter(Boolean));

  if (host) {
    origins.add(`${req.protocol}://${host}`);
  }

  return origins;
}

function getPublicImageUrl() {
  return `${getPublicBaseUrl()}/og-fixmydoor-service.jpg`;
}

function replacePublicUrlTokens(template: string) {
  return template
    .replaceAll(PUBLIC_SITE_URL_TOKEN, getPublicBaseUrl())
    .replaceAll(PUBLIC_IMAGE_URL_TOKEN, getPublicImageUrl());
}

function canonicalHostRedirectUrl(req: express.Request) {
  if (process.env.NODE_ENV !== "production") {
    return "";
  }

  let publicUrl: URL;
  try {
    publicUrl = new URL(getPublicBaseUrl());
  } catch {
    return "";
  }

  const canonicalHost = publicUrl.hostname.toLowerCase();
  if (!canonicalHost.startsWith("www.")) {
    return "";
  }

  const requestHost = (req.get("host") || "").split(":")[0].toLowerCase();
  const apexHost = canonicalHost.replace(/^www\./, "");
  if (requestHost !== apexHost) {
    return "";
  }

  return `${publicUrl.protocol}//${publicUrl.host}${req.originalUrl}`;
}

function replaceMetaContent(html: string, selector: "name" | "property", key: string, content: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`<meta ${selector}="${escapedKey}" content="[^"]*" \\/>`);
  const replacement = `<meta ${selector}="${key}" content="${escapeHtml(content)}" />`;
  return expression.test(html) ? html.replace(expression, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}

function renderPageStructuredData(pagePath: string) {
  const page = resolveSeoPage(pagePath);
  const publicBaseUrl = getPublicBaseUrl();
  const canonicalUrl = page.path === "/" ? `${publicBaseUrl}/` : `${publicBaseUrl}${page.path}`;
  const servicePage = serviceSeoPages[page.path];

  if (!servicePage) {
    return "";
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${publicBaseUrl}/#business`,
        "name": "FixMyDoor Services",
        "url": publicBaseUrl,
        "logo": `${publicBaseUrl}/img5150-transparent.png`,
        "image": getPublicImageUrl(),
        "description": "Door repairs, door installations, furniture repairs, lock rekeying, and hardware sourcing in Montreal, Quebec, Canada.",
        "telephone": "+14383471823",
        "email": "info.fixmydoor@gmail.com",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "10158 Rue Berri",
          "addressLocality": "Montreal",
          "addressRegion": "QC",
          "postalCode": "H3L 2G6",
          "addressCountry": "CA",
        },
        "areaServed": ["Montreal", "Laval", "Longueuil", "Brossard", "West Island", "Quebec", "Canada"],
        "openingHours": "Mo-Su 00:00-23:59",
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "opens": "00:00",
            "closes": "23:59",
          },
        ],
        "priceRange": "$$",
        "sameAs": [
          "https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr",
          "https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=fixmydoor.ca&utm_medium=social_link&utm_campaign=montreal_quebec_canada",
          "https://x.com/fixmydoor?s=11",
        ],
      },
      {
        "@type": "Service",
        "@id": `${canonicalUrl}#service`,
        "name": servicePage.structuredServiceName,
        "description": servicePage.description,
        "provider": {
          "@id": `${publicBaseUrl}/#business`,
        },
        "areaServed": [
          { "@type": "City", "name": "Montreal" },
          { "@type": "AdministrativeArea", "name": "Quebec" },
          { "@type": "City", "name": "Laval" },
          { "@type": "City", "name": "Longueuil" },
          { "@type": "City", "name": "Brossard" },
          { "@type": "Country", "name": "Canada" },
          { "@type": "Place", "name": "International requests" },
        ],
        "serviceType": servicePage.structuredServiceName,
        "url": canonicalUrl,
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        "mainEntity": buildServiceFaqs(servicePage).map((item) => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${publicBaseUrl}/`,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": servicePage.eyebrow,
            "item": canonicalUrl,
          },
        ],
      },
    ],
  };

  return `    <script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`;
}

function buildServiceFaqs(servicePage: (typeof serviceSeoPages)[string]) {
  const faqByPath: Record<string, Array<{ question: string; answer: string }>> = {
    "/door-repair": [
      {
        question: "How do I know if my door needs repair or replacement?",
        answer: "If the frame is still solid and the door panel is not badly damaged, many sticking, sagging, rubbing, or latch problems can be repaired. FixMyDoor Services reviews the photos and recommends the practical option.",
      },
      {
        question: "Do you repair both interior and exterior doors?",
        answer: "Yes. FixMyDoor Services helps with interior doors, entry doors, exterior doors, frames, hinges, handles, latches, and alignment issues across Montreal and surrounding areas.",
      },
      {
        question: "What should I send for a door repair request?",
        answer: "Send photos of the full door, the damaged area, the hinges, the latch, and the frame. Add your location and a short note explaining what happens when you open, close, or lock the door.",
      },
      {
        question: "Can a sagging or scraping door be fixed without replacing it?",
        answer: "Often yes. Hinge adjustment, strike plate work, frame review, or minor fitting can make a door close properly again without a full replacement.",
      },
    ],
    "/entry-door-installation": [
      {
        question: "What measurements are needed for entry door installation?",
        answer: "Send the current door width, height, frame opening, swing direction, and photos from inside and outside. If you are unsure, FixMyDoor Services will explain what needs to be measured before ordering.",
      },
      {
        question: "Can you help choose the right front door before buying?",
        answer: "Yes. FixMyDoor Services can review the opening, preferred style, hardware needs, finish, and installation plan so the door choice makes sense before money is spent.",
      },
      {
        question: "Do you handle hardware matching for a new entry door?",
        answer: "Yes. Handles, locks, hinges, cylinders, door closers, and finish choices can be reviewed so the new entry door works properly with the frame and daily use.",
      },
      {
        question: "Can an old front door be replaced with a different style?",
        answer: "Usually yes, but the frame, swing direction, size, and hardware must be checked first. That helps avoid ordering a door that looks good but does not fit correctly.",
      },
    ],
    "/furniture-repair": [
      {
        question: "What types of furniture can FixMyDoor Services repair?",
        answer: "Common requests include sofa frames, chairs, cabinets, drawers, desks, shelves, loose joints, damaged supports, cabinet hinges, and drawer slides.",
      },
      {
        question: "Should I repair furniture or replace it?",
        answer: "If the main structure is still useful, repair or stronger replacement hardware may be more practical than buying new furniture. Photos help confirm the best route.",
      },
      {
        question: "What should I send for a furniture repair request?",
        answer: "Send photos of the full item, the damaged part, any missing hardware, and the area where the part connects. Include measurements if a replacement part may be needed.",
      },
      {
        question: "Can you help with drawer slides and cabinet hinges?",
        answer: "Yes. FixMyDoor Services can help repair, replace, or source drawer slides, cabinet hinges, soft-close runners, handles, brackets, and other furniture hardware.",
      },
    ],
    "/door-hardware": [
      {
        question: "What hardware can FixMyDoor Services help source?",
        answer: "Requests can include locks, hinges, handles, cylinders, door closers, latch parts, strike plates, cabinet hinges, drawer slides, brackets, and furniture repair parts.",
      },
      {
        question: "How do I avoid buying the wrong lock, hinge, or handle?",
        answer: "Send clear photos, measurements, finish preference, door thickness if available, and the problem you need to solve. FixMyDoor Services reviews compatibility before suggesting next steps.",
      },
      {
        question: "Can you help with both door and furniture parts?",
        answer: "Yes. The sourcing support covers door equipment, door hardware, furniture hardware, cabinet parts, drawer parts, and practical replacement fittings.",
      },
      {
        question: "Do you support international hardware requests?",
        answer: "Yes. Customers outside Canada can send photos, quantity, city, country, time zone, preferred currency, and delivery questions for review.",
      },
    ],
  };

  return faqByPath[servicePage.path] || [
    {
      question: `What information should I send for ${servicePage.eyebrow.toLowerCase()}?`,
      answer: `Send clear photos, your city or country, measurements if available, and a short note about the issue. FixMyDoor Services reviews those details before recommending repair, installation, replacement, or sourcing.`,
    },
    {
      question: "Can FixMyDoor Services help in Montreal and outside Canada?",
      answer: "Yes. The business is based in Montreal, Quebec, supports Canadian requests, and can also review international product sourcing or repair guidance requests.",
    },
    {
      question: "Will I know the next step before work starts?",
      answer: "Yes. The goal is to explain the practical next step clearly before customers spend money on the wrong door, lock, hinge, furniture part, or hardware item.",
    },
  ];
}

function renderAlternateLinks(canonicalUrl: string) {
  return [
    `    <link rel="alternate" hreflang="en-ca" href="${escapeHtml(canonicalUrl)}" />`,
    `    <link rel="alternate" hreflang="fr-ca" href="${escapeHtml(`${canonicalUrl}${canonicalUrl.includes("?") ? "&" : "?"}lang=fr`)}" />`,
    `    <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}" />`,
  ].join("\n");
}

function renderServiceFallbackMain(pagePath: string) {
  const page = resolveSeoPage(pagePath);
  const servicePage = serviceSeoPages[page.path];

  if (!servicePage) {
    return "";
  }

  const publicBaseUrl = getPublicBaseUrl();
  const canonicalUrl = servicePage.path === "/" ? `${publicBaseUrl}/` : `${publicBaseUrl}${servicePage.path}`;
  const faqs = buildServiceFaqs(servicePage);

  return `<main data-seo-fallback="true" style="font-family: Arial, sans-serif; max-width: 980px; margin: 0 auto; padding: 32px 18px; color: #2f241c;">
        <img src="/img5150-transparent.png" alt="FixMyDoor Services logo" style="width: 180px; height: auto;" />
        <p style="font-weight: 700; color: #b46532; text-transform: uppercase; letter-spacing: .08em;">${escapeHtml(servicePage.eyebrow)}</p>
        <h1>${escapeHtml(servicePage.title)}</h1>
        <p>${escapeHtml(servicePage.description)}</p>
        <h2>What this service covers</h2>
        <ul>${servicePage.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2>How FixMyDoor Services handles the request</h2>
        <ol>
          <li>Send photos, measurements, location, and the best way to contact you.</li>
          <li>FixMyDoor Services reviews the details and confirms the practical next step.</li>
          <li>The request is handled as repair, installation, replacement planning, or hardware sourcing.</li>
        </ol>
        <h2>Frequently asked questions</h2>
        ${faqs.map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join("")}
        <h2>Service areas</h2>
        <p>FixMyDoor Services is based in Montreal, Quebec and welcomes requests from Montreal, Laval, Longueuil, Brossard, nearby Quebec communities, other Canadian locations, and international customers who need door, furniture, or hardware sourcing guidance.</p>
        <h2>Contact FixMyDoor Services</h2>
        <p>Phone: <a href="tel:+14383471823">+1 (438) 347-1823</a></p>
        <p>Email: <a href="mailto:info.fixmydoor@gmail.com">info.fixmydoor@gmail.com</a></p>
        <p>WhatsApp: <a href="https://wa.me/233242011305">+233 24 201 1305</a></p>
        <p>Canonical page: <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(canonicalUrl)}</a></p>
      </main>`;
}

function renderServiceFallbackContent(pagePath: string) {
  const fallbackMain = renderServiceFallbackMain(pagePath);

  return fallbackMain ? `    <noscript>
      ${fallbackMain}
    </noscript>` : "";
}

function renderIndexHtmlForPath(template: string, pagePath = "/") {
  const page = resolveSeoPage(pagePath);
  const publicBaseUrl = getPublicBaseUrl();
  const canonicalUrl = page.path === "/" ? `${publicBaseUrl}/` : `${publicBaseUrl}${page.path}`;
  const structuredData = renderPageStructuredData(pagePath);
  const isAdminPath = normalizeSeoPath(pagePath).startsWith("/admin");

  let html = replacePublicUrlTokens(template)
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(page.title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);

  if (isAdminPath) {
    html = html
      .replace(/<link id="fixmydoor-manifest" rel="manifest" href="[^"]*" \/>/, '<link id="fixmydoor-manifest" rel="manifest" href="/admin-manifest.json" />')
      .replace(/<link id="fixmydoor-apple-touch-icon" rel="apple-touch-icon" href="[^"]*" \/>/, '<link id="fixmydoor-apple-touch-icon" rel="apple-touch-icon" href="/icons/admin-icon-v2-192x192.png" />')
      .replace(/<meta name="application-name" content="[^"]*" \/>/, '<meta name="application-name" content="FixMyDoor Admin Dashboard" />')
      .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/, '<meta name="apple-mobile-web-app-title" content="FixMyDoor Admin" />')
      .replace(/<meta name="theme-color" content="[^"]*" \/>/, '<meta name="theme-color" content="#2F241C" />')
      .replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, nofollow" />');
  }

  html = html
    .replace(/    <link rel="alternate" hreflang="en-ca" href="[^"]*" \/>\n    <link rel="alternate" hreflang="fr-ca" href="[^"]*" \/>\n    <link rel="alternate" hreflang="x-default" href="[^"]*" \/>/, renderAlternateLinks(canonicalUrl));

  html = replaceMetaContent(html, "name", "description", page.description);
  html = replaceMetaContent(html, "name", "keywords", page.keywords);
  html = replaceMetaContent(html, "property", "og:title", page.title);
  html = replaceMetaContent(html, "property", "og:description", page.description);
  html = replaceMetaContent(html, "property", "og:url", canonicalUrl);
  html = replaceMetaContent(html, "property", "og:image", getPublicImageUrl());
  html = replaceMetaContent(html, "property", "og:image:width", "1200");
  html = replaceMetaContent(html, "property", "og:image:height", "630");
  html = replaceMetaContent(html, "property", "og:image:alt", "FixMyDoor Services door and furniture repair work");
  html = replaceMetaContent(html, "name", "twitter:title", page.title);
  html = replaceMetaContent(html, "name", "twitter:description", page.description);
  html = replaceMetaContent(html, "name", "twitter:image", getPublicImageUrl());
  html = replaceMetaContent(html, "name", "twitter:image:alt", "FixMyDoor Services door and furniture repair work");

  const serviceRootFallback = renderServiceFallbackMain(pagePath);
  if (serviceRootFallback) {
    html = html.replace('<div id="root"></div>', `<div id="root">\n      ${serviceRootFallback}\n    </div>`);
  }

  const serviceFallbackContent = renderServiceFallbackContent(pagePath);
  if (serviceFallbackContent) {
    html = html.replace(/    <noscript>[\s\S]*?<\/noscript>/, serviceFallbackContent);
  }

  return structuredData ? html.replace("</head>", `${structuredData}\n  </head>`) : html;
}

function renderRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${getPublicBaseUrl()}/sitemap.xml`,
    "",
  ].join("\n");
}

function renderSitemapXml() {
  const publicBaseUrl = getPublicBaseUrl();
  const lastModified = new Date().toISOString().slice(0, 10);

  const items = sitemapRoutes.map((route) => {
    const pageUrl = route === "/" ? `${publicBaseUrl}/` : `${publicBaseUrl}${route}`;
    const seoPage = resolveSeoPage(route);

    return [
      "  <url>",
      `    <loc>${pageUrl}</loc>`,
      `    <lastmod>${lastModified}</lastmod>`,
      `    <changefreq>${seoPage.changeFrequency}</changefreq>`,
      `    <priority>${seoPage.sitemapPriority}</priority>`,
      "  </url>",
    ].join("\n");
  }).join("\n");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    items,
    "</urlset>",
    "",
  ].join("\n");
}

function renderQuoteInvoiceHtml(booking: Booking, nonce: string) {
  const lineItems = (booking.quoteNotes || "Labour, materials, sourcing, delivery, or installation details will be confirmed by FixMyDoor Services.").split(/\r?\n/).filter(Boolean);
  const bookingDisplayId = formatBookingDisplayId(booking);
  const issuedDate = new Date().toLocaleDateString();
  const contactDetails = [booking.phone, booking.email].filter(Boolean).map(escapeHtml).join("<br>");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FixMyDoor Services Quote / Invoice - ${escapeHtml(bookingDisplayId)}</title>
  <style>
    @page { size: letter; margin: 7mm; }
    * { box-sizing: border-box; }
    html { background: #f7efe4; }
    body { margin: 0; background: #f7efe4; color: #2f241c; font-family: Arial, sans-serif; font-size: 12px; }
    .page { max-width: 780px; margin: 14px auto; background: #fffaf2; border: 1px solid #ead8bf; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 60px rgba(47,36,28,.14); }
    header { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; background: #2f241c; color: white; padding: 16px 18px; }
    header img { width: 118px; max-width: 34vw; background: white; border-radius: 13px; padding: 6px 9px; }
    header p { margin: 4px 0 0; }
    main { padding: 16px 18px; }
    h1, h2, h3 { margin: 0; color: #6B4423; }
    h1 { font-size: 26px; }
    h2 { font-size: 16px; }
    h3 { font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 11px 0; }
    .box { background: #f5f1e8; border-radius: 11px; padding: 9px; }
    .label { color: #7b6758; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
    .value { margin-top: 4px; font-weight: 700; line-height: 1.28; }
    .total { margin: 11px 0; padding: 12px 14px; border-radius: 13px; background: #2f241c; color: white; display: flex; justify-content: space-between; gap: 14px; align-items: center; }
    .total strong { font-size: 21px; }
    ul { margin: 6px 0 0; padding-left: 16px; line-height: 1.34; }
    li { margin-bottom: 1px; }
    .notes-box { margin-top: 10px; }
    .notes-box p { margin: 4px 0 0; line-height: 1.28; }
    .approval-block { margin-top: 12px; border-top: 1px solid #e2c6a6; padding-top: 10px; }
    .approval-block p { margin: 0 0 7px; color: #7b6758; line-height: 1.3; }
    .signature-script { width: 118px; max-width: 44vw; height: auto; display: block; margin: 0 0 3px; mix-blend-mode: multiply; filter: contrast(1.18); }
    .signature-line { height: 1px; background: #8f6a48; margin: 0 0 4px; max-width: 150px; }
    .signature-name { display: block; font-weight: 800; color: #2f241c; }
    .signature-title { display: block; margin-top: 1px; color: #7b6758; font-size: 9px; }
    .invoice-footer { margin-top: 10px; border-top: 1px solid #ead8bf; padding-top: 7px; color: #7b6758; font-size: 9.5px; line-height: 1.24; }
    .actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    button { border: 0; border-radius: 12px; background: #b46532; color: white; padding: 11px 15px; font-weight: 800; cursor: pointer; touch-action: manipulation; }
    .secondary-button { background: #2f241c; }
    @media print {
      html, body { background: white; }
      body { font-size: 9.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { width: 100%; max-width: none; margin: 0; box-shadow: none; border-radius: 0; border: 0; break-inside: avoid; page-break-inside: avoid; }
      header { padding: 8px 10px; gap: 8px; }
      header img { width: 82px; border-radius: 9px; padding: 4px 6px; }
      header p { margin-top: 2px; }
      main { padding: 8px 10px; }
      h1 { font-size: 18px; }
      h2 { font-size: 12px; }
      h3 { font-size: 11px; }
      .grid { gap: 5px; margin: 6px 0; }
      .box { border-radius: 8px; padding: 5px 6px; }
      .label { font-size: 7px; }
      .value { margin-top: 2px; line-height: 1.12; }
      .total { margin: 6px 0; padding: 7px 9px; border-radius: 8px; }
      .total strong { font-size: 15px; }
      ul { margin-top: 4px; padding-left: 12px; line-height: 1.16; }
      li { margin-bottom: 0; }
      .notes-box { margin-top: 6px; }
      .notes-box p { margin-top: 2px; line-height: 1.12; }
      .approval-block { margin-top: 6px; padding-top: 5px; break-inside: avoid; page-break-inside: avoid; }
      .approval-block p { margin-bottom: 3px; line-height: 1.1; }
      .signature-script { width: 76px; margin-bottom: 1px; }
      .signature-line { max-width: 96px; margin-bottom: 2px; }
      .signature-name { font-size: 8px; }
      .signature-title { font-size: 7px; }
      .invoice-footer { margin-top: 5px; padding-top: 4px; font-size: 7.2px; line-height: 1.12; }
      .actions { display: none; }
    }
    @media (max-width: 640px) { body { font-size: 11px; } .page { margin: 0; border-radius: 0; } header, .grid { grid-template-columns: 1fr; display: grid; } }
  </style>
</head>
<body>
  <section class="page">
    <header>
      <div>
        <img src="/img5150-transparent.png" alt="FixMyDoor" />
        <p>Door & Furniture Repair Services</p>
      </div>
      <div>
        <h1 style="color:white;">Quote / Invoice</h1>
        <p>Booking ID: ${escapeHtml(bookingDisplayId)}</p>
        <p>Date: ${escapeHtml(issuedDate)}</p>
      </div>
    </header>
    <main>
      <div class="grid">
        <div class="box"><div class="label">Customer</div><div class="value">${escapeHtml(booking.name)}</div></div>
        <div class="box"><div class="label">Contact</div><div class="value">${contactDetails || "Not provided"}</div></div>
        <div class="box"><div class="label">Location</div><div class="value">${escapeHtml([booking.city, booking.country].filter(Boolean).join(", ") || booking.address)}</div></div>
        <div class="box"><div class="label">Request</div><div class="value">${escapeHtml(booking.repairType)}</div></div>
        <div class="box"><div class="label">Invoice Status</div><div class="value">${escapeHtml(booking.invoiceStatus || "Not issued")}</div></div>
        <div class="box"><div class="label">Payment Status</div><div class="value">${escapeHtml(booking.paymentStatus || "Not paid")}</div></div>
      </div>
      <div class="total"><span>Estimated Amount</span><strong>${escapeHtml(booking.quoteAmount || "To be confirmed")}</strong></div>
      <div class="box quote-box">
        <h2>Quote Details</h2>
        <ul>${lineItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div class="box notes-box">
        <h3>Notes</h3>
        <p>Prepared from the booking details. Final cost may change if measurements, parts, delivery, or installation requirements change.</p>
        <p>Thank you for choosing FixMyDoor Services. We appreciate your trust.</p>
        <p><strong>FixMyDoor Services</strong><br>info.fixmydoor@gmail.com<br>+1 (438) 347-1823</p>
      </div>
      <div class="approval-block">
        <p>Sincerely,</p>
        <img class="signature-script" src="/richard-ampofo-official-signature.jpg" alt="Official signature of Richard Ampofo for FixMyDoor Services" />
        <div class="signature-line"></div>
        <span class="signature-name">Richard Ampofo</span>
        <span class="signature-title">Owner / Authorized Signatory, FixMyDoor Services</span>
        <p><strong>Issued:</strong> ${escapeHtml(issuedDate)}</p>
      </div>
      <div class="invoice-footer">
        Services we provide: door repairs, door installations, lock rekeying, furniture repairs, furniture installations, and hardware sourcing.
      </div>
      <div class="actions">
        <button id="print-quote" type="button">Print / Save PDF</button>
        <button id="open-browser-print" class="secondary-button" type="button">Try Again</button>
      </div>
    </main>
  </section>
  <script nonce="${nonce}">
    const printButton = document.getElementById("print-quote");
    const retryButton = document.getElementById("open-browser-print");
    let lastPrintRequest = 0;

    function requestPrint(event) {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      const now = Date.now();
      if (now - lastPrintRequest < 800) return;
      lastPrintRequest = now;

      try {
        window.focus();
        setTimeout(function () {
          if (typeof window.print === "function") {
            window.print();
          }
        }, 150);
      } catch (error) {
      }
    }

    printButton?.addEventListener("click", requestPrint);
    printButton?.addEventListener("touchend", requestPrint, { passive: false });
    retryButton?.addEventListener("click", requestPrint);
    retryButton?.addEventListener("touchend", requestPrint, { passive: false });
  </script>
</body>
</html>`;
}

// Validate Database URL for production
if (!process.env.DATABASE_URL) {
  console.error("[ERROR] DATABASE_URL environment variable is missing.");
}

// Validate critical environment variables
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  console.error("[ERROR] SESSION_SECRET must be set and at least 32 characters long");
  console.error("Generate a secure secret with: openssl rand -base64 32");
  process.exit(1);
}

async function startServer() {
  // Run database migrations in production
  if (process.env.NODE_ENV === "production") {
    try {
      console.log("Running database migrations...");
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("Database migrations completed.");
    } catch (error) {
      console.error("Database migration failed:", error);
      // Don't exit - the app might still work if schema is up to date
    }
  }

  try {
    console.log("Checking database compatibility...");
    await ensureDatabaseCompatibility();
    console.log("Database compatibility check completed.");
  } catch (error) {
    console.error("Database compatibility check failed:", error);
    throw error;
  }

  const app = express();
  const server = createServer(app);
  const isProduction = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  // Initialize admin user
  await initializeAdminUser();
  startBookingReminderSweep();
  startWeekendPromotionSweep();

  // Initialize email service
  emailService.initialize();

  // Security middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        mediaSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "https://www.googletagmanager.com", "https://netsync.yellowpages.ca", "https://s3.eu-central-1.amazonaws.com"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        connectSrc: ["'self'", "https://www.google-analytics.com", "https://analytics.google.com", "https://region1.google-analytics.com", "https://netsync.yellowpages.ca", "https://*.yellowpages.ca", "https://s3.eu-central-1.amazonaws.com"],
        frameSrc: ["'self'", "https://netsync.yellowpages.ca", "https://*.yellowpages.ca", "https://s3.eu-central-1.amazonaws.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    permissionsPolicy: {
      features: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        fullscreen: ["self"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("X-Download-Options", "noopen");

    if (isProduction && /^\/(?:src|server|shared|attached_assets|\.git|\.env|node_modules)(?:\/|$)/i.test(req.path)) {
      return res.status(404).send("Not found");
    }

    const redirectUrl = canonicalHostRedirectUrl(req);
    if (!redirectUrl) {
      return next();
    }

    return res.redirect(req.method === "GET" || req.method === "HEAD" ? 301 : 308, redirectUrl);
  });

  // Rate limiting
  const staticOrPublicFilePattern = /\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?|json|xml|txt|webmanifest|mp4|webm|ogg|pdf|docx?)$/i;
  const shouldSkipPublicRateLimit = (req: express.Request) => {
    if (req.method === "OPTIONS") {
      return true;
    }

    if (staticOrPublicFilePattern.test(req.path)) {
      return true;
    }

    return (
      req.path.startsWith("/assets/") ||
      req.path.startsWith("/icons/") ||
      req.path.startsWith("/uploads/") ||
      req.path.startsWith("/locales/") ||
      req.path === "/favicon.ico" ||
      req.path === "/fixmydoor-favicon-v2.png" ||
      req.path === "/sw.js" ||
      req.path === "/app-shell.js" ||
      req.path === "/manifest.json" ||
      req.path === "/admin-manifest.json" ||
      req.path === "/robots.txt" ||
      req.path === "/sitemap.xml"
    );
  };

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1200,
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipPublicRateLimit,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: "Too many login attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Too many uploads from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);

  // Compression
  app.use(compression());

  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const origin = normalizeOrigin(req.get("origin"));
    if (!origin || allowedOriginsForRequest(req).has(origin)) {
      return next();
    }

    return res.status(403).json({ success: false, error: "Request origin is not allowed" });
  });

  // Session configuration
  app.use(session({
    store: new PrismaSessionStore(),
    secret: sessionSecret as string,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      secure: isProduction, // Use HTTPS in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
    name: "fixmydoor.sid", // Change default session name
  }));

  prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((error) => {
    console.error("Expired session cleanup failed:", error);
  });
  const sessionCleanupTimer = setInterval(() => {
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((error) => {
      console.error("Expired session cleanup failed:", error);
    });
  }, 60 * 60 * 1000);
  sessionCleanupTimer.unref?.();

  app.use(express.json({ limit: "30mb" }));
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir, {
    maxAge: isProduction ? "30d" : 0,
  }));
  app.use("/api/media", uploadLimiter);
  app.use("/api/admin/media", uploadLimiter);

  // Auth middleware
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.session.adminId) {
      return next();
    }
    res.status(401).json({ success: false, error: "Authentication required" });
  }

  function cleanOptionalText(value: unknown, maxLength = 1000) {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim().slice(0, maxLength)
      : null;
  }

  function csvValue(value: unknown) {
    const safeValue = String(value ?? "").replace(/"/g, '""');
    return `"${safeValue}"`;
  }

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    const payload = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      checks: {
        database: "connected",
      },
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.json(payload);
    } catch (error) {
      console.error("Health check failed:", error);

      return res.json({
        ...payload,
        status: "degraded",
        checks: {
          database: "unavailable",
        },
      });
    }
  });

  // Auth routes with rate limiting
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required" });
    }

    // Input validation
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, error: "Invalid input format" });
    }

    if (username.length > 50 || password.length > 100) {
      return res.status(400).json({ success: false, error: "Input too long" });
    }

    try {
      const admin = await findAdminByUsername(username);
      if (!admin) {
        // Don't reveal if username exists - constant time response
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50)); // Random delay
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      const isValidPassword = await verifyPassword(password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      req.session.adminId = admin.id;
      res.json({ success: true });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: "Logout failed" });
      }
      res.clearCookie("fixmydoor.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({ authenticated: !!req.session.adminId });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Current and new password required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "New password must be at least 8 characters long" });
    }

    try {
      const admin = await prisma.admin.findUnique({
        where: { id: req.session.adminId },
      });

      if (!admin || !(await verifyPassword(currentPassword, admin.password))) {
        return res.status(401).json({ success: false, error: "Current password is incorrect" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await prisma.admin.update({
        where: { id: admin.id },
        data: { password: hashedPassword },
      });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ success: false, error: "Failed to change password" });
    }
  });

  app.post("/api/admin/email-test", requireAuth, async (_req, res) => {
    try {
      const sent = await emailService.sendTestEmail();
      if (!sent) {
        return res.status(500).json({
          success: false,
          error: "Email test failed. Check the email diagnostics below and confirm SMTP_USER and SMTP_PASS are set in Railway.",
          status: emailService.getStatus(),
        });
      }

      return res.json({ success: true, status: emailService.getStatus() });
    } catch (error) {
      console.error("Email test error:", error);
      return res.status(500).json({ success: false, error: "Email test failed", status: emailService.getStatus() });
    }
  });

  app.get("/api/admin/email-status", requireAuth, (_req, res) => {
    return res.json({ status: emailService.getStatus() });
  });

  // Booking endpoints
  app.get("/api/services", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ services: serviceCatalog });
  });

  app.get("/api/content", async (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const items = await listPublicContent();
      return res.json({ items });
    } catch (error) {
      console.error("Content load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load content" });
    }
  });

  app.get("/api/site-events", (req, res) => {
    res.set({
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    });
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ sentAt: new Date().toISOString() })}\n\n`);
    siteEventClients.add(res);

    const heartbeat = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      siteEventClients.delete(res);
    });
  });

  app.get("/api/push/public-key", (_req, res) => {
    try {
      return res.json({ publicKey: getVapidKeys().publicKey });
    } catch (error) {
      console.error("Push public key error:", error);
      return res.status(500).json({ success: false, error: "Push notifications are not available right now" });
    }
  });

  app.post("/api/push/subscribe", (req, res) => {
    if (!isValidPushSubscription(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid push subscription" });
    }

    const now = new Date().toISOString();
    const subscriptions = loadPushSubscriptions();
    const existingIndex = subscriptions.findIndex((subscription) => subscription.endpoint === req.body.endpoint);
    const requestedAudience = normalizePushAudience(req.body.audience);
    const existingAudiences = existingIndex >= 0
      ? subscriptions[existingIndex].audiences?.length
        ? subscriptions[existingIndex].audiences
        : [subscriptions[existingIndex].audience || "visitor"]
      : [];
    const audiences = Array.from(new Set([...existingAudiences, requestedAudience]));
    const nextSubscription: StoredPushSubscription = {
      endpoint: req.body.endpoint,
      expirationTime: req.body.expirationTime ?? null,
      keys: req.body.keys,
      audiences,
      audience: requestedAudience,
      createdAt: existingIndex >= 0 ? subscriptions[existingIndex].createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      subscriptions[existingIndex] = nextSubscription;
    } else {
      subscriptions.push(nextSubscription);
    }

    savePushSubscriptions(subscriptions);
    const subscriberCounts = getPushSubscriberCounts();
    return res.json({
      success: true,
      ...subscriberCounts,
      audience: requestedAudience,
      audiences,
    });
  });

  app.get("/api/admin/notifications", requireAuth, (_req, res) => {
    const subscriptions = loadPushSubscriptions();
    const subscriberCounts = getPushSubscriberCounts(subscriptions);
    return res.json({
      ...subscriberCounts,
      notifications: loadPushNotificationLog(),
      publicKeyReady: Boolean(getVapidKeys().publicKey),
    });
  });

  app.post("/api/admin/notifications/send", requireAuth, async (req, res) => {
    const title = String(req.body?.title || "").trim().slice(0, 90);
    const message = String(req.body?.message || "").trim().slice(0, 240);
    const url = String(req.body?.url || "/").trim() || "/";
    const audience = req.body?.audience === "admin" || req.body?.audience === "visitor" ? req.body.audience : "all";

    if (!title || !message) {
      return res.status(400).json({ success: false, error: "Title and message are required" });
    }

    const logEntry = await sendPushNotificationToSubscribers({
      title,
      message,
      url,
      icon: audience === "admin" ? "/icons/admin-icon-v2-192x192.png" : "/icons/main-icon-v2-192x192.png",
      badge: audience === "admin" ? "/icons/admin-icon-v2-96x96.png" : "/icons/main-icon-v2-96x96.png",
    }, { audience, log: true });
    broadcastSiteEvent({ type: "notification", title, message, url });
    if (audience !== "admin") {
      queueCustomerEmailBroadcast({ title, message, url }, "notification");
    }

    return res.json({
      success: true,
      delivered: logEntry.delivered,
      failed: logEntry.failed,
      subscriberCount: logEntry.subscriberCount,
      notification: logEntry,
    });
  });

  app.post("/api/social-click", (req, res) => {
    const platform = String(req.body?.platform || "").trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(socialPlatformLabels, platform)) {
      return res.status(400).json({ success: false, error: "Invalid social platform" });
    }

    const platformLabel = socialPlatformLabels[platform as keyof typeof socialPlatformLabels];
    const page = String(req.body?.page || "/").replace(/[^\w\-./#?=&]/g, "").slice(0, 140) || "/";
    const ipKey = `${req.ip || req.socket.remoteAddress || "unknown"}:${platform}`;
    const now = Date.now();
    const nextAllowedAt = socialClickNoticeCooldown.get(ipKey) || 0;
    const shouldNotify = now >= nextAllowedAt;

    if (shouldNotify) {
      socialClickNoticeCooldown.set(ipKey, now + SOCIAL_CLICK_NOTICE_COOLDOWN_MS);
      queuePushNotification({
        title: `${platformLabel} link opened`,
        message: `A visitor opened FixMyDoor Services on ${platformLabel} from ${page}. Montreal, Quebec social lead.`,
        url: "/admin",
        icon: "/icons/admin-icon-v2-192x192.png",
        badge: "/icons/admin-icon-v2-96x96.png",
      }, { audience: "admin", log: false });
    }

    return res.json({ success: true, notified: shouldNotify });
  });

  app.post("/api/media", async (req, res) => {
    try {
      const media = saveDataUrlMedia(req.body?.dataUrl, { allowVideo: false, maxBytes: 1_800_000 });
      return res.status(201).json({ success: true, ...media });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error?.message || "Invalid media upload" });
    }
  });

  app.post("/api/admin/media", requireAuth, async (req, res) => {
    try {
      const media = saveDataUrlMedia(req.body?.dataUrl, { allowVideo: true, allowDocument: true, maxBytes: 20_000_000 });
      return res.status(201).json({ success: true, ...media });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error?.message || "Invalid media upload" });
    }
  });

  app.get("/api/admin/content", requireAuth, async (_req, res) => {
    try {
      const items = await listAdminContent();
      return res.json({ items });
    } catch (error) {
      console.error("Admin content load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load content" });
    }
  });

  app.post("/api/admin/content", requireAuth, async (req, res) => {
    if (!validateContentItem(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid content item" });
    }

    try {
      const item = await createContentItem(req.body);
      if (item.active) {
        const payload: SiteEventPayload = {
          type: item.category === "advert" ? "advert" : "notification",
          title: item.category === "advert" ? "New FixMyDoor Services advert" : "New FixMyDoor Services website update",
          message: item.title,
          url: item.category === "advert" ? "/#booking-form" : "/",
        };
        queuePushNotification(payload, { audience: "visitor", log: true });
        if (item.category === "advert") {
          broadcastSiteEvent(payload);
          queueCustomerEmailBroadcast(payload, "advert");
        }
      }
      return res.status(201).json({ success: true, item });
    } catch (error) {
      console.error("Content creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to create content item" });
    }
  });

  app.patch("/api/admin/content/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id || id.length > 50 || !validateContentItem(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid content item" });
    }

    try {
      const item = await updateContentItem(id, req.body);
      if (item.active) {
        const payload: SiteEventPayload = {
          type: item.category === "advert" ? "advert" : "notification",
          title: item.category === "advert" ? "Updated FixMyDoor Services advert" : "Updated FixMyDoor Services website content",
          message: item.title,
          url: item.category === "advert" ? "/#booking-form" : "/",
        };
        queuePushNotification(payload, { audience: "visitor", log: true });
        if (item.category === "advert") {
          broadcastSiteEvent(payload);
          queueCustomerEmailBroadcast(payload, "advert");
        }
      }
      return res.json({ success: true, item });
    } catch (error) {
      console.error("Content update error:", error);
      return res.status(500).json({ success: false, error: "Failed to update content item" });
    }
  });

  app.delete("/api/admin/content/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid content item ID" });
    }

    try {
      await prisma.contentItem.delete({ where: { id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("Content deletion error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete content item" });
    }
  });

  app.get("/api/reviews", async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const limit = Math.min(30, Math.max(1, parseInt(req.query.limit as string, 10) || 12));
      const reviews = await listReviews(limit);
      return res.json({ reviews });
    } catch (error) {
      console.error("Review load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load reviews" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    if (!validateReview(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid review data" });
    }

    try {
      const review = await saveReview(req.body);
      return res.status(201).json({ success: true, review });
    } catch (error) {
      console.error("Review creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to save review" });
    }
  });

  app.get("/api/admin/reviews", requireAuth, async (req, res) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const reviews = await listAdminReviews(limit);
      return res.json({ reviews });
    } catch (error) {
      console.error("Admin review load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load reviews" });
    }
  });

  app.patch("/api/admin/reviews/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!id || id.length > 50 || !validateReviewStatus(status)) {
      return res.status(400).json({ success: false, error: "Invalid review update" });
    }

    try {
      const review = await prisma.review.update({
        where: { id },
        data: {
          status,
          adminNotes: cleanOptionalText(adminNotes, 500),
        },
      });
      if (status === "APPROVED") {
        const payload: SiteEventPayload = {
          type: "review",
          title: "New FixMyDoor Services review",
          message: `${review.rating}-star review from ${review.name}`,
          url: "/#testimonials",
        };
        queuePushNotification(payload, { audience: "visitor", log: true });
        broadcastSiteEvent(payload);
      }
      return res.json({ success: true, review });
    } catch (error) {
      console.error("Review update error:", error);
      return res.status(500).json({ success: false, error: "Failed to update review" });
    }
  });

  app.delete("/api/admin/reviews/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!id || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid review ID" });
    }

    try {
      await prisma.review.delete({ where: { id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("Review deletion error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete review" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    const booking = req.body;
    if (!validateBooking(booking)) {
      return res.status(400).json({ success: false, error: "Invalid booking data" });
    }

    try {
      const savedBooking = await saveBooking(booking) as Booking;
      const trackingUrl = savedBooking.customerToken ? `${getPublicBaseUrl()}/track/${savedBooking.customerToken}` : "";
      const emailPromise = sendBookingEmailsWithStatus(savedBooking);
      const emailStatus = await Promise.race([
        emailPromise,
        emailStatusTimeout(9000),
      ]);

      if (emailStatus.queued) {
        emailPromise.catch((error) => {
          console.error("Queued booking email send failed:", error);
        });
      }

      queuePushNotification({
        title: "New customer request",
        message: `${formatBookingDisplayId(savedBooking)} - ${savedBooking.name} requested ${savedBooking.repairType}`,
        url: "/admin",
        icon: "/icons/admin-icon-v2-192x192.png",
        badge: "/icons/admin-icon-v2-96x96.png",
      }, { audience: "admin", log: false });

      return res.status(201).json({
        success: true,
        trackingUrl,
        email: emailStatus,
      });
    } catch (error) {
      console.error("Booking creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to create booking" });
    }
  });

  app.post("/api/admin/bookings/manual", requireAuth, async (req, res) => {
    if (!validateManualBooking(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid manual booking details" });
    }

    try {
      const savedBooking = await saveManualBooking(req.body);
      return res.status(201).json({ success: true, booking: savedBooking });
    } catch (error) {
      console.error("Manual booking creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to create manual booking" });
    }
  });

  app.get("/api/bookings/track/:token", async (req, res) => {
    const { token } = req.params;
    if (!token || token.length > 80) {
      return res.status(400).json({ success: false, error: "Invalid tracking link" });
    }

    try {
      const booking = await prisma.booking.findUnique({
        where: { customerToken: token },
      });

      if (!booking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
      }

      const safeBooking = toBooking(booking);
      return res.json({
        booking: {
          id: safeBooking.id,
          name: safeBooking.name,
          repairType: safeBooking.repairType,
          preferredDate: safeBooking.preferredDate,
          status: safeBooking.status,
          appointmentTime: safeBooking.appointmentTime,
          quoteAmount: safeBooking.quoteAmount,
          invoiceStatus: safeBooking.invoiceStatus,
          paymentStatus: safeBooking.paymentStatus,
          staffAssigned: safeBooking.staffAssigned,
          statusHistory: safeBooking.statusHistory,
          createdAt: safeBooking.createdAt,
          updatedAt: safeBooking.updatedAt,
        },
      });
    } catch (error) {
      console.error("Booking tracking error:", error);
      return res.status(500).json({ success: false, error: "Failed to load booking status" });
    }
  });

  app.get("/api/bookings", requireAuth, async (req, res) => {
    try {
      const { search, status, workflow = "ALL", page = "1", limit = "50" } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));

      let where: any = {};

      if (search && typeof search === "string" && search.length > 0 && search.length <= 100) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { address: { contains: search } },
        ];
      }

      if (status && status !== "ALL" && validateBookingStatus(status)) {
        where.status = status;
      }

      const workflowFilter = typeof workflow === "string" ? workflow : "ALL";
      let bookings: any[] = [];
      let totalCount = 0;

      if (workflowFilter && workflowFilter !== "ALL") {
        const allMatchingBookings = (await prisma.booking.findMany({
          where,
          orderBy: { createdAt: "desc" },
        })).map(toBooking).filter((booking) => matchesWorkflowFilter(booking, workflowFilter));

        totalCount = allMatchingBookings.length;
        bookings = allMatchingBookings.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      } else {
        const [pagedBookings, count] = await Promise.all([
          prisma.booking.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
          }),
          prisma.booking.count({ where }),
        ]);

        bookings = pagedBookings;
        totalCount = count;
      }

      return res.json({
        bookings: bookings.map((booking) => "statusHistory" in booking && Array.isArray(booking.statusHistory) ? booking : toBooking(booking)),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching bookings:", error);
      return res.status(500).json({ success: false, error: "Failed to load bookings" });
    }
  });

  app.get("/api/bookings/export", requireAuth, async (_req, res) => {
    try {
      const bookings = (await prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
      })).map(toBooking);

      const headers = [
        "Booking Code",
        "Internal ID",
        "Name",
        "Phone",
        "Email",
        "Address",
        "City",
        "Country",
        "Time Zone",
        "Preferred Contact",
        "Urgency",
        "Request Scope",
        "Service",
        "Status",
        "Preferred Date",
        "Appointment Time",
        "Quote Amount",
        "Invoice Status",
        "Payment Status",
        "Staff Assigned",
        "Reminder At",
        "Reminder Window",
        "Reminder Note",
        "Reminder Sent At",
        "Currency",
        "Budget",
        "Dimensions",
        "Quantity",
        "Delivery Needed",
        "Installation Needed",
        "Message",
        "Created At",
      ];
      const rows = bookings.map((booking) => [
        formatBookingDisplayId(booking),
        booking.id,
        booking.name,
        booking.phone,
        booking.email,
        booking.address,
        booking.city,
        booking.country,
        booking.timeZone,
        booking.preferredContactMethod,
        booking.urgency,
        booking.requestScope,
        booking.repairType,
        booking.status,
        booking.preferredDate,
        booking.appointmentTime,
        booking.quoteAmount,
        booking.invoiceStatus,
        booking.paymentStatus,
        booking.staffAssigned,
        booking.reminderAt,
        booking.reminderWindow,
        booking.reminderNote,
        booking.reminderSentAt,
        booking.currency,
        booking.budget,
        booking.dimensions,
        booking.quantity,
        booking.deliveryNeeded,
        booking.installationNeeded,
        booking.message,
        booking.createdAt,
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map(csvValue).join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"fixmydoor-bookings.csv\"");
      return res.send(csv);
    } catch (error) {
      console.error("Booking export error:", error);
      return res.status(500).json({ success: false, error: "Failed to export bookings" });
    }
  });

  app.get("/api/bookings/:id/quote", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.length > 50) {
      return res.status(400).send("Invalid booking ID");
    }

    try {
      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).send("Booking not found");
      }

      const nonce = randomUUID().replace(/-/g, "");
      res.setHeader(
        "Content-Security-Policy",
        `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'`,
      );
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(renderQuoteInvoiceHtml(toBooking(booking), nonce));
    } catch (error) {
      console.error("Quote invoice render error:", error);
      return res.status(500).send("Failed to render quote/invoice");
    }
  });

  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const update = req.body as BookingUpdateRequest;
    const { status } = update;

    // Validate ID format
    if (!id || typeof id !== "string" || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }

    if (status !== undefined && !validateBookingStatus(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    try {
      const existingBooking = await prisma.booking.findUnique({ where: { id } });
      if (!existingBooking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
      }

      const previousStatus = existingBooking.status as Booking["status"];
      const nextStatus = status || previousStatus;
      const history = parseStatusHistory(existingBooking.statusHistory);

      if (status && status !== previousStatus) {
        history.push({
          status,
          changedAt: new Date().toISOString(),
          note: cleanOptionalText(update.adminNotes, 300) || "Status updated by admin",
        } as BookingStatusHistoryEntry);
      }

      const updateData: Record<string, unknown> = {
        status: nextStatus,
        statusHistory: serializeStatusHistory(history),
      };

      if ("appointmentTime" in update) {
        const appointmentTime = cleanOptionalText(update.appointmentTime, 160);
        updateData.appointmentTime = appointmentTime;

        if (appointmentTime && !("reminderAt" in update) && !(existingBooking as any).reminderAt) {
          const autoReminderAt = getTwoHourAppointmentReminderAt(appointmentTime);
          if (autoReminderAt) {
            updateData.reminderAt = autoReminderAt;
            updateData.reminderWindow = "2 hours before appointment";
            updateData.reminderNote = buildDefaultAppointmentReminderNote({ repairType: existingBooking.repairType });
            updateData.reminderSentAt = null;
          }
        }
      }
      if ("quoteAmount" in update) updateData.quoteAmount = cleanOptionalText(update.quoteAmount, 80);
      if ("quoteNotes" in update) updateData.quoteNotes = cleanOptionalText(update.quoteNotes, 1000);
      if ("invoiceStatus" in update) updateData.invoiceStatus = cleanOptionalText(update.invoiceStatus, 80);
      if ("paymentStatus" in update) updateData.paymentStatus = cleanOptionalText(update.paymentStatus, 80);
      if ("staffAssigned" in update) updateData.staffAssigned = cleanOptionalText(update.staffAssigned, 120);
      if ("adminNotes" in update) updateData.adminNotes = cleanOptionalText(update.adminNotes, 1000);
      if ("reminderAt" in update) {
        const reminderAt = cleanOptionalText(update.reminderAt, 160);
        updateData.reminderAt = reminderAt;
        if (reminderAt !== (existingBooking as any).reminderAt) {
          updateData.reminderSentAt = null;
        }
      }
      if ("reminderWindow" in update) updateData.reminderWindow = cleanOptionalText(update.reminderWindow, 80);
      if ("reminderNote" in update) updateData.reminderNote = cleanOptionalText(update.reminderNote, 400);

      const booking = await prisma.booking.update({
        where: { id },
        data: updateData as any,
      });
      const normalizedBooking = toBooking(booking);

      if (status && status !== previousStatus) {
        emailService.sendStatusUpdate(normalizedBooking).catch(err =>
          console.error("Failed to send status update email:", err)
        );
      }

      res.json(normalizedBooking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ success: false, error: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }

    try {
      await prisma.booking.delete({
        where: { id },
      });
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting booking:", error);
      return res.status(500).json({ success: false, error: "Failed to delete booking" });
    }
  });

  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const [
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        internationalBookings,
        urgentBookings,
        todayBookings,
        thisWeekBookings,
        thisMonthBookings,
        dueReminderBookings,
      ] = await Promise.all([
        prisma.booking.count(),
        prisma.booking.count({ where: { status: "PENDING" } }),
        prisma.booking.count({ where: { status: "CONFIRMED" } }),
        prisma.booking.count({ where: { status: "COMPLETED" } }),
        prisma.booking.count({
          where: {
            OR: [
              { requestScope: { contains: "International" } },
              { country: { notIn: ["Canada", "canada", "CA", "ca", ""] } },
            ],
          } as any,
        }),
        prisma.booking.count({
          where: {
            OR: [
              { urgency: { contains: "Urgent" } },
              { urgency: { contains: "Emergency" } },
              { urgency: { contains: "Same-day" } },
            ],
          } as any,
        }),
        prisma.booking.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        prisma.booking.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.booking.count({
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
        prisma.booking.count({
          where: {
            reminderAt: { lte: new Date().toISOString() },
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
        } as any),
      ]);

      // Get recent bookings
      const recentBookings = await prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          repairType: true,
        },
      });
      const recentReminderBookings = (await prisma.booking.findMany({
        where: {
          reminderAt: { not: null },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        take: 5,
        orderBy: { reminderAt: "asc" },
      } as any)).map(toBooking);

      res.json({
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        internationalBookings,
        urgentBookings,
        todayBookings,
        thisWeekBookings,
        thisMonthBookings,
        dueReminderBookings,
        recentBookings,
        recentReminderBookings,
      });
    } catch (error) {
      console.error("Stats fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch statistics" });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");
  const indexHtmlPath = path.join(staticPath, "index.html");

  const sendIndexHtml = (res: express.Response, pagePath = "/") => {
    try {
      const html = fs.readFileSync(indexHtmlPath, "utf8");
      res.type("html").send(renderIndexHtmlForPath(html, pagePath));
    } catch (error) {
      console.error("Failed to render index.html:", error);
      res.status(500).send("Failed to load application");
    }
  };

  const isKnownClientRoute = (pagePath: string) => {
    const normalizedPath = normalizeSeoPath(pagePath);
    return (
      normalizedPath === "/" ||
      normalizedPath === "/admin" ||
      normalizedPath === "/admin/notify" ||
      normalizedPath === "/privacy-policy" ||
      normalizedPath === "/terms-and-conditions" ||
      normalizedPath === "/404" ||
      normalizedPath.startsWith("/track/") ||
      Boolean(serviceSeoPages[normalizedPath])
    );
  };

  app.use((req, res, next) => {
    if ((req.method === "GET" || req.method === "HEAD") && req.path.length > 1 && req.path.endsWith("/")) {
      const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(301, `${req.path.replace(/\/+$/, "")}${query}`);
    }

    return next();
  });

  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Cache-Control", isProduction ? "public, max-age=300" : "no-cache");
    res.type("text/plain").send(renderRobotsTxt());
  });

  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Cache-Control", isProduction ? "public, max-age=300" : "no-cache");
    res.type("application/xml").send(renderSitemapXml());
  });

  app.get(Object.keys(seoRouteAliases), (req, res) => {
    const canonicalPath = seoRouteAliases[normalizeSeoPath(req.path)];
    if (!canonicalPath) {
      return res.status(404).send("Not found");
    }

    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(301, `${canonicalPath}${query}`);
  });

  app.get("/index.html", (req, res) => {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(301, `/${query}`);
  });

  app.use(express.static(staticPath, {
    index: false,
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (!isProduction) {
        return;
      }

      if (filePath.endsWith("index.html") || filePath.endsWith("sw.js") || filePath.endsWith("manifest.json") || filePath.endsWith("app-shell.js")) {
        res.setHeader("Cache-Control", "no-store");
      } else if (/\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (req, res) => {
    res.setHeader("Cache-Control", isProduction ? "no-store" : "no-cache");
    if (!isKnownClientRoute(req.path)) {
      res.status(404);
    }
    sendIndexHtml(res, req.path);
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
