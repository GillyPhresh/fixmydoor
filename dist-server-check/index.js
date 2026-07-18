// server/index.ts
import express from "express";
import session from "express-session";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createCipheriv, createECDH, createHmac, createPrivateKey, createSign, generateKeyPairSync, randomBytes, randomUUID as randomUUID2 } from "crypto";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// server/bookings.ts
import { createHash, randomUUID } from "crypto";

// server/prisma.ts
import { PrismaClient } from "@prisma/client";
if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  process.env.DATABASE_URL = "file:/data/fixmydoor.db";
}
var prisma = new PrismaClient();

// server/bookings.ts
var VALID_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
var OPTIONAL_TEXT_FIELDS = [
  "city",
  "country",
  "timeZone",
  "preferredContactMethod",
  "urgency",
  "requestScope",
  "currency",
  "dimensions",
  "quantity",
  "material",
  "color",
  "swingDirection",
  "deliveryNeeded",
  "installationNeeded",
  "budget"
];
var MAX_PHOTO_COUNT = 3;
var MAX_PHOTO_LENGTH = 25e5;
var STORED_MEDIA_PATTERN = /^\/uploads\/[a-z0-9-]+\.(png|jpe?g|webp)$/i;
var TWO_HOURS_MS = 2 * 60 * 60 * 1e3;
function validateOptionalText(body, field, maxLength = 180) {
  return body[field] === void 0 || typeof body[field] === "string" && body[field].trim().length <= maxLength;
}
function validatePhotos(photos) {
  if (photos === void 0) {
    return true;
  }
  if (!Array.isArray(photos) || photos.length > MAX_PHOTO_COUNT) {
    return false;
  }
  return photos.every((photo) => {
    if (typeof photo !== "string") {
      return false;
    }
    if (STORED_MEDIA_PATTERN.test(photo)) {
      return true;
    }
    return photo.length <= MAX_PHOTO_LENGTH && /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(photo);
  });
}
function parseJsonArray(value, fallback = []) {
  if (!value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function serializeStatusHistory(history) {
  return JSON.stringify(history);
}
function parseStatusHistory(value) {
  return parseJsonArray(value);
}
function toBooking(record) {
  return {
    ...record,
    clientId: record.clientId ?? void 0,
    preferredDate: record.preferredDate ?? void 0,
    message: record.message ?? void 0,
    customerToken: record.customerToken ?? void 0,
    photos: parseJsonArray(record.photos),
    city: record.city ?? void 0,
    country: record.country ?? void 0,
    timeZone: record.timeZone ?? void 0,
    preferredContactMethod: record.preferredContactMethod ?? void 0,
    urgency: record.urgency ?? void 0,
    requestScope: record.requestScope ?? void 0,
    currency: record.currency ?? void 0,
    dimensions: record.dimensions ?? void 0,
    quantity: record.quantity ?? void 0,
    material: record.material ?? void 0,
    color: record.color ?? void 0,
    swingDirection: record.swingDirection ?? void 0,
    deliveryNeeded: record.deliveryNeeded ?? void 0,
    installationNeeded: record.installationNeeded ?? void 0,
    budget: record.budget ?? void 0,
    appointmentTime: record.appointmentTime ?? void 0,
    quoteAmount: record.quoteAmount ?? void 0,
    quoteNotes: record.quoteNotes ?? void 0,
    invoiceStatus: record.invoiceStatus ?? void 0,
    paymentStatus: record.paymentStatus ?? void 0,
    staffAssigned: record.staffAssigned ?? void 0,
    adminNotes: record.adminNotes ?? void 0,
    reminderAt: record.reminderAt ?? void 0,
    reminderWindow: record.reminderWindow ?? void 0,
    reminderNote: record.reminderNote ?? void 0,
    reminderSentAt: record.reminderSentAt ?? void 0,
    statusHistory: parseStatusHistory(record.statusHistory),
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt
  };
}
function validateBooking(body) {
  const hasSubmittedAt = typeof body?.submittedAt === "string" && body.submittedAt.trim().length > 0;
  const submittedAt = hasSubmittedAt ? Date.parse(body.submittedAt) : Number.NaN;
  const submissionAgeMs = Date.now() - submittedAt;
  const hasSafeSubmissionTiming = hasSubmittedAt && Number.isFinite(submittedAt) && submissionAgeMs >= 1200 && submissionAgeMs <= 7 * 24 * 60 * 60 * 1e3;
  const passedSecurityCheck = typeof body?.securityAnswer === "string" && body.securityAnswer === "verified-customer";
  return typeof body === "object" && body !== null && typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 100 && typeof body.phone === "string" && body.phone.trim().length > 0 && body.phone.trim().length <= 35 && typeof body.email === "string" && body.email.trim().length > 0 && body.email.trim().length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) && typeof body.address === "string" && body.address.trim().length > 0 && body.address.trim().length <= 500 && typeof body.repairType === "string" && body.repairType.trim().length > 0 && body.repairType.trim().length <= 100 && (body.preferredDate === void 0 || typeof body.preferredDate === "string") && (body.message === void 0 || typeof body.message === "string" && body.message.length <= 1e3) && (body.website === void 0 || body.website === "") && hasSafeSubmissionTiming && passedSecurityCheck && OPTIONAL_TEXT_FIELDS.every((field) => validateOptionalText(body, field)) && validatePhotos(body.photos) && body.customerConsent === true;
}
function validateBookingStatus(status) {
  return typeof status === "string" && VALID_STATUSES.includes(status);
}
function validateManualBooking(body) {
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  return typeof body === "object" && body !== null && typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 100 && typeof body.phone === "string" && body.phone.trim().length > 0 && body.phone.trim().length <= 35 && (email === "" || email.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) && (body.address === void 0 || typeof body.address === "string" && body.address.trim().length <= 500) && (body.city === void 0 || typeof body.city === "string" && body.city.trim().length <= 100) && (body.country === void 0 || typeof body.country === "string" && body.country.trim().length <= 100) && (body.preferredContactMethod === void 0 || typeof body.preferredContactMethod === "string" && body.preferredContactMethod.trim().length <= 100) && (body.urgency === void 0 || typeof body.urgency === "string" && body.urgency.trim().length <= 100) && typeof body.repairType === "string" && body.repairType.trim().length > 0 && body.repairType.trim().length <= 100 && (body.preferredDate === void 0 || typeof body.preferredDate === "string" && body.preferredDate.trim().length <= 60) && (body.appointmentTime === void 0 || typeof body.appointmentTime === "string" && body.appointmentTime.trim().length <= 160) && (body.message === void 0 || typeof body.message === "string" && body.message.length <= 1e3) && (body.adminNotes === void 0 || typeof body.adminNotes === "string" && body.adminNotes.length <= 1e3) && (body.customerConsent === void 0 || typeof body.customerConsent === "boolean");
}
function getManualReminderAt(appointmentTime) {
  if (!appointmentTime) {
    return null;
  }
  const appointmentMs = Date.parse(appointmentTime);
  if (!Number.isFinite(appointmentMs)) {
    return null;
  }
  return new Date(Math.max(Date.now(), appointmentMs - TWO_HOURS_MS)).toISOString();
}
function normalizeClientKey(booking) {
  const phoneDigits = booking.phone?.replace(/\D/g, "") || "";
  const email = booking.email?.trim().toLowerCase() || "";
  return phoneDigits || email || randomUUID();
}
function getClientIdForContact(booking) {
  const digest = createHash("sha1").update(normalizeClientKey(booking)).digest("hex").slice(0, 8).toUpperCase();
  return `FMD-C${digest}`;
}
async function saveBooking(booking) {
  const statusHistory = [
    {
      status: "PENDING",
      changedAt: (/* @__PURE__ */ new Date()).toISOString(),
      note: "Request received"
    }
  ];
  const sanitizedBooking = {
    clientId: getClientIdForContact(booking),
    name: booking.name.trim(),
    phone: booking.phone.trim(),
    email: booking.email.trim().toLowerCase(),
    address: booking.address.trim(),
    city: booking.city?.trim() || null,
    country: booking.country?.trim() || null,
    timeZone: booking.timeZone?.trim() || null,
    preferredContactMethod: booking.preferredContactMethod?.trim() || null,
    urgency: booking.urgency?.trim() || null,
    requestScope: booking.requestScope?.trim() || null,
    currency: booking.currency?.trim() || null,
    repairType: booking.repairType.trim(),
    preferredDate: booking.preferredDate?.trim() || null,
    message: booking.message?.trim() || null,
    customerToken: randomUUID().replace(/-/g, ""),
    photos: booking.photos?.length ? JSON.stringify(booking.photos) : null,
    dimensions: booking.dimensions?.trim() || null,
    quantity: booking.quantity?.trim() || null,
    material: booking.material?.trim() || null,
    color: booking.color?.trim() || null,
    swingDirection: booking.swingDirection?.trim() || null,
    deliveryNeeded: booking.deliveryNeeded?.trim() || null,
    installationNeeded: booking.installationNeeded?.trim() || null,
    budget: booking.budget?.trim() || null,
    customerConsent: booking.customerConsent === true,
    statusHistory: serializeStatusHistory(statusHistory)
  };
  const result = await prisma.booking.create({
    data: sanitizedBooking
  });
  return toBooking(result);
}
async function saveManualBooking(booking) {
  const appointmentTime = booking.appointmentTime?.trim() || null;
  const reminderAt = getManualReminderAt(appointmentTime || void 0);
  const statusHistory = [
    {
      status: "PENDING",
      changedAt: (/* @__PURE__ */ new Date()).toISOString(),
      note: "Manual phone request entered by admin"
    }
  ];
  const result = await prisma.booking.create({
    data: {
      name: booking.name.trim(),
      clientId: getClientIdForContact({ phone: booking.phone, email: booking.email || "" }),
      phone: booking.phone.trim(),
      email: booking.email?.trim().toLowerCase() || "",
      address: booking.address?.trim() || "Phone request - address not confirmed",
      city: booking.city?.trim() || "Montreal",
      country: booking.country?.trim() || "Canada",
      preferredContactMethod: booking.preferredContactMethod?.trim() || "Phone call",
      urgency: booking.urgency?.trim() || null,
      requestScope: "Manual phone request",
      repairType: booking.repairType.trim(),
      preferredDate: booking.preferredDate?.trim() || null,
      message: booking.message?.trim() || null,
      customerToken: randomUUID().replace(/-/g, ""),
      customerConsent: booking.customerConsent === true,
      appointmentTime,
      adminNotes: booking.adminNotes?.trim() || "Created from a phone call by admin.",
      reminderAt,
      reminderWindow: reminderAt ? "2 hours before appointment" : null,
      reminderNote: reminderAt ? `About 2 hours left to go and do the ${booking.repairType.trim()} job. Check the customer details, route, tools, and parts before leaving.` : null,
      statusHistory: serializeStatusHistory(statusHistory)
    }
  });
  return toBooking(result);
}

// server/reviews.ts
var VALID_REVIEW_STATUSES = ["PENDING", "APPROVED", "HIDDEN"];
function validateReview(body) {
  return typeof body === "object" && body !== null && typeof body.name === "string" && body.name.trim().length >= 2 && body.name.trim().length <= 80 && (body.location === void 0 || typeof body.location === "string" && body.location.trim().length <= 100) && typeof body.quote === "string" && body.quote.trim().length >= 8 && body.quote.trim().length <= 500 && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5;
}
function validateReviewStatus(status) {
  return typeof status === "string" && VALID_REVIEW_STATUSES.includes(status);
}
function toReview(review) {
  return {
    id: review.id,
    name: review.name,
    location: review.location ?? void 0,
    rating: review.rating,
    quote: review.quote,
    status: validateReviewStatus(review.status) ? review.status : void 0,
    adminNotes: review.adminNotes ?? void 0,
    createdAt: review.createdAt.toISOString()
  };
}
async function listReviews(limit = 12, status = "APPROVED") {
  const safeLimit = Math.min(30, Math.max(1, limit));
  const reviews = await prisma.review.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: safeLimit
  });
  return reviews.map(toReview);
}
async function listAdminReviews(limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: safeLimit
  });
  return reviews.map(toReview);
}
async function saveReview(review) {
  const createdReview = await prisma.review.create({
    data: {
      name: review.name.trim(),
      location: review.location?.trim() || null,
      rating: review.rating,
      quote: review.quote.trim(),
      status: "PENDING"
    }
  });
  return toReview(createdReview);
}
async function saveAdminReview(review) {
  const createdReview = await prisma.review.create({
    data: {
      name: review.name.trim(),
      location: review.location?.trim() || null,
      rating: review.rating,
      quote: review.quote.trim(),
      status: validateReviewStatus(review.status) ? review.status : "APPROVED",
      adminNotes: review.adminNotes?.trim().slice(0, 300) || null
    }
  });
  return toReview(createdReview);
}

// server/content.ts
var VALID_CATEGORIES = [
  "advert",
  "serviceShowcase",
  "productCategory",
  "doorProduct",
  "hardwareProduct",
  "projectGallery",
  "documentResource",
  "ownerProfile"
];
var CONTENT_MEDIA_PATTERN = /^(\/uploads\/[a-z0-9-]+\.(png|jpe?g|webp|mp4|webm|ogg)|https:\/\/[^\s<>"']{1,900})$/i;
function cleanOptional(value, maxLength = 1e3) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, maxLength) : null;
}
function validateOptionalMedia(value) {
  return value === void 0 || value === "" || typeof value === "string" && value.length <= 1e3 && CONTENT_MEDIA_PATTERN.test(value.trim());
}
function cleanStoredMedia(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const trimmed = value.trim();
  return trimmed.length <= 1e3 && CONTENT_MEDIA_PATTERN.test(trimmed) ? trimmed : void 0;
}
function cleanStoredText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, maxLength) : void 0;
}
function validateContentCategory(category) {
  return typeof category === "string" && VALID_CATEGORIES.includes(category);
}
function validateContentItem(body) {
  return typeof body === "object" && body !== null && validateContentCategory(body.category) && typeof body.title === "string" && body.title.trim().length >= 2 && body.title.trim().length <= 120 && (body.description === void 0 || typeof body.description === "string" && body.description.length <= 1e3) && (body.tag === void 0 || typeof body.tag === "string" && body.tag.length <= 80) && validateOptionalMedia(body.image) && validateOptionalMedia(body.accentImage) && (body.items === void 0 || typeof body.items === "string" && body.items.length <= 500) && (body.bookingValue === void 0 || typeof body.bookingValue === "string" && body.bookingValue.length <= 100) && (body.sortOrder === void 0 || Number.isInteger(body.sortOrder)) && (body.active === void 0 || typeof body.active === "boolean");
}
function toContentItem(item) {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    description: cleanStoredText(item.description, 1e3),
    tag: cleanStoredText(item.tag, 80),
    image: cleanStoredMedia(item.image),
    accentImage: cleanStoredMedia(item.accentImage),
    items: cleanStoredText(item.items, 500),
    bookingValue: cleanStoredText(item.bookingValue, 100),
    sortOrder: item.sortOrder,
    active: item.active,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt
  };
}
async function listPublicContent() {
  const items = await prisma.contentItem.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }]
  });
  return items.map(toContentItem);
}
async function listAdminContent() {
  const items = await prisma.contentItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }]
  });
  return items.map(toContentItem);
}
async function createContentItem(item) {
  const created = await prisma.contentItem.create({
    data: {
      category: item.category,
      title: item.title.trim(),
      description: cleanOptional(item.description),
      tag: cleanOptional(item.tag, 80),
      image: cleanOptional(item.image, 1e3),
      accentImage: cleanOptional(item.accentImage, 1e3),
      items: cleanOptional(item.items, 500),
      bookingValue: cleanOptional(item.bookingValue, 100),
      sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : 0,
      active: item.active !== false
    }
  });
  return toContentItem(created);
}
async function updateContentItem(id, item) {
  const updated = await prisma.contentItem.update({
    where: { id },
    data: {
      category: item.category,
      title: item.title.trim(),
      description: cleanOptional(item.description),
      tag: cleanOptional(item.tag, 80),
      image: cleanOptional(item.image, 1e3),
      accentImage: cleanOptional(item.accentImage, 1e3),
      items: cleanOptional(item.items, 500),
      bookingValue: cleanOptional(item.bookingValue, 100),
      sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : 0,
      active: item.active !== false
    }
  });
  return toContentItem(updated);
}

// server/auth.ts
import bcrypt from "bcrypt";
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
async function createAdminUser(username, password) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    throw new Error("Password must contain at least one uppercase letter, one lowercase letter, and one number");
  }
  const hashedPassword = await hashPassword(password);
  return prisma.admin.create({
    data: {
      username,
      password: hashedPassword
    }
  });
}
async function findAdminByUsername(username) {
  return prisma.admin.findUnique({
    where: { username }
  });
}
async function initializeAdminUser() {
  try {
    const existingAdmin = await prisma.admin.findFirst();
    if (!existingAdmin) {
      const createDefaultAdmin = process.env.CREATE_DEFAULT_ADMIN === "true";
      if (createDefaultAdmin) {
        const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
        if (!defaultPassword) {
          console.error("DEFAULT_ADMIN_PASSWORD environment variable is required when CREATE_DEFAULT_ADMIN=true");
          return;
        }
        await createAdminUser(defaultUsername, defaultPassword);
        console.log(`Default admin user created: ${defaultUsername}`);
        console.log("[WARNING] Change the default password immediately after first login.");
      } else {
        console.log("No admin user exists. Set CREATE_DEFAULT_ADMIN=true and provide DEFAULT_ADMIN_PASSWORD to create one.");
      }
    }
  } catch (error) {
    console.error("Error initializing admin user:", error);
  }
}

// server/email.ts
import nodemailer from "nodemailer";
import { setDefaultResultOrder } from "node:dns";
import { existsSync } from "fs";
import { resolve } from "path";

