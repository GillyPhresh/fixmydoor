import { randomUUID } from "crypto";
import { BookingRequest, Booking, BookingStatus, BookingStatusHistoryEntry } from "../shared/types";
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
    statusHistory: parseStatusHistory(record.statusHistory),
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt,
  };
}

export function validateBooking(body: any): body is BookingRequest {
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
    OPTIONAL_TEXT_FIELDS.every((field) => validateOptionalText(body, field)) &&
    validatePhotos(body.photos) &&
    body.customerConsent === true
  );
}

export function validateBookingStatus(status: any): status is BookingStatus {
  return typeof status === "string" && VALID_STATUSES.includes(status as BookingStatus);
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
