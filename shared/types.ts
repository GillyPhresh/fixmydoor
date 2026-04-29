export interface BookingRequest {
  name: string;
  phone: string;
  email: string;
  address: string;
  repairType: string;
  preferredDate?: string;
  message?: string;
  submittedAt?: string;
}

export interface Booking extends BookingRequest {
  id: string;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

export type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