// shared/booking-code.ts
function formatBookingDisplayId(booking) {
  const rawId = String(booking.id || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const suffix = (rawId.slice(-6) || "000000").padStart(6, "0");
  const createdAt = new Date(booking.createdAt || Date.now());
  const datePart = Number.isNaN(createdAt.getTime()) ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "") : createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `FMD-SVC-${datePart}-${suffix}`;
}

// server/email.ts
var DEFAULT_BUSINESS_EMAIL = "info.fixmydoor@gmail.com";
var DEFAULT_PUBLIC_SITE_URL = "https://www.fixmydoor.ca";
var GOOGLE_REVIEW_URL = "https://g.page/r/CeZinY_kV0VcEAE/review";
var LOGO_CID = "fixmydoor-logo";
var EMAIL_LOGO_CARD_STYLE = "background:#ffffff; background-color:#ffffff; border:1px solid #ead8bf; border-radius:22px; padding:14px 22px; margin:0 auto 14px; box-shadow:0 14px 32px rgba(0,0,0,0.16);";
var EMAIL_LOGO_IMG_STYLE = "display:block; width:220px; max-width:100%; height:auto; margin:0 auto;";
try {
  setDefaultResultOrder("ipv4first");
} catch {
}
function normalizeEnvValue(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return "";
  }
  const quote = trimmed[0];
  if ((quote === `"` || quote === `'`) && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
function normalizeSmtpPassword(value, host) {
  return /gmail|googlemail/i.test(host) ? value.replace(/\s+/g, "") : value;
}
function inferSmtpHost(user, host) {
  if (host) {
    return host;
  }
  const normalizedUser = user.toLowerCase();
  if (/@(?:gmail|googlemail)\.com$/.test(normalizedUser)) {
    return "smtp.gmail.com";
  }
  if (/@(?:outlook|hotmail|live)\.com$/.test(normalizedUser)) {
    return "smtp.office365.com";
  }
  return "";
}
function maskEmail(value) {
  const [name, domain] = value.split("@");
  if (!name || !domain) {
    return value ? "configured" : "";
  }
  return `${name.slice(0, 2)}***@${domain}`;
}
function summarizeEmailError(error) {
  const rawError = error;
  const pieces = [
    rawError?.code,
    rawError?.command,
    rawError?.responseCode ? `response ${rawError.responseCode}` : "",
    rawError?.message || String(error || "")
  ].filter(Boolean);
  return pieces.join(" | ").replace(/\s+/g, " ").slice(0, 320);
}
function getBusinessEmail() {
  return normalizeEnvValue(process.env.BUSINESS_EMAIL) || normalizeEnvValue(process.env.ADMIN_EMAIL) || DEFAULT_BUSINESS_EMAIL;
}
function normalizePublicUrl(value) {
  const rawValue = normalizeEnvValue(value);
  if (!rawValue) {
    return "";
  }
  const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase();
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";
    if (process.env.NODE_ENV === "production" && isLocalHost) {
      return "";
    }
    return url.origin.replace(/\/+$/, "");
  } catch {
    return "";
  }
}
function getRailwayPublicBaseUrl() {
  const railwayDomain = normalizeEnvValue(process.env.RAILWAY_PUBLIC_DOMAIN);
  return railwayDomain ? normalizePublicUrl(railwayDomain) : "";
}
function getPublicBaseUrl() {
  const adminRoot = normalizeEnvValue(process.env.ADMIN_URL).replace(/\/admin\/?$/, "");
  return (normalizePublicUrl(process.env.PUBLIC_SITE_URL) || normalizePublicUrl(process.env.VITE_PUBLIC_SITE_URL) || normalizePublicUrl(adminRoot) || getRailwayPublicBaseUrl() || (process.env.NODE_ENV === "production" ? DEFAULT_PUBLIC_SITE_URL : "http://localhost:3000")).replace(/\/+$/, "");
}
function getAdminDashboardUrl() {
  const configuredAdminUrl = normalizePublicUrl(process.env.ADMIN_URL);
  if (configuredAdminUrl) {
    return `${configuredAdminUrl.replace(/\/admin\/?$/, "")}/admin`;
  }
  return `${getPublicBaseUrl()}/admin`;
}
function getBookingMapQuery(booking) {
  return [booking.address, booking.city, booking.country].filter(Boolean).join(", ");
}
function getGoogleMapsUrl(booking) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getBookingMapQuery(booking))}`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function cleanSubjectValue(value) {
  return value.replace(/[\r\n]+/g, " ").trim();
}
function sanitizeSingleLine(value, maxLength = 120) {
  return cleanSubjectValue(String(value || "")).slice(0, maxLength);
}
function cleanBodyText(value, maxLength = 1e3) {
  return String(value || "").replace(/\r/g, "").trim().slice(0, maxLength);
}
function displayValue(value, fallback = "Not specified") {
  return value ? escapeHtml(value) : fallback;
}
function getLogoAttachment() {
  const candidates = [
    resolve(process.cwd(), "client/public/img5150-transparent.png"),
    resolve(process.cwd(), "client/public/fixmydoor-logo-transparent.png"),
    resolve(process.cwd(), "dist/public/img5150-transparent.png"),
    resolve(process.cwd(), "dist/public/fixmydoor-logo-transparent.png")
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  return logoPath ? {
    filename: "fixmydoor-logo.png",
    path: logoPath,
    cid: LOGO_CID
  } : void 0;
}
function renderEmailLogo(logoAttachment, options = {}) {
  const marginBottom = options.marginBottom ?? "14px";
  const textSize = options.textSize ?? "30px";
  const logoSrc = options.hosted ? `${getPublicBaseUrl()}/img5150-transparent.png` : `cid:${LOGO_CID}`;
  const content = logoAttachment || options.hosted ? `<img src="${logoSrc}" alt="FixMyDoor" width="220" style="${EMAIL_LOGO_IMG_STYLE} background:#ffffff; background-color:#ffffff;" />` : `<span style="display:block; color:#6B4423; font-size:${textSize}; font-weight:800; line-height:1.1;">FixMyDoor Services</span>`;
  return `
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="${EMAIL_LOGO_CARD_STYLE} margin-bottom:${marginBottom};">
      <tr>
        <td align="center" bgcolor="#ffffff" style="background:#ffffff; background-color:#ffffff; border-radius:22px;">
          ${content}
        </td>
      </tr>
    </table>
  `;
}
function formatSubmittedAt(value) {
  const submittedAt = new Date(value);
  return Number.isNaN(submittedAt.getTime()) ? escapeHtml(value) : submittedAt.toLocaleString();
}
function formatOptionalRow(label, value) {
  return value ? `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>` : "";
}
async function sendMailWithRetry(transporter, options, label, onError) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await transporter.sendMail(options);
      if (attempt > 1) {
        console.log(`${label} email sent after retry`);
      }
      return true;
    } catch (error) {
      lastError = error;
      console.error(`${label} email attempt ${attempt} failed:`, error);
      await new Promise((resolve2) => setTimeout(resolve2, 900));
    }
  }
  console.error(`${label} email failed after retry:`, lastError);
  onError?.(lastError);
  return false;
}
function getPhotoAttachments(booking) {
  return (booking.photos || []).map((photo, index) => {
    const match = photo.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
    if (!match) {
      return null;
    }
    const extension = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
    return {
      filename: `booking-photo-${index + 1}.${extension}`,
      content: Buffer.from(match[2], "base64"),
      contentType: match[1]
    };
  }).filter(Boolean);
}
function statusMessage(status) {
  switch (status) {
    case "CONFIRMED":
      return "Your request has been confirmed. We will follow the appointment details shared with you.";
    case "IN_PROGRESS":
      return "Your request is now in progress.";
    case "COMPLETED":
      return "Your request has been marked as completed. Thank you for trusting FixMyDoor Services.";
    case "CANCELLED":
      return "Your request has been cancelled. Contact us if you need to reopen it.";
    default:
      return "Your request is still pending. Our staff will contact you soon.";
  }
}
function getReviewJobLabel(repairType) {
  const value = (repairType || "").toLowerCase();
  if (/lock|rekey|serrurier|barillet/.test(value)) {
    return "door lock or rekeying service";
  }
  if (/furniture|cabinet|drawer|chair|sofa|meuble|armoire/.test(value)) {
    return "furniture or cabinet service";
  }
  if (/install|entry|fitting|purchase|buy|porte/.test(value)) {
    return "door installation or sourcing service";
  }
  if (/hardware|hinge|handle|closer|quincaillerie|charni/.test(value)) {
    return "door or furniture hardware service";
  }
  return "door, lock, furniture, or hardware service";
}
var EmailService = class {
  transporter = null;
  config = null;
  verified = false;
  resendVerified = false;
  lastVerifyError = "";
  lastSendError = "";
  initializedAt = "";
  getResendApiKey() {
    return normalizeEnvValue(process.env.RESEND_API_KEY);
  }
  getResendFrom() {
    return normalizeEnvValue(process.env.RESEND_FROM_EMAIL) || normalizeEnvValue(process.env.FROM_EMAIL);
  }
  canUseResend() {
    return Boolean(this.getResendApiKey() && this.getResendFrom());
  }
  canSendEmail() {
    return this.canUseResend() || Boolean(this.transporter && this.config);
  }
  initialize() {
    this.initializedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.verified = false;
    this.resendVerified = false;
    this.lastVerifyError = "";
    this.lastSendError = "";
    if (this.canUseResend()) {
      this.transporter = null;
      this.config = null;
      this.resendVerified = true;
      console.log("Email service configured for Resend HTTPS delivery.");
      return true;
    }
    const rawHost = normalizeEnvValue(process.env.SMTP_HOST);
    const user = normalizeEnvValue(process.env.SMTP_USER);
    const host = inferSmtpHost(user, rawHost);
    const port = parseInt(normalizeEnvValue(process.env.SMTP_PORT) || (/gmail/i.test(host) ? "465" : "587"), 10);
    const pass = normalizeSmtpPassword(normalizeEnvValue(process.env.SMTP_PASS), host);
    const from = `FixMyDoor Services <${user}>`;
    if (!host || !user || !pass) {
      this.transporter = null;
      this.config = null;
      if (!this.canUseResend()) {
        this.lastVerifyError = "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in Railway, or set SMTP_USER and SMTP_PASS on a Railway plan that supports SMTP.";
        console.warn(this.lastVerifyError);
      }
      return false;
    }
    this.config = {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      from
    };
    this.transporter = nodemailer.createTransport({
      ...this.config,
      family: 4,
      connectionTimeout: 1e4,
      greetingTimeout: 1e4,
      socketTimeout: 15e3,
      tls: {
        servername: host
      }
    });
    this.transporter.verify().then(
      () => {
        this.verified = true;
        this.lastVerifyError = "";
        console.log("Email service verified and ready.");
      },
      (error) => {
        this.verified = false;
        this.lastVerifyError = summarizeEmailError(error);
        console.error("Email service verification failed:", error);
      }
    );
    return true;
  }
  getStatus() {
    const rawHost = normalizeEnvValue(process.env.SMTP_HOST);
    const user = normalizeEnvValue(process.env.SMTP_USER);
    const host = this.config?.host || inferSmtpHost(user, rawHost);
    const pass = normalizeEnvValue(process.env.SMTP_PASS);
    const resendApiKey = this.getResendApiKey();
    const resendFrom = this.getResendFrom();
    const resendConfigured = Boolean(resendApiKey && resendFrom);
    const provider = resendConfigured ? "resend" : this.transporter && this.config ? "smtp" : "none";
    const missing = [
      resendApiKey && !resendFrom ? "RESEND_FROM_EMAIL" : "",
      !resendApiKey && !host ? "SMTP_HOST" : "",
      !resendApiKey && !user ? "SMTP_USER" : "",
      !resendApiKey && !pass ? "SMTP_PASS" : ""
    ].filter(Boolean);
    return {
      configured: Boolean(resendConfigured || this.transporter && this.config && missing.length === 0),
      verified: provider === "resend" ? this.resendVerified : this.verified,
      provider,
      host,
      port: this.config?.port || null,
      secure: Boolean(this.config?.secure),
      smtpUser: maskEmail(user),
      resendConfigured,
      resendFrom: resendFrom ? "configured" : "",
      from: this.config?.from || "",
      businessEmail: getBusinessEmail(),
      adminEmail: normalizeEnvValue(process.env.ADMIN_EMAIL) || getBusinessEmail(),
      publicBaseUrl: getPublicBaseUrl(),
      adminDashboardUrl: getAdminDashboardUrl(),
      missing,
      lastVerifyError: provider === "resend" ? "" : this.lastVerifyError,
      lastSendError: this.lastSendError,
      initializedAt: this.initializedAt
    };
  }
  getProviderName() {
    return this.canUseResend() ? "resend" : "smtp";
  }
  async sendViaResend(options, label, onError) {
    const apiKey = this.getResendApiKey();
    const from = this.getResendFrom();
    if (!apiKey || !from) {
      const error = new Error("Resend is missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
      this.lastSendError = summarizeEmailError(error);
      onError?.(error);
      return false;
    }
    try {
      const attachments = (options.attachments || []).filter((attachment) => attachment && !attachment.cid && attachment.filename && attachment.content).map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.isBuffer(attachment.content) ? attachment.content.toString("base64") : String(attachment.content)
      }));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15e3);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(options.to) ? options.to : [options.to],
          reply_to: options.replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: attachments.length ? attachments : void 0
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const responseBody = await response.text();
      if (!response.ok) {
        throw new Error(`Resend ${response.status}: ${responseBody.slice(0, 260)}`);
      }
      this.resendVerified = true;
      this.lastSendError = "";
      console.log(`${label} email sent with Resend.`);
      return true;
    } catch (error) {
      this.resendVerified = false;
      this.lastSendError = summarizeEmailError(error);
      console.error(`${label} email failed with Resend:`, error);
      onError?.(error);
      return false;
    }
  }
  async sendEmail(options, label, onError) {
    if (this.canUseResend()) {
      return this.sendViaResend(options, label, onError);
    }
    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return false;
    }
    return sendMailWithRetry(this.transporter, options, label, onError);
  }
  async sendBookingConfirmation(booking) {
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }
    if (!booking.email?.trim()) {
      console.warn("Booking confirmation skipped because customer email is missing");
      return false;
    }
    const businessEmail = getBusinessEmail();
    const subject = "FixMyDoor Services - Booking Confirmation";
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? void 0 : getLogoAttachment();
    const trackingUrl = booking.customerToken ? `${getPublicBaseUrl()}/track/${booking.customerToken}` : "";
    const bookingDisplayId = formatBookingDisplayId(booking);
    const logoHtml = renderEmailLogo(logoAttachment, { hosted: useResend });
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:22px; overflow:hidden;">
        <div style="background:#2f241c; padding:24px 24px 20px; text-align:center;">
          ${logoHtml}
          <p style="margin:0; color:#f7efe4; font-size:13px; letter-spacing:1.5px; text-transform:uppercase;">Door & Furniture Repair Services</p>
        </div>

        <div style="padding:28px;">
        <h1 style="color:#6B4423; margin:0 0 14px;">We received your request</h1>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Hi ${escapeHtml(booking.name)},</p>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Thanks for contacting FixMyDoor Services. Your request is now in our system, and our staff will contact you soon to confirm the details.</p>

        <div style="background:#F5F1E8; padding:20px; border-radius:16px; margin:22px 0; color:#3a281f;">
          <h3 style="margin-top:0; color:#6B4423;">Your request details</h3>
          <p><strong>Booking ID:</strong> ${escapeHtml(bookingDisplayId)}</p>
          <p><strong>Request:</strong> ${escapeHtml(booking.repairType)}</p>
          <p><strong>Address:</strong> ${escapeHtml(booking.address)}</p>
          ${formatOptionalRow("City / Province", booking.city)}
          ${formatOptionalRow("Country", booking.country)}
          ${formatOptionalRow("Time Zone", booking.timeZone)}
          ${formatOptionalRow("Preferred Contact", booking.preferredContactMethod)}
          ${formatOptionalRow("Urgency", booking.urgency)}
          ${formatOptionalRow("Request Type", booking.requestScope)}
          ${formatOptionalRow("Currency", booking.currency)}
          <p><strong>Phone:</strong> ${escapeHtml(booking.phone)}</p>
          <p><strong>Preferred Date:</strong> ${displayValue(booking.preferredDate, "To be scheduled")}</p>
          ${formatOptionalRow("Size / Measurements", booking.dimensions)}
          ${formatOptionalRow("Quantity", booking.quantity)}
          ${formatOptionalRow("Material", booking.material)}
          ${formatOptionalRow("Color / Finish", booking.color)}
          ${formatOptionalRow("Swing Direction", booking.swingDirection)}
          ${formatOptionalRow("Delivery Needed", booking.deliveryNeeded)}
          ${formatOptionalRow("Installation Needed", booking.installationNeeded)}
          ${formatOptionalRow("Budget", booking.budget)}
          ${booking.message ? `<p><strong>Message:</strong> ${escapeHtml(booking.message)}</p>` : ""}
          ${booking.photos?.length ? `<p><strong>Photos:</strong> ${booking.photos.length} image(s) received</p>` : ""}
          <p><strong>Status:</strong> ${booking.status}</p>
        </div>

        ${trackingUrl ? `<p style="font-size:16px; line-height:1.6; color:#3a281f;">You can check your request status here:</p>
        <p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block; background:#b46532; color:#ffffff; padding:12px 18px; border-radius:12px; text-decoration:none; font-weight:700;">Track Your Request</a></p>` : ""}

        <p style="font-size:16px; line-height:1.6; color:#3a281f;">You can reach us here if you need to add anything:</p>
        <p style="font-size:15px; color:#3a281f;"><strong>Phone:</strong> +1 (438) 347-1823</p>
        <p style="font-size:15px; color:#3a281f;"><strong>Email:</strong> <a href="mailto:${escapeHtml(businessEmail)}" style="color:#b46532;">${escapeHtml(businessEmail)}</a></p>

        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Thank you for trusting FixMyDoor Services with your repair needs.</p>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Best regards,<br><strong>FixMyDoor Services</strong></p>
        </div>
      </div>
    `;
    try {
      const text = [
        `Hi ${booking.name},`,
        "",
        "Thanks for contacting FixMyDoor Services. Your request is now in our system, and our staff will contact you soon to confirm the details.",
        "",
        `Booking ID: ${bookingDisplayId}`,
        `Request: ${booking.repairType}`,
        `Address: ${booking.address}`,
        `City / Province: ${booking.city || "Not specified"}`,
        `Country: ${booking.country || "Not specified"}`,
        `Phone: ${booking.phone}`,
        `Preferred Date: ${booking.preferredDate || "To be scheduled"}`,
        `Message: ${booking.message || "None"}`,
        trackingUrl ? `Track your request: ${trackingUrl}` : "",
        "",
        "Phone: +1 (438) 347-1823",
        `Email: ${businessEmail}`,
        "",
        "Best regards,",
        "FixMyDoor Services"
      ].filter(Boolean).join("\n");
      const sent = await this.sendEmail({
        from: this.config?.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        text,
        html,
        attachments: logoAttachment ? [logoAttachment] : void 0
      }, "Customer booking confirmation", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
      if (!sent) {
        return false;
      }
      console.log(`Booking confirmation email sent to ${booking.email}`);
      return true;
    } catch (error) {
      console.error("Failed to send booking confirmation email:", error);
      return false;
    }
  }
  async sendAdminNotification(booking) {
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }
    const businessEmail = getBusinessEmail();
    const adminEmail = normalizeEnvValue(process.env.ADMIN_EMAIL) || businessEmail || this.config?.auth.user;
    const adminUrl = getAdminDashboardUrl();
    const mapQuery = getBookingMapQuery(booking);
    const mapsUrl = getGoogleMapsUrl(booking);
    const photoAttachments = getPhotoAttachments(booking);
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? void 0 : getLogoAttachment();
    const logoHtml = `<div style="text-align:center; background:#2f241c; padding:24px; border-radius:18px 18px 0 0;">${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })}</div>`;
    const subject = `New FixMyDoor Services Booking: ${cleanSubjectValue(booking.name)} - ${cleanSubjectValue(booking.repairType)}`;
    const bookingDisplayId = formatBookingDisplayId(booking);
    const text = [
      "New FixMyDoor Services booking received",
      "",
      `Booking ID: ${bookingDisplayId}`,
      `Name: ${booking.name}`,
      `Phone: ${booking.phone}`,
      `Email: ${booking.email}`,
      `Address: ${booking.address}`,
      `City / Province: ${booking.city || "Not specified"}`,
      `Country: ${booking.country || "Not specified"}`,
      `Time Zone: ${booking.timeZone || "Not specified"}`,
      `Preferred Contact: ${booking.preferredContactMethod || "Not specified"}`,
      `Urgency: ${booking.urgency || "Not specified"}`,
      `Request Type: ${booking.requestScope || "Not specified"}`,
      `Currency: ${booking.currency || "Not specified"}`,
      `Map Search: ${mapQuery}`,
      `Google Maps: ${mapsUrl}`,
      `Service: ${booking.repairType}`,
      `Preferred Date: ${booking.preferredDate || "Not specified"}`,
      `Size / Measurements: ${booking.dimensions || "Not specified"}`,
      `Quantity: ${booking.quantity || "Not specified"}`,
      `Material: ${booking.material || "Not specified"}`,
      `Color / Finish: ${booking.color || "Not specified"}`,
      `Swing Direction: ${booking.swingDirection || "Not specified"}`,
      `Delivery Needed: ${booking.deliveryNeeded || "Not specified"}`,
      `Installation Needed: ${booking.installationNeeded || "Not specified"}`,
      `Budget: ${booking.budget || "Not specified"}`,
      `Photos: ${booking.photos?.length || 0}`,
      `Message: ${booking.message || "None"}`,
      `Status: ${booking.status}`,
      `Submitted: ${formatSubmittedAt(booking.createdAt)}`,
      "",
      `Admin Dashboard: ${adminUrl}`
    ].join("\n");
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:18px; overflow:hidden;">
        ${logoHtml}
        <div style="padding:24px;">
        <h1 style="color: #6B4423; margin-top:0;">New Booking Alert</h1>
        <p>A new booking has been received. Review the details below and follow up with the customer.</p>

        <div style="background: #F5F1E8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Customer Details:</h3>
          <p><strong>Booking ID:</strong> ${escapeHtml(bookingDisplayId)}</p>
          <p><strong>Name:</strong> ${escapeHtml(booking.name)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(booking.phone)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a></p>
          <p><strong>Address:</strong> ${escapeHtml(booking.address)}</p>
          ${formatOptionalRow("City / Province", booking.city)}
          ${formatOptionalRow("Country", booking.country)}
          ${formatOptionalRow("Time Zone", booking.timeZone)}
          ${formatOptionalRow("Preferred Contact", booking.preferredContactMethod)}
          ${formatOptionalRow("Urgency", booking.urgency)}
          ${formatOptionalRow("Request Type", booking.requestScope)}
          ${formatOptionalRow("Currency", booking.currency)}
          <p><strong>Map Search:</strong> ${escapeHtml(mapQuery)}</p>
          <p><a href="${escapeHtml(mapsUrl)}" style="display:inline-block; background:#2f241c; color:#ffffff; padding:10px 14px; border-radius:10px; text-decoration:none; font-weight:700;">Open Customer Location in Google Maps</a></p>
          <p><strong>Service:</strong> ${escapeHtml(booking.repairType)}</p>
          <p><strong>Preferred Date:</strong> ${displayValue(booking.preferredDate)}</p>
          ${formatOptionalRow("Size / Measurements", booking.dimensions)}
          ${formatOptionalRow("Quantity", booking.quantity)}
          ${formatOptionalRow("Material", booking.material)}
          ${formatOptionalRow("Color / Finish", booking.color)}
          ${formatOptionalRow("Swing Direction", booking.swingDirection)}
          ${formatOptionalRow("Delivery Needed", booking.deliveryNeeded)}
          ${formatOptionalRow("Installation Needed", booking.installationNeeded)}
          ${formatOptionalRow("Budget", booking.budget)}
          <p><strong>Photos:</strong> ${booking.photos?.length || 0} image(s)${photoAttachments.length ? " attached to this email" : ""}</p>
          ${booking.message ? `<p><strong>Message:</strong> <span style="white-space: pre-wrap;">${escapeHtml(booking.message)}</span></p>` : "<p><strong>Message:</strong> None</p>"}
          <p><strong>Status:</strong> ${booking.status}</p>
          <p><strong>Submitted:</strong> ${formatSubmittedAt(booking.createdAt)}</p>
        </div>

        <p>Please log in to the admin dashboard to manage this booking.</p>
        <p><a href="${escapeHtml(adminUrl)}" style="background: #D97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Admin Dashboard</a></p>
        </div>
      </div>
    `;
    try {
      const sent = await this.sendEmail({
        from: this.config?.from,
        to: adminEmail,
        replyTo: booking.email,
        subject,
        text,
        html,
        attachments: [...logoAttachment ? [logoAttachment] : [], ...photoAttachments]
      }, "Admin booking notification", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
      if (!sent) {
        return false;
      }
      console.log("Admin notification email sent");
      return true;
    } catch (error) {
      console.error("Failed to send admin notification email:", error);
      return false;
    }
  }
  async sendStatusUpdate(booking) {
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }
    if (!booking.email?.trim()) {
      console.warn("Status update email skipped because customer email is missing");
      return false;
    }
    const businessEmail = getBusinessEmail();
    const trackingUrl = booking.customerToken ? `${getPublicBaseUrl()}/track/${booking.customerToken}` : "";
    const subject = `FixMyDoor Services request update: ${booking.status.replace("_", " ")}`;
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? void 0 : getLogoAttachment();
    const bookingDisplayId = formatBookingDisplayId(booking);
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:20px; overflow:hidden;">
        <div style="background:#2f241c; padding:22px; text-align:center;">
          ${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })}
        </div>
        <div style="padding:26px; color:#3a281f;">
          <h1 style="color:#6B4423; margin-top:0;">Your request status changed</h1>
          <p>Hi ${escapeHtml(booking.name)},</p>
          <p>${escapeHtml(statusMessage(booking.status))}</p>
          <div style="background:#F5F1E8; padding:18px; border-radius:14px; margin:20px 0;">
            <p><strong>Booking ID:</strong> ${escapeHtml(bookingDisplayId)}</p>
            <p><strong>Current Status:</strong> ${escapeHtml(booking.status.replace("_", " "))}</p>
            ${formatOptionalRow("Appointment Time", booking.appointmentTime)}
            ${formatOptionalRow("Quote Amount", booking.quoteAmount)}
            ${formatOptionalRow("Invoice Status", booking.invoiceStatus)}
            ${formatOptionalRow("Payment Status", booking.paymentStatus)}
            ${formatOptionalRow("Staff Assigned", booking.staffAssigned)}
          </div>
          ${trackingUrl ? `<p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block; background:#b46532; color:#ffffff; padding:12px 18px; border-radius:12px; text-decoration:none; font-weight:700;">View Request Status</a></p>` : ""}
          <p>You can reach us at <a href="mailto:${escapeHtml(businessEmail)}" style="color:#b46532;">${escapeHtml(businessEmail)}</a> or +1 (438) 347-1823.</p>
          <p>Best regards,<br><strong>FixMyDoor Services</strong></p>
        </div>
      </div>
    `;
    try {
      const sent = await this.sendEmail({
        from: this.config?.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        html,
        attachments: logoAttachment ? [logoAttachment] : void 0
      }, "Status update", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
      if (!sent) {
        return false;
      }
      console.log(`Status update email sent to ${booking.email}`);
      return true;
    } catch (error) {
      console.error("Failed to send status update email:", error);
      return false;
    }
  }
  async sendReviewRequest(booking) {
    if (!this.canSendEmail()) {
      console.warn("Review request email skipped because email service is not initialized");
      return false;
    }
    if (!booking.email?.trim()) {
      console.warn("Review request email skipped because customer email is missing");
      return false;
    }
    const businessEmail = getBusinessEmail();
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? void 0 : getLogoAttachment();
    const bookingDisplayId = formatBookingDisplayId(booking);
    const jobLabel = getReviewJobLabel(booking.repairType);
    const subject = "How was your FixMyDoor Services job?";
    const text = [
      `Hi ${booking.name},`,
      "",
      `Thank you for choosing FixMyDoor Services for your ${jobLabel}.`,
      "If you were happy with the work, please leave us an honest Google review. Your feedback helps other customers in Montreal find reliable door, lock, furniture, and hardware help.",
      "",
      `Review link: ${GOOGLE_REVIEW_URL}`,
      "",
      "Thank you,",
      "FixMyDoor Services"
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#fffaf2;border:1px solid #ead8bf;border-radius:20px;overflow:hidden;">
        <div style="background:#2f241c;padding:22px;text-align:center;">
          ${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })}
        </div>
        <div style="padding:26px;color:#3a281f;">
          <p style="margin:0 0 10px;color:#b46532;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Completed service follow-up</p>
          <h1 style="color:#6B4423;margin:0 0 14px;">Thank you for choosing FixMyDoor Services</h1>
          <p>Hi ${escapeHtml(booking.name)},</p>
          <p>Thank you for choosing FixMyDoor Services for your ${escapeHtml(jobLabel)}.</p>
          <p>If you were happy with the work, please leave us an honest Google review. Your feedback helps other customers in Montreal find reliable door, lock, furniture, and hardware help.</p>
          <div style="background:#F5F1E8;padding:16px;border-radius:14px;margin:20px 0;">
            <p style="margin:0;"><strong>Booking ID:</strong> ${escapeHtml(bookingDisplayId)}</p>
          </div>
          <p><a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;background:#b46532;color:#ffffff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:800;">Leave an honest Google review</a></p>
          <p style="font-size:14px;color:#6f6258;">Thank you,<br><strong>FixMyDoor Services</strong><br><a href="mailto:${escapeHtml(businessEmail)}" style="color:#b46532;">${escapeHtml(businessEmail)}</a><br>+1 (438) 347-1823</p>
        </div>
      </div>
    `;
    try {
      const sent = await this.sendEmail({
        from: this.config?.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        text,
        html,
        attachments: logoAttachment ? [logoAttachment] : void 0
      }, "Review request", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
      if (!sent) {
        return false;
      }
      console.log(`Review request email sent to ${booking.email}`);
      return true;
    } catch (error) {
      console.error("Failed to send review request email:", error);
      return false;
    }
  }
  async sendCustomerBroadcastEmail(to, payload) {
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }
    const businessEmail = getBusinessEmail();
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? void 0 : getLogoAttachment();
    const title = sanitizeSingleLine(payload.title, 90) || "FixMyDoor Services update";
    const message = cleanBodyText(payload.message, 600) || "A new FixMyDoor Services update is available.";
    const url = payload.url ? normalizePublicUrl(payload.url) || `${getPublicBaseUrl()}${payload.url.startsWith("/") ? payload.url : `/${payload.url}`}` : getPublicBaseUrl();
    const subjectPrefix = payload.type === "advert" ? "New FixMyDoor Services offer" : "FixMyDoor Services update";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#fffaf2;border:1px solid #ead8bf;border-radius:20px;overflow:hidden;">
        <div style="background:#2f241c;padding:22px;text-align:center;">
          ${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })}
        </div>
        <div style="padding:26px;color:#3a281f;">
          <p style="margin:0 0 10px;color:#b46532;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(subjectPrefix)}</p>
          <h1 style="color:#6B4423;margin:0 0 14px;">${escapeHtml(title)}</h1>
          <p style="font-size:16px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>
          <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#b46532;color:#ffffff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:800;">View Update</a></p>
          <p style="font-size:13px;line-height:1.5;color:#6f6258;">You are receiving this because you previously contacted FixMyDoor Services. To stop receiving service updates, reply STOP to this email.</p>
          <p style="font-size:14px;color:#3a281f;">FixMyDoor Services<br><a href="mailto:${escapeHtml(businessEmail)}" style="color:#b46532;">${escapeHtml(businessEmail)}</a><br>+1 (438) 347-1823</p>
        </div>
      </div>
    `;
    try {
      return await this.sendEmail({
        from: this.config?.from,
        to,
        replyTo: businessEmail,
        subject: `${subjectPrefix}: ${title}`,
        text: [
          title,
          "",
          message,
          "",
          `View update: ${url}`,
          "",
          "You are receiving this because you previously contacted FixMyDoor Services. To stop receiving service updates, reply STOP to this email.",
          `Contact: ${businessEmail} | +1 (438) 347-1823`
        ].join("\n"),
        html,
        attachments: logoAttachment ? [logoAttachment] : void 0
      }, "Customer update broadcast", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
    } catch (error) {
      console.error("Failed to send customer update email:", error);
      return false;
    }
  }
  async sendTestEmail(to = getBusinessEmail()) {
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? void 0 : getLogoAttachment();
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fffaf2;border:1px solid #ead8bf;border-radius:20px;overflow:hidden;">
        <div style="background:#2f241c;padding:22px;text-align:center;">
          ${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })}
        </div>
        <div style="padding:24px;color:#3a281f;">
          <h1 style="color:#6B4423;margin-top:0;">FixMyDoor Services email test</h1>
          <p>This confirms the website can send emails through the configured SMTP account.</p>
          <p>If you received this message, booking emails should also deliver to customers and admin.</p>
        </div>
      </div>
    `;
    try {
      const sent = await this.sendEmail({
        from: this.config?.from,
        to,
        replyTo: getBusinessEmail(),
        subject: "FixMyDoor Services email test",
        html,
        attachments: logoAttachment ? [logoAttachment] : void 0
      }, "Test", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
      if (!sent) {
        return false;
      }
      console.log(`Test email sent to ${to}`);
      return true;
    } catch (error) {
      console.error("Failed to send test email:", error);
      return false;
    }
  }
};
var emailService = new EmailService();

