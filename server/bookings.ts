import { BookingRequest, BookingStatus } from "../shared/types";
import { prisma } from "./prisma";

const VALID_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export function validateBooking(body: any): body is BookingRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof body.name === "string" &&
    body.name.trim().length > 0 &&
    body.name.trim().length <= 100 &&
    typeof body.phone === "string" &&
    body.phone.trim().length > 0 &&
    body.phone.trim().length <= 20 &&
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
    (body.message === undefined || (typeof body.message === "string" && body.message.length <= 1000))
  );
}

export function validateBookingStatus(status: any): status is BookingStatus {
  return typeof status === "string" && VALID_STATUSES.includes(status as BookingStatus);
}

export async function saveBooking(booking: BookingRequest) {
  // Sanitize inputs
  const sanitizedBooking = {
    name: booking.name.trim(),
    phone: booking.phone.trim(),
    email: booking.email.trim().toLowerCase(),
    address: booking.address.trim(),
    repairType: booking.repairType.trim(),
    preferredDate: booking.preferredDate?.trim() || null,
    message: booking.message?.trim() || null,
  };

  return await prisma.booking.create({
    data: sanitizedBooking,
  });
}
