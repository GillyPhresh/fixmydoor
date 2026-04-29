import { BookingRequest } from "../shared/types";
import { prisma } from "./prisma";

export function validateBooking(body: any): body is BookingRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof body.name === "string" &&
    body.name.trim().length > 0 &&
    typeof body.phone === "string" &&
    body.phone.trim().length > 0 &&
    typeof body.email === "string" &&
    body.email.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) &&
    typeof body.address === "string" &&
    body.address.trim().length > 0 &&
    typeof body.repairType === "string" &&
    body.repairType.trim().length > 0
  );
}

export async function saveBooking(booking: BookingRequest) {
  await prisma.booking.create({
    data: {
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      address: booking.address,
      repairType: booking.repairType,
      preferredDate: booking.preferredDate || null,
      message: booking.message || null,
    },
  });
}