// shared/services.ts
var serviceCatalog = [
  {
    slug: "door-repair",
    title: "Door Repairs",
    summary: "For doors that stick, drag, sag, scrape, or refuse to close properly.",
    bookingValue: "door-repair",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true
  },
  {
    slug: "lock-rekeying",
    title: "Lock & Hinge Care",
    summary: "Rekeying, handle changes, and hinge adjustments for doors that need to feel safe again.",
    bookingValue: "lock-rekeying",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true
  },
  {
    slug: "furniture-repair",
    title: "Furniture Repairs",
    summary: "Repairs for furniture that is loose, worn, damaged, or no longer working the way it should.",
    bookingValue: "furniture-repair",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true
  },
  {
    slug: "furniture-installation",
    title: "Furniture Installations",
    summary: "Furniture setup, fitting, alignment, hardware installation, and practical installation support.",
    bookingValue: "furniture-installation",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true
  },
  {
    slug: "entry-door-installation",
    title: "Entry Door Installation",
    summary: "A front-door upgrade that fits better, closes better, and improves the entrance.",
    bookingValue: "entry-door-installation",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true
  },
  {
    slug: "door-alignment",
    title: "Door Alignment",
    summary: "For doors that rub, leave gaps, swing badly, or need a cleaner close.",
    bookingValue: "door-alignment",
    showOnHome: false,
    showInFooter: false,
    showInBooking: true
  },
  {
    slug: "door-purchase",
    title: "Buy Doors",
    summary: "Ask about entry, interior, glass-panel, steel, wood-look, and custom-fit door options.",
    bookingValue: "door-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true
  },
  {
    slug: "door-hardware-purchase",
    title: "Buy Door Hardware",
    summary: "Ask about handles, locks, cylinders, hinges, backplates, and full hardware kits.",
    bookingValue: "door-hardware-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true
  },
  {
    slug: "furniture-hardware-purchase",
    title: "Buy Furniture Hardware",
    summary: "Ask about drawer slides, cabinet hinges, soft-close runners, and repair hardware.",
    bookingValue: "furniture-hardware-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true
  },
  {
    slug: "international-request",
    title: "International Requests",
    summary: "Door, furniture, and hardware request support for customers outside Montreal or Canada.",
    bookingValue: "international-request",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true
  }
];

