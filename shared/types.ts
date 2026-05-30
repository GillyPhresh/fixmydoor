export interface BookingRequest {
  name: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
  country?: string;
  timeZone?: string;
  preferredContactMethod?: string;
  urgency?: string;
  requestScope?: string;
  currency?: string;
  repairType: string;
  preferredDate?: string;
  message?: string;
  photos?: string[];
  dimensions?: string;
  quantity?: string;
  material?: string;
  color?: string;
  swingDirection?: string;
  deliveryNeeded?: string;
  installationNeeded?: string;
  budget?: string;
  securityAnswer?: string;
  customerConsent?: boolean;
  submittedAt?: string;
  website?: string;
}

export interface Booking extends BookingRequest {
  id: string;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  customerToken?: string;
  appointmentTime?: string;
  quoteAmount?: string;
  quoteNotes?: string;
  invoiceStatus?: string;
  paymentStatus?: string;
  staffAssigned?: string;
  adminNotes?: string;
  reminderAt?: string;
  reminderWindow?: string;
  reminderNote?: string;
  reminderSentAt?: string;
  statusHistory?: BookingStatusHistoryEntry[];
  createdAt: string;
  updatedAt?: string;
}

export type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface BookingStatusHistoryEntry {
  status: BookingStatus;
  changedAt: string;
  note?: string;
}

export interface BookingUpdateRequest {
  status?: BookingStatus;
  appointmentTime?: string;
  quoteAmount?: string;
  quoteNotes?: string;
  invoiceStatus?: string;
  paymentStatus?: string;
  staffAssigned?: string;
  adminNotes?: string;
  reminderAt?: string;
  reminderWindow?: string;
  reminderNote?: string;
}

export interface ReviewRequest {
  name: string;
  location?: string;
  rating: number;
  quote: string;
}

export interface Review extends ReviewRequest {
  id: string;
  status?: ReviewStatus;
  adminNotes?: string;
  createdAt: string;
}

export type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN";

export interface ContentItem {
  id: string;
  category: ContentCategory;
  title: string;
  description?: string;
  tag?: string;
  image?: string;
  accentImage?: string;
  items?: string;
  bookingValue?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type ContentCategory =
  | "advert"
  | "serviceShowcase"
  | "productCategory"
  | "doorProduct"
  | "hardwareProduct"
  | "projectGallery";

export type ContentItemRequest = Omit<ContentItem, "id" | "createdAt" | "updatedAt">;
