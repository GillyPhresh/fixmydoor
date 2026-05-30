import { randomUUID } from "crypto";
import { BookingRequest, Booking, BookingStatus, BookingStatusHistoryEntry, ManualBookingRequest } from "../shared/types";
import { prisma } from "./prisma";

const VALID_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const OPTIONAL_TEXT_FIELDS = [
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
  "budget",
] as const;
const MAX_PHOTO_COUNT = 3;
const MAX_PHOTO_LENGTH = 2_500_000;
const STORED_MEDIA_PATTERN = /^\/uploads\/[a-z0-9-]+\.(png|jpe?g|webp)$/i;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function validateOptionalText(body: any, field: (typeof OPTIONAL_TEXT_FIELDS)[number], maxLength = 180) {
  return body[field] === undefined || (typeof body[field] === "string" && body[field].trim().length <= maxLength);
}

function validatePhotos(photos: unknown) {
  if (photos === undefined) {
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

function parseJsonArray<T>(value: string | null | undefined, fallback: T[] = []): T[] {
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

export function serializeStatusHistory(history: BookingStatusHistoryEntry[]) {
  return JSON.stringify(history);
}

export function parseStatusHistory(value: string | null | undefined) {
  return parseJsonArray<BookingStatusHistoryEntry>(value);
}

export function toBooking(record: any): Booking {
  return {
    ...record,
    preferredDate: record.preferredDate ?? undefined,
    message: record.message ?? undefined,
    customerToken: record.customerToken ?? undefined,
    photos: parseJsonArray<string>(record.photos),
    city: record.city ?? undefined,
    country: record.country ?? undefined,
    timeZone: record.timeZone ?? undefined,
    preferredContactMethod: record.preferredContactMethod ?? undefined,
    urgency: record.urgency ?? undefined,
    requestScope: record.requestScope ?? undefined,
    currency: record.currency ?? undefined,
    dimensions: record.dimensions ?? undefined,
    quantity: record.quantity ?? undefined,
    material: record.material ?? undefined,
    color: record.color ?? undefined,
    swingDirection: record.swingDirection ?? undefined,
    deliveryNeeded: record.deliveryNeeded ?? undefined,
    installationNeeded: record.installationNeeded ?? undefined,
    budget: record.budget ?? undefined,
    appointmentTime: record.appointmentTime ?? undefined,
    quoteAmount: record.quoteAmount ?? undefined,
    quoteNotes: record.quoteNotes ?? undefined,
    invoiceStatus: record.invoiceStatus ?? undefined,
    paymentStatus: record.paymentStatus ?? undefined,
    staffAssigned: record.staffAssigned ?? undefined,
    adminNotes: record.adminNotes ?? undefined,
    reminderAt: record.reminderAt ?? undefined,
    reminderWindow: record.reminderWindow ?? undefined,
    reminderNote: record.reminderNote ?? undefined,
    reminderSentAt: record.reminderSentAt ?? undefined,
    statusHistory: parseStatusHistory(record.statusHistory),
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt,
  };
}

export function validateBooking(body: any): body is BookingRequest {
  const hasSubmittedAt = typeof body?.submittedAt === "string" && body.submittedAt.trim().length > 0;
  const submittedAt = hasSubmittedAt ? Date.parse(body.submittedAt) : Number.NaN;
  const submissionAgeMs = Date.now() - submittedAt;
  const hasSafeSubmissionTiming =
    hasSubmittedAt &&
    Number.isFinite(submittedAt) &&
    submissionAgeMs >= 1_200 &&
    submissionAgeMs <= 7 * 24 * 60 * 60 * 1000;
  const passedSecurityCheck =
    typeof body?.securityAnswer === "string" &&
    body.securityAnswer === "verified-customer";

  return (
    typeof body === "object" &&
    body !== null &&
    typeof body.name === "string" &&
    body.name.trim().length > 0 &&
    body.name.trim().length <= 100 &&
    typeof body.phone === "string" &&
    body.phone.trim().length > 0 &&
    body.phone.trim().length <= 35 &&
    typeof body.email === "string" &&
    body.email.trim().length > 0 &&
    body.email.trim().length <= 100 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) &&
    typeof body.address === "string" &&
    body.address.trim().length > 0 &&
    body.address.trim().length <= 500 &&
    typeof body.repairType === "string" &&
    body.repairType.trim().length > 0 &&
    body.repairType.trim().length <= 100 &&
    (body.preferredDate === undefined || typeof body.preferredDate === "string") &&
    (body.message === undefined || (typeof body.message === "string" && body.message.length <= 1000)) &&
    (body.website === undefined || body.website === "") &&
    hasSafeSubmissionTiming &&
    passedSecurityCheck &&
    OPTIONAL_TEXT_FIELDS.every((field) => validateOptionalText(body, field)) &&
    validatePhotos(body.photos) &&
    body.customerConsent === true
  );
}

export function validateBookingStatus(status: any): status is BookingStatus {
  return typeof status === "string" && VALID_STATUSES.includes(status as BookingStatus);
}

export function validateManualBooking(body: any): body is ManualBookingRequest {
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  return (
    typeof body === "object" &&
    body !== null &&
    typeof body.name === "string" &&
    body.name.trim().length > 0 &&
    body.name.trim().length <= 100 &&
    typeof body.phone === "string" &&
    body.phone.trim().length > 0 &&
    body.phone.trim().length <= 35 &&
    (email === "" || (email.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) &&
    (body.address === undefined || (typeof body.address === "string" && body.address.trim().length <= 500)) &&
    (body.city === undefined || (typeof body.city === "string" && body.city.trim().length <= 100)) &&
    (body.country === undefined || (typeof body.country === "string" && body.country.trim().length <= 100)) &&
    (body.preferredContactMethod === undefined || (typeof body.preferredContactMethod === "string" && body.preferredContactMethod.trim().length <= 100)) &&
    (body.urgency === undefined || (typeof body.urgency === "string" && body.urgency.trim().length <= 100)) &&
    typeof body.repairType === "string" &&
    body.repairType.trim().length > 0 &&
    body.repairType.trim().length <= 100 &&
    (body.preferredDate === undefined || (typeof body.preferredDate === "string" && body.preferredDate.trim().length <= 60)) &&
    (body.appointmentTime === undefined || (typeof body.appointmentTime === "string" && body.appointmentTime.trim().length <= 160)) &&
    (body.message === undefined || (typeof body.message === "string" && body.message.length <= 1000)) &&
    (body.adminNotes === undefined || (typeof body.adminNotes === "string" && body.adminNotes.length <= 1000)) &&
    (body.customerConsent === undefined || typeof body.customerConsent === "boolean")
  );
}

function getManualReminderAt(appointmentTime?: string) {
  if (!appointmentTime) {
    return null;
  }

  const appointmentMs = Date.parse(appointmentTime);
  if (!Number.isFinite(appointmentMs)) {
    return null;
  }

  return new Date(Math.max(Date.now(), appointmentMs - TWO_HOURS_MS)).toISOString();
}

export async function saveBooking(booking: BookingRequest): Promise<Booking> {
  const statusHistory: BookingStatusHistoryEntry[] = [
    {
      status: "PENDING",
      changedAt: new Date().toISOString(),
      note: "Request received",
    },
  ];

  // Sanitize inputs
  const sanitizedBooking = {
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
    statusHistory: serializeStatusHistory(statusHistory),
  };

  const result = await prisma.booking.create({
    data: sanitizedBooking,
  });

  return toBooking(result);
}

export async function saveManualBooking(booking: ManualBookingRequest): Promise<Booking> {
  const appointmentTime = booking.appointmentTime?.trim() || null;
  const reminderAt = getManualReminderAt(appointmentTime || undefined);
  const statusHistory: BookingStatusHistoryEntry[] = [
    {
      status: "PENDING",
      changedAt: new Date().toISOString(),
      note: "Manual phone request entered by admin",
    },
  ];

  const result = await prisma.booking.create({
    data: {
      name: booking.name.trim(),
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
      statusHistory: serializeStatusHistory(statusHistory),
    },
  });

  return toBooking(result);
}