// shared/seo.ts
var homeSeoPage = {
  path: "/",
  title: "Door Repair Montreal | Locksmith & Furniture Help | FixMyDoor",
  description: "Door repair, lock rekeying, furniture repair, installation, and hardware sourcing in Montreal. Send photos to FixMyDoor Services for clear next steps.",
  keywords: "door repair Montreal, serrurier Montreal, locksmith Montreal, lock rekeying Montreal, door hardware replacement, furniture repair Montreal, entry door installation Montreal, FixMyDoor Services, Laval door repair, Longueuil door repair",
  frenchTitle: "Reparation de portes Montreal | Serrurier et meubles | FixMyDoor",
  frenchDescription: "Reparation de portes, changement de barillet, reparation de meubles, installation et recherche de quincaillerie a Montreal. Envoyez des photos a FixMyDoor Services.",
  frenchKeywords: "reparation de portes Montreal, serrurier Montreal, changement de barillet Montreal, reparation de meubles Montreal, quincaillerie de porte Montreal, installation de porte entree Montreal, FixMyDoor Services",
  sitemapPriority: "1.0",
  changeFrequency: "weekly"
};
var privacyPolicySeoPage = {
  path: "/privacy-policy",
  title: "Privacy Policy | FixMyDoor Services",
  description: "Read the FixMyDoor Services privacy policy for bookings, customer messages, uploaded photos, reviews, website analytics, notifications, and third-party tools.",
  keywords: "FixMyDoor Services privacy policy, FixMyDoor privacy, customer data Montreal, booking privacy, review widget privacy, YellowPages reviews, Google reviews",
  sitemapPriority: "0.4",
  changeFrequency: "monthly"
};
var termsConditionsSeoPage = {
  path: "/terms-and-conditions",
  title: "Terms & Conditions | FixMyDoor Services",
  description: "Review the FixMyDoor Services terms and conditions for service requests, quotes, bookings, payments, uploads, reviews, notifications, and customer responsibilities.",
  keywords: "FixMyDoor Services terms, FixMyDoor terms and conditions, booking terms Montreal, service terms, quote terms, notification consent, repair service conditions",
  sitemapPriority: "0.4",
  changeFrequency: "monthly"
};
var ghanaBranchSeoPage = {
  path: "/ghana-branch",
  title: "FixMyDoor Services Ghana | Doors, Furniture & Installation in Kumasi",
  description: "FixMyDoor Services Ghana in Kumasi offers door sales, door installation, furniture sales, furniture installation, door repairs, and furniture repairs.",
  keywords: "FixMyDoor Services Ghana, doors Kumasi, door installation Ghana, furniture sales Kumasi, furniture installation Ghana, door repairs Ghana, furniture repairs Ghana",
  sitemapPriority: "0.7",
  changeFrequency: "weekly"
};
var serviceSeoPages = {
  "/door-repair": {
    path: "/door-repair",
    eyebrow: "Door Repair",
    title: "Door Repair Montreal | Sticking & Damaged Doors Fixed",
    description: "Door sticking, sagging, rubbing, or not closing? FixMyDoor Services repairs doors, hinges, frames, handles, and latches for Montreal customers.",
    keywords: "door repair Montreal, Montreal door repair, fixing doors Montreal, sticking door repair, damaged door frame Montreal, door hinge repair, door handle repair, door repairs Quebec, door repair near me, reparation de porte Montreal",
    frenchTitle: "Reparation de portes Montreal | Portes qui coincent",
    frenchDescription: "Porte qui coince, frotte, descend ou ferme mal? FixMyDoor Services aide a reparer portes, charnieres, cadres, poignees et loquets a Montreal.",
    frenchKeywords: "reparation de portes Montreal, porte qui coince, ajustement de porte Montreal, charniere de porte, cadre de porte, poignee de porte, porte qui ferme mal",
    bullets: ["Sticking, dragging, sagging, or scraping doors", "Frame, latch, hinge, and handle repairs", "Photo-based review before follow-up"],
    cta: "Book Door Repair",
    bookingValue: "door-repair",
    structuredServiceName: "Door repair",
    sitemapPriority: "0.9",
    changeFrequency: "weekly"
  },
  "/lock-rekeying": {
    path: "/lock-rekeying",
    eyebrow: "Lock Rekeying",
    title: "Serrurier Montreal | Lock Rekeying & Door Lock Help",
    description: "Need a Montreal locksmith for lock rekeying, cylinder replacement, handle repair, or safer entry hardware? Send photos to FixMyDoor Services.",
    keywords: "lock rekeying Montreal, serrurier Montreal, locksmith Montreal, door lock replacement Montreal, rekey front door, lock repair Montreal, door cylinder replacement, handle replacement Montreal, safer door lock, Quebec door hardware",
    frenchTitle: "Serrurier Montreal | Changement de barillet et serrure",
    frenchDescription: "Besoin d'un serrurier a Montreal pour changement de barillet, remplacement de serrure, cylindre ou poignee? Envoyez des photos a FixMyDoor Services.",
    frenchKeywords: "serrurier Montreal, changement de barillet Montreal, reparation de serrure, remplacement de serrure, cylindre de porte, poignee de porte, serrurier Ahuntsic",
    bullets: ["Rekeying after missing keys or tenant changes", "Cylinder, latch, handle, and hinge support", "Security-focused recommendations"],
    cta: "Request Lock Help",
    bookingValue: "lock-rekeying",
    structuredServiceName: "Lock rekeying and door hardware replacement",
    sitemapPriority: "0.9",
    changeFrequency: "weekly"
  },
  "/furniture-repair": {
    path: "/furniture-repair",
    eyebrow: "Furniture Repair",
    title: "Furniture Repair Montreal | Cabinets, Drawers, Sofas & Chairs",
    description: "Furniture repair in Montreal for cabinets, drawer slides, sofa frames, loose chairs, desks, and hardware replacement. Send photos for review.",
    keywords: "furniture repair Montreal, sofa repair Montreal, cabinet repair, drawer slide repair, chair repair Montreal, furniture restoration, furniture parts, furniture repair Quebec",
    frenchTitle: "Reparation de meubles Montreal | Armoires, tiroirs et sofas",
    frenchDescription: "Reparation de meubles a Montreal: armoires, coulisses de tiroirs, sofas, chaises, bureaux et quincaillerie. Envoyez des photos pour examen.",
    frenchKeywords: "reparation de meubles Montreal, reparation armoire, coulisse de tiroir, charniere armoire, sofa, chaise, pieces de meubles",
    bullets: ["Sofa, cabinet, drawer, chair, and table support", "Loose joints, broken parts, and hardware replacement", "Clear next steps from photos and measurements"],
    cta: "Book Furniture Help",
    bookingValue: "furniture-repair",
    structuredServiceName: "Furniture repair",
    sitemapPriority: "0.9",
    changeFrequency: "weekly"
  },
  "/furniture-installation": {
    path: "/furniture-installation",
    eyebrow: "Furniture Installation",
    title: "Furniture Installation Montreal | Setup, Fitting & Hardware",
    description: "Need furniture installation in Montreal? Get help with setup, fitting, cabinets, drawer slides, shelves, desks, office furniture, and hardware support.",
    keywords: "furniture installation Montreal, furniture setup Montreal, cabinet installation, drawer slide installation, furniture assembly Montreal, cabinet hardware installation, furniture fitting Quebec",
    frenchTitle: "Installation de meubles Montreal | Montage et quincaillerie",
    frenchDescription: "Installation de meubles a Montreal: montage, ajustement, armoires, coulisses, tablettes, bureaux, mobilier de bureau et quincaillerie.",
    frenchKeywords: "installation de meubles Montreal, montage de meubles, installation armoire, mobilier de bureau, coulisses de tiroirs, quincaillerie d'armoires",
    bullets: ["Furniture setup, fitting, and alignment", "Cabinet, drawer, desk, shelf, and hardware installation", "Photos and measurements reviewed before follow-up"],
    cta: "Book Furniture Installation",
    bookingValue: "furniture-installation",
    structuredServiceName: "Furniture installation",
    sitemapPriority: "0.85",
    changeFrequency: "weekly"
  },
  "/entry-door-installation": {
    path: "/entry-door-installation",
    eyebrow: "Entry Door Installation",
    title: "Entry Door Installation Montreal | Front Door Fitting",
    description: "Entry door installation in Montreal with help for measurements, swing direction, front door fitting, hardware matching, and clear planning.",
    keywords: "entry door installation Montreal, front door replacement Montreal, install exterior door, door fitting Montreal, front door installation Quebec, replacement doors, door measurement",
    frenchTitle: "Installation de porte d'entree Montreal | Porte exterieure",
    frenchDescription: "Installation de porte d'entree a Montreal avec aide pour mesures, sens d'ouverture, ajustement, quincaillerie et planification claire.",
    frenchKeywords: "installation de porte d'entree Montreal, porte exterieure Montreal, remplacement de porte, ajustement de porte, mesures de porte",
    bullets: ["Front, entry, interior, steel, wood-look, and glass-panel doors", "Measurements, swing direction, hardware, and finish guidance", "Delivery and installation planning when needed"],
    cta: "Ask About Door Installation",
    bookingValue: "entry-door-installation",
    structuredServiceName: "Entry door installation",
    sitemapPriority: "0.85",
    changeFrequency: "weekly"
  },
  "/door-alignment": {
    path: "/door-alignment",
    eyebrow: "Door Alignment",
    title: "Door Alignment Montreal | Hinge Adjustment & Door Gaps",
    description: "Door rubbing, dragging, swinging open, or failing to latch? FixMyDoor Services helps Montreal customers with alignment, hinges, gaps, and strike plates.",
    keywords: "door alignment, hinge adjustment, door rubbing frame, door dragging floor, door not closing, door gap repair, fix sagging door",
    frenchTitle: "Alignement de porte Montreal | Charniere et ajustement",
    frenchDescription: "Porte qui frotte, traine, s'ouvre seule ou ne s'enclenche pas? FixMyDoor Services aide avec alignement, charnieres, espaces et g\xE2ches.",
    frenchKeywords: "alignement de porte Montreal, ajustement de charniere, porte qui frotte, porte qui ferme mal, espace de porte, gache de porte",
    bullets: ["Doors that rub, scrape, drag, or swing badly", "Hinge, latch, strike plate, and gap checks", "Cleaner closing without replacing the full door when possible"],
    cta: "Request Door Alignment",
    bookingValue: "door-alignment",
    structuredServiceName: "Door alignment and hinge adjustment",
    sitemapPriority: "0.8",
    changeFrequency: "weekly"
  },
  "/door-purchase": {
    path: "/door-purchase",
    eyebrow: "Buy Doors",
    title: "Buy Doors Montreal | Entry, Interior, Steel & Glass Options",
    description: "Need help buying the right door? FixMyDoor Services can review measurements, style, hardware, and sourcing options for entry, interior, steel, and glass doors.",
    keywords: "buy doors, purchase doors, entry doors for sale, interior doors, heavy doors, Paladin doors, SED doors, glass doors, steel doors, door supplier Canada",
    frenchTitle: "Acheter des portes Montreal | Entree, interieur et acier",
    frenchDescription: "Besoin d'aide pour acheter une porte? FixMyDoor Services examine mesures, style, quincaillerie et options pour portes d'entree ou interieures.",
    frenchKeywords: "acheter des portes Montreal, porte d'entree, porte interieure, porte acier, porte vitree, fournisseur de portes Canada",
    bullets: ["Entry, interior, heavy-duty, glass-panel, steel, and wood-look options", "Paladin doors, SED doors, heavy doors, and many sizes", "Size, quantity, finish, and hardware guidance before buying"],
    cta: "Ask for Door Quote",
    bookingValue: "door-purchase",
    structuredServiceName: "Door sourcing and buying support",
    sitemapPriority: "0.9",
    changeFrequency: "weekly"
  },
  "/buy-door-hardware": {
    path: "/buy-door-hardware",
    eyebrow: "Buy Door Hardware",
    title: "Door Hardware Montreal | Locks, Handles, Hinges & Parts",
    description: "Need door hardware in Montreal? Get help sourcing locks, handles, hinges, cylinders, backplates, mortise kits, and entry hardware.",
    keywords: "buy door hardware, door handles, door locks, hinges, lock cylinders, mortise lock, bathroom door lock, door hardware Canada, door equipment",
    frenchTitle: "Quincaillerie de porte Montreal | Serrures et poignees",
    frenchDescription: "Besoin de quincaillerie de porte a Montreal? Aide pour serrures, poignees, charnieres, cylindres, plaques, mortaises et pieces d'entree.",
    frenchKeywords: "quincaillerie de porte Montreal, serrure de porte, poignee de porte, charniere, cylindre de serrure, serrure mortaise, pieces de porte",
    bullets: ["Handles, locks, cylinders, hinges, backplates, and full kits", "Bathroom, entry, interior, and security hardware options", "Help matching finish, size, and door type"],
    cta: "Ask for Hardware Quote",
    bookingValue: "door-hardware-purchase",
    structuredServiceName: "Door hardware sourcing",
    sitemapPriority: "0.9",
    changeFrequency: "weekly"
  },
  "/furniture-hardware-purchase": {
    path: "/furniture-hardware-purchase",
    eyebrow: "Buy Furniture Hardware",
    title: "Furniture Hardware Montreal | Drawer Slides, Hinges & Parts",
    description: "Need furniture replacement parts? FixMyDoor Services helps source drawer slides, cabinet hinges, soft-close runners, fittings, and repair hardware.",
    keywords: "buy furniture hardware, drawer slides, cabinet hinges, soft close runners, furniture parts, furniture repair hardware, cabinet hardware Canada",
    frenchTitle: "Quincaillerie de meubles Montreal | Coulisses et charnieres",
    frenchDescription: "Besoin de pieces de meubles? FixMyDoor Services aide a trouver coulisses de tiroirs, charnieres d'armoires, ferrures et quincaillerie.",
    frenchKeywords: "quincaillerie de meubles Montreal, coulisses de tiroirs, charnieres d'armoires, pieces de meubles, quincaillerie armoire",
    bullets: ["Drawer slides, soft-close runners, cabinet hinges, and repair parts", "Practical matching support from photos and measurements", "Useful for repairs, replacement, or new furniture setup"],
    cta: "Ask for Furniture Parts",
    bookingValue: "furniture-hardware-purchase",
    structuredServiceName: "Furniture hardware sourcing",
    sitemapPriority: "0.85",
    changeFrequency: "weekly"
  },
  "/door-hardware": {
    path: "/door-hardware",
    eyebrow: "Hardware Sourcing",
    title: "Hardware Sourcing Montreal | Door & Furniture Parts",
    description: "Looking for door or furniture parts in Montreal? Send photos and measurements for help sourcing locks, hinges, handles, cabinet hardware, and fittings.",
    keywords: "hardware sourcing, door equipment, source door parts, source furniture parts, door hardware sourcing, repair parts, locks hinges handles",
    frenchTitle: "Recherche de quincaillerie Montreal | Portes et meubles",
    frenchDescription: "Vous cherchez des pieces de porte ou de meuble a Montreal? Envoyez photos et mesures pour serrures, charnieres, poignees et ferrures.",
    frenchKeywords: "recherche de quincaillerie Montreal, pieces de porte, pieces de meubles, serrures, charnieres, poignees, ferrures d'armoires",
    bullets: ["Door equipment, locks, hinges, handles, and furniture hardware", "Photos, measurements, quantity, finish, and budget review", "Canada-based coordination with international request support"],
    cta: "Ask for Product Quote",
    bookingValue: "door-hardware-purchase",
    structuredServiceName: "Door equipment and hardware sourcing",
    sitemapPriority: "0.85",
    changeFrequency: "weekly"
  },
  "/international-requests": {
    path: "/international-requests",
    eyebrow: "International Requests",
    title: "International Door, Furniture & Hardware Requests",
    description: "Outside Montreal or Canada? Send door, furniture, or hardware details for Canada-based sourcing guidance, measurements, repair planning, and quote preparation.",
    keywords: "international door requests, international furniture repair support, buy doors internationally, hardware sourcing worldwide, Canada door service international",
    frenchTitle: "Demandes internationales | Portes, meubles et quincaillerie",
    frenchDescription: "Hors Montreal ou Canada? Envoyez details, photos et mesures pour conseils de recherche, achat, reparation ou preparation de devis.",
    frenchKeywords: "demandes internationales portes, quincaillerie Canada, pieces de meubles, achat de portes, conseils de reparation, devis international",
    bullets: ["Country, city, time zone, and currency-aware requests", "WhatsApp, email, and phone follow-up", "Door, furniture, and hardware sourcing support"],
    cta: "Send International Request",
    bookingValue: "international-request",
    structuredServiceName: "International door, furniture, and hardware request support",
    sitemapPriority: "0.8",
    changeFrequency: "weekly"
  }
};
var seoRouteAliases = {
  "/buy-doors": "/door-purchase",
  "/door-installation": "/entry-door-installation",
  "/door-equipment": "/buy-door-hardware",
  "/door-hardware-purchase": "/buy-door-hardware",
  "/hardware-sourcing": "/door-hardware",
  "/buy-furniture-hardware": "/furniture-hardware-purchase",
  "/furniture-parts": "/furniture-hardware-purchase",
  "/furniture-setup": "/furniture-installation"
};
var seoPages = {
  [homeSeoPage.path]: homeSeoPage,
  [privacyPolicySeoPage.path]: privacyPolicySeoPage,
  [termsConditionsSeoPage.path]: termsConditionsSeoPage,
  [ghanaBranchSeoPage.path]: ghanaBranchSeoPage,
  ...serviceSeoPages
};
var sitemapRoutes = [homeSeoPage.path, ...Object.keys(serviceSeoPages), ghanaBranchSeoPage.path, privacyPolicySeoPage.path, termsConditionsSeoPage.path];
function normalizeSeoPath(pathname = "/") {
  const withoutQuery = pathname.split("?")[0].split("#")[0] || "/";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : "/";
}
function resolveSeoPage(pathname = "/") {
  const normalizedPath = normalizeSeoPath(pathname);
  const canonicalPath = seoRouteAliases[normalizedPath] || normalizedPath;
  return seoPages[canonicalPath] || homeSeoPage;
}

