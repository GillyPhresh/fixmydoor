import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, Calendar, Download, Phone, User, MapPin, Mail, Filter, LogOut, Trash2, Eye, Save, Star, KeyRound, MessageCircle, Upload, FileText, Send, RefreshCw, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { Booking, BookingStatus, BookingUpdateRequest, ContentItem, ContentItemRequest, ManualBookingRequest, Review, ReviewStatus } from "@shared/types";
import { formatBookingDisplayId } from "@shared/booking-code";
import { getSmsUrl, getWhatsAppUrl, normalizePhoneForMessaging } from "@shared/phone";
import { serviceCatalog } from "@shared/services";

const ADMIN_NOTIFICATION_CHOICE_KEY = "fixmydoor-admin-push-choice-v1";
const ADMIN_REMINDER_WATCH_DISMISS_KEY = "fixmydoor-admin-reminder-watch-dismissed-v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const statusColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const emptyContentDraft: ContentItemRequest = {
  category: "projectGallery",
  title: "",
  description: "",
  tag: "",
  image: "",
  accentImage: "",
  items: "",
  bookingValue: "",
  sortOrder: 0,
  active: true,
};

const emptyManualBookingDraft: ManualBookingRequest = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "Montreal",
  country: "Canada",
  preferredContactMethod: "Phone call",
  urgency: "Normal",
  repairType: "door-repair",
  preferredDate: "",
  appointmentTime: "",
  message: "",
  adminNotes: "",
  customerConsent: false,
};

const contentCategories: { value: ContentItem["category"]; label: string }[] = [
  { value: "advert", label: "Advert / Promotion" },
  { value: "serviceShowcase", label: "Service Card" },
  { value: "productCategory", label: "Product Category" },
  { value: "doorProduct", label: "Door Product" },
  { value: "hardwareProduct", label: "Hardware Product" },
  { value: "projectGallery", label: "Project Gallery" },
  { value: "ownerProfile", label: "Owner Profile Photo" },
];

const quickMessageTemplates = [
  {
    label: "Received",
    message: (booking: Booking) => `Hello ${booking.name}, this is FixMyDoor Services. We received your request for ${booking.repairType} and will review the details shortly.\nBooking ID: ${formatBookingDisplayId(booking)}`,
  },
  {
    label: "Quote sent",
    message: (booking: Booking) => `Hello ${booking.name}, this is FixMyDoor Services. Your quote for ${booking.repairType} has been prepared. Please review it and let us know if you have any questions.\nBooking ID: ${formatBookingDisplayId(booking)}`,
  },
  {
    label: "Confirmed",
    message: (booking: Booking) => `Hello ${booking.name}, this is FixMyDoor Services. Your appointment for ${booking.repairType} is confirmed${booking.appointmentTime ? ` for ${booking.appointmentTime}` : ""}.\nBooking ID: ${formatBookingDisplayId(booking)}`,
  },
  {
    label: "Completed",
    message: (booking: Booking) => `Hello ${booking.name}, this is FixMyDoor Services. Thank you for choosing us. Your job is marked completed. Please contact us if you need any follow-up.\nBooking ID: ${formatBookingDisplayId(booking)}`,
  },
];

const quoteTemplateText = [
  "Labour: C$",
  "Materials / parts: C$",
  "Delivery / pickup: C$",
  "Estimated total: C$",
  "Notes:",
  "Quote is based on the photos, measurements, and details provided. Final cost may change if site conditions are different.",
].join("\n");

const workflowExamples = [
  ["Appointment Date & Time", "Pick the visit time from the calendar, for example May 30, 2026 at 2:30 PM."],
  ["Reminder", "When you pick an appointment, a 2-hour-before job reminder is added automatically. You can still change it if needed."],
  ["Quote Amount", "Use a clear amount such as C$250, or a range such as C$180-C$320 when the final parts are not confirmed."],
  ["Staff", "Write who will handle the job, for example Richard, Team A, or Supplier follow-up."],
  ["Invoice / Quote Stage", "Choose where the paperwork is: not sent yet, quote sent, final invoice sent, or revised after a change."],
  ["Payment Progress", "Choose the money status: no payment yet, deposit requested, part payment received, or fully paid."],
  ["Quote / Invoice Notes", "Write customer-facing line items such as labour, hinges, delivery, installation, warranty, and payment terms."],
  ["Private Admin Notes", "Write internal reminders only, such as confirm hinge size, call after 6 PM, or customer prefers WhatsApp."],
] as const;

const reminderWindowOptions = [
  "At selected time",
  "2 hours before appointment",
  "Within 15 minutes",
  "Within 30 minutes",
  "Within 1 hour",
  "Same day follow-up",
] as const;

const reminderTypeDescriptions = [
  ["At selected time", "The reminder fires at the exact Reminder Time you selected."],
  ["2 hours before appointment", "Best for scheduled jobs. When you choose an appointment, the dashboard sets this reminder 2 hours before the visit."],
  ["Within 15 minutes", "Use this as a quick-response label when the customer needs attention almost immediately."],
  ["Within 30 minutes", "Use this for a short follow-up window after a call, message, or quote request."],
  ["Within 1 hour", "Use this when the customer should be contacted within the hour."],
  ["Same day follow-up", "Use this when the request should be handled before the end of the day."],
] as const;

const staffAssignmentOptions = ["Not assigned", "Richard", "Staff"] as const;

const invoiceStatusOptions = [
  { value: "Not issued", label: "Not sent yet" },
  { value: "Quote sent", label: "Quote sent to customer" },
  { value: "Invoice sent", label: "Final invoice sent" },
  { value: "Revised", label: "Revised quote/invoice sent" },
] as const;

const paymentStatusOptions = [
  { value: "Not paid", label: "No payment received" },
  { value: "Deposit requested", label: "Deposit requested" },
  { value: "Partially paid", label: "Part payment received" },
  { value: "Paid", label: "Fully paid" },
] as const;

const reminderHelpSteps = [
  "First choose the appointment date and time.",
  "The dashboard fills the reminder for 2 hours before the job automatically.",
  "Only change the reminder time or message if you want a different follow-up.",
] as const;

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

type EmailRuntimeStatus = {
  configured: boolean;
  verified: boolean;
  provider: "resend" | "smtp" | "none";
  host: string;
  port: number | null;
  secure: boolean;
  smtpUser: string;
  resendConfigured: boolean;
  resendFrom: string;
  from: string;
  businessEmail: string;
  adminEmail: string;
  publicBaseUrl: string;
  adminDashboardUrl: string;
  missing: string[];
  lastVerifyError: string;
  lastSendError: string;
};

type PushNotificationLogEntry = {
  id: string;
  title: string;
  message: string;
  audience?: "visitor" | "admin" | "all";
  sentAt: string;
  delivered: number;
  failed: number;
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function formatPreferredDate(dateString?: string | null) {
  if (!dateString) {
    return "Not specified";
  }

  const [year, month, day] = dateString.split("-").map(Number);
  if ([year, month, day].some(Number.isNaN)) {
    return dateString;
  }

  return new Date(year, month - 1, day).toLocaleDateString();
}

function isDocumentMedia(value?: string | null) {
  return Boolean(value && /\.(pdf|docx?)(\?.*)?$/i.test(value));
}

function readFileAsDataUrl(selectedFile: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(selectedFile);
  });
}

function getDefaultClientMessage(booking: Booking) {
  return [
    `Hello ${booking.name}, this is FixMyDoor Services.`,
    `We received your request for ${booking.repairType}.`,
    "Our staff will contact you to confirm the appointment details.",
    `Booking ID: ${formatBookingDisplayId(booking)}`,
  ].join("\n");
}

function getAdminToClientWhatsAppUrl(booking: Booking, customMessage?: string) {
  return getWhatsAppUrl(booking.phone, booking.country || booking.address, customMessage || getDefaultClientMessage(booking));
}

function getAdminToClientSmsUrl(booking: Booking, customMessage?: string) {
  return getSmsUrl(booking.phone, booking.country || booking.address, customMessage || getDefaultClientMessage(booking));
}

function hasBookingEmail(booking: Pick<Booking, "email">) {
  return Boolean(booking.email?.trim());
}

function getBookingEmailLabel(booking: Pick<Booking, "email">) {
  return booking.email?.trim() || "No email added";
}

function getEmailStatusLabel(status: EmailRuntimeStatus) {
  if (!status.configured) {
    return "Not configured";
  }

  if (status.provider === "resend" && status.verified) {
    return "Ready with Resend";
  }

  if (status.provider === "resend") {
    return "Resend configured, test email pending";
  }

  return status.verified ? "Ready with SMTP" : "SMTP verification pending/failed";
}

function toDateTimeLocalInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const offsetDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatDateTimeLocalInput(value: string) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toIsoDateTimeInputValue(value: string) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString();
}

function getTwoHourReminderIsoFromInput(value: string) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Date(Math.max(Date.now(), parsedDate.getTime() - TWO_HOURS_MS)).toISOString();
}

function getDefaultJobReminderNote(repairType?: string) {
  return `About 2 hours left to go and do the ${repairType || "job"}. Check the customer details, route, tools, and parts before leaving.`;
}

function applyAppointmentToDraft(draft: BookingUpdateRequest, value: string, repairType?: string): BookingUpdateRequest {
  const appointmentTime = formatDateTimeLocalInput(value);

  if (!appointmentTime) {
    return {
      ...draft,
      appointmentTime: "",
      reminderAt: "",
      reminderWindow: "At selected time",
      reminderNote: "",
    };
  }

  const hasCustomReminder = Boolean(draft.reminderAt) && draft.reminderWindow && !["At selected time", "2 hours before appointment"].includes(draft.reminderWindow);
  if (hasCustomReminder) {
    return { ...draft, appointmentTime };
  }

  const reminderAt = getTwoHourReminderIsoFromInput(value);
  return {
    ...draft,
    appointmentTime,
    reminderAt,
    reminderWindow: reminderAt ? "2 hours before appointment" : draft.reminderWindow || "At selected time",
    reminderNote: draft.reminderNote || getDefaultJobReminderNote(repairType),
  };
}