// server/index.ts
if (fs.existsSync(".env")) {
  process.loadEnvFile?.(".env");
}
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var defaultUploadDir = process.env.NODE_ENV === "production" && process.platform !== "win32" ? "/data/uploads" : path.resolve(process.cwd(), "uploads");
var uploadDir = process.env.UPLOAD_DIR || defaultUploadDir;
var PUBLIC_SITE_URL_TOKEN = "__PUBLIC_SITE_URL__";
var PUBLIC_IMAGE_URL_TOKEN = "__PUBLIC_IMAGE_URL__";
var siteEventClients = /* @__PURE__ */ new Set();
var socialPlatformLabels = {
  instagram: "Instagram",
  x: "X (Twitter)",
  facebook: "Facebook"
};
var socialClickNoticeCooldown = /* @__PURE__ */ new Map();
var SOCIAL_CLICK_NOTICE_COOLDOWN_MS = 2 * 60 * 1e3;
var mediaTypes = {
  "image/png": { extension: "png", kind: "image" },
  "image/jpeg": { extension: "jpg", kind: "image" },
  "image/jpg": { extension: "jpg", kind: "image" },
  "image/webp": { extension: "webp", kind: "image" },
  "video/mp4": { extension: "mp4", kind: "video" },
  "video/webm": { extension: "webm", kind: "video" },
  "video/ogg": { extension: "ogg", kind: "video" },
  "application/pdf": { extension: "pdf", kind: "document" },
  "application/msword": { extension: "doc", kind: "document" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: "docx", kind: "document" }
};
function broadcastSiteEvent(event) {
  const payload = JSON.stringify({
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sentAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  siteEventClients.forEach((client) => {
    client.write(`event: site-update
data: ${payload}

`);
  });
}
function saveDataUrlMedia(dataUrl, options) {
  if (typeof dataUrl !== "string") {
    throw new Error("Missing media data");
  }
  const match = dataUrl.match(/^data:([^;]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error("Invalid media data");
  }
  const mimeType = match[1].toLowerCase();
  const mediaType = mediaTypes[mimeType];
  if (!mediaType || !options.allowVideo && mediaType.kind === "video" || !options.allowDocument && mediaType.kind === "document") {
    throw new Error("Unsupported media type");
  }
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.byteLength <= 0 || buffer.byteLength > options.maxBytes) {
    throw new Error("Media file is too large");
  }
  fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID2()}.${mediaType.extension}`;
  fs.writeFileSync(path.join(uploadDir, fileName), buffer, { flag: "wx" });
  return {
    url: `/uploads/${fileName}`,
    kind: mediaType.kind,
    mimeType
  };
}
function escapeHtml2(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}
function base64UrlDecode(value) {
  return Buffer.from(value, "base64url");
}
function getPushStorePath(fileName) {
  fs.mkdirSync(uploadDir, { recursive: true });
  return path.join(uploadDir, fileName);
}
function loadJsonFile(fileName, fallback) {
  try {
    const filePath = getPushStorePath(fileName);
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to load ${fileName}:`, error);
    return fallback;
  }
}
function saveJsonFile(fileName, data) {
  fs.writeFileSync(getPushStorePath(fileName), JSON.stringify(data, null, 2), "utf8");
}
function getVapidKeys() {
  const existing = loadJsonFile("push-vapid-keys.json", null);
  if (existing?.publicKey && existing?.privateKey) {
    return existing;
  }
  const generated = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { format: "jwk" },
    privateKeyEncoding: { format: "jwk" }
  });
  const publicKey = Buffer.concat([
    Buffer.from([4]),
    base64UrlDecode(generated.publicKey.x || ""),
    base64UrlDecode(generated.publicKey.y || "")
  ]).toString("base64url");
  const privateKey = generated.privateKey.d || "";
  const keys = { publicKey, privateKey };
  saveJsonFile("push-vapid-keys.json", keys);
  return keys;
}
function loadPushSubscriptions() {
  const savedSubscriptions = loadJsonFile("push-subscriptions.json", []);
  const subscriptions = dedupePushSubscriptions(savedSubscriptions);
  if (subscriptions.length !== savedSubscriptions.length) {
    saveJsonFile("push-subscriptions.json", subscriptions);
  }
  return subscriptions;
}
function savePushSubscriptions(subscriptions) {
  saveJsonFile("push-subscriptions.json", dedupePushSubscriptions(subscriptions));
}
function loadPushNotificationLog() {
  return loadJsonFile("push-notification-log.json", []);
}
function savePushNotificationLog(entries) {
  saveJsonFile("push-notification-log.json", entries.slice(0, 20));
}
function isValidPushSubscription(value) {
  return Boolean(
    value && typeof value.endpoint === "string" && value.endpoint.startsWith("https://") && value.keys && typeof value.keys.p256dh === "string" && typeof value.keys.auth === "string"
  );
}
function normalizePushAudience(value) {
  return value === "admin" ? "admin" : "visitor";
}
function getPushAudiences(subscription) {
  const audiences = subscription.audiences?.length ? subscription.audiences : [subscription.audience || "visitor"];
  return Array.from(new Set(audiences.map(normalizePushAudience)));
}
function dedupePushSubscriptions(subscriptions) {
  const uniqueSubscriptions = /* @__PURE__ */ new Map();
  subscriptions.forEach((subscription) => {
    if (!subscription?.endpoint) {
      return;
    }
    const endpoint = subscription.endpoint.trim();
    const existing = uniqueSubscriptions.get(endpoint);
    const audiences = Array.from(/* @__PURE__ */ new Set([
      ...existing ? getPushAudiences(existing) : [],
      ...getPushAudiences(subscription)
    ]));
    uniqueSubscriptions.set(endpoint, {
      ...existing,
      ...subscription,
      endpoint,
      audiences,
      audience: subscription.audience || existing?.audience || audiences[0] || "visitor",
      createdAt: existing?.createdAt || subscription.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: subscription.updatedAt || existing?.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  return Array.from(uniqueSubscriptions.values());
}
function getPushSubscriberCounts(subscriptions = loadPushSubscriptions()) {
  return {
    subscriberCount: subscriptions.length,
    visitorSubscriberCount: subscriptions.filter((subscription) => matchesPushAudience(subscription, "visitor")).length,
    adminSubscriberCount: subscriptions.filter((subscription) => matchesPushAudience(subscription, "admin")).length
  };
}
function matchesPushAudience(subscription, audience) {
  if (!audience || audience === "all") {
    return true;
  }
  return getPushAudiences(subscription).includes(audience);
}
function hkdfExpand(prk, info, length) {
  const buffers = [];
  let previous = Buffer.alloc(0);
  let counter = 1;
  while (Buffer.concat(buffers).length < length) {
    previous = createHmac("sha256", prk).update(previous).update(typeof info === "string" ? Buffer.from(info) : info).update(Buffer.from([counter++])).digest();
    buffers.push(previous);
  }
  return Buffer.concat(buffers).subarray(0, length);
}
function createVapidJwt(subscriptionEndpoint) {
  const { publicKey, privateKey } = getVapidKeys();
  const audience = new URL(subscriptionEndpoint).origin;
  const header = base64UrlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1e3) + 12 * 60 * 60,
    sub: "mailto:info.fixmydoor@gmail.com"
  }));
  const signingInput = `${header}.${payload}`;
  const publicKeyBuffer = base64UrlDecode(publicKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: publicKeyBuffer.subarray(1, 33).toString("base64url"),
    y: publicKeyBuffer.subarray(33, 65).toString("base64url"),
    d: privateKey
  };
  const key = createPrivateKey({ key: jwk, format: "jwk" });
  const signature = createSign("sha256").update(signingInput).end().sign({ key, dsaEncoding: "ieee-p1363" });
  return {
    publicKey,
    token: `${signingInput}.${base64UrlEncode(signature)}`
  };
}
function encryptPushPayload(subscription, payload) {
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
    senderPublicKey
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
async function sendPushNotification(subscription, payload) {
  const vapid = createVapidJwt(subscription.endpoint);
  const body = encryptPushPayload(subscription, JSON.stringify(payload));
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${vapid.token}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal"
    },
    body
  });
  return response;
}
async function sendPushNotificationToSubscribers(payload, options = {}) {
  const subscriptions = loadPushSubscriptions();
  const targetSubscriptions = subscriptions.filter((subscription) => matchesPushAudience(subscription, options.audience));
  let delivered = 0;
  let failed = 0;
  const deadEndpoints = /* @__PURE__ */ new Set();
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
  const logEntry = {
    id: randomUUID2(),
    title: payload.title,
    message: payload.message,
    audience: options.audience || "all",
    sentAt: (/* @__PURE__ */ new Date()).toISOString(),
    delivered,
    failed
  };
  if (options.log) {
    savePushNotificationLog([logEntry, ...loadPushNotificationLog()]);
  }
  return {
    ...logEntry,
    subscriberCount: loadPushSubscriptions().filter((subscription) => matchesPushAudience(subscription, options.audience)).length
  };
}
function queuePushNotification(payload, options = {}) {
  sendPushNotificationToSubscribers(payload, options).catch((error) => {
    console.error("Queued push notification failed:", error);
  });
}
var TWO_HOURS_MS2 = 2 * 60 * 60 * 1e3;
var WEEKEND_PROMOTION_STATE_FILE = "weekend-promotion-state.json";
var WEEKEND_PROMOTION_CHECK_MS = 60 * 60 * 1e3;
var WEEKEND_PROMOTION_START_HOUR = 9;
var bookingReminderSweepRunning = false;
var weekendPromotionSweepRunning = false;
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
        status: { notIn: ["COMPLETED", "CANCELLED"] }
      },
      orderBy: { reminderAt: "asc" },
      take: 25
    })).map(toBooking).filter((booking) => isReminderDue(booking));
    for (const booking of reminderCandidates) {
      const displayId = formatBookingDisplayId(booking);
      const appointmentReminder = isTwoHourAppointmentReminder(booking);
      queuePushNotification({
        title: appointmentReminder ? `Job in 2 hours: ${booking.name}` : `Reminder: ${booking.name}`,
        message: buildAdminReminderMessage(booking, displayId),
        url: "/admin",
        icon: "/icons/admin-icon-v2-192x192.png",
        badge: "/icons/admin-icon-v2-96x96.png"
      }, { audience: "admin", log: true });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: (/* @__PURE__ */ new Date()).toISOString() }
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
  }, 60 * 1e3);
  reminderTimer.unref?.();
}
function getMontrealDateParts(date = /* @__PURE__ */ new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    weekday: parts.weekday || "",
    year: parts.year || "",
    month: parts.month || "",
    day: parts.day || "",
    hour: Number(parts.hour || 0)
  };
}
function getCurrentMontrealWeekendKey(date = /* @__PURE__ */ new Date()) {
  const parts = getMontrealDateParts(date);
  if (!["Sat", "Sun"].includes(parts.weekday) || parts.hour < WEEKEND_PROMOTION_START_HOUR) {
    return null;
  }
  const saturdayDate = parts.weekday === "Sun" ? new Date(date.getTime() - 24 * 60 * 60 * 1e3) : date;
  const saturdayParts = getMontrealDateParts(saturdayDate);
  return `${saturdayParts.year}-${saturdayParts.month}-${saturdayParts.day}`;
}
function getYmdFromUtcDate(date) {
  return date.toISOString().slice(0, 10);
}
function getFixedHolidayKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function getNthWeekdayOfMonth(year, month, weekday, occurrence) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - firstDay + 7) % 7;
  return getFixedHolidayKey(year, month, 1 + offset + (occurrence - 1) * 7);
}
function getLastWeekdayBefore(year, month, day, weekday) {
  const date = new Date(Date.UTC(year, month - 1, day));
  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return getYmdFromUtcDate(date);
}
function getEasterSundayKey(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return getFixedHolidayKey(year, month, day);
}
function getCanadianHolidayForMontrealDate(parts) {
  const year = Number(parts.year);
  if (!Number.isFinite(year)) {
    return null;
  }
  const easterSunday = /* @__PURE__ */ new Date(`${getEasterSundayKey(year)}T12:00:00.000Z`);
  const goodFriday = new Date(easterSunday);
  goodFriday.setUTCDate(easterSunday.getUTCDate() - 2);
  const easterMonday = new Date(easterSunday);
  easterMonday.setUTCDate(easterSunday.getUTCDate() + 1);
  const holidays = {
    [getFixedHolidayKey(year, 1, 1)]: {
      name: "New Year's Day",
      message: "Happy New Year from FixMyDoor Services. If your home or office needs door, lock, furniture, or hardware help this season, send us photos and details."
    },
    [getYmdFromUtcDate(goodFriday)]: {
      name: "Good Friday",
      message: "Wishing you a peaceful Good Friday. If the long weekend is a good time to fix a door, lock, cabinet, or furniture issue, FixMyDoor Services can help."
    },
    [getYmdFromUtcDate(easterMonday)]: {
      name: "Easter Monday",
      message: "Happy Easter Monday from FixMyDoor Services. Use the holiday break to plan door repairs, furniture fixes, installations, or hardware sourcing."
    },
    [getLastWeekdayBefore(year, 5, 25, 1)]: {
      name: "Victoria Day",
      message: "Happy Victoria Day. If you are using the long weekend to improve your home, FixMyDoor Services can help with doors, locks, furniture, and hardware."
    },
    [getFixedHolidayKey(year, 6, 24)]: {
      name: "Saint-Jean-Baptiste Day",
      message: "Bonne Saint-Jean-Baptiste. FixMyDoor Services is available for Montreal door repairs, lock help, furniture installation, and hardware sourcing."
    },
    [getFixedHolidayKey(year, 7, 1)]: {
      name: "Canada Day",
      message: "Happy Canada Day from FixMyDoor Services. If the holiday gives you time to fix your door, lock, cabinet, or furniture, send us the details."
    },
    [getNthWeekdayOfMonth(year, 8, 1, 1)]: {
      name: "Civic Holiday",
      message: "Happy long weekend from FixMyDoor Services. It is a good time to handle loose doors, cabinet hardware, furniture setup, or repair planning."
    },
    [getNthWeekdayOfMonth(year, 9, 1, 1)]: {
      name: "Labour Day",
      message: "Happy Labour Day. FixMyDoor Services is ready to help Montreal customers with door repairs, hardware, lock work, and furniture service."
    },
    [getFixedHolidayKey(year, 9, 30)]: {
      name: "National Day for Truth and Reconciliation",
      message: "On this day of reflection, FixMyDoor Services remains available for respectful, practical door, lock, furniture, and hardware support."
    },
    [getNthWeekdayOfMonth(year, 10, 1, 2)]: {
      name: "Thanksgiving",
      message: "Happy Thanksgiving from FixMyDoor Services. If family visits reveal a door, lock, cabinet, or furniture issue, we can help you plan the fix."
    },
    [getFixedHolidayKey(year, 11, 11)]: {
      name: "Remembrance Day",
      message: "On Remembrance Day, FixMyDoor Services sends respectful greetings and remains available for door, lock, furniture, and hardware requests."
    },
    [getFixedHolidayKey(year, 12, 25)]: {
      name: "Christmas Day",
      message: "Merry Christmas from FixMyDoor Services. Wishing you a safe home, strong doors, secure locks, and a peaceful holiday season."
    },
    [getFixedHolidayKey(year, 12, 26)]: {
      name: "Boxing Day",
      message: "Happy Boxing Day. If you are planning home repairs, furniture setup, door work, or hardware replacement, FixMyDoor Services can help."
    }
  };
  return holidays[`${parts.year}-${parts.month}-${parts.day}`] || null;
}
async function sendCustomerEngagementCampaign(payload) {
  const { visitorSubscriberCount } = getPushSubscriberCounts();
  if (visitorSubscriberCount > 0) {
    await sendPushNotificationToSubscribers(payload, { audience: "visitor", log: true });
    broadcastSiteEvent({ type: "notification", title: payload.title, message: payload.message, url: payload.url });
  }
  await sendCustomerEmailBroadcast(payload, "notification");
}
async function sendWeekendPromotionIfDue() {
  if (weekendPromotionSweepRunning) {
    return;
  }
  weekendPromotionSweepRunning = true;
  try {
    const todayParts = getMontrealDateParts();
    const state = loadJsonFile(WEEKEND_PROMOTION_STATE_FILE, {});
    const holiday = todayParts.hour >= WEEKEND_PROMOTION_START_HOUR ? getCanadianHolidayForMontrealDate(todayParts) : null;
    if (holiday) {
      const holidayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}-${holiday.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (!state.sentHolidayKeys?.[holidayKey]) {
        const payload2 = {
          title: `${holiday.name} greetings`,
          message: holiday.message,
          url: "/#booking-form",
          icon: "/icons/main-icon-v2-192x192.png",
          badge: "/icons/main-icon-v2-96x96.png"
        };
        await sendCustomerEngagementCampaign(payload2);
        saveJsonFile(WEEKEND_PROMOTION_STATE_FILE, {
          ...state,
          sentHolidayKeys: {
            ...state.sentHolidayKeys || {},
            [holidayKey]: (/* @__PURE__ */ new Date()).toISOString()
          },
          lastSentAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return;
    }
    const weekendKey = getCurrentMontrealWeekendKey();
    if (!weekendKey) {
      return;
    }
    if (state.lastSentWeekendKey === weekendKey) {
      return;
    }
    const payload = {
      title: "Weekend home fix reminder",
      message: "Happy weekend from FixMyDoor Services. If you have time to fix a loose door, lock, cabinet, furniture setup, or hardware issue, send us photos and we will guide you.",
      url: "/#booking-form",
      icon: "/icons/main-icon-v2-192x192.png",
      badge: "/icons/main-icon-v2-96x96.png"
    };
    await sendCustomerEngagementCampaign(payload);
    saveJsonFile(WEEKEND_PROMOTION_STATE_FILE, {
      ...state,
      lastSentWeekendKey: weekendKey,
      lastSentAt: (/* @__PURE__ */ new Date()).toISOString()
    });
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
var CUSTOMER_EMAIL_BROADCAST_LIMIT = Math.max(1, Math.min(500, Number(process.env.CUSTOMER_EMAIL_BROADCAST_LIMIT || 120)));
function queueCustomerEmailBroadcast(payload, type = "notification") {
  setTimeout(() => {
    sendCustomerEmailBroadcast(payload, type).catch((error) => {
      console.error("Queued customer email broadcast failed:", error);
    });
  }, 0);
}
async function sendCustomerEmailBroadcast(payload, type) {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      email: true,
      customerConsent: true
    },
    take: 1e3
  });
  const uniqueEmails = Array.from(new Set(
    bookings.filter((booking) => booking.customerConsent && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email || "")).map((booking) => booking.email.trim().toLowerCase())
  )).slice(0, CUSTOMER_EMAIL_BROADCAST_LIMIT);
  let sent = 0;
  let failed = 0;
  for (const email of uniqueEmails) {
    const ok = await emailService.sendCustomerBroadcastEmail(email, {
      title: payload.title,
      message: payload.message,
      url: payload.url,
      type
    });
    if (ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  }
  console.log("Customer email broadcast finished", { type, sent, failed, total: uniqueEmails.length });
}
function isInternationalBooking(booking) {
  const country = (booking.country || "").trim().toLowerCase();
  const scope = (booking.requestScope || "").trim().toLowerCase();
  return Boolean(
    scope.includes("international") || country && !["canada", "ca", "can"].includes(country)
  );
}
function getDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}
function isBookingInDateRange(booking, days) {
  const now = /* @__PURE__ */ new Date();
  const todayKey = getDateKey(now);
  const startTime = (/* @__PURE__ */ new Date(`${todayKey}T00:00:00.000Z`)).getTime();
  const endTime = startTime + days * 24 * 60 * 60 * 1e3;
  const preferredTime = booking.preferredDate ? (/* @__PURE__ */ new Date(`${booking.preferredDate}T12:00:00.000Z`)).getTime() : NaN;
  const createdTime = new Date(booking.createdAt).getTime();
  return !Number.isNaN(preferredTime) && preferredTime >= startTime && preferredTime < endTime || !Number.isNaN(createdTime) && createdTime >= startTime && createdTime < endTime;
}
function getBookingReminderTime(booking) {
  const reminderAt = booking.reminderAt?.trim();
  if (!reminderAt) {
    return Number.NaN;
  }
  const reminderTime = Date.parse(reminderAt);
  return Number.isFinite(reminderTime) ? reminderTime : Number.NaN;
}
function isReminderActive(booking) {
  return Boolean(booking.reminderAt) && !["COMPLETED", "CANCELLED"].includes(booking.status);
}
function isReminderDue(booking, now = Date.now()) {
  const reminderTime = getBookingReminderTime(booking);
  return isReminderActive(booking) && Number.isFinite(reminderTime) && reminderTime <= now;
}
function getDateTimeMs(value) {
  const text = value?.trim();
  if (!text) {
    return Number.NaN;
  }
  const parsedTime = Date.parse(text);
  return Number.isFinite(parsedTime) ? parsedTime : Number.NaN;
}
function getTwoHourAppointmentReminderAt(appointmentTime) {
  const appointmentMs = getDateTimeMs(appointmentTime);
  if (!Number.isFinite(appointmentMs)) {
    return "";
  }
  return new Date(Math.max(Date.now(), appointmentMs - TWO_HOURS_MS2)).toISOString();
}
function isTwoHourAppointmentReminder(booking) {
  const appointmentMs = getDateTimeMs(booking.appointmentTime);
  const reminderMs = getBookingReminderTime(booking);
  return Number.isFinite(appointmentMs) && Number.isFinite(reminderMs) && Math.abs(reminderMs - (appointmentMs - TWO_HOURS_MS2)) <= 9e4;
}
function buildDefaultAppointmentReminderNote(booking) {
  return `About 2 hours left to go and do the ${booking.repairType || "job"}. Check the customer details, route, tools, and parts before leaving.`;
}
function buildAdminReminderMessage(booking, displayId) {
  const reminderText = booking.reminderNote?.trim() || (isTwoHourAppointmentReminder(booking) ? buildDefaultAppointmentReminderNote(booking) : "Follow up with this customer request.");
  if (isTwoHourAppointmentReminder(booking)) {
    return `${displayId} - ${reminderText}${booking.appointmentTime ? ` Appointment: ${booking.appointmentTime}.` : ""}`;
  }
  return `${displayId} - ${reminderText}`;
}
function matchesWorkflowFilter(booking, workflow) {
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
async function sendBookingEmailsWithStatus(booking) {
  const results = await Promise.allSettled([
    emailService.sendBookingConfirmation(booking),
    emailService.sendAdminNotification(booking)
  ]);
  const [customerResult, adminResult] = results;
  const customerEmailSent = customerResult.status === "fulfilled" && customerResult.value === true;
  const adminEmailSent = adminResult.status === "fulfilled" && adminResult.value === true;
  if (!customerEmailSent || !adminEmailSent) {
    console.error("Booking saved, but one or more emails failed.", {
      bookingId: booking.id,
      customerEmailSent,
      adminEmailSent
    });
  }
  return {
    queued: false,
    customer: customerEmailSent,
    admin: adminEmailSent
  };
}
function emailStatusTimeout(ms) {
  return new Promise((resolve2) => {
    setTimeout(() => resolve2({ queued: true }), ms);
  });
}
async function executeSchemaStatement(sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error) {
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
      "clientId" TEXT,
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
    `ALTER TABLE "Booking" ADD COLUMN "clientId" TEXT`,
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
    `CREATE TABLE IF NOT EXISTS "SmsDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "clientId" TEXT,
      "bookingId" TEXT,
      "clientName" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "sentAt" DATETIME
    )`,
    `ALTER TABLE "ContentItem" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Admin_username_key" ON "Admin"("username")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Booking_customerToken_key" ON "Booking"("customerToken")`,
    `CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status")`,
    `CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Booking_name_idx" ON "Booking"("name")`,
    `CREATE INDEX IF NOT EXISTS "Booking_email_idx" ON "Booking"("email")`,
    `CREATE INDEX IF NOT EXISTS "Booking_phone_idx" ON "Booking"("phone")`,
    `CREATE INDEX IF NOT EXISTS "Booking_clientId_idx" ON "Booking"("clientId")`,
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
    `CREATE INDEX IF NOT EXISTS "SmsDraft_status_idx" ON "SmsDraft"("status")`,
    `CREATE INDEX IF NOT EXISTS "SmsDraft_createdAt_idx" ON "SmsDraft"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "SmsDraft_clientId_idx" ON "SmsDraft"("clientId")`,
    `CREATE INDEX IF NOT EXISTS "SmsDraft_bookingId_idx" ON "SmsDraft"("bookingId")`
  ];
  for (const statement of statements) {
    await executeSchemaStatement(statement);
  }
}
var PrismaSessionStore = class extends session.Store {
  get(sid, callback) {
    prisma.session.findUnique({ where: { sid } }).then(async (record) => {
      if (!record) {
        callback(null, null);
        return;
      }
      if (record.expiresAt <= /* @__PURE__ */ new Date()) {
        await prisma.session.delete({ where: { sid } }).catch(() => void 0);
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(record.data));
    }).catch((error) => callback(error));
  }
  set(sid, sessionData, callback) {
    const expiresAt = sessionData.cookie?.expires ? new Date(sessionData.cookie.expires) : new Date(Date.now() + 24 * 60 * 60 * 1e3);
    prisma.session.upsert({
      where: { sid },
      create: { sid, data: JSON.stringify(sessionData), expiresAt },
      update: { data: JSON.stringify(sessionData), expiresAt }
    }).then(() => callback?.()).catch((error) => callback?.(error));
  }
  destroy(sid, callback) {
    prisma.session.deleteMany({ where: { sid } }).then(() => callback?.()).catch((error) => callback?.(error));
  }
  touch(sid, sessionData, callback) {
    const expiresAt = sessionData.cookie?.expires ? new Date(sessionData.cookie.expires) : new Date(Date.now() + 24 * 60 * 60 * 1e3);
    prisma.session.updateMany({ where: { sid }, data: { expiresAt } }).then(() => callback?.()).catch((error) => callback?.(error));
  }
};
function normalizeOrigin(value) {
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
function allowedOriginsForRequest(req) {
  const host = req.get("host");
  const origins = new Set([
    normalizeOrigin(process.env.PUBLIC_SITE_URL),
    normalizeOrigin(process.env.ADMIN_URL),
    normalizeOrigin(process.env.VITE_PUBLIC_SITE_URL),
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ].filter(Boolean));
  if (host) {
    origins.add(`${req.protocol}://${host}`);
  }
  return origins;
}
function getPublicImageUrl() {
  return `${getPublicBaseUrl()}/og-fixmydoor-service.jpg`;
}
function isFrenchSeoRequest(pagePath = "/") {
  const queryIndex = pagePath.indexOf("?");
  if (queryIndex === -1) {
    return false;
  }
  try {
    const params = new URLSearchParams(pagePath.slice(queryIndex + 1));
    return (params.get("lang") || "").toLowerCase().startsWith("fr");
  } catch {
    return false;
  }
}
function appendFrenchQuery(url) {
  return `${url}${url.includes("?") ? "&" : "?"}lang=fr`;
}
function getLocalizedSeoPageValues(page, isFrench) {
  return {
    title: isFrench && page.frenchTitle ? page.frenchTitle : page.title,
    description: isFrench && page.frenchDescription ? page.frenchDescription : page.description,
    keywords: isFrench && page.frenchKeywords ? page.frenchKeywords : page.keywords
  };
}
function replacePublicUrlTokens(template) {
  return template.replaceAll(PUBLIC_SITE_URL_TOKEN, getPublicBaseUrl()).replaceAll(PUBLIC_IMAGE_URL_TOKEN, getPublicImageUrl());
}
function canonicalHostRedirectUrl(req) {
  if (process.env.NODE_ENV !== "production") {
    return "";
  }
  let publicUrl;
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
function replaceMetaContent(html, selector, key, content) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`<meta ${selector}="${escapedKey}" content="[^"]*" \\/>`);
  const replacement = `<meta ${selector}="${key}" content="${escapeHtml2(content)}" />`;
  return expression.test(html) ? html.replace(expression, replacement) : html.replace("</head>", `    ${replacement}
  </head>`);
}
function renderPageStructuredData(pagePath) {
  const page = resolveSeoPage(pagePath);
  const isFrench = isFrenchSeoRequest(pagePath);
  const localizedPage = getLocalizedSeoPageValues(page, isFrench);
  const publicBaseUrl = getPublicBaseUrl();
  const canonicalBaseUrl = page.path === "/" ? `${publicBaseUrl}/` : `${publicBaseUrl}${page.path}`;
  const canonicalUrl = isFrench ? appendFrenchQuery(canonicalBaseUrl) : canonicalBaseUrl;
  const servicePage = serviceSeoPages[page.path];
  if (page.path === ghanaBranchSeoPage.path) {
    const structuredData2 = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "LocalBusiness",
          "@id": `${canonicalUrl}#ghana-branch`,
          "name": "FixMyDoor Services Ghana",
          "url": canonicalUrl,
          "logo": `${publicBaseUrl}/img5150-transparent.png`,
          "image": getPublicImageUrl(),
          "description": localizedPage.description,
          "telephone": "+233559004048",
          "email": "info.fixmydoor@gmail.com",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Kumasi",
            "addressCountry": "GH"
          },
          "areaServed": [
            { "@type": "City", "name": "Kumasi" },
            { "@type": "AdministrativeArea", "name": "Ashanti Region" },
            { "@type": "Country", "name": "Ghana" }
          ],
          "branchOf": {
            "@type": "LocalBusiness",
            "name": "FixMyDoor Services",
            "url": publicBaseUrl
          },
          "employee": {
            "@type": "Person",
            "name": "Emmanuella Asare Konadu",
            "jobTitle": "Managing Director",
            "image": `${publicBaseUrl}/ghana-manager-emmanuella-asare-konadu.jpg`
          },
          "knowsAbout": [
            "door wholesale Ghana",
            "door retail Ghana",
            "door installation Kumasi",
            "furniture sales Kumasi",
            "furniture installation Ghana",
            "door repairs Ghana",
            "furniture repairs Ghana"
          ],
          "priceRange": "$$"
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonicalUrl}#breadcrumb`,
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": `${publicBaseUrl}/`
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Ghana Branch",
              "item": canonicalUrl
            }
          ]
        }
      ]
    };
    return `    <script type="application/ld+json">${JSON.stringify(structuredData2).replace(/</g, "\\u003c")}</script>`;
  }
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
          "addressCountry": "CA"
        },
        "areaServed": ["Montreal", "Laval", "Longueuil", "Brossard", "West Island", "Quebec", "Canada"],
        "openingHours": "Mo-Su 00:00-23:59",
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 45.5519558764642,
          "longitude": -73.6607124389078
        },
        "hasMap": "https://www.google.com/maps/search/?api=1&query=10158%20Rue%20Berri%2C%20Montreal%2C%20QC%20H3L%202G6%2C%20Canada",
        "contactPoint": [
          {
            "@type": "ContactPoint",
            "telephone": "+14383471823",
            "contactType": "customer service",
            "areaServed": ["CA", "Worldwide"],
            "availableLanguage": ["English", "French"]
          }
        ],
        "knowsAbout": [
          "door repair Montreal",
          "serrurier Montreal",
          "locksmith Montreal",
          "lock rekeying Montreal",
          "door hardware replacement",
          "furniture repair Montreal",
          "entry door installation Montreal"
        ],
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "opens": "00:00",
            "closes": "23:59"
          }
        ],
        "priceRange": "$$",
        "sameAs": [
          "https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr",
          "https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=fixmydoor.ca&utm_medium=social_link&utm_campaign=montreal_quebec_canada",
          "https://x.com/fixmydoor?s=11",
          "https://www.yellowpages.ca/bus/Quebec/Montreal/FixMyDoor-Services/105313756.html"
        ]
      },
      {
        "@type": "Service",
        "@id": `${canonicalUrl}#service`,
        "name": servicePage.structuredServiceName,
        "description": localizedPage.description,
        "inLanguage": isFrench ? "fr-CA" : "en-CA",
        "provider": {
          "@id": `${publicBaseUrl}/#business`
        },
        "areaServed": [
          { "@type": "City", "name": "Montreal" },
          { "@type": "AdministrativeArea", "name": "Quebec" },
          { "@type": "City", "name": "Laval" },
          { "@type": "City", "name": "Longueuil" },
          { "@type": "City", "name": "Brossard" },
          { "@type": "Country", "name": "Canada" },
          { "@type": "Place", "name": "International requests" }
        ],
        "serviceType": servicePage.structuredServiceName,
        "url": canonicalUrl
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        "mainEntity": buildServiceFaqs(servicePage).map((item) => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
          }
        }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${publicBaseUrl}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": servicePage.eyebrow,
            "item": canonicalUrl
          }
        ]
      }
    ]
  };
  return `    <script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`;
}
function buildServiceFaqs(servicePage) {
  const faqByPath = {
    "/door-repair": [
      {
        question: "How do I know if my door needs repair or replacement?",
        answer: "If the frame is still solid and the door panel is not badly damaged, many sticking, sagging, rubbing, or latch problems can be repaired. FixMyDoor Services reviews the photos and recommends the practical option."
      },
      {
        question: "Do you repair both interior and exterior doors?",
        answer: "Yes. FixMyDoor Services helps with interior doors, entry doors, exterior doors, frames, hinges, handles, latches, and alignment issues across Montreal and surrounding areas."
      },
      {
        question: "What should I send for a door repair request?",
        answer: "Send photos of the full door, the damaged area, the hinges, the latch, and the frame. Add your location and a short note explaining what happens when you open, close, or lock the door."
      },
      {
        question: "Can a sagging or scraping door be fixed without replacing it?",
        answer: "Often yes. Hinge adjustment, strike plate work, frame review, or minor fitting can make a door close properly again without a full replacement."
      }
    ],
    "/entry-door-installation": [
      {
        question: "What measurements are needed for entry door installation?",
        answer: "Send the current door width, height, frame opening, swing direction, and photos from inside and outside. If you are unsure, FixMyDoor Services will explain what needs to be measured before ordering."
      },
      {
        question: "Can you help choose the right front door before buying?",
        answer: "Yes. FixMyDoor Services can review the opening, preferred style, hardware needs, finish, and installation plan so the door choice makes sense before money is spent."
      },
      {
        question: "Do you handle hardware matching for a new entry door?",
        answer: "Yes. Handles, locks, hinges, cylinders, door closers, and finish choices can be reviewed so the new entry door works properly with the frame and daily use."
      },
      {
        question: "Can an old front door be replaced with a different style?",
        answer: "Usually yes, but the frame, swing direction, size, and hardware must be checked first. That helps avoid ordering a door that looks good but does not fit correctly."
      }
    ],
    "/furniture-repair": [
      {
        question: "What types of furniture can FixMyDoor Services repair?",
        answer: "Common requests include sofa frames, chairs, cabinets, drawers, desks, shelves, loose joints, damaged supports, cabinet hinges, and drawer slides."
      },
      {
        question: "Should I repair furniture or replace it?",
        answer: "If the main structure is still useful, repair or stronger replacement hardware may be more practical than buying new furniture. Photos help confirm the best route."
      },
      {
        question: "What should I send for a furniture repair request?",
        answer: "Send photos of the full item, the damaged part, any missing hardware, and the area where the part connects. Include measurements if a replacement part may be needed."
      },
      {
        question: "Can you help with drawer slides and cabinet hinges?",
        answer: "Yes. FixMyDoor Services can help repair, replace, or source drawer slides, cabinet hinges, soft-close runners, handles, brackets, and other furniture hardware."
      }
    ],
    "/door-hardware": [
      {
        question: "What hardware can FixMyDoor Services help source?",
        answer: "Requests can include locks, hinges, handles, cylinders, door closers, latch parts, strike plates, cabinet hinges, drawer slides, brackets, and furniture repair parts."
      },
      {
        question: "How do I avoid buying the wrong lock, hinge, or handle?",
        answer: "Send clear photos, measurements, finish preference, door thickness if available, and the problem you need to solve. FixMyDoor Services reviews compatibility before suggesting next steps."
      },
      {
        question: "Can you help with both door and furniture parts?",
        answer: "Yes. The sourcing support covers door equipment, door hardware, furniture hardware, cabinet parts, drawer parts, and practical replacement fittings."
      },
      {
        question: "Do you support international hardware requests?",
        answer: "Yes. Customers outside Canada can send photos, quantity, city, country, time zone, preferred currency, and delivery questions for review."
      }
    ]
  };
  return faqByPath[servicePage.path] || [
    {
      question: `What information should I send for ${servicePage.eyebrow.toLowerCase()}?`,
      answer: `Send clear photos, your city or country, measurements if available, and a short note about the issue. FixMyDoor Services reviews those details before recommending repair, installation, replacement, or sourcing.`
    },
    {
      question: "Can FixMyDoor Services help in Montreal and outside Canada?",
      answer: "Yes. The business is based in Montreal, Quebec, supports Canadian requests, and can also review international product sourcing or repair guidance requests."
    },
    {
      question: "Will I know the next step before work starts?",
      answer: "Yes. The goal is to explain the practical next step clearly before customers spend money on the wrong door, lock, hinge, furniture part, or hardware item."
    }
  ];
}
function renderAlternateLinks(canonicalBaseUrl, pagePath = "/") {
  if (normalizeSeoPath(pagePath) === ghanaBranchSeoPage.path) {
    return [
      `    <link rel="alternate" hreflang="en-gh" href="${escapeHtml2(canonicalBaseUrl)}" />`,
      `    <link rel="alternate" hreflang="en-ca" href="${escapeHtml2(getPublicBaseUrl())}/" />`,
      `    <link rel="alternate" hreflang="x-default" href="${escapeHtml2(canonicalBaseUrl)}" />`
    ].join("\n");
  }
  return [
    `    <link rel="alternate" hreflang="en-ca" href="${escapeHtml2(canonicalBaseUrl)}" />`,
    `    <link rel="alternate" hreflang="fr-ca" href="${escapeHtml2(appendFrenchQuery(canonicalBaseUrl))}" />`,
    `    <link rel="alternate" hreflang="x-default" href="${escapeHtml2(canonicalBaseUrl)}" />`
  ].join("\n");
}
function renderServiceFallbackMain(pagePath) {
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
        <p style="font-weight: 700; color: #b46532; text-transform: uppercase; letter-spacing: .08em;">${escapeHtml2(servicePage.eyebrow)}</p>
        <h1>${escapeHtml2(servicePage.title)}</h1>
        <p>${escapeHtml2(servicePage.description)}</p>
        <h2>What this service covers</h2>
        <ul>${servicePage.bullets.map((item) => `<li>${escapeHtml2(item)}</li>`).join("")}</ul>
        <h2>How FixMyDoor Services handles the request</h2>
        <ol>
          <li>Send photos, measurements, location, and the best way to contact you.</li>
          <li>FixMyDoor Services reviews the details and confirms the practical next step.</li>
          <li>The request is handled as repair, installation, replacement planning, or hardware sourcing.</li>
        </ol>
        <h2>Frequently asked questions</h2>
        ${faqs.map((item) => `<h3>${escapeHtml2(item.question)}</h3><p>${escapeHtml2(item.answer)}</p>`).join("")}
        <h2>Service areas</h2>
        <p>FixMyDoor Services is based in Montreal, Quebec and welcomes requests from Montreal, Laval, Longueuil, Brossard, nearby Quebec communities, other Canadian locations, and international customers who need door, furniture, or hardware sourcing guidance.</p>
        <h2>Contact FixMyDoor Services</h2>
        <p>Phone: <a href="tel:+14383471823">+1 (438) 347-1823</a></p>
        <p>Email: <a href="mailto:info.fixmydoor@gmail.com">info.fixmydoor@gmail.com</a></p>
        <p>WhatsApp: <a href="https://wa.me/233242011305">+233 24 201 1305</a></p>
        <p>Canonical page: <a href="${escapeHtml2(canonicalUrl)}">${escapeHtml2(canonicalUrl)}</a></p>
      </main>`;
}
function renderServiceFallbackContent(pagePath) {
  const fallbackMain = renderServiceFallbackMain(pagePath);
  return fallbackMain ? `    <noscript>
      ${fallbackMain}
    </noscript>` : "";
}
function renderIndexHtmlForPath(template, pagePath = "/") {
  const page = resolveSeoPage(pagePath);
  const isFrench = isFrenchSeoRequest(pagePath);
  const localizedPage = getLocalizedSeoPageValues(page, isFrench);
  const publicBaseUrl = getPublicBaseUrl();
  const canonicalBaseUrl = page.path === "/" ? `${publicBaseUrl}/` : `${publicBaseUrl}${page.path}`;
  const canonicalUrl = isFrench ? appendFrenchQuery(canonicalBaseUrl) : canonicalBaseUrl;
  const structuredData = renderPageStructuredData(pagePath);
  const isAdminPath = normalizeSeoPath(pagePath).startsWith("/admin");
  let html = replacePublicUrlTokens(template).replace(/<html lang="[^"]*">/, `<html lang="${isFrench ? "fr-CA" : "en-CA"}">`).replace(/<title>.*?<\/title>/s, `<title>${escapeHtml2(localizedPage.title)}</title>`).replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml2(canonicalUrl)}" />`);
  if (isAdminPath) {
    html = html.replace(/<link id="fixmydoor-manifest" rel="manifest" href="[^"]*" \/>/, '<link id="fixmydoor-manifest" rel="manifest" href="/admin-manifest.json" />').replace(/<link id="fixmydoor-apple-touch-icon" rel="apple-touch-icon" href="[^"]*" \/>/, '<link id="fixmydoor-apple-touch-icon" rel="apple-touch-icon" href="/icons/admin-icon-v2-192x192.png" />').replace(/<meta name="application-name" content="[^"]*" \/>/, '<meta name="application-name" content="FixMyDoor Admin Dashboard" />').replace(/<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/, '<meta name="apple-mobile-web-app-title" content="FixMyDoor Admin" />').replace(/<meta name="theme-color" content="[^"]*" \/>/, '<meta name="theme-color" content="#2F241C" />').replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, nofollow" />');
  }
  html = html.replace(/    <link rel="alternate" hreflang="en-ca" href="[^"]*" \/>\n    <link rel="alternate" hreflang="fr-ca" href="[^"]*" \/>\n    <link rel="alternate" hreflang="x-default" href="[^"]*" \/>/, renderAlternateLinks(canonicalBaseUrl, page.path));
  html = replaceMetaContent(html, "name", "description", localizedPage.description);
  html = replaceMetaContent(html, "name", "keywords", localizedPage.keywords);
  html = replaceMetaContent(html, "name", "language", isFrench ? "French, English" : "English, French");
  html = replaceMetaContent(html, "property", "og:title", localizedPage.title);
  html = replaceMetaContent(html, "property", "og:description", localizedPage.description);
  html = replaceMetaContent(html, "property", "og:url", canonicalUrl);
  html = replaceMetaContent(html, "property", "og:image", getPublicImageUrl());
  html = replaceMetaContent(html, "property", "og:image:width", "1200");
  html = replaceMetaContent(html, "property", "og:image:height", "630");
  html = replaceMetaContent(html, "property", "og:image:alt", "FixMyDoor Services door and furniture repair work");
  html = replaceMetaContent(html, "name", "twitter:title", localizedPage.title);
  html = replaceMetaContent(html, "name", "twitter:description", localizedPage.description);
  html = replaceMetaContent(html, "name", "twitter:image", getPublicImageUrl());
  html = replaceMetaContent(html, "name", "twitter:image:alt", "FixMyDoor Services door and furniture repair work");
  const serviceRootFallback = renderServiceFallbackMain(pagePath);
  if (serviceRootFallback) {
    html = html.replace('<div id="root"></div>', `<div id="root">
      ${serviceRootFallback}
    </div>`);
  }
  const serviceFallbackContent = renderServiceFallbackContent(pagePath);
  if (serviceFallbackContent) {
    html = html.replace(/    <noscript>[\s\S]*?<\/noscript>/, serviceFallbackContent);
  }
  return structuredData ? html.replace("</head>", `${structuredData}
  </head>`) : html;
}
function renderRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${getPublicBaseUrl()}/sitemap.xml`,
    ""
  ].join("\n");
}
function renderSitemapXml() {
  const publicBaseUrl = getPublicBaseUrl();
  const lastModified = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const items = sitemapRoutes.map((route) => {
    const pageUrl = route === "/" ? `${publicBaseUrl}/` : `${publicBaseUrl}${route}`;
    const seoPage = resolveSeoPage(route);
    return [
      "  <url>",
      `    <loc>${pageUrl}</loc>`,
      `    <lastmod>${lastModified}</lastmod>`,
      `    <changefreq>${seoPage.changeFrequency}</changefreq>`,
      `    <priority>${seoPage.sitemapPriority}</priority>`,
      "  </url>"
    ].join("\n");
  }).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    items,
    "</urlset>",
    ""
  ].join("\n");
}
function renderQuoteInvoiceHtml(booking, nonce) {
  const lineItems = (booking.quoteNotes || "Labour, materials, sourcing, delivery, or installation details will be confirmed by FixMyDoor Services.").split(/\r?\n/).filter(Boolean);
  const bookingDisplayId = formatBookingDisplayId(booking);
  const issuedDate = (/* @__PURE__ */ new Date()).toLocaleDateString();
  const contactDetails = [booking.phone, booking.email].filter(Boolean).map(escapeHtml2).join("<br>");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FixMyDoor Services Quote / Invoice - ${escapeHtml2(bookingDisplayId)}</title>
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
        <p>Booking ID: ${escapeHtml2(bookingDisplayId)}</p>
        <p>Client ID: ${escapeHtml2(booking.clientId || "New client")}</p>
        <p>Date: ${escapeHtml2(issuedDate)}</p>
      </div>
    </header>
    <main>
      <div class="grid">
        <div class="box"><div class="label">Customer</div><div class="value">${escapeHtml2(booking.name)}</div></div>
        <div class="box"><div class="label">Contact</div><div class="value">${contactDetails || "Not provided"}</div></div>
        <div class="box"><div class="label">Location</div><div class="value">${escapeHtml2([booking.city, booking.country].filter(Boolean).join(", ") || booking.address)}</div></div>
        <div class="box"><div class="label">Request</div><div class="value">${escapeHtml2(booking.repairType)}</div></div>
        <div class="box"><div class="label">Invoice Status</div><div class="value">${escapeHtml2(booking.invoiceStatus || "Not issued")}</div></div>
        <div class="box"><div class="label">Payment Status</div><div class="value">${escapeHtml2(booking.paymentStatus || "Not paid")}</div></div>
      </div>
      <div class="total"><span>Estimated Amount</span><strong>${escapeHtml2(booking.quoteAmount || "To be confirmed")}</strong></div>
      <div class="box quote-box">
        <h2>Quote Details</h2>
        <ul>${lineItems.map((item) => `<li>${escapeHtml2(item)}</li>`).join("")}</ul>
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
        <p><strong>Issued:</strong> ${escapeHtml2(issuedDate)}</p>
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
if (!process.env.DATABASE_URL) {
  console.error("[ERROR] DATABASE_URL environment variable is missing.");
}
var sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  console.error("[ERROR] SESSION_SECRET must be set and at least 32 characters long");
  console.error("Generate a secure secret with: openssl rand -base64 32");
  process.exit(1);
}
async function startServer() {
  if (process.env.NODE_ENV === "production") {
    try {
      console.log("Running database migrations...");
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("Database migrations completed.");
    } catch (error) {
      console.error("Database migration failed:", error);
    }
  }
  try {
    console.log("Checking database compatibility...");
    await ensureDatabaseCompatibility();
    await backfillMissingClientIds();
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
  await initializeAdminUser();
  emailService.initialize();
  startBookingReminderSweep();
  startWeekendPromotionSweep();
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
        frameAncestors: ["'self'"]
      }
    },
    permissionsPolicy: {
      features: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        fullscreen: ["self"]
      }
    },
    hsts: {
      maxAge: 31536e3,
      includeSubDomains: true,
      preload: true
    }
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
  const staticOrPublicFilePattern = /\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?|json|xml|txt|webmanifest|mp4|webm|ogg|pdf|docx?)$/i;
  const shouldSkipPublicRateLimit = (req) => {
    if (req.method === "OPTIONS") {
      return true;
    }
    if (staticOrPublicFilePattern.test(req.path)) {
      return true;
    }
    return req.path.startsWith("/assets/") || req.path.startsWith("/icons/") || req.path.startsWith("/uploads/") || req.path.startsWith("/locales/") || req.path === "/favicon.ico" || req.path === "/fixmydoor-favicon-v2.png" || req.path === "/sw.js" || req.path === "/app-shell.js" || req.path === "/manifest.json" || req.path === "/admin-manifest.json" || req.path === "/robots.txt" || req.path === "/sitemap.xml";
  };
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: 1200,
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipPublicRateLimit
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: 5,
    // limit each IP to 5 login attempts per windowMs
    message: "Too many login attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false
  });
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1e3,
    // 1 hour
    max: 20,
    message: "Too many uploads from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);
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
  app.use(session({
    store: new PrismaSessionStore(),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      secure: isProduction,
      // Use HTTPS in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1e3,
      // 24 hours
      sameSite: "lax"
    },
    name: "fixmydoor.sid"
    // Change default session name
  }));
  prisma.session.deleteMany({ where: { expiresAt: { lt: /* @__PURE__ */ new Date() } } }).catch((error) => {
    console.error("Expired session cleanup failed:", error);
  });
  const sessionCleanupTimer = setInterval(() => {
    prisma.session.deleteMany({ where: { expiresAt: { lt: /* @__PURE__ */ new Date() } } }).catch((error) => {
      console.error("Expired session cleanup failed:", error);
    });
  }, 60 * 60 * 1e3);
  sessionCleanupTimer.unref?.();
  app.use(express.json({ limit: "30mb" }));
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir, {
    maxAge: isProduction ? "30d" : 0
  }));
  app.use("/api/media", uploadLimiter);
  app.use("/api/admin/media", uploadLimiter);
  function requireAuth(req, res, next) {
    if (req.session.adminId) {
      return next();
    }
    res.status(401).json({ success: false, error: "Authentication required" });
  }
  function cleanOptionalText(value, maxLength = 1e3) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, maxLength) : null;
  }
  function csvValue(value) {
    const safeValue = String(value ?? "").replace(/"/g, '""');
    return `"${safeValue}"`;
  }
  function normalizeSmsDraft(record) {
    return {
      id: String(record.id),
      clientId: record.clientId || void 0,
      bookingId: record.bookingId || void 0,
      clientName: String(record.clientName || ""),
      phone: String(record.phone || ""),
      message: String(record.message || ""),
      status: record.status === "SENT" ? "SENT" : "PENDING",
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt || ""),
      sentAt: record.sentAt ? record.sentAt instanceof Date ? record.sentAt.toISOString() : String(record.sentAt) : void 0
    };
  }
  function getReviewRequestMessage(booking) {
    const repairType = (booking.repairType || "").toLowerCase();
    const jobLabel = /lock|rekey|serrurier|barillet/.test(repairType) ? "door lock or rekeying work" : /furniture|cabinet|drawer|chair|sofa|meuble|armoire/.test(repairType) ? "furniture or cabinet work" : /install|entry|fitting|purchase|buy|porte/.test(repairType) ? "door installation or sourcing work" : /hardware|hinge|handle|closer|quincaillerie|charni/.test(repairType) ? "door or furniture hardware work" : "door, lock, furniture, or hardware work";
    return [
      `Hi, thank you for choosing FixMyDoor Services for your ${jobLabel}.`,
      "If you were happy with the work, please leave us an honest Google review. Your feedback helps other customers in Montreal find reliable door, lock, furniture, and hardware help.",
      "",
      "Review link:",
      "https://g.page/r/CeZinY_kV0VcEAE/review",
      "",
      "Thank you,",
      "FixMyDoor Services"
    ].join("\n");
  }
  async function createReviewSmsDraftForBooking(booking) {
    if (!booking.phone?.trim()) {
      return false;
    }
    const existingDrafts = await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "SmsDraft" WHERE "bookingId" = ? AND "message" LIKE ? LIMIT 1`,
      booking.id,
      "%g.page/r/CeZinY_kV0VcEAE/review%"
    );
    if (existingDrafts.length > 0) {
      return false;
    }
    const id = randomUUID2();
    const clientId = booking.clientId || getClientIdForContact({ phone: booking.phone, email: booking.email || "" });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SmsDraft" ("id", "clientId", "bookingId", "clientName", "phone", "message", "status", "createdAt")
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)`,
      id,
      clientId,
      booking.id,
      booking.name || "Client",
      booking.phone,
      getReviewRequestMessage(booking).slice(0, 480)
    );
    return true;
  }
  async function backfillMissingClientIds() {
    const records = await prisma.$queryRawUnsafe(
      `SELECT "id", "phone", "email" FROM "Booking" WHERE "clientId" IS NULL OR "clientId" = '' LIMIT 250`
    );
    for (const record of records) {
      await prisma.$executeRawUnsafe(
        `UPDATE "Booking" SET "clientId" = ? WHERE "id" = ?`,
        getClientIdForContact({ phone: record.phone || "", email: record.email || "" }),
        record.id
      );
    }
  }
  app.get("/api/health", async (req, res) => {
    const payload = {
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      checks: {
        database: "connected"
      }
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
          database: "unavailable"
        }
      });
    }
  });
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required" });
    }
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, error: "Invalid input format" });
    }
    if (username.length > 50 || password.length > 100) {
      return res.status(400).json({ success: false, error: "Input too long" });
    }
    try {
      const admin = await findAdminByUsername(username);
      if (!admin) {
        await new Promise((resolve2) => setTimeout(resolve2, Math.random() * 100 + 50));
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
        where: { id: req.session.adminId }
      });
      if (!admin || !await verifyPassword(currentPassword, admin.password)) {
        return res.status(401).json({ success: false, error: "Current password is incorrect" });
      }
      const hashedPassword = await hashPassword(newPassword);
      await prisma.admin.update({
        where: { id: admin.id },
        data: { password: hashedPassword }
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
          status: emailService.getStatus()
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
      Connection: "keep-alive"
    });
    res.flushHeaders?.();
    res.write(`event: ready
data: ${JSON.stringify({ sentAt: (/* @__PURE__ */ new Date()).toISOString() })}

`);
    siteEventClients.add(res);
    const heartbeat = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 25e3);
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
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const subscriptions = loadPushSubscriptions();
    const existingIndex = subscriptions.findIndex((subscription) => subscription.endpoint === req.body.endpoint);
    const requestedAudience = normalizePushAudience(req.body.audience);
    const existingAudiences = existingIndex >= 0 ? subscriptions[existingIndex].audiences?.length ? subscriptions[existingIndex].audiences : [subscriptions[existingIndex].audience || "visitor"] : [];
    const audiences = Array.from(/* @__PURE__ */ new Set([...existingAudiences, requestedAudience]));
    const nextSubscription = {
      endpoint: req.body.endpoint,
      expirationTime: req.body.expirationTime ?? null,
      keys: req.body.keys,
      audiences,
      audience: requestedAudience,
      createdAt: existingIndex >= 0 ? subscriptions[existingIndex].createdAt : now,
      updatedAt: now
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
      audiences
    });
  });
  app.get("/api/admin/notifications", requireAuth, (_req, res) => {
    const subscriptions = loadPushSubscriptions();
    const subscriberCounts = getPushSubscriberCounts(subscriptions);
    return res.json({
      ...subscriberCounts,
      notifications: loadPushNotificationLog(),
      publicKeyReady: Boolean(getVapidKeys().publicKey)
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
      badge: audience === "admin" ? "/icons/admin-icon-v2-96x96.png" : "/icons/main-icon-v2-96x96.png"
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
      notification: logEntry
    });
  });
  app.get("/api/admin/sms-drafts", requireAuth, async (req, res) => {
    const status = req.query.status === "SENT" ? "SENT" : req.query.status === "ALL" ? "ALL" : "PENDING";
    const whereClause = status === "ALL" ? "" : `WHERE "status" = ?`;
    const params = status === "ALL" ? [] : [status];
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT "id", "clientId", "bookingId", "clientName", "phone", "message", "status", "createdAt", "sentAt"
         FROM "SmsDraft"
         ${whereClause}
         ORDER BY CASE WHEN "status" = 'PENDING' THEN 0 ELSE 1 END, "createdAt" DESC
         LIMIT 100`,
        ...params
      );
      return res.json({ drafts: rows.map(normalizeSmsDraft) });
    } catch (error) {
      console.error("SMS draft fetch error:", error);
      return res.status(500).json({ success: false, error: "Failed to load saved SMS messages" });
    }
  });
  app.post("/api/admin/sms-drafts", requireAuth, async (req, res) => {
    const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
    const message = cleanOptionalText(req.body?.message, 480);
    if (!message) {
      return res.status(400).json({ success: false, error: "SMS message is required" });
    }
    const cleanContacts = contacts.map((contact) => ({
      bookingId: cleanOptionalText(contact?.bookingId, 80),
      clientId: cleanOptionalText(contact?.clientId, 40),
      clientName: cleanOptionalText(contact?.clientName, 100) || "Client",
      phone: cleanOptionalText(contact?.phone, 35)
    })).filter((contact) => contact.phone).slice(0, 80);
    if (cleanContacts.length === 0) {
      return res.status(400).json({ success: false, error: "Add at least one client phone number" });
    }
    try {
      const createdDrafts = [];
      for (const contact of cleanContacts) {
        const id = randomUUID2();
        const clientId = contact.clientId || getClientIdForContact({ phone: contact.phone, email: "" });
        await prisma.$executeRawUnsafe(
          `INSERT INTO "SmsDraft" ("id", "clientId", "bookingId", "clientName", "phone", "message", "status", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)`,
          id,
          clientId,
          contact.bookingId,
          contact.clientName,
          contact.phone,
          message
        );
        createdDrafts.push({
          id,
          clientId,
          bookingId: contact.bookingId || void 0,
          clientName: contact.clientName,
          phone: contact.phone,
          message,
          status: "PENDING",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return res.status(201).json({ success: true, drafts: createdDrafts });
    } catch (error) {
      console.error("SMS draft create error:", error);
      return res.status(500).json({ success: false, error: "Failed to save SMS message" });
    }
  });
  app.patch("/api/admin/sms-drafts/:id/sent", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id || id.length > 80) {
      return res.status(400).json({ success: false, error: "Invalid SMS message ID" });
    }
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "SmsDraft" SET "status" = 'SENT', "sentAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
        id
      );
      return res.json({ success: true });
    } catch (error) {
      console.error("SMS draft sent update error:", error);
      return res.status(500).json({ success: false, error: "Failed to mark SMS as sent" });
    }
  });
  app.delete("/api/admin/sms-drafts/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id || id.length > 80) {
      return res.status(400).json({ success: false, error: "Invalid SMS message ID" });
    }
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "SmsDraft" WHERE "id" = ?`, id);
      return res.json({ success: true });
    } catch (error) {
      console.error("SMS draft delete error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete SMS message" });
    }
  });
  app.post("/api/social-click", (req, res) => {
    const platform = String(req.body?.platform || "").trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(socialPlatformLabels, platform)) {
      return res.status(400).json({ success: false, error: "Invalid social platform" });
    }
    const platformLabel = socialPlatformLabels[platform];
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
        badge: "/icons/admin-icon-v2-96x96.png"
      }, { audience: "admin", log: false });
    }
    return res.json({ success: true, notified: shouldNotify });
  });
  app.post("/api/media", async (req, res) => {
    try {
      const media = saveDataUrlMedia(req.body?.dataUrl, { allowVideo: false, maxBytes: 18e5 });
      return res.status(201).json({ success: true, ...media });
    } catch (error) {
      return res.status(400).json({ success: false, error: error?.message || "Invalid media upload" });
    }
  });
  app.post("/api/admin/media", requireAuth, async (req, res) => {
    try {
      const media = saveDataUrlMedia(req.body?.dataUrl, { allowVideo: true, allowDocument: true, maxBytes: 2e7 });
      return res.status(201).json({ success: true, ...media });
    } catch (error) {
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
        const payload = {
          type: item.category === "advert" ? "advert" : "notification",
          title: item.category === "advert" ? "New FixMyDoor Services advert" : "New FixMyDoor Services website update",
          message: item.title,
          url: item.category === "advert" ? "/#booking-form" : "/"
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
        const payload = {
          type: item.category === "advert" ? "advert" : "notification",
          title: item.category === "advert" ? "Updated FixMyDoor Services advert" : "Updated FixMyDoor Services website content",
          message: item.title,
          url: item.category === "advert" ? "/#booking-form" : "/"
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
      const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 12));
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
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const reviews = await listAdminReviews(limit);
      return res.json({ reviews });
    } catch (error) {
      console.error("Admin review load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load reviews" });
    }
  });
  app.post("/api/admin/reviews", requireAuth, async (req, res) => {
    if (!validateReview(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid review data" });
    }
    const reviewBody = req.body;
    const requestedStatus = validateReviewStatus(reviewBody.status) ? reviewBody.status : "APPROVED";
    try {
      const review = await saveAdminReview({
        ...reviewBody,
        status: requestedStatus,
        adminNotes: cleanOptionalText(reviewBody.adminNotes, 300) || "Imported by admin"
      });
      if (review.status === "APPROVED") {
        const payload = {
          type: "review",
          title: "New FixMyDoor Services review",
          message: `${review.rating}-star review from ${review.name}`,
          url: "/#testimonials"
        };
        queuePushNotification(payload, { audience: "visitor", log: true });
        broadcastSiteEvent(payload);
      }
      return res.status(201).json({ success: true, review });
    } catch (error) {
      console.error("Admin review creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to save review" });
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
          adminNotes: cleanOptionalText(adminNotes, 500)
        }
      });
      if (status === "APPROVED") {
        const payload = {
          type: "review",
          title: "New FixMyDoor Services review",
          message: `${review.rating}-star review from ${review.name}`,
          url: "/#testimonials"
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
      const savedBooking = await saveBooking(booking);
      const trackingUrl = savedBooking.customerToken ? `${getPublicBaseUrl()}/track/${savedBooking.customerToken}` : "";
      const emailPromise = sendBookingEmailsWithStatus(savedBooking);
      const emailStatus = await Promise.race([
        emailPromise,
        emailStatusTimeout(9e3)
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
        badge: "/icons/admin-icon-v2-96x96.png"
      }, { audience: "admin", log: false });
      return res.status(201).json({
        success: true,
        trackingUrl,
        email: emailStatus
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
        where: { customerToken: token }
      });
      if (!booking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
      }
      const safeBooking = toBooking(booking);
      return res.json({
        booking: {
          id: safeBooking.id,
          clientId: safeBooking.clientId,
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
          updatedAt: safeBooking.updatedAt
        }
      });
    } catch (error) {
      console.error("Booking tracking error:", error);
      return res.status(500).json({ success: false, error: "Failed to load booking status" });
    }
  });
  app.get("/api/bookings", requireAuth, async (req, res) => {
    try {
      const { search, status, workflow = "ALL", page = "1", limit = "50" } = req.query;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
      let where = {};
      if (search && typeof search === "string" && search.length > 0 && search.length <= 100) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { address: { contains: search } }
        ];
      }
      if (status && status !== "ALL" && validateBookingStatus(status)) {
        where.status = status;
      }
      const workflowFilter = typeof workflow === "string" ? workflow : "ALL";
      let bookings = [];
      let totalCount = 0;
      if (workflowFilter && workflowFilter !== "ALL") {
        const allMatchingBookings = (await prisma.booking.findMany({
          where,
          orderBy: { createdAt: "desc" }
        })).map(toBooking).filter((booking) => matchesWorkflowFilter(booking, workflowFilter));
        totalCount = allMatchingBookings.length;
        bookings = allMatchingBookings.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      } else {
        const [pagedBookings, count] = await Promise.all([
          prisma.booking.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (pageNum - 1) * limitNum,
            take: limitNum
          }),
          prisma.booking.count({ where })
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
          pages: Math.ceil(totalCount / limitNum)
        }
      });
    } catch (error) {
      console.error("Error fetching bookings:", error);
      return res.status(500).json({ success: false, error: "Failed to load bookings" });
    }
  });
  app.get("/api/bookings/export", requireAuth, async (_req, res) => {
    try {
      const bookings = (await prisma.booking.findMany({
        orderBy: { createdAt: "desc" }
      })).map(toBooking);
      const headers = [
        "Booking Code",
        "Client ID",
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
        "Created At"
      ];
      const rows = bookings.map((booking) => [
        formatBookingDisplayId(booking),
        booking.clientId,
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
        booking.createdAt
      ]);
      const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="fixmydoor-bookings.csv"');
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
      const nonce = randomUUID2().replace(/-/g, "");
      res.setHeader(
        "Content-Security-Policy",
        `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'`
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
    const update = req.body;
    const { status } = update;
    if (!id || typeof id !== "string" || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }
    if (status !== void 0 && !validateBookingStatus(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }
    try {
      const existingBooking = await prisma.booking.findUnique({ where: { id } });
      if (!existingBooking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
      }
      const previousStatus = existingBooking.status;
      const nextStatus = status || previousStatus;
      const history = parseStatusHistory(existingBooking.statusHistory);
      if (status && status !== previousStatus) {
        history.push({
          status,
          changedAt: (/* @__PURE__ */ new Date()).toISOString(),
          note: cleanOptionalText(update.adminNotes, 300) || "Status updated by admin"
        });
      }
      const updateData = {
        status: nextStatus,
        statusHistory: serializeStatusHistory(history)
      };
      if ("appointmentTime" in update) {
        const appointmentTime = cleanOptionalText(update.appointmentTime, 160);
        updateData.appointmentTime = appointmentTime;
        if (appointmentTime && !("reminderAt" in update) && !existingBooking.reminderAt) {
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
      if ("quoteNotes" in update) updateData.quoteNotes = cleanOptionalText(update.quoteNotes, 1e3);
      if ("invoiceStatus" in update) updateData.invoiceStatus = cleanOptionalText(update.invoiceStatus, 80);
      if ("paymentStatus" in update) updateData.paymentStatus = cleanOptionalText(update.paymentStatus, 80);
      if ("staffAssigned" in update) updateData.staffAssigned = cleanOptionalText(update.staffAssigned, 120);
      if ("adminNotes" in update) updateData.adminNotes = cleanOptionalText(update.adminNotes, 1e3);
      if ("reminderAt" in update) {
        const reminderAt = cleanOptionalText(update.reminderAt, 160);
        updateData.reminderAt = reminderAt;
        if (reminderAt !== existingBooking.reminderAt) {
          updateData.reminderSentAt = null;
        }
      }
      if ("reminderWindow" in update) updateData.reminderWindow = cleanOptionalText(update.reminderWindow, 80);
      if ("reminderNote" in update) updateData.reminderNote = cleanOptionalText(update.reminderNote, 400);
      const booking = await prisma.booking.update({
        where: { id },
        data: updateData
      });
      const normalizedBooking = toBooking(booking);
      if (status && status !== previousStatus) {
        emailService.sendStatusUpdate(normalizedBooking).catch(
          (err) => console.error("Failed to send status update email:", err)
        );
        if (nextStatus === "COMPLETED") {
          emailService.sendReviewRequest(normalizedBooking).catch(
            (err) => console.error("Failed to send review request email:", err)
          );
          createReviewSmsDraftForBooking(normalizedBooking).catch(
            (err) => console.error("Failed to create review SMS draft:", err)
          );
        }
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
        where: { id }
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
        dueReminderBookings
      ] = await Promise.all([
        prisma.booking.count(),
        prisma.booking.count({ where: { status: "PENDING" } }),
        prisma.booking.count({ where: { status: "CONFIRMED" } }),
        prisma.booking.count({ where: { status: "COMPLETED" } }),
        prisma.booking.count({
          where: {
            OR: [
              { requestScope: { contains: "International" } },
              { country: { notIn: ["Canada", "canada", "CA", "ca", ""] } }
            ]
          }
        }),
        prisma.booking.count({
          where: {
            OR: [
              { urgency: { contains: "Urgent" } },
              { urgency: { contains: "Emergency" } },
              { urgency: { contains: "Same-day" } }
            ]
          }
        }),
        prisma.booking.count({
          where: {
            createdAt: {
              gte: new Date((/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0))
            }
          }
        }),
        prisma.booking.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3)
            }
          }
        }),
        prisma.booking.count({
          where: {
            createdAt: {
              gte: new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1)
            }
          }
        }),
        prisma.booking.count({
          where: {
            reminderAt: { lte: (/* @__PURE__ */ new Date()).toISOString() },
            status: { notIn: ["COMPLETED", "CANCELLED"] }
          }
        })
      ]);
      const recentBookings = await prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          repairType: true
        }
      });
      const recentReminderBookings = (await prisma.booking.findMany({
        where: {
          reminderAt: { not: null },
          status: { notIn: ["COMPLETED", "CANCELLED"] }
        },
        take: 5,
        orderBy: { reminderAt: "asc" }
      })).map(toBooking);
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
        recentReminderBookings
      });
    } catch (error) {
      console.error("Stats fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch statistics" });
    }
  });
  const staticPath = process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");
  const indexHtmlPath = path.join(staticPath, "index.html");
  const sendIndexHtml = (res, pagePath = "/") => {
    try {
      const html = fs.readFileSync(indexHtmlPath, "utf8");
      res.type("html").send(renderIndexHtmlForPath(html, pagePath));
    } catch (error) {
      console.error("Failed to render index.html:", error);
      res.status(500).send("Failed to load application");
    }
  };
  const isKnownClientRoute = (pagePath) => {
    const normalizedPath = normalizeSeoPath(pagePath);
    return normalizedPath === "/" || normalizedPath === "/admin" || normalizedPath === "/admin/notify" || normalizedPath === "/privacy-policy" || normalizedPath === "/terms-and-conditions" || normalizedPath === ghanaBranchSeoPage.path || normalizedPath === "/404" || normalizedPath.startsWith("/track/") || Boolean(serviceSeoPages[normalizedPath]);
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
    }
  }));
  app.get("*", (req, res) => {
    res.setHeader("Cache-Control", isProduction ? "no-store" : "no-cache");
    if (!isKnownClientRoute(req.path)) {
      res.status(404);
    }
    sendIndexHtml(res, req.originalUrl || req.url || req.path);
  });
  const port = process.env.PORT || 3e3;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