function formatReminderDisplay(value?: string | null) {
  if (!value) {
    return "No reminder set";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isReminderDueForAdmin(booking: Pick<Booking, "reminderAt" | "status">) {
  if (!booking.reminderAt || ["COMPLETED", "CANCELLED"].includes(booking.status)) {
    return false;
  }

  const reminderTime = new Date(booking.reminderAt).getTime();
  return Number.isFinite(reminderTime) && reminderTime <= Date.now();
}

function getBookingDateTimeMs(value?: string | null) {
  const parsedDate = value ? new Date(value) : null;
  const time = parsedDate?.getTime() ?? Number.NaN;
  return Number.isFinite(time) ? time : Number.NaN;
}

function isJobWithinTwoHours(booking: Pick<Booking, "appointmentTime" | "status">) {
  if (!booking.appointmentTime || ["COMPLETED", "CANCELLED"].includes(booking.status)) {
    return false;
  }

  const appointmentTime = getBookingDateTimeMs(booking.appointmentTime);
  const timeLeft = appointmentTime - Date.now();
  return Number.isFinite(timeLeft) && timeLeft > 0 && timeLeft <= TWO_HOURS_MS;
}

function getReminderBadgeText(booking: Pick<Booking, "appointmentTime" | "reminderAt" | "status">) {
  if (isJobWithinTwoHours(booking)) {
    return "2 hours left";
  }

  return isReminderDueForAdmin(booking) ? "Due" : "Set";
}

function getReminderCardMessage(booking: Pick<Booking, "appointmentTime" | "reminderAt" | "reminderNote" | "repairType" | "status">) {
  if (isJobWithinTwoHours(booking)) {
    return getDefaultJobReminderNote(booking.repairType);
  }

  return booking.reminderNote || booking.repairType;
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [workflowFilter, setWorkflowFilter] = useState<string>("ALL");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingUpdateRequest>({});
  const [manualBookingDialogOpen, setManualBookingDialogOpen] = useState(false);
  const [manualBookingDraft, setManualBookingDraft] = useState<ManualBookingRequest>(emptyManualBookingDraft);
  const [manualBookingLoading, setManualBookingLoading] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentDraft, setContentDraft] = useState<ContentItemRequest>(emptyContentDraft);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [ownerPhotoDialogOpen, setOwnerPhotoDialogOpen] = useState(false);
  const [ownerPhotoDraft, setOwnerPhotoDraft] = useState("");
  const [ownerPhotoLoading, setOwnerPhotoLoading] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [emailStatusLoading, setEmailStatusLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailRuntimeStatus | null>(null);
  const [contentUploadLoading, setContentUploadLoading] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushRefreshLoading, setPushRefreshLoading] = useState(false);
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [pushSubscriberCount, setPushSubscriberCount] = useState(0);
  const [visitorSubscriberCount, setVisitorSubscriberCount] = useState(0);
  const [adminSubscriberCount, setAdminSubscriberCount] = useState(0);
  const [pushNotifications, setPushNotifications] = useState<PushNotificationLogEntry[]>([]);
  const [adminNotificationSupported, setAdminNotificationSupported] = useState(false);
  const [adminNotificationsEnabled, setAdminNotificationsEnabled] = useState(false);
  const [adminNotificationLoading, setAdminNotificationLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [adminStandalone, setAdminStandalone] = useState(false);
  const [dismissedReminderWatchKey, setDismissedReminderWatchKey] = useState(() => (
    typeof window === "undefined" ? "" : window.localStorage.getItem(ADMIN_REMINDER_WATCH_DISMISS_KEY) || ""
  ));

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    setAdminNotificationSupported(supported);
    if (supported && Notification.permission === "granted") {
      window.localStorage.setItem(ADMIN_NOTIFICATION_CHOICE_KEY, "allowed");
      setAdminNotificationsEnabled(true);
    } else {
      setAdminNotificationsEnabled(false);
    }
    setAdminStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone));

    const handleBeforeInstallPrompt = (event: Event) => {
      if (!window.location.pathname.startsWith("/admin")) {
        return;
      }

      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchStats();
      fetchReviews();
      fetchContentItems();
      fetchEmailStatus();
      fetchPushNotifications();
      if (adminNotificationSupported && Notification.permission === "granted") {
        subscribeAdminAlerts().catch((error) => {
          console.error("Admin push re-subscribe error:", error);
        });
      }
      if (window.location.pathname === "/admin/notify") {
        window.setTimeout(() => {
          document.getElementById("push-notification-manager")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      }
    }
  }, [authenticated, adminNotificationSupported]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (authenticated && debouncedSearch !== undefined) {
      fetchBookings();
    }
  }, [authenticated, debouncedSearch, statusFilter, workflowFilter, currentPage]);

  useEffect(() => {
    if (!ownerPhotoDialogOpen) {
      const ownerPhoto = contentItems.find((item) => item.category === "ownerProfile" && item.active);
      setOwnerPhotoDraft(ownerPhoto?.image || "");
    }
  }, [contentItems, ownerPhotoDialogOpen]);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get("/api/auth/status");
      setAuthenticated(response.data.authenticated);
    } catch (err) {
      setAuthenticated(false);
      setBookings([]);
      setStats(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await axios.post("/api/auth/login", loginData);
      setAuthenticated(true);
      toast.success("Logged in successfully");
    } catch (err: any) {
      if (axios.isAxiosError(err) && !err.response) {
        toast.error("Poor network. Check your internet connection and try again.");
      } else if (axios.isAxiosError(err) && err.response?.status === 401) {
        toast.error("Invalid username or password.");
      } else if (axios.isAxiosError(err) && err.response?.status === 429) {
        toast.error("Too many login attempts. Please wait and try again.");
      } else {
        toast.error(err?.response?.data?.error || "Login failed. Please try again.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setAuthenticated(false);
      setBookings([]);
      setStats(null);
      setError(null);
      setSelectedBooking(null);
      setBookingDraft({});
      setReviews([]);
      setContentItems([]);
      setEmailStatus(null);
      setCurrentPage(1);
      toast.success("Logged out successfully");
    } catch (err) {
      toast.error("Failed to logout");
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get("/api/stats");
      setStats(response.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (workflowFilter !== "ALL") params.append("workflow", workflowFilter);
      params.append("page", currentPage.toString());
      params.append("limit", "20");

      const response = await axios.get(`/api/bookings?${params.toString()}`);
      setBookings(response.data.bookings);
      setTotalPages(response.data.pagination.pages || 1);
      setError(null);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setAuthenticated(false);
        setBookings([]);
        setStats(null);
        setError(null);
        toast.error("Your admin session expired. Please log in again.");
      } else {
        setError("Failed to load bookings");
        console.error("Error fetching bookings:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboard = async () => {
    setDashboardRefreshing(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchBookings(),
        fetchReviews(),
        fetchContentItems(),
        fetchEmailStatus(),
        fetchPushNotifications(),
      ]);
      toast.success("Admin dashboard refreshed");
    } catch {
      toast.error("Some dashboard data could not refresh");
    } finally {
      setDashboardRefreshing(false);
    }
  };

  const applyQuickBookingFilter = (filter: { status?: string; workflow?: string }) => {
    setStatusFilter(filter.status || "ALL");
    setWorkflowFilter(filter.workflow || "ALL");
    setCurrentPage(1);
    document.getElementById("booking-requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const dismissReminderWatch = (reminderWatchKey: string) => {
    setDismissedReminderWatchKey(reminderWatchKey);
    window.localStorage.setItem(ADMIN_REMINDER_WATCH_DISMISS_KEY, reminderWatchKey);
    toast.success("Reminder Watch closed for now");
  };

  const fetchReviews = async () => {
    try {
      const response = await axios.get("/api/admin/reviews?limit=100");
      setReviews(response.data.reviews || []);
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    }
  };

  const fetchContentItems = async () => {
    try {
      const response = await axios.get("/api/admin/content");
      setContentItems(response.data.items || []);
    } catch (err) {
      console.error("Failed to fetch content items:", err);
    }
  };

  const fetchEmailStatus = async (showToast = false) => {
    setEmailStatusLoading(true);
    try {
      const response = await axios.get<{ status: EmailRuntimeStatus }>("/api/admin/email-status");
      setEmailStatus(response.data.status);
      if (showToast) {
        toast.success("Email status refreshed");
      }
    } catch (err) {
      console.error("Failed to fetch email status:", err);
      if (showToast) {
        toast.error("Unable to refresh email status");
      }
    } finally {
      setEmailStatusLoading(false);
    }
  };

  const fetchPushNotifications = async (showToast = false) => {
    setPushRefreshLoading(true);
    try {
      const response = await axios.get<{
        subscriberCount: number;
        visitorSubscriberCount: number;
        adminSubscriberCount: number;
        notifications: PushNotificationLogEntry[];
      }>("/api/admin/notifications");
      setPushSubscriberCount(response.data.subscriberCount || 0);
      setVisitorSubscriberCount(response.data.visitorSubscriberCount || 0);
      setAdminSubscriberCount(response.data.adminSubscriberCount || 0);
      setPushNotifications(response.data.notifications || []);
      if (showToast) {
        toast.success("Notification log refreshed");
      }
    } catch (err) {
      console.error("Failed to fetch push notifications:", err);
      if (showToast) {
        toast.error("Unable to refresh notifications");
      }
    } finally {
      setPushRefreshLoading(false);
    }
  };

  const subscribeAdminAlerts = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Push notifications are not available on this device.");
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const keyResponse = await axios.get<{ publicKey: string }>("/api/push/public-key");
    const publicKey = keyResponse.data.publicKey;
    if (!publicKey) {
      throw new Error("Push notification key is not ready.");
    }

    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await axios.post("/api/push/subscribe", { ...subscription.toJSON(), audience: "admin" });
    setAdminNotificationsEnabled(true);
    window.localStorage.setItem(ADMIN_NOTIFICATION_CHOICE_KEY, "allowed");
    await fetchPushNotifications();
    return registration;
  };

  const enableAdminNotifications = async () => {
    if (!adminNotificationSupported) {
      toast.error("Admin alerts are not available on this browser.");
      return;
    }

    setAdminNotificationLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        window.localStorage.setItem(ADMIN_NOTIFICATION_CHOICE_KEY, "denied");
        setAdminNotificationsEnabled(false);
        toast.message("Admin alerts were not enabled.");
        return;
      }

      const registration = await subscribeAdminAlerts();
      registration.showNotification("FixMyDoor admin alerts are on", {
        body: "New customer messages and admin updates can now appear on this device.",
        icon: "/icons/admin-icon-v2-192x192.png",
        badge: "/icons/admin-icon-v2-96x96.png",
        tag: "fixmydoor-admin-alerts-enabled",
        renotify: true,
        silent: false,
        data: { url: "/admin" },
      } as NotificationOptions).catch((error) => {
        console.error("Admin notification confirmation display error:", error);
      });
      toast.success("Admin alerts are enabled for this device.");
    } catch (err) {
      console.error("Admin alert setup error:", err);
      toast.error("Unable to enable admin alerts right now.");
    } finally {
      setAdminNotificationLoading(false);
    }
  };

  const installAdminApp = async () => {
    if (adminStandalone) {
      toast.message("The admin dashboard is already running as an app.");
      return;
    }

    if (!installPrompt) {
      toast.message("On Android Chrome, open the three-dot menu and choose Install app or Add to Home screen.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") {
      toast.success("FixMyDoor Admin app installation started.");
    }
  };

  const sendPushNotification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pushTitle.trim() || !pushMessage.trim()) {
      toast.error("Notification title and message are required");
      return;
    }

    setPushLoading(true);
    try {
      const response = await axios.post("/api/admin/notifications/send", {
        title: pushTitle,
        message: pushMessage,
        url: "/",
      });
      setPushTitle("");
      setPushMessage("");
      await fetchPushNotifications();
      toast.success(`Notification sent. Delivered: ${response.data.delivered || 0}, failed: ${response.data.failed || 0}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to send notification");
    } finally {
      setPushLoading(false);
    }
  };

  const saveManualBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualBookingDraft.name.trim() || !manualBookingDraft.phone.trim() || !manualBookingDraft.repairType.trim()) {
      toast.error("Name, phone number, and service are required");
      return;
    }

    const appointmentValue = manualBookingDraft.appointmentTime?.trim() || "";
    const payload: ManualBookingRequest = {
      ...manualBookingDraft,
      preferredDate: manualBookingDraft.preferredDate || (appointmentValue ? appointmentValue.slice(0, 10) : ""),
      appointmentTime: appointmentValue ? formatDateTimeLocalInput(appointmentValue) : "",
    };

    setManualBookingLoading(true);
    try {
      const response = await axios.post<{ booking: Booking }>("/api/admin/bookings/manual", payload);
      const createdBooking = response.data.booking;
      setBookings((currentBookings) => [createdBooking, ...currentBookings].slice(0, 20));
      setManualBookingDraft(emptyManualBookingDraft);
      setManualBookingDialogOpen(false);
      setStatusFilter("ALL");
      setWorkflowFilter("ALL");
      setCurrentPage(1);
      await fetchStats();
      toast.success("Phone-call booking added to the dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to add phone-call booking");
    } finally {
      setManualBookingLoading(false);
    }
  };

  const openBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setBookingDraft({
      appointmentTime: booking.appointmentTime || "",
      quoteAmount: booking.quoteAmount || "",
      quoteNotes: booking.quoteNotes || "",
      invoiceStatus: booking.invoiceStatus || "Not issued",
      paymentStatus: booking.paymentStatus || "Not paid",
      staffAssigned: booking.staffAssigned || "",
      adminNotes: booking.adminNotes || "",
      reminderAt: booking.reminderAt || "",
      reminderWindow: booking.reminderWindow || "At selected time",
      reminderNote: booking.reminderNote || "",
    });
  };

  const saveBookingWorkflow = async () => {
    if (!selectedBooking) return;

    try {
      const response = await axios.patch(`/api/bookings/${selectedBooking.id}`, bookingDraft);
      const updatedBooking = response.data as Booking;
      setBookings((currentBookings) =>
        currentBookings.map((booking) => (booking.id === updatedBooking.id ? updatedBooking : booking)),
      );
      setSelectedBooking(updatedBooking);
      setBookingDraft({
        appointmentTime: updatedBooking.appointmentTime || "",
        quoteAmount: updatedBooking.quoteAmount || "",
        quoteNotes: updatedBooking.quoteNotes || "",
        invoiceStatus: updatedBooking.invoiceStatus || "Not issued",
        paymentStatus: updatedBooking.paymentStatus || "Not paid",
        staffAssigned: updatedBooking.staffAssigned || "",
        adminNotes: updatedBooking.adminNotes || "",
        reminderAt: updatedBooking.reminderAt || "",
        reminderWindow: updatedBooking.reminderWindow || "At selected time",
        reminderNote: updatedBooking.reminderNote || "",
      });
      await fetchStats();
      toast.success("Booking details saved");
    } catch (err) {
      toast.error("Failed to save booking details");
    }
  };

  const updateReviewStatus = async (id: string, status: ReviewStatus) => {
    try {
      await axios.patch(`/api/admin/reviews/${id}`, { status });
      await fetchReviews();
      toast.success("Review updated");
    } catch (err) {
      toast.error("Failed to update review");
    }
  };

  const deleteReview = async (id: string) => {
    try {
      await axios.delete(`/api/admin/reviews/${id}`);
      setReviews((currentReviews) => currentReviews.filter((review) => review.id !== id));
      toast.success("Review deleted");
    } catch (err) {
      toast.error("Failed to delete review");
    }
  };

  const saveContentItem = async () => {
    if (!contentDraft.title.trim()) {
      toast.error("Content title is required");
      return;
    }

    try {
      if (editingContentId) {
        await axios.patch(`/api/admin/content/${editingContentId}`, contentDraft);
        toast.success("Content updated");
      } else {
        await axios.post("/api/admin/content", contentDraft);
        toast.success("Content added");
      }
      setContentDraft(emptyContentDraft);
      setEditingContentId(null);
      await fetchContentItems();
    } catch (err) {
      toast.error("Failed to save content item");
    }
  };

  const adjustContentSortOrder = (amount: number) => {
    setContentDraft((draft) => ({
      ...draft,
      sortOrder: Math.max(0, (Number(draft.sortOrder) || 0) + amount),
    }));
  };

  const insertQuoteTemplate = () => {
    setBookingDraft((draft) => ({
      ...draft,
      quoteNotes: draft.quoteNotes?.trim() ? `${draft.quoteNotes}\n\n${quoteTemplateText}` : quoteTemplateText,
    }));
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (passwordDraft.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }

    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      await axios.post("/api/auth/change-password", {
        currentPassword: passwordDraft.currentPassword,
        newPassword: passwordDraft.newPassword,
      });
      setPasswordDraft({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordDialogOpen(false);
      toast.success("Admin password changed successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const editContentItem = (item: ContentItem) => {
    setEditingContentId(item.id);
    setContentDraft({
      category: item.category,
      title: item.title,
      description: item.description || "",
      tag: item.tag || "",
      image: item.image || "",
      accentImage: item.accentImage || "",
      items: item.items || "",
      bookingValue: item.bookingValue || "",
      sortOrder: item.sortOrder,
      active: item.active,
    });
  };

  const deleteContentItem = async (id: string) => {
    try {
      await axios.delete(`/api/admin/content/${id}`);
      setContentItems((currentItems) => currentItems.filter((item) => item.id !== id));
      toast.success("Content deleted");
    } catch (err) {
      toast.error("Failed to delete content item");
    }
  };

  const handleOwnerPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image for the owner profile.");
      return;
    }

    if (file.size > 8_000_000) {
      toast.error("Please use an image under 8MB.");
      return;
    }

    try {
      setOwnerPhotoLoading(true);
      const dataUrl = await readFileAsDataUrl(file);
      const response = await axios.post<{ url: string }>("/api/admin/media", { dataUrl, fileName: file.name });
      setOwnerPhotoDraft(response.data.url);
      toast.success("Owner photo uploaded. Save it to publish on the website.");
    } catch (err) {
      toast.error("Unable to upload the owner photo.");
    } finally {
      setOwnerPhotoLoading(false);
    }
  };

  const saveOwnerPhoto = async () => {
    if (!ownerPhotoDraft.trim()) {
      toast.error("Upload or paste an owner photo first.");
      return;
    }

    const ownerPhotoItem = contentItems.find((item) => item.category === "ownerProfile");
    const payload: ContentItemRequest = {
      category: "ownerProfile",
      title: "Richard Ampofo",
      description: "Owner profile photo for FixMyDoor Services.",
      tag: "Owner",
      image: ownerPhotoDraft.trim(),
      accentImage: "",
      items: "",
      bookingValue: "",
      sortOrder: 0,
      active: true,
    };

    try {
      setOwnerPhotoLoading(true);
      if (ownerPhotoItem) {
        await axios.patch(`/api/admin/content/${ownerPhotoItem.id}`, payload);
      } else {
        await axios.post("/api/admin/content", payload);
      }
      await fetchContentItems();
      setOwnerPhotoDialogOpen(false);
      toast.success("Owner photo updated on the website");
    } catch (err) {
      toast.error("Failed to save owner photo");
    } finally {
      setOwnerPhotoLoading(false);
    }
  };

  const handleContentImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const isDocument = /(\.pdf|\.doc|\.docx)$/i.test(file.name) || [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(file.type);

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !isDocument) {
      toast.error("Please upload an image, video, PDF, Word document, or short advert file.");
      return;
    }

    if (file.size > 20_000_000) {
      toast.error("Please use a file under 20MB.");
      return;
    }

    try {
      setContentUploadLoading(true);
      const dataUrl = await readFileAsDataUrl(file);
      const response = await axios.post<{ url: string; kind?: "image" | "video" | "document" }>("/api/admin/media", { dataUrl, fileName: file.name });
      if (response.data.kind === "document") {
        setContentDraft((draft) => ({ ...draft, items: response.data.url }));
        toast.success("Document uploaded. Save this content item and the document will appear as a clickable link in the selected website section.");
      } else {
        setContentDraft((draft) => ({ ...draft, image: response.data.url }));
        toast.success("Media uploaded. Save the content item to publish it.");
      }
    } catch (err) {
      toast.error("Unable to upload the selected media.");
    } finally {
      setContentUploadLoading(false);
    }
  };

  const exportBookings = () => {
    window.open("/api/bookings/export", "_blank");
  };

  const sendTestEmail = async () => {
    setEmailTestLoading(true);
    try {
      const response = await axios.post<{ status: EmailRuntimeStatus }>("/api/admin/email-test");
      setEmailStatus(response.data.status);
      toast.success("Test email sent to the business inbox");
    } catch (err: any) {
      if (err?.response?.data?.status) {
        setEmailStatus(err.response.data.status);
      }
      toast.error(err?.response?.data?.error || "Email test failed");
    } finally {
      setEmailTestLoading(false);
    }
  };

  const openQuoteInvoice = (bookingId: string) => {
    window.open(`/api/bookings/${bookingId}/quote`, "_blank", "noopener,noreferrer");
  };

  const updateBookingStatus = async (id: string, status: BookingStatus) => {
    setStatusUpdateLoading(id);
    try {
      const response = await axios.patch(`/api/bookings/${id}`, { status });
      const updatedBooking = response.data as Booking;
      setBookings((currentBookings) =>
        currentBookings.map((booking) => (booking.id === id ? updatedBooking : booking)),
      );
      setSelectedBooking((currentBooking) =>
        currentBooking?.id === id ? updatedBooking : currentBooking,
      );
      toast.success("Status updated and customer email was queued");
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setStatusUpdateLoading(null);
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      await axios.delete(`/api/bookings/${id}`);
      setSelectedBooking((currentBooking) => (currentBooking?.id === id ? null : currentBooking));
      await Promise.all([fetchStats(), fetchBookings()]);
      toast.success("Booking deleted successfully");
    } catch (err) {
      toast.error("Failed to delete booking");
    }
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-screen max-w-full flex-col items-center justify-center overflow-x-hidden bg-gradient-to-br from-[#f7efe5] via-white to-[#f3dfc7] px-4 py-8 text-center">
        <Card className="w-full max-w-md overflow-hidden border-[#dec4a3] bg-white/95 shadow-[0_24px_70px_rgba(66,40,18,0.14)]">
          <CardHeader className="items-center px-4 pb-4 pt-6 text-center sm:px-6">
            <div className="relative mx-auto mb-2 inline-flex items-center justify-center overflow-hidden rounded-[22px] border border-[#d6b88c] bg-[#FAF6F0] px-4 py-3 shadow-[0_18px_42px_rgba(66,40,18,0.16)] ring-1 ring-white/80 sm:px-5 sm:py-4">
              <div className="pointer-events-none absolute inset-x-4 top-2 h-1 rounded-full bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
              <img
                src="/img5150-transparent.png"
                alt="FixMyDoor logo"
                className="relative block h-auto w-[230px] max-w-[78vw] object-contain drop-shadow-[0_10px_18px_rgba(66,40,18,0.16)] sm:w-[260px]"
              />
            </div>
            <CardTitle className="mt-3 text-2xl font-display text-secondary">Admin Login</CardTitle>
            <p className="max-w-xs text-sm text-muted-foreground">
              FixMyDoor Services booking dashboard for customer requests, reviews, service content, and follow-up.
            </p>
            <Button
              type="button"
              onClick={installAdminApp}
              variant="outline"
              className="mt-3 h-10 rounded-2xl border-[#d6b88c] bg-white px-4 text-xs font-black text-secondary shadow-sm hover:border-primary hover:text-primary"
            >
              <Download className="mr-2 h-4 w-4" />
              {adminStandalone ? "Admin App Open" : "Install Admin App"}
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#8a5a2d] underline-offset-4 transition hover:text-primary hover:underline"
                  >
                    <KeyRound className="h-4 w-4" />
                    Forgot password?
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Forgot admin password?</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                    <p>
                      For security, the admin password cannot be reset from this public login page.
                    </p>
                    <p>
                      Use the current admin account to change it inside the dashboard, or update the admin password securely from the website server environment.
                    </p>
                    <a
                      href="mailto:info.fixmydoor@gmail.com?subject=FixMyDoor%20Services%20admin%20password%20help"
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 font-bold text-white transition hover:bg-primary/90"
                    >
                      <Mail className="h-4 w-4" />
                      Contact FixMyDoor Services support
                    </a>
                  </div>
                </DialogContent>
              </Dialog>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen max-w-full items-center justify-center overflow-x-hidden bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading bookings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen max-w-full items-center justify-center overflow-x-hidden bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchBookings}>Try Again</Button>
        </div>
      </div>
    );
  }

  const statsCards = stats ? [
    { label: "Total", value: stats.totalBookings, color: "text-secondary", action: { status: "ALL", workflow: "ALL" } },
    { label: "Pending", value: stats.pendingBookings, color: "text-yellow-700", action: { status: "PENDING", workflow: "ALL" } },
    { label: "Reminders", value: stats.dueReminderBookings || 0, color: "text-rose-700", action: { status: "ALL", workflow: "REMINDERS" } },
    { label: "Urgent", value: stats.urgentBookings, color: "text-red-600", action: { status: "ALL", workflow: "URGENT" } },
    { label: "This Week", value: stats.thisWeekBookings, color: "text-blue-700", action: { status: "ALL", workflow: "THIS_WEEK" } },
    { label: "Completed", value: stats.completedBookings, color: "text-green-700", action: { status: "COMPLETED", workflow: "ALL" } },
  ] : [];

  const quickBookingFilters = [
    { label: "All", action: { status: "ALL", workflow: "ALL" } },
    { label: "Today", action: { status: "ALL", workflow: "TODAY" } },
    { label: "Week", action: { status: "ALL", workflow: "THIS_WEEK" } },
    { label: "Urgent", action: { status: "ALL", workflow: "URGENT" } },
    { label: "Reminders", action: { status: "ALL", workflow: "REMINDERS" } },
    { label: "Pending", action: { status: "PENDING", workflow: "ALL" } },
    { label: "Needs Quote", action: { status: "ALL", workflow: "NEEDS_QUOTE" } },
  ];
  const reminderWatchBookings: Booking[] = Array.isArray(stats?.recentReminderBookings)
    ? stats.recentReminderBookings.slice(0, 3)
    : [];
  const reminderWatchKey = reminderWatchBookings
    .map((booking) => `${booking.id}:${booking.reminderAt || ""}:${booking.status}`)
    .join("|");
  const showReminderWatch = reminderWatchBookings.length > 0 && reminderWatchKey !== dismissedReminderWatchKey;

  return (
    <div className="admin-dashboard-shell min-h-screen max-w-full overflow-x-hidden bg-[#f7efe4]">
      <div className="container mx-auto w-full max-w-[1320px] min-w-0 overflow-x-hidden px-3 py-4 sm:px-4 md:py-8">
        <div className="relative mb-4 overflow-hidden rounded-[24px] border border-[#ead8bf] bg-white/90 p-4 text-center shadow-[0_24px_70px_rgba(66,40,18,0.10)] md:mb-6 md:rounded-3xl md:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#6B4423] via-[#D4A574] to-[#6B4423]" />
          <div className="mx-auto flex max-w-xl flex-col items-center gap-2.5 md:gap-3">
            <div className="relative overflow-hidden rounded-[22px] border border-[#d6b88c] bg-[#FAF6F0] px-4 py-3 shadow-[0_18px_42px_rgba(66,40,18,0.14)] ring-1 ring-white/80 md:px-6 md:py-4">
              <div className="pointer-events-none absolute inset-x-4 top-2 h-1 rounded-full bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
              <img
                src="/img5150-transparent.png"
                alt="FixMyDoor logo"
                className="relative h-auto w-[230px] max-w-[76vw] object-contain drop-shadow-[0_10px_18px_rgba(66,40,18,0.16)] md:w-[280px]"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a5a2d] md:text-sm md:tracking-[0.22em]">
                FixMyDoor Services
              </p>
              <h1 className="text-2xl font-display font-bold text-secondary md:text-4xl">
                Admin Dashboard
              </h1>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-foreground/70 md:text-base">
                Manage bookings, customer requests, reviews, website content, and alerts.
              </p>
            </div>
          </div>
          <div className="mx-auto mt-4 grid w-full max-w-[34rem] grid-cols-2 gap-2 rounded-[22px] border border-[#ead8bf] bg-[#fffaf2]/90 p-2 shadow-[0_16px_38px_rgba(66,40,18,0.12)] md:max-w-[45rem] md:grid-cols-4">
            <Button type="button" onClick={installAdminApp} variant="outline" className="h-10 justify-center rounded-2xl bg-white/95 px-2 text-xs font-black shadow-sm sm:text-sm">
              <Download className="w-4 h-4 mr-2" />
              <span>{adminStandalone ? "App Open" : "Install App"}</span>
            </Button>
            <Button
              type="button"
              onClick={enableAdminNotifications}
              variant={adminNotificationsEnabled ? "default" : "outline"}
              className={`h-10 justify-center rounded-2xl px-2 text-xs font-black shadow-sm sm:text-sm ${adminNotificationsEnabled ? "bg-[#6B4423] text-white hover:bg-[#543218]" : "bg-white/95"}`}
              disabled={adminNotificationLoading}
            >
              <Bell className="w-4 h-4 mr-2" />
              {adminNotificationLoading ? "Enabling..." : adminNotificationsEnabled ? "Alerts On" : "Alerts"}
            </Button>
            <Button type="button" onClick={refreshDashboard} variant="outline" className="h-10 justify-center rounded-2xl bg-white/95 px-2 text-xs font-black shadow-sm sm:text-sm" disabled={dashboardRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${dashboardRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={handleLogout} variant="outline" className="h-10 justify-center rounded-2xl bg-white/95 text-xs font-black shadow-sm sm:text-sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="sticky top-2 z-20 mb-4 grid grid-cols-4 gap-1.5 rounded-2xl border border-[#ead8bf] bg-white/95 p-1.5 shadow-[0_14px_35px_rgba(66,40,18,0.12)] backdrop-blur md:hidden">
          {[
            ["Jobs", "booking-requests"],
            ["Alerts", "push-notification-manager"],
            ["Content", "website-content-manager"],
            ["Reviews", "review-moderation"],
          ].map(([label, target]) => (
            <button
              key={target}
              type="button"
              onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-xl bg-[#fff6ea] px-2 py-2 text-[0.68rem] font-black text-[#6B4423]"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stats Dashboard */}
        {stats && (
          <div className="mb-4 grid grid-cols-3 gap-1.5 md:mb-6 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
            {statsCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => applyQuickBookingFilter(card.action)}
                className="rounded-2xl border border-[#ead8bf] bg-white px-2.5 py-2 text-left shadow-sm transition active:scale-[0.98] md:rounded-xl md:px-4 md:py-4"
              >
                <span className="block text-[0.64rem] font-bold uppercase tracking-[0.1em] text-muted-foreground md:text-xs">{card.label}</span>
                <span className={`mt-0.5 block text-lg font-black leading-none md:mt-2 md:text-2xl ${card.color}`}>{card.value}</span>
              </button>
            ))}
          </div>
        )}

        {showReminderWatch && (
          <Card className="mb-4 border-[#e7c7b5] bg-[#fff7f0] shadow-sm md:mb-6">
            <CardContent className="p-3 md:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-700">Reminder Watch</p>
                  <h2 className="mt-1 text-lg font-display font-bold text-secondary">Upcoming jobs and follow-ups</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    These are admin-only reminders. A red badge means the job or follow-up needs attention now.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-9 bg-white text-xs font-bold" onClick={() => applyQuickBookingFilter({ status: "ALL", workflow: "REMINDERS" })}>
                    View reminders due now
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 bg-white text-xs font-bold text-rose-700 hover:text-rose-800"
                    onClick={() => dismissReminderWatch(reminderWatchKey)}
                    aria-label="Close Reminder Watch"
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Close
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {reminderWatchBookings.map((booking: Booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => applyQuickBookingFilter({ status: "ALL", workflow: "REMINDERS" })}
                    className={`rounded-2xl border bg-white p-3 text-left shadow-sm ${isJobWithinTwoHours(booking) || isReminderDueForAdmin(booking) ? "border-rose-200" : "border-[#ead8bf]"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-secondary">{booking.name}</p>
                        <p className="mt-0.5 text-[0.68rem] font-bold text-primary">{formatBookingDisplayId(booking)}</p>
                      </div>
                      <Badge className={isJobWithinTwoHours(booking) || isReminderDueForAdmin(booking) ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}>
                        {getReminderBadgeText(booking)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-foreground/75">{formatReminderDisplay(booking.reminderAt)}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{getReminderCardMessage(booking)}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-4 border-[#ead8bf] bg-[#fffaf2] shadow-sm md:mb-6">
          <CardContent className="grid gap-4 p-3 md:p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a5a2d]">Owner Controls</p>
                <h2 className="mt-1 text-lg font-display font-bold leading-tight text-secondary md:text-xl">Manage security, email, bookings, and website content</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
                  Use these quick actions first, then review Recent Bookings and Booking Requests below.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
                <Dialog open={ownerPhotoDialogOpen} onOpenChange={setOwnerPhotoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="h-10 bg-white px-2 text-xs md:text-sm">
                      <ImageIcon className="mr-1.5 h-4 w-4" />
                      Owner Photo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[88vh] w-[calc(100vw-1rem)] max-w-lg overflow-x-hidden overflow-y-auto rounded-2xl p-4">
                    <DialogHeader>
                      <DialogTitle>Change Website Owner Photo</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="rounded-2xl border border-[#ead8bf] bg-[#fffaf2] p-3 text-xs leading-relaxed text-muted-foreground">
                        This changes the Richard Ampofo picture in the homepage expert section. Use a clear professional image for trust.
                      </div>
                      <div className="overflow-hidden rounded-3xl border border-[#ead8bf] bg-white shadow-sm">
                        {ownerPhotoDraft ? (
                          <img src={ownerPhotoDraft} alt="Owner profile preview" className="h-64 w-full object-cover object-top" />
                        ) : (
                          <div className="flex h-48 items-center justify-center bg-[#f7efe4] text-sm font-bold text-muted-foreground">
                            No owner photo selected
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="owner-photo-url">Owner Photo URL</Label>
                        <Input
                          id="owner-photo-url"
                          value={ownerPhotoDraft}
                          onChange={(event) => setOwnerPhotoDraft(event.target.value)}
                          placeholder="/uploads/photo.jpg"
                          className="mt-1"
                        />
                      </div>
                      <label htmlFor="owner-photo-upload" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/25 bg-white p-4 text-center">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Upload className="h-5 w-5" />
                        </span>
                        <span className="font-semibold text-foreground">{ownerPhotoLoading ? "Uploading..." : "Upload new owner photo"}</span>
                        <span className="text-xs text-muted-foreground">Image only. Use a clean photo under 8MB.</span>
                      </label>
                      <Input id="owner-photo-upload" type="file" accept="image/*" className="sr-only" onChange={handleOwnerPhotoUpload} disabled={ownerPhotoLoading} />
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" className="bg-white" onClick={() => setOwnerPhotoDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={saveOwnerPhoto} disabled={ownerPhotoLoading}>
                          {ownerPhotoLoading ? "Saving..." : "Save Photo"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={manualBookingDialogOpen} onOpenChange={setManualBookingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" className="h-10 bg-[#6B4423] px-2 text-xs text-white hover:bg-[#543218] md:text-sm">
                      <Phone className="mr-1.5 h-4 w-4" />
                      Add Call Job
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[88vh] w-[calc(100vw-1rem)] max-w-2xl overflow-x-hidden overflow-y-auto rounded-2xl p-4">
                    <DialogHeader>
                      <DialogTitle>Add Phone-Call Booking</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveManualBooking} className="grid gap-3">
                      <div className="rounded-2xl border border-[#ead8bf] bg-[#fffaf2] p-3 text-xs leading-relaxed text-muted-foreground">
                        Use this when a customer calls instead of using the website form. It will appear in Booking Requests like a normal website request.
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="manual-booking-name">Customer Name</Label>
                          <Input
                            id="manual-booking-name"
                            value={manualBookingDraft.name}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, name: event.target.value }))}
                            placeholder="Customer name"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="manual-booking-phone">Phone Number</Label>
                          <Input
                            id="manual-booking-phone"
                            value={manualBookingDraft.phone}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, phone: event.target.value }))}
                            placeholder="+1 438..."
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="manual-booking-email">Email Optional</Label>
                          <Input
                            id="manual-booking-email"
                            type="email"
                            value={manualBookingDraft.email || ""}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, email: event.target.value }))}
                            placeholder="customer@email.com"
                          />
                        </div>
                        <div>
                          <Label>Service Needed</Label>
                          <Select value={manualBookingDraft.repairType} onValueChange={(value) => setManualBookingDraft((draft) => ({ ...draft, repairType: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {serviceCatalog.filter((service) => service.showInBooking).map((service) => (
                                <SelectItem key={service.bookingValue} value={service.bookingValue}>{service.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="manual-booking-appointment">Appointment Date & Time</Label>
                          <Input
                            id="manual-booking-appointment"
                            type="datetime-local"
                            value={manualBookingDraft.appointmentTime || ""}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, appointmentTime: event.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Urgency</Label>
                          <Select value={manualBookingDraft.urgency || "Normal"} onValueChange={(value) => setManualBookingDraft((draft) => ({ ...draft, urgency: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Normal">Normal</SelectItem>
                              <SelectItem value="Urgent">Urgent</SelectItem>
                              <SelectItem value="Emergency">Emergency</SelectItem>
                              <SelectItem value="Weekend follow-up">Weekend follow-up</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="manual-booking-city">City</Label>
                          <Input
                            id="manual-booking-city"
                            value={manualBookingDraft.city || ""}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, city: event.target.value }))}
                            placeholder="Montreal"
                          />
                        </div>
                        <div>
                          <Label htmlFor="manual-booking-country">Country</Label>
                          <Input
                            id="manual-booking-country"
                            value={manualBookingDraft.country || ""}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, country: event.target.value }))}
                            placeholder="Canada"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor="manual-booking-address">Address Optional</Label>
                          <Input
                            id="manual-booking-address"
                            value={manualBookingDraft.address || ""}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, address: event.target.value }))}
                            placeholder="Customer address or area"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor="manual-booking-message">Call Notes</Label>
                          <Textarea
                            id="manual-booking-message"
                            value={manualBookingDraft.message || ""}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, message: event.target.value }))}
                            placeholder="What did the customer ask for?"
                            className="min-h-20"
                          />
                        </div>
                        <label className="flex items-start gap-2 rounded-2xl border border-[#ead8bf] bg-white p-3 text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4"
                            checked={manualBookingDraft.customerConsent === true}
                            onChange={(event) => setManualBookingDraft((draft) => ({ ...draft, customerConsent: event.target.checked }))}
                          />
                          <span>Customer agreed that FixMyDoor Services can contact them about this request and future service updates.</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" className="bg-white" onClick={() => setManualBookingDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={manualBookingLoading}>
                          {manualBookingLoading ? "Saving..." : "Save Call Job"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" className="h-10 bg-[#8a5a2d] px-2 text-xs text-white hover:bg-[#71451f] md:text-sm">
                      <KeyRound className="mr-1.5 h-4 w-4" />
                      <span className="sm:hidden">Password</span>
                      <span className="hidden sm:inline">Change Password</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Change Admin Password</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={changePassword} className="space-y-4">
                      <div>
                        <Label htmlFor="current-admin-password">Current Password</Label>
                        <Input
                          id="current-admin-password"
                          type="password"
                          value={passwordDraft.currentPassword}
                          onChange={(event) => setPasswordDraft((draft) => ({ ...draft, currentPassword: event.target.value }))}
                          autoComplete="current-password"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-admin-password">New Password</Label>
                        <Input
                          id="new-admin-password"
                          type="password"
                          value={passwordDraft.newPassword}
                          onChange={(event) => setPasswordDraft((draft) => ({ ...draft, newPassword: event.target.value }))}
                          autoComplete="new-password"
                          minLength={8}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirm-admin-password">Confirm New Password</Label>
                        <Input
                          id="confirm-admin-password"
                          type="password"
                          value={passwordDraft.confirmPassword}
                          onChange={(event) => setPasswordDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))}
                          autoComplete="new-password"
                          minLength={8}
                          required
                        />
                      </div>
                      <Button type="submit" disabled={passwordLoading} className="w-full">
                        {passwordLoading ? "Saving..." : "Update Admin Password"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button type="button" variant="outline" onClick={sendTestEmail} disabled={emailTestLoading} className="h-10 bg-white px-2 text-xs md:text-sm">
                  <Mail className="mr-1.5 h-4 w-4" />
                  {emailTestLoading ? "Testing..." : "Test Email"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 bg-white px-2 text-xs md:text-sm"
                  onClick={() => document.getElementById("push-notification-manager")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  <Bell className="mr-1.5 h-4 w-4" />
                  Notifications
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 bg-white px-2 text-xs md:text-sm"
                  onClick={() => document.getElementById("website-content-manager")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  Content
                </Button>
              </div>
            </div>
            {emailStatus && (
              <div className={`overflow-hidden rounded-2xl border p-3 text-xs leading-relaxed md:p-4 md:text-sm ${emailStatus.configured && emailStatus.verified ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold">
                      Email status: {getEmailStatusLabel(emailStatus)}
                    </p>
                    <p className="mt-1 break-words">
                      Provider: {emailStatus.provider.toUpperCase()} | SMTP: {emailStatus.host || "missing"}{emailStatus.port ? `:${emailStatus.port}` : ""} | User: {emailStatus.smtpUser || "missing"} | Resend: {emailStatus.resendConfigured ? "configured" : "not set"} | Admin: {emailStatus.adminEmail}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchEmailStatus(true)}
                    disabled={emailStatusLoading}
                  >
                    {emailStatusLoading ? "Refreshing..." : "Refresh Email Status"}
                  </Button>
                </div>
                {emailStatus.missing.length > 0 && (
                  <p className="mt-2 font-semibold">Missing in Railway: {emailStatus.missing.join(", ")}</p>
                )}
                {(emailStatus.lastVerifyError || emailStatus.lastSendError) && (
                  <p className="mt-2 break-words">
                    {emailStatus.lastVerifyError || emailStatus.lastSendError}
                  </p>
                )}
                <p className="mt-2 text-xs">
                  Links: {emailStatus.publicBaseUrl} | Admin: {emailStatus.adminDashboardUrl}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="push-notification-manager" className="mb-4 scroll-mt-8 border-[#ead8bf] bg-white shadow-sm md:mb-6">
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a5a2d]">Push Notifications</p>
                <CardTitle className="mt-1 text-xl font-display text-secondary md:text-2xl">Send update to subscribers</CardTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
                  {pushSubscriberCount} unique device{pushSubscriberCount === 1 ? "" : "s"} subscribed. Audience tags: {visitorSubscriberCount} visitor{visitorSubscriberCount === 1 ? "" : "s"} and {adminSubscriberCount} admin device{adminSubscriberCount === 1 ? "" : "s"}. A device is counted once even if it logs in many times.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button type="button" onClick={enableAdminNotifications} disabled={adminNotificationLoading} className="h-10 bg-[#6B4423] px-2 text-xs text-white hover:bg-[#543218] md:text-sm">
                  <Bell className="mr-2 h-4 w-4" />
                  {adminNotificationsEnabled ? "Alerts On" : "Admin Alerts"}
                </Button>
                <Button type="button" variant="outline" onClick={() => fetchPushNotifications(true)} className="h-10 bg-white px-2 text-xs md:text-sm" disabled={pushRefreshLoading}>
                  <RefreshCw className={`mr-1.5 h-4 w-4 ${pushRefreshLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 pt-0 md:p-6 md:pt-0 lg:grid-cols-[0.7fr_1.3fr]">
            <form onSubmit={sendPushNotification} className="space-y-3 rounded-2xl border border-primary/10 bg-[#fffaf2] p-3 md:space-y-4 md:p-4">
              <div className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-muted-foreground shadow-sm">
                Use this sender for social media posts too. Visitor notifications also email previous customers who agreed to be contacted. Admin-only alerts stay inside the admin side.
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Website Update", "We added a new FixMyDoor Services update. Tap to view the latest."],
                  ["New Social Post", "FixMyDoor Services has a new post online. Visit the website for the latest update."],
                  ["New Offer", "A new FixMyDoor Services advert or service offer is available now."],
                ].map(([title, message]) => (
                  <Button
                    key={title}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-9 whitespace-normal bg-white px-2 py-2 text-[0.68rem] leading-tight sm:text-xs"
                    onClick={() => {
                      setPushTitle(title);
                      setPushMessage(message);
                    }}
                  >
                    {title}
                  </Button>
                ))}
              </div>
              <div>
                <Label htmlFor="push-title">Title</Label>
                <Input
                  id="push-title"
                  value={pushTitle}
                  onChange={(event) => setPushTitle(event.target.value)}
                  maxLength={90}
                  placeholder="New FixMyDoor update"
                />
              </div>
              <div>
                <Label htmlFor="push-message">Message</Label>
                <Textarea
                  id="push-message"
                  value={pushMessage}
                  onChange={(event) => setPushMessage(event.target.value)}
                  maxLength={240}
                  rows={4}
                  placeholder="Write the message customers should receive..."
                />
              </div>
              <Button type="submit" className="w-full bg-[#8a5a2d] text-white hover:bg-[#71451f]" disabled={pushLoading}>
                <Send className="mr-2 h-4 w-4" />
                {pushLoading ? "Sending..." : "Send Notification"}
              </Button>
            </form>
            <div className="rounded-2xl border border-primary/10 bg-background p-3 md:p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-secondary md:text-base">Recent notification log</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => fetchPushNotifications(true)} disabled={pushRefreshLoading} className="h-8 px-2 text-xs">
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${pushRefreshLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              {pushNotifications.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No push notifications have been sent yet.</p>
              ) : (
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {pushNotifications.slice(0, 8).map((notification) => (
                    <div key={notification.id} className="rounded-xl bg-white p-2.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-secondary">{notification.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{notification.message}</p>
                        </div>
                        <Badge variant={notification.failed > 0 ? "secondary" : "default"} className="shrink-0 text-[0.65rem]">
                          {notification.delivered} devices
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
                        {new Date(notification.sentAt).toLocaleString()} | Audience: {notification.audience || "all"} | Failed: {notification.failed}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        {stats?.recentBookings && stats.recentBookings.length > 0 && (
          <Card className="mb-4 border-[#ead8bf] bg-white shadow-sm md:mb-6">
            <CardHeader className="p-3 pb-2 md:p-6 md:pb-3">
              <CardTitle className="text-base md:text-xl">Recent Bookings</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {stats.recentBookings.slice(0, 6).map((booking: any) => (
                  <div key={booking.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-secondary">{booking.name}</p>
                      <p className="truncate text-[0.68rem] font-bold text-primary">{formatBookingDisplayId(booking)}</p>
                      <p className="truncate text-xs text-muted-foreground">{booking.repairType}</p>
                    </div>
                    <Badge variant={booking.status === "PENDING" ? "secondary" : booking.status === "COMPLETED" ? "default" : "outline"} className="shrink-0 text-[0.65rem]">
                      {booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-2xl border border-[#ead8bf] bg-white p-1.5 shadow-sm sm:grid-cols-6 lg:mb-4">
          {quickBookingFilters.map((filter) => {
            const isActive = statusFilter === filter.action.status && workflowFilter === filter.action.workflow;
            return (
              <button
                key={filter.label}
                type="button"
                onClick={() => applyQuickBookingFilter(filter.action)}
                className={`rounded-xl px-2 py-2 text-[0.68rem] font-black transition sm:text-xs ${isActive ? "bg-[#6B4423] text-white shadow-sm" : "bg-[#fff6ea] text-[#6B4423]"}`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="mb-4 grid gap-2 lg:mb-6 lg:grid-cols-[1fr_auto_auto_auto] lg:gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_rgba(66,40,18,0.12)] ring-1 ring-primary/18">
                <img src="/fixmydoor-door-spanner-mark.png" alt="FixMyDoor search logo" className="h-7 w-7 object-contain" />
              </span>
              <Input
                placeholder="Search by name, email, phone, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 rounded-full border-primary/20 bg-white pl-14 shadow-sm focus-visible:ring-primary/35"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
            <SelectTrigger className="w-full bg-white lg:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={workflowFilter} onValueChange={(value) => { setWorkflowFilter(value); setCurrentPage(1); }}>
            <SelectTrigger className="w-full bg-white lg:w-56">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Workflow filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Workflows</SelectItem>
              <SelectItem value="TODAY">Today</SelectItem>
              <SelectItem value="THIS_WEEK">This Week</SelectItem>
              <SelectItem value="INTERNATIONAL">International Requests</SelectItem>
              <SelectItem value="URGENT">Urgent / Emergency</SelectItem>
              <SelectItem value="REMINDERS">Due Reminders</SelectItem>
              <SelectItem value="NEEDS_QUOTE">Needs Quote</SelectItem>
              <SelectItem value="QUOTED">Quoted</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="PAYMENT_PENDING">Payment Pending</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={exportBookings} className="h-11 bg-white lg:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card id="booking-requests" className="scroll-mt-20 border-[#ead8bf] bg-white shadow-sm md:scroll-mt-8">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Booking Requests ({bookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            {bookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No bookings found.
              </p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                {bookings.map((booking) => (
                  <article key={`mobile-${booking.id}`} className="rounded-2xl border border-[#ead8bf] bg-[#fffaf2] p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-secondary">{booking.name}</h3>
                        <p className="mt-0.5 truncate text-[0.68rem] font-black text-primary">{formatBookingDisplayId(booking)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{booking.repairType}</p>
                      </div>
                      <Badge className={`${statusColors[booking.status]} shrink-0 text-[0.65rem]`}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-foreground/75">
                      <a href={`tel:${normalizePhoneForMessaging(booking.phone, booking.country || booking.address) || booking.phone}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-secondary">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        {normalizePhoneForMessaging(booking.phone, booking.country || booking.address) || booking.phone}
                      </a>
                      <a href={hasBookingEmail(booking) ? `mailto:${booking.email}` : undefined} className={`flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold ${hasBookingEmail(booking) ? "text-secondary" : "pointer-events-none text-muted-foreground"}`}>
                        <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{getBookingEmailLabel(booking)}</span>
                      </a>
                      <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="line-clamp-2">{booking.address}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {[
                        ["Requested", formatPreferredDate(booking.preferredDate)],
                        ["Appointment", booking.appointmentTime || "Not set"],
                        ["Reminder", formatReminderDisplay(booking.reminderAt)],
                        ["Quote", booking.quoteAmount || "Not quoted"],
                        ["Payment", booking.paymentStatus || "Not paid"],
                        ["Urgency", booking.urgency || "Standard"],
                      ].map(([label, value]) => (
                        <div key={`${booking.id}-${label}`} className="min-w-0 rounded-xl bg-white px-3 py-2">
                          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                          <p className={`mt-0.5 truncate font-semibold ${label === "Reminder" && isReminderDueForAdmin(booking) ? "text-rose-700" : "text-secondary"}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Select
                        value={booking.status}
                        onValueChange={(value: BookingStatus) => updateBookingStatus(booking.id, value)}
                        disabled={statusUpdateLoading === booking.id}
                      >
                        <SelectTrigger className="h-10 w-full bg-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      {getAdminToClientWhatsAppUrl(booking) ? (
                        <a
                          href={getAdminToClientWhatsAppUrl(booking)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-green-600 px-2 text-xs font-bold text-white transition hover:bg-green-700"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      ) : (
                        <Button type="button" variant="outline" className="h-10 bg-white text-xs" disabled>
                          No WhatsApp
                        </Button>
                      )}
                      {getAdminToClientSmsUrl(booking) ? (
                        <a
                          href={getAdminToClientSmsUrl(booking)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#6B4423] px-2 text-xs font-bold text-white transition hover:bg-[#543218]"
                        >
                          <Phone className="h-4 w-4" />
                          SMS
                        </a>
                      ) : (
                        <Button type="button" variant="outline" className="h-10 bg-white text-xs" disabled>
                          No SMS
                        </Button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-10 bg-white text-xs" onClick={() => openBooking(booking)}>
                            <Eye className="mr-1.5 h-4 w-4" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[88vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto rounded-2xl p-4">
                          <DialogHeader>
                            <DialogTitle className="text-lg">Booking Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="rounded-2xl bg-[#fffaf2] p-3">
                              <p className="font-bold text-secondary">{booking.name}</p>
                              <p className="mt-1 text-xs font-black text-primary">{formatBookingDisplayId(booking)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Submitted: {new Date(booking.createdAt).toLocaleString()}</p>
                            </div>
                            <div className="grid gap-2 text-sm sm:grid-cols-2">
                              <div className="rounded-xl border bg-white p-3">
                                <p className="text-xs font-semibold text-muted-foreground">Service</p>
                                <p className="mt-1 font-semibold">{booking.repairType}</p>
                              </div>
                              <div className="rounded-xl border bg-white p-3">
                                <p className="text-xs font-semibold text-muted-foreground">Date</p>
                                <p className="mt-1 font-semibold">{formatPreferredDate(booking.preferredDate)}</p>
                              </div>
                              <div className="rounded-xl border bg-white p-3 sm:col-span-2">
                                <p className="text-xs font-semibold text-muted-foreground">Address</p>
                                <p className="mt-1 font-semibold">{booking.address}</p>
                              </div>
                            </div>
                            {booking.message && (
                              <div className="rounded-xl border bg-white p-3">
                                <p className="text-xs font-semibold text-muted-foreground">Message</p>
                                <p className="mt-1 text-sm leading-relaxed">{booking.message}</p>
                              </div>
                            )}
                            {(booking.dimensions || booking.quantity || booking.material || booking.color || booking.swingDirection || booking.deliveryNeeded || booking.installationNeeded || booking.budget) && (
                              <div className="rounded-xl border bg-white p-3">
                                <p className="text-xs font-semibold text-muted-foreground">Product / Job Details</p>
                                <div className="mt-2 grid gap-2 text-sm">
                                  {[
                                    ["Measurements", booking.dimensions],
                                    ["Quantity", booking.quantity],
                                    ["Material", booking.material],
                                    ["Color", booking.color],
                                    ["Swing", booking.swingDirection],
                                    ["Delivery", booking.deliveryNeeded],
                                    ["Installation", booking.installationNeeded],
                                    ["Budget", booking.budget],
                                  ].filter(([, value]) => value).map(([label, value]) => (
                                    <p key={label} className="grid gap-1 rounded-lg bg-muted/40 px-2 py-1.5 sm:grid-cols-[0.8fr_1.2fr]">
                                      <span className="text-muted-foreground">{label}</span>
                                      <span className="font-semibold sm:text-right">{value}</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="rounded-xl border bg-white p-3">
                              <p className="text-xs font-semibold text-muted-foreground">Quick Client Messages</p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {quickMessageTemplates.map((template) => {
                                  const messageText = template.message(booking);
                                  const messageUrl = getAdminToClientWhatsAppUrl(booking, messageText);
                                  const smsUrl = getAdminToClientSmsUrl(booking, messageText);
                                  return (
                                    <div key={`${booking.id}-${template.label}`} className="grid grid-cols-2 gap-1">
                                      <a
                                        href={messageUrl || undefined}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`inline-flex h-9 items-center justify-center rounded-lg px-2 text-[0.68rem] font-bold ${messageUrl ? "bg-green-600 text-white" : "pointer-events-none bg-muted text-muted-foreground"}`}
                                      >
                                        WA {template.label}
                                      </a>
                                      <a
                                        href={smsUrl || undefined}
                                        className={`inline-flex h-9 items-center justify-center rounded-lg px-2 text-[0.68rem] font-bold ${smsUrl ? "bg-[#6B4423] text-white" : "pointer-events-none bg-muted text-muted-foreground"}`}
                                      >
                                        SMS
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {booking.photos && booking.photos.length > 0 && (
                              <div>
                                <Label>Customer Photos</Label>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {booking.photos.map((photo, index) => (
                                    <img key={`${booking.id}-mobile-photo-${index}`} src={photo} alt={`Booking photo ${index + 1}`} className="h-28 w-full rounded-xl object-cover" />
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="rounded-2xl border border-[#ead8bf] bg-white p-3 shadow-sm">
                              <div className="mb-3 rounded-xl bg-[#fffaf2] p-3">
                                <div>
                                  <Label>Admin Workflow</Label>
                                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    Set the appointment, quote, invoice status, payment status, assigned staff, and private notes from your phone.
                                  </p>
                                  <details className="mt-2 rounded-xl border border-primary/10 bg-white px-3 py-2 text-xs">
                                    <summary className="cursor-pointer font-bold text-secondary">Example formats</summary>
                                    <div className="mt-2 grid gap-2 text-muted-foreground">
                                      {workflowExamples.map(([label, example]) => (
                                        <p key={label}><strong className="text-secondary">{label}:</strong> {example}</p>
                                      ))}
                                    </div>
                                  </details>
                                </div>
                                <Button type="button" size="sm" onClick={saveBookingWorkflow} className="mt-3 w-full">
                                  <Save className="mr-1.5 h-4 w-4" />
                                  Save Details
                                </Button>
                              </div>
                              <div className="grid gap-2">
                                <div>
                                  <Label htmlFor={`appointment-${booking.id}`}>Appointment Date & Time</Label>
                                  <Input
                                    id={`appointment-${booking.id}`}
                                    type="datetime-local"
                                    value={toDateTimeLocalInputValue(bookingDraft.appointmentTime)}
                                    onChange={(event) => setBookingDraft((draft) => applyAppointmentToDraft(draft, event.target.value, booking.repairType))}
                                    className="bg-white"
                                  />
                                </div>
                                <div className="rounded-2xl border border-rose-100 bg-[#fff7f0] p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <Label htmlFor={`reminder-${booking.id}`}>Admin Job Reminder</Label>
                                      <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
                                        Choose the appointment first. The reminder is recalculated for 2 hours before that visit so the timing stays correct.
                                      </p>
                                    </div>
                                    {bookingDraft.reminderAt && (
                                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[0.68rem]" onClick={() => setBookingDraft((draft) => ({ ...draft, reminderAt: "", reminderNote: "", reminderWindow: "At selected time" }))}>
                                        Clear
                                      </Button>
                                    )}
                                  </div>
                                  <details className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[0.68rem] leading-relaxed text-muted-foreground">
                                    <summary className="cursor-pointer font-black text-rose-700">How this reminder works</summary>
                                    <div className="mt-2 grid gap-1">
                                      {reminderHelpSteps.map((step, index) => (
                                        <p key={step}><strong className="text-rose-700">{index + 1}.</strong> {step}</p>
                                      ))}
                                    </div>
                                    <div className="mt-2 grid gap-1 border-t border-rose-100 pt-2">
                                      <p className="font-black text-rose-700">Reminder type meanings</p>
                                      {reminderTypeDescriptions.map(([label, description]) => (
                                        <p key={label}><strong className="text-foreground">{label}:</strong> {description}</p>
                                      ))}
                                    </div>
                                  </details>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <Label className="text-[0.7rem]">Reminder Time</Label>
                                      <Input
                                        id={`reminder-${booking.id}`}
                                        type="datetime-local"
                                        value={toDateTimeLocalInputValue(bookingDraft.reminderAt)}
                                        onChange={(event) => setBookingDraft((draft) => ({ ...draft, reminderAt: toIsoDateTimeInputValue(event.target.value) }))}
                                        className="mt-1 bg-white"
                                      />
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <div>
                                        <Label className="text-[0.7rem]">Reminder Type</Label>
                                        <Select value={bookingDraft.reminderWindow || "At selected time"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, reminderWindow: value }))}>
                                          <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {reminderWindowOptions.map((option) => (
                                              <SelectItem key={option} value={option}>{option}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-[0.7rem]">Message</Label>
                                        <Input
                                          value={bookingDraft.reminderNote || ""}
                                          onChange={(event) => setBookingDraft((draft) => ({ ...draft, reminderNote: event.target.value }))}
                                          placeholder="Job follow-up"
                                          className="mt-1 bg-white"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
                                    This reminder is only for admin. It helps you prepare before the job and avoid forgetting the customer.
                                  </p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <Label>Quote Amount</Label>
                                    <Input
                                      value={bookingDraft.quoteAmount || ""}
                                      onChange={(event) => setBookingDraft((draft) => ({ ...draft, quoteAmount: event.target.value }))}
                                      placeholder="C$250"
                                      className="bg-white"
                                    />
                                  </div>
                                  <div>
                                    <Label>Staff Assigned</Label>
                                    <Select value={bookingDraft.staffAssigned || "Not assigned"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, staffAssigned: value }))}>
                                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {staffAssignmentOptions.map((option) => (
                                          <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <Label>Invoice / Quote Stage</Label>
                                    <Select value={bookingDraft.invoiceStatus || "Not issued"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, invoiceStatus: value }))}>
                                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {invoiceStatusOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="mt-1 text-[0.66rem] leading-relaxed text-muted-foreground">Shows if paperwork has not been sent, a quote was sent, or the final invoice is ready.</p>
                                  </div>
                                  <div>
                                    <Label>Payment Progress</Label>
                                    <Select value={bookingDraft.paymentStatus || "Not paid"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, paymentStatus: value }))}>
                                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {paymentStatusOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="mt-1 text-[0.66rem] leading-relaxed text-muted-foreground">Tracks whether money has not arrived, deposit is needed, part payment came in, or it is fully paid.</p>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <Label>Quote / Invoice Notes</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={insertQuoteTemplate} className="h-8 bg-white px-2 text-[0.68rem]">
                                      Template
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={bookingDraft.quoteNotes || ""}
                                    onChange={(event) => setBookingDraft((draft) => ({ ...draft, quoteNotes: event.target.value }))}
                                    placeholder="Labour, material, delivery, payment terms, or quote details."
                                    className="min-h-36 resize-y bg-white transition-all duration-200 focus:min-h-72"
                                  />
                                  <p className="mt-1 text-[0.66rem] leading-relaxed text-muted-foreground">Tap or click inside this box and it opens more space for longer invoice details.</p>
                                </div>
                                <div>
                                  <Label>Private Admin / Payment Notes</Label>
                                  <Textarea
                                    value={bookingDraft.adminNotes || ""}
                                    onChange={(event) => setBookingDraft((draft) => ({ ...draft, adminNotes: event.target.value }))}
                                    placeholder="Internal payment notes, follow-up reminders, customer preference, parts, supplier info, or anything the customer should not see."
                                    className="min-h-32 resize-y bg-white transition-all duration-200 focus:min-h-72"
                                  />
                                  <p className="mt-1 text-[0.66rem] leading-relaxed text-muted-foreground">Use this for deposit, balance, collection notes, and private follow-up details.</p>
                                </div>
                                <Button type="button" variant="outline" className="bg-white" onClick={() => openQuoteInvoice(booking.id)}>
                                  <FileText className="mr-1.5 h-4 w-4" />
                                  Open Quote / Invoice
                                </Button>
                              </div>
                            </div>
                            {booking.statusHistory && booking.statusHistory.length > 0 && (
                              <div className="rounded-2xl border border-[#ead8bf] bg-white p-3">
                                <Label>Status History</Label>
                                <div className="mt-2 grid gap-2">
                                  {booking.statusHistory.map((entry, index) => (
                                    <div key={`${entry.status}-${entry.changedAt}-${index}`} className="relative rounded-xl bg-[#fffaf2] p-3 pl-8">
                                      <span className="absolute left-3 top-4 h-2.5 w-2.5 rounded-full bg-[#6B4423]" />
                                      <p className="text-sm font-black text-secondary">{entry.status.replace("_", " ")}</p>
                                      <p className="text-xs text-muted-foreground">{new Date(entry.changedAt).toLocaleString()}</p>
                                      {entry.note && <p className="mt-1 text-xs leading-relaxed text-foreground/80">{entry.note}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="outline" size="sm" className="h-10 bg-white text-xs" onClick={() => openQuoteInvoice(booking.id)}>
                        <FileText className="mr-1.5 h-4 w-4" />
                        Quote
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-10 bg-white text-xs">
                            <Trash2 className="mr-1.5 h-4 w-4 text-destructive" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this booking? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteBooking(booking.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Repair Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <p className="font-medium">{booking.name}</p>
                        <p className="mt-1 text-xs font-bold text-primary">{formatBookingDisplayId(booking)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {normalizePhoneForMessaging(booking.phone, booking.country || booking.address) || booking.phone}
                          </div>
                          {getAdminToClientWhatsAppUrl(booking) && (
                            <a
                              href={getAdminToClientWhatsAppUrl(booking)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WhatsApp client
                            </a>
                          )}
                          {getAdminToClientSmsUrl(booking) && (
                            <a
                              href={getAdminToClientSmsUrl(booking)}
                              className="inline-flex items-center gap-1 text-sm font-semibold text-[#6B4423] hover:underline"
                            >
                              <Phone className="h-3 w-3" />
                              SMS client
                            </a>
                          )}
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            {hasBookingEmail(booking) ? (
                              <a href={`mailto:${booking.email}`} className="text-primary hover:underline">
                                {booking.email}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">No email added</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{booking.address}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{booking.repairType}</Badge>
                        {(booking.country || booking.urgency) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {booking.country && <Badge variant="outline">{booking.country}</Badge>}
                            {booking.urgency && booking.urgency !== "Standard" && <Badge className="bg-red-100 text-red-800">{booking.urgency}</Badge>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={booking.status}
                          onValueChange={(value: BookingStatus) => updateBookingStatus(booking.id, value)}
                          disabled={statusUpdateLoading === booking.id}
                        >
                          <SelectTrigger className="w-32">
                            <Badge className={statusColors[booking.status]}>
                              {booking.status.replace("_", " ")}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {booking.preferredDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {formatPreferredDate(booking.preferredDate)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No date</span>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Submitted: {new Date(booking.createdAt).toLocaleString()}
                          </div>
                          {booking.reminderAt && (
                            <div className={`mt-1 rounded-lg px-2 py-1 text-xs font-bold ${isReminderDueForAdmin(booking) ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                              Reminder: {formatReminderDisplay(booking.reminderAt)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => openBooking(booking)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[88vh] w-[min(920px,calc(100vw-2rem))] max-w-none overflow-x-hidden overflow-y-auto rounded-2xl p-4">
                              <DialogHeader>
                                <DialogTitle>Booking Details</DialogTitle>
                              </DialogHeader>
                              {selectedBooking && (
                                <div className="space-y-4">
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <Label>Name</Label>
                                      <p className="font-medium">{selectedBooking.name}</p>
                                      <p className="mt-1 text-xs font-black text-primary">{formatBookingDisplayId(selectedBooking)}</p>
                                    </div>
                                    <div>
                                      <Label>Phone</Label>
                                      <p className="font-medium">{normalizePhoneForMessaging(selectedBooking.phone, selectedBooking.country || selectedBooking.address) || selectedBooking.phone}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {getAdminToClientWhatsAppUrl(selectedBooking) && (
                                          <a
                                            href={getAdminToClientWhatsAppUrl(selectedBooking)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-green-700"
                                          >
                                            <MessageCircle className="h-4 w-4" />
                                            WhatsApp
                                          </a>
                                        )}
                                        {getAdminToClientSmsUrl(selectedBooking) && (
                                          <a
                                            href={getAdminToClientSmsUrl(selectedBooking)}
                                            className="inline-flex items-center gap-2 rounded-lg bg-[#6B4423] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#543218]"
                                          >
                                            <Phone className="h-4 w-4" />
                                            SMS
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <Label>Email</Label>
                                      <p className="font-medium">{getBookingEmailLabel(selectedBooking)}</p>
                                    </div>
                                    <div>
                                      <Label>Repair Type</Label>
                                      <p className="font-medium">{selectedBooking.repairType}</p>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <Label>Address</Label>
                                      <p className="font-medium">{selectedBooking.address}</p>
                                    </div>
                                    {(selectedBooking.city || selectedBooking.country || selectedBooking.timeZone || selectedBooking.preferredContactMethod || selectedBooking.urgency || selectedBooking.requestScope || selectedBooking.currency) && (
                                      <div className="rounded-xl border bg-muted/30 p-4 sm:col-span-2">
                                        <Label>International / Contact Details</Label>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                          {[
                                            ["City / Province", selectedBooking.city],
                                            ["Country", selectedBooking.country],
                                            ["Time Zone", selectedBooking.timeZone],
                                            ["Preferred Contact", selectedBooking.preferredContactMethod],
                                            ["Urgency", selectedBooking.urgency],
                                            ["Request Type", selectedBooking.requestScope],
                                            ["Currency", selectedBooking.currency],
                                          ].filter(([, value]) => value).map(([label, value]) => (
                                            <div key={label} className="rounded-lg bg-background p-3">
                                              <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                                              <p className="font-medium">{value}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      <Label>Preferred Date</Label>
                                      <p className="font-medium">
                                        {formatPreferredDate(selectedBooking.preferredDate)}
                                      </p>
                                    </div>
                                    <div>
                                      <Label>Status</Label>
                                      <Badge className={statusColors[selectedBooking.status]}>
                                        {selectedBooking.status.replace("_", " ")}
                                      </Badge>
                                    </div>
                                    {selectedBooking.reminderAt && (
                                      <div className="rounded-xl border border-rose-100 bg-[#fffaf2] p-3 sm:col-span-2">
                                        <Label>Admin Reminder</Label>
                                        <p className={`mt-1 font-bold ${isReminderDueForAdmin(selectedBooking) ? "text-rose-700" : "text-secondary"}`}>
                                          {formatReminderDisplay(selectedBooking.reminderAt)}
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                          {selectedBooking.reminderNote || selectedBooking.reminderWindow || "Follow up with this request."}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  {selectedBooking.message && (
                                    <div>
                                      <Label>Message</Label>
                                      <p className="mt-1 p-3 bg-muted rounded-md">{selectedBooking.message}</p>
                                    </div>
                                  )}
                                  <div className="rounded-xl border bg-muted/30 p-4">
                                    <Label>Quick Client Messages</Label>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                      {quickMessageTemplates.map((template) => {
                                        const messageText = template.message(selectedBooking);
                                        const messageUrl = getAdminToClientWhatsAppUrl(selectedBooking, messageText);
                                        const smsUrl = getAdminToClientSmsUrl(selectedBooking, messageText);
                                        return (
                                          <div key={`${selectedBooking.id}-${template.label}`} className="grid grid-cols-2 gap-2">
                                            <a
                                              href={messageUrl || undefined}
                                              target="_blank"
                                              rel="noreferrer"
                                              className={`inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-bold ${messageUrl ? "bg-green-600 text-white hover:bg-green-700" : "pointer-events-none bg-muted text-muted-foreground"}`}
                                            >
                                              WA {template.label}
                                            </a>
                                            <a
                                              href={smsUrl || undefined}
                                              className={`inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-bold ${smsUrl ? "bg-[#6B4423] text-white hover:bg-[#543218]" : "pointer-events-none bg-muted text-muted-foreground"}`}
                                            >
                                              SMS
                                            </a>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {(selectedBooking.dimensions || selectedBooking.quantity || selectedBooking.material || selectedBooking.color || selectedBooking.swingDirection || selectedBooking.deliveryNeeded || selectedBooking.installationNeeded || selectedBooking.budget) && (
                                    <div className="rounded-xl border bg-muted/30 p-4">
                                      <Label>Product / Job Details</Label>
                                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        {[
                                          ["Size / Measurements", selectedBooking.dimensions],
                                          ["Quantity", selectedBooking.quantity],
                                          ["Material", selectedBooking.material],
                                          ["Color / Finish", selectedBooking.color],
                                          ["Swing Direction", selectedBooking.swingDirection],
                                          ["Delivery Needed", selectedBooking.deliveryNeeded],
                                          ["Installation Needed", selectedBooking.installationNeeded],
                                          ["Budget", selectedBooking.budget],
                                        ].filter(([, value]) => value).map(([label, value]) => (
                                          <div key={label} className="rounded-lg bg-background p-3">
                                            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                                            <p className="font-medium">{value}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {selectedBooking.photos && selectedBooking.photos.length > 0 && (
                                    <div>
                                      <Label>Customer Photos</Label>
                                      <div className="mt-2 grid gap-3 sm:grid-cols-3">
                                        {selectedBooking.photos.map((photo, index) => (
                                          <img key={`${selectedBooking.id}-photo-${index}`} src={photo} alt={`Booking photo ${index + 1}`} className="h-36 w-full rounded-xl object-cover" />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="rounded-2xl border border-[#ead8bf] bg-white p-4 shadow-sm">
                                    <div className="mb-3 grid gap-3 rounded-xl bg-[#fffaf2] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                                      <div>
                                        <Label>Admin Workflow</Label>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                          Manage the visit time, reminder, quote, payment, staff, and notes for this booking.
                                        </p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                                        <Button type="button" size="sm" variant="outline" onClick={() => openQuoteInvoice(selectedBooking.id)}>
                                          <FileText className="mr-2 h-4 w-4" />
                                          Quote / Invoice
                                        </Button>
                                        <Button type="button" size="sm" onClick={saveBookingWorkflow}>
                                          <Save className="mr-2 h-4 w-4" />
                                          Save Details
                                        </Button>
                                      </div>
                                    </div>
                                    <details className="mb-3 rounded-xl border border-primary/10 bg-[#fffaf2] px-3 py-2 text-xs">
                                      <summary className="cursor-pointer font-bold text-secondary">Example formats for this workflow</summary>
                                      <div className="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-2">
                                        {workflowExamples.map(([label, example]) => (
                                          <p key={label}><strong className="text-secondary">{label}:</strong> {example}</p>
                                        ))}
                                      </div>
                                    </details>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                      <div>
                                        <Label>Appointment Date & Time</Label>
                                        <Input
                                          type="datetime-local"
                                          value={toDateTimeLocalInputValue(bookingDraft.appointmentTime)}
                                          onChange={(event) => setBookingDraft((draft) => applyAppointmentToDraft(draft, event.target.value, selectedBooking.repairType))}
                                        />
                                      </div>
                                      <div className="rounded-2xl border border-rose-100 bg-[#fff7f0] p-3 sm:col-span-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <div>
                                            <Label>Admin Job Reminder</Label>
                                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                              Choose the appointment first. The dashboard recalculates the reminder for 2 hours before that visit.
                                            </p>
                                          </div>
                                          {bookingDraft.reminderAt && (
                                            <Button type="button" variant="outline" size="sm" className="h-8 bg-white text-xs" onClick={() => setBookingDraft((draft) => ({ ...draft, reminderAt: "", reminderNote: "", reminderWindow: "At selected time" }))}>
                                              Clear Reminder
                                            </Button>
                                          )}
                                        </div>
                                        <details className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                          <summary className="cursor-pointer font-black text-rose-700">How this reminder works</summary>
                                          <div className="mt-2 grid gap-1">
                                            {reminderHelpSteps.map((step, index) => (
                                              <p key={step}><strong className="text-rose-700">{index + 1}.</strong> {step}</p>
                                            ))}
                                          </div>
                                          <div className="mt-2 grid gap-1 border-t border-rose-100 pt-2">
                                            <p className="font-black text-rose-700">Reminder type meanings</p>
                                            {reminderTypeDescriptions.map(([label, description]) => (
                                              <p key={label}><strong className="text-foreground">{label}:</strong> {description}</p>
                                            ))}
                                          </div>
                                        </details>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_0.8fr]">
                                          <div>
                                            <Label className="text-xs">Reminder Time</Label>
                                            <Input
                                              type="datetime-local"
                                              value={toDateTimeLocalInputValue(bookingDraft.reminderAt)}
                                              onChange={(event) => setBookingDraft((draft) => ({ ...draft, reminderAt: toIsoDateTimeInputValue(event.target.value) }))}
                                              className="mt-1 bg-white"
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-xs">Reminder Type</Label>
                                            <Select value={bookingDraft.reminderWindow || "At selected time"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, reminderWindow: value }))}>
                                              <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                {reminderWindowOptions.map((option) => (
                                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="sm:col-span-2">
                                            <Label className="text-xs">Reminder Message</Label>
                                            <Textarea
                                              value={bookingDraft.reminderNote || ""}
                                              onChange={(event) => setBookingDraft((draft) => ({ ...draft, reminderNote: event.target.value }))}
                                              placeholder="Example: Job starts soon. Check customer details, route, tools, and parts."
                                              className="mt-1 bg-white"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <Label>Quote Amount</Label>
                                        <Input
                                          value={bookingDraft.quoteAmount || ""}
                                          onChange={(event) => setBookingDraft((draft) => ({ ...draft, quoteAmount: event.target.value }))}
                                          placeholder="C$250"
                                        />
                                      </div>
                                      <div>
                                        <Label>Staff Assigned</Label>
                                        <Select value={bookingDraft.staffAssigned || "Not assigned"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, staffAssigned: value }))}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {staffAssignmentOptions.map((option) => (
                                              <SelectItem key={option} value={option}>{option}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label>Invoice / Quote Stage</Label>
                                        <Select value={bookingDraft.invoiceStatus || "Not issued"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, invoiceStatus: value }))}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {invoiceStatusOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Shows whether nothing was sent, a quote was sent, or the final invoice is ready.</p>
                                      </div>
                                      <div>
                                        <Label>Payment Progress</Label>
                                        <Select value={bookingDraft.paymentStatus || "Not paid"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, paymentStatus: value }))}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {paymentStatusOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Shows whether payment is missing, requested, partly received, or fully paid.</p>
                                      </div>
                                      <div className="sm:col-span-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <Label>Quote / Invoice Notes</Label>
                                          <Button type="button" variant="outline" size="sm" onClick={insertQuoteTemplate}>
                                            Use Template
                                          </Button>
                                        </div>
                                        <Textarea
                                          value={bookingDraft.quoteNotes || ""}
                                          onChange={(event) => setBookingDraft((draft) => ({ ...draft, quoteNotes: event.target.value }))}
                                          placeholder="Line items, labour, materials, delivery, tax notes, payment link, or quote terms..."
                                          className="min-h-36 resize-y transition-all duration-200 focus:min-h-72"
                                        />
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Click inside this box and it opens more space for longer invoice details.</p>
                                      </div>
                                      <div className="sm:col-span-3">
                                        <Label>Private Admin / Payment Notes</Label>
                                        <Textarea
                                          value={bookingDraft.adminNotes || ""}
                                          onChange={(event) => setBookingDraft((draft) => ({ ...draft, adminNotes: event.target.value }))}
                                          placeholder="Private payment notes, follow-up reminders, measurements, pricing, supplier info, or customer preferences..."
                                          className="min-h-32 resize-y transition-all duration-200 focus:min-h-72"
                                        />
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Use this for deposit, balance, collection notes, and anything only the admin should see.</p>
                                      </div>
                                    </div>
                                  </div>
                                  {selectedBooking.statusHistory && selectedBooking.statusHistory.length > 0 && (
                                    <div className="rounded-2xl border border-[#ead8bf] bg-white p-3">
                                      <Label>Status History</Label>
                                      <div className="mt-2 grid gap-2">
                                        {selectedBooking.statusHistory.map((entry, index) => (
                                          <div key={`${entry.status}-${entry.changedAt}-${index}`} className="relative rounded-xl bg-[#fffaf2] p-3 pl-8">
                                            <span className="absolute left-3 top-4 h-2.5 w-2.5 rounded-full bg-[#6B4423]" />
                                            <p className="font-black text-secondary">{entry.status.replace("_", " ")}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(entry.changedAt).toLocaleString()}</p>
                                            {entry.note && <p className="mt-1 text-sm leading-relaxed text-foreground/80">{entry.note}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button variant="outline" size="sm" onClick={() => openQuoteInvoice(booking.id)}>
                            <FileText className="w-4 h-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Booking</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this booking? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteBooking(booking.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}

        <Card id="review-moderation" className="mt-8 scroll-mt-20 md:scroll-mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Review Moderation ({reviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            {reviews.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {reviews.map((review) => (
                  <div key={review.id} className="min-w-0 rounded-xl border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{review.name}</p>
                        <p className="text-sm text-muted-foreground">{review.location || "No location"} · {review.rating} stars</p>
                      </div>
                      <Badge variant={review.status === "APPROVED" ? "default" : "secondary"}>{review.status || "PENDING"}</Badge>
                    </div>
                    <p className="text-sm leading-relaxed">"{review.quote}"</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Select value={review.status || "PENDING"} onValueChange={(value: ReviewStatus) => updateReviewStatus(review.id, value)}>
                        <SelectTrigger className="sm:w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="APPROVED">Approved</SelectItem>
                          <SelectItem value="HIDDEN">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={() => deleteReview(review.id)}>
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="website-content-manager" className="mt-8 scroll-mt-20 md:scroll-mt-6">
          <CardHeader>
            <CardTitle>Website Content Manager</CardTitle>
            <p className="text-sm text-muted-foreground">
              Add adverts, service cards, product cards, project photos, videos, and documents from here. Active adverts notify app subscribers and email previous customers who agreed to be contacted.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:grid-cols-2">
              <div>
                <Label>Where should this appear?</Label>
                <Select value={contentDraft.category} onValueChange={(value: ContentItem["category"]) => setContentDraft((draft) => ({ ...draft, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {contentCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={contentDraft.title} onChange={(event) => setContentDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder={contentDraft.category === "advert" ? "Holiday repair discount" : "Card title"} />
              </div>
              <div>
                <Label>Small Label</Label>
                <Input value={contentDraft.tag || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, tag: event.target.value }))} placeholder={contentDraft.category === "advert" ? "New Arrival, Discount, Holiday Offer..." : "Security, Door Kit, Before / After..."} />
              </div>
              <div>
                <Label>Booking Service</Label>
                <Input value={contentDraft.bookingValue || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, bookingValue: event.target.value }))} placeholder="door-purchase" />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={contentDraft.description || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, description: event.target.value }))} placeholder={contentDraft.category === "advert" ? "Tell customers what is new, discounted, or available for booking." : "Short customer-facing description"} />
              </div>
              <div className="md:col-span-2">
                <Label>{contentDraft.category === "advert" ? "Button Text / Details" : "Items / Details"}</Label>
                <Input value={contentDraft.items || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, items: event.target.value }))} placeholder={contentDraft.category === "advert" ? "Book This Offer" : "Handles, cylinders, hinges, lock bodies..."} />
                <p className="mt-1 text-xs text-muted-foreground">
                  For normal content, write the details customers should see. If you upload a PDF or Word document, the document link is saved here and appears publicly as a clickable document link.
                </p>
              </div>
              <div className="md:col-span-2">
                <Label>Main Media</Label>
                <Input value={contentDraft.image || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, image: event.target.value }))} placeholder="Image/video URL or uploaded media" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload or paste the main image or video. The website will crop and size it automatically so it fits the selected section.
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-primary/25 bg-white p-4 md:col-span-2">
                <Label htmlFor="content-flyer-upload" className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="font-semibold text-foreground">{contentUploadLoading ? "Uploading..." : "Upload image, video, or document"}</span>
                  <span className="max-w-lg text-xs text-muted-foreground">
                    Use this for advert flyers, product photos, service images, short videos, PDFs, or Word documents. Files can be up to 20MB.
                  </span>
                </Label>
                <Input id="content-flyer-upload" type="file" accept="image/*,video/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={handleContentImageUpload} disabled={contentUploadLoading} />
                {contentDraft.image && (
                  <div className="mt-4 overflow-hidden rounded-2xl border bg-muted/20">
                    {contentDraft.image.startsWith("data:video/") || /\.(mp4|webm|ogg)(\?.*)?$/i.test(contentDraft.image) ? (
                      <video src={contentDraft.image} className="max-h-56 w-full object-contain" controls muted />
                    ) : (
                      <img src={contentDraft.image} alt="Selected content preview" className="max-h-56 w-full object-contain" />
                    )}
                  </div>
                )}
                {isDocumentMedia(contentDraft.items) && (
                  <a
                    href={contentDraft.items || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-[#fffaf2] p-3 text-sm font-bold text-secondary transition hover:text-primary"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">Document saved for this content item</span>
                    </span>
                    <span className="shrink-0 text-xs">Open</span>
                  </a>
                )}
              </div>
              <div>
                <Label>Sort Order</Label>
                <div className="mt-1 flex overflow-hidden rounded-xl border bg-white">
                  <button type="button" onClick={() => adjustContentSortOrder(-1)} className="h-11 w-11 border-r text-lg font-black text-[#6B4423]">-</button>
                  <Input type="number" value={contentDraft.sortOrder} onChange={(event) => setContentDraft((draft) => ({ ...draft, sortOrder: Number(event.target.value) || 0 }))} className="h-11 rounded-none border-0 text-center font-bold focus-visible:ring-0" />
                  <button type="button" onClick={() => adjustContentSortOrder(1)} className="h-11 w-11 border-l text-lg font-black text-[#6B4423]">+</button>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {[0, 10, 20, 30].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setContentDraft((draft) => ({ ...draft, sortOrder: value }))}
                      className="rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-[#6B4423] ring-1 ring-[#ead8bf]"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={contentDraft.active ? "true" : "false"} onValueChange={(value) => setContentDraft((draft) => ({ ...draft, active: value === "true" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Visible</SelectItem>
                    <SelectItem value="false">Hidden</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Hidden items stay saved in admin but do not appear on the website.</p>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row">
                <Button type="button" onClick={saveContentItem}>
                  <Save className="mr-2 h-4 w-4" />
                  {editingContentId ? "Update Content" : "Add Content"}
                </Button>
                {editingContentId && (
                  <Button type="button" variant="outline" onClick={() => { setEditingContentId(null); setContentDraft(emptyContentDraft); }}>
                    Cancel Editing
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {contentItems.map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant="secondary">{contentCategories.find((category) => category.value === item.category)?.label || item.category}</Badge>
                      <h3 className="mt-2 break-words text-lg font-semibold">{item.title}</h3>
                      <p className="mt-1 break-words text-sm text-muted-foreground">{item.description || "No description"}</p>
                    </div>
                    <Badge variant={item.active ? "default" : "outline"}>{item.active ? "Visible" : "Hidden"}</Badge>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button type="button" variant="outline" onClick={() => editContentItem(item)}>Edit</Button>
                    <Button type="button" variant="outline" onClick={() => deleteContentItem(item.id)}>
                      <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {contentItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No custom content yet. The website is using its built-in cards until you add replacements here.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
