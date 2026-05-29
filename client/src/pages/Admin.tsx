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
import { Bell, Calendar, Download, Phone, User, MapPin, Mail, Filter, LogOut, Trash2, Eye, Save, Star, KeyRound, MessageCircle, Upload, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import type { Booking, BookingStatus, BookingUpdateRequest, ContentItem, ContentItemRequest, Review, ReviewStatus } from "@shared/types";

const ADMIN_NOTIFICATION_CHOICE_KEY = "fixmydoor-admin-push-choice-v1";

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

const contentCategories: { value: ContentItem["category"]; label: string }[] = [
  { value: "advert", label: "Advert / Promotion" },
  { value: "serviceShowcase", label: "Service Card" },
  { value: "productCategory", label: "Product Category" },
  { value: "doorProduct", label: "Door Product" },
  { value: "hardwareProduct", label: "Hardware Product" },
  { value: "projectGallery", label: "Project Gallery" },
];

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

function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `1${digits}`;
  }
  if (digits.startsWith("00") && digits.length > 10) {
    return digits.slice(2);
  }
  return digits.length >= 8 ? digits : "";
}

function getAdminToClientWhatsAppUrl(booking: Booking) {
  const normalizedPhone = normalizeWhatsAppPhone(booking.phone);
  if (!normalizedPhone) {
    return "";
  }

  const message = [
    `Hello ${booking.name}, this is FixMyDoor Services.`,
    `We received your request for ${booking.repairType}.`,
    "Our staff will contact you to confirm the appointment details.",
    `Booking ID: ${booking.id}`,
  ].join("\n");

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
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
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentDraft, setContentDraft] = useState<ContentItemRequest>(emptyContentDraft);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
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
  const [pushSubscriberCount, setPushSubscriberCount] = useState(0);
  const [visitorSubscriberCount, setVisitorSubscriberCount] = useState(0);
  const [adminSubscriberCount, setAdminSubscriberCount] = useState(0);
  const [pushNotifications, setPushNotifications] = useState<PushNotificationLogEntry[]>([]);
  const [adminNotificationSupported, setAdminNotificationSupported] = useState(false);
  const [adminNotificationsEnabled, setAdminNotificationsEnabled] = useState(false);
  const [adminNotificationLoading, setAdminNotificationLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [adminStandalone, setAdminStandalone] = useState(false);

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
    } catch (err) {
      toast.error("Invalid credentials");
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

  const fetchPushNotifications = async () => {
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
    } catch (err) {
      console.error("Failed to fetch push notifications:", err);
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
        icon: "/icons/admin-icon-192x192.png",
        badge: "/icons/admin-icon-96x96.png",
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
      toast.message("Use the browser menu and choose Install App or Add to Home Screen.");
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

    const readFile = (selectedFile: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

    try {
      setContentUploadLoading(true);
      const dataUrl = await readFile(file);
      const response = await axios.post<{ url: string; kind?: "image" | "video" | "document" }>("/api/admin/media", { dataUrl, fileName: file.name });
      if (response.data.kind === "document") {
        setContentDraft((draft) => ({ ...draft, items: response.data.url }));
        toast.success("Document uploaded. The document link was saved in the details field.");
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f7efe5] via-white to-[#f3dfc7] px-4 py-8 text-center">
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading bookings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchBookings}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7efe4]">
      <div className="container mx-auto max-w-[1320px] px-3 py-4 sm:px-4 md:py-8">
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
          <div className="mt-4 grid grid-cols-2 gap-2 md:absolute md:right-5 md:top-5 md:mt-0 md:flex md:max-w-[31rem] md:flex-wrap md:justify-end">
            <Button type="button" onClick={installAdminApp} variant="outline" className="h-10 bg-white/90 px-2 text-xs sm:text-sm">
              <Download className="w-4 h-4 mr-2" />
              <span>{adminStandalone ? "App Open" : "Install App"}</span>
            </Button>
            <Button
              type="button"
              onClick={enableAdminNotifications}
              variant={adminNotificationsEnabled ? "default" : "outline"}
              className={`h-10 px-2 text-xs sm:text-sm ${adminNotificationsEnabled ? "bg-[#6B4423] text-white hover:bg-[#543218]" : "bg-white/90"}`}
              disabled={adminNotificationLoading}
            >
              <Bell className="w-4 h-4 mr-2" />
              {adminNotificationLoading ? "Enabling..." : adminNotificationsEnabled ? "Alerts On" : "Alerts"}
            </Button>
            <Button onClick={handleLogout} variant="outline" className="col-span-2 h-10 bg-white/90 text-xs sm:text-sm md:col-span-1">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Dashboard */}
        {stats && (
          <div className="mb-4 grid grid-cols-2 gap-2.5 md:mb-6 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
            <Card className="border-[#ead8bf] bg-white shadow-sm">
              <CardHeader className="p-3 pb-1 md:p-4 md:pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">Total Bookings</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
                <div className="text-xl font-bold md:text-2xl">{stats.totalBookings}</div>
              </CardContent>
            </Card>
            <Card className="border-[#ead8bf] bg-white shadow-sm">
              <CardHeader className="p-3 pb-1 md:p-4 md:pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">Pending</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
                <div className="text-xl font-bold text-yellow-600 md:text-2xl">{stats.pendingBookings}</div>
              </CardContent>
            </Card>
            <Card className="border-[#ead8bf] bg-white shadow-sm">
              <CardHeader className="p-3 pb-1 md:p-4 md:pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">Urgent</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
                <div className="text-xl font-bold text-red-600 md:text-2xl">{stats.urgentBookings}</div>
              </CardContent>
            </Card>
            <Card className="border-[#ead8bf] bg-white shadow-sm">
              <CardHeader className="p-3 pb-1 md:p-4 md:pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">This Week</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
                <div className="text-xl font-bold text-blue-600 md:text-2xl">{stats.thisWeekBookings}</div>
              </CardContent>
            </Card>
            <Card className="border-[#ead8bf] bg-white shadow-sm">
              <CardHeader className="p-3 pb-1 md:p-4 md:pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">International</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
                <div className="text-xl font-bold text-purple-700 md:text-2xl">{stats.internationalBookings}</div>
              </CardContent>
            </Card>
            <Card className="border-[#ead8bf] bg-white shadow-sm">
              <CardHeader className="p-3 pb-1 md:p-4 md:pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">Completed</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
                <div className="text-xl font-bold text-green-600 md:text-2xl">{stats.completedBookings}</div>
              </CardContent>
            </Card>
          </div>
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
                  {pushSubscriberCount} total device{pushSubscriberCount === 1 ? "" : "s"} subscribed: {visitorSubscriberCount} visitor{visitorSubscriberCount === 1 ? "" : "s"} and {adminSubscriberCount} admin device{adminSubscriberCount === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button type="button" onClick={enableAdminNotifications} disabled={adminNotificationLoading} className="h-10 bg-[#6B4423] px-2 text-xs text-white hover:bg-[#543218] md:text-sm">
                  <Bell className="mr-2 h-4 w-4" />
                  {adminNotificationsEnabled ? "Alerts On" : "Admin Alerts"}
                </Button>
                <Button type="button" variant="outline" onClick={fetchPushNotifications} className="h-10 bg-white px-2 text-xs md:text-sm">
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 pt-0 md:p-6 md:pt-0 lg:grid-cols-[0.7fr_1.3fr]">
            <form onSubmit={sendPushNotification} className="space-y-3 rounded-2xl border border-primary/10 bg-[#fffaf2] p-3 md:space-y-4 md:p-4">
              <div className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-muted-foreground shadow-sm">
                Use this sender for social media posts too. Website adverts, approved reviews, and new customer requests can also trigger alerts automatically.
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
              <h3 className="font-bold text-secondary">Recent notification log</h3>
              {pushNotifications.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No push notifications have been sent yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {pushNotifications.slice(0, 5).map((notification) => (
                    <div key={notification.id} className="rounded-2xl bg-white p-3 shadow-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-bold text-secondary">{notification.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                        </div>
                        <Badge variant={notification.failed > 0 ? "secondary" : "default"}>
                          {notification.delivered} sent
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
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
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentBookings.map((booking: any) => (
                  <div key={booking.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{booking.name}</p>
                      <p className="text-sm text-muted-foreground">{booking.repairType}</p>
                    </div>
                    <Badge variant={booking.status === "PENDING" ? "secondary" : booking.status === "COMPLETED" ? "default" : "outline"}>
                      {booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
              <SelectItem value="INTERNATIONAL">International Requests</SelectItem>
              <SelectItem value="URGENT">Urgent / Emergency</SelectItem>
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

        <Card className="border-[#ead8bf] bg-white shadow-sm">
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
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{booking.repairType}</p>
                      </div>
                      <Badge className={`${statusColors[booking.status]} shrink-0 text-[0.65rem]`}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-foreground/75">
                      <a href={`tel:${booking.phone}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-secondary">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        {booking.phone}
                      </a>
                      <a href={`mailto:${booking.email}`} className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-secondary">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{booking.email}</span>
                      </a>
                      <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="line-clamp-2">{booking.address}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
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
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-10 bg-white text-xs" onClick={() => openBooking(booking)}>
                            <Eye className="mr-1.5 h-4 w-4" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[88vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl p-4">
                          <DialogHeader>
                            <DialogTitle className="text-lg">Booking Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="rounded-2xl bg-[#fffaf2] p-3">
                              <p className="font-bold text-secondary">{booking.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Submitted: {new Date(booking.createdAt).toLocaleString()}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-xl border bg-white p-3">
                                <p className="text-xs font-semibold text-muted-foreground">Service</p>
                                <p className="mt-1 font-semibold">{booking.repairType}</p>
                              </div>
                              <div className="rounded-xl border bg-white p-3">
                                <p className="text-xs font-semibold text-muted-foreground">Date</p>
                                <p className="mt-1 font-semibold">{formatPreferredDate(booking.preferredDate)}</p>
                              </div>
                              <div className="col-span-2 rounded-xl border bg-white p-3">
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
                                    <p key={label} className="flex justify-between gap-3 rounded-lg bg-muted/40 px-2 py-1.5">
                                      <span className="text-muted-foreground">{label}</span>
                                      <span className="font-semibold text-right">{value}</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
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
                            <div className="rounded-2xl border bg-[#fffaf2] p-3">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <Label>Admin Workflow</Label>
                                <Button type="button" size="sm" onClick={saveBookingWorkflow}>
                                  <Save className="mr-1.5 h-4 w-4" />
                                  Save
                                </Button>
                              </div>
                              <div className="grid gap-2">
                                <Input
                                  value={bookingDraft.appointmentTime || ""}
                                  onChange={(event) => setBookingDraft((draft) => ({ ...draft, appointmentTime: event.target.value }))}
                                  placeholder="Appointment time"
                                />
                                <Input
                                  value={bookingDraft.quoteAmount || ""}
                                  onChange={(event) => setBookingDraft((draft) => ({ ...draft, quoteAmount: event.target.value }))}
                                  placeholder="Quote amount"
                                />
                                <Textarea
                                  value={bookingDraft.adminNotes || ""}
                                  onChange={(event) => setBookingDraft((draft) => ({ ...draft, adminNotes: event.target.value }))}
                                  placeholder="Internal notes"
                                />
                              </div>
                            </div>
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
                      <TableCell className="font-medium">{booking.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {booking.phone}
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
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            <a href={`mailto:${booking.email}`} className="text-primary hover:underline">
                              {booking.email}
                            </a>
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
                            <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Booking Details</DialogTitle>
                              </DialogHeader>
                              {selectedBooking && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Name</Label>
                                      <p className="font-medium">{selectedBooking.name}</p>
                                    </div>
                                    <div>
                                      <Label>Phone</Label>
                                      <p className="font-medium">{selectedBooking.phone}</p>
                                      {getAdminToClientWhatsAppUrl(selectedBooking) && (
                                        <a
                                          href={getAdminToClientWhatsAppUrl(selectedBooking)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-green-700"
                                        >
                                          <MessageCircle className="h-4 w-4" />
                                          Message on WhatsApp
                                        </a>
                                      )}
                                    </div>
                                    <div>
                                      <Label>Email</Label>
                                      <p className="font-medium">{selectedBooking.email}</p>
                                    </div>
                                    <div>
                                      <Label>Repair Type</Label>
                                      <p className="font-medium">{selectedBooking.repairType}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <Label>Address</Label>
                                      <p className="font-medium">{selectedBooking.address}</p>
                                    </div>
                                    {(selectedBooking.city || selectedBooking.country || selectedBooking.timeZone || selectedBooking.preferredContactMethod || selectedBooking.urgency || selectedBooking.requestScope || selectedBooking.currency) && (
                                      <div className="col-span-2 rounded-xl border bg-muted/30 p-4">
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
                                  </div>
                                  {selectedBooking.message && (
                                    <div>
                                      <Label>Message</Label>
                                      <p className="mt-1 p-3 bg-muted rounded-md">{selectedBooking.message}</p>
                                    </div>
                                  )}
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
                                  <div className="rounded-xl border p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <Label>Admin Workflow</Label>
                                      <div className="flex flex-wrap gap-2">
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
                                    <div className="grid gap-3 sm:grid-cols-3">
                                      <div>
                                        <Label>Appointment Time</Label>
                                        <Input
                                          value={bookingDraft.appointmentTime || ""}
                                          onChange={(event) => setBookingDraft((draft) => ({ ...draft, appointmentTime: event.target.value }))}
                                          placeholder="May 10, 2:00 PM"
                                        />
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
                                        <Input
                                          value={bookingDraft.staffAssigned || ""}
                                          onChange={(event) => setBookingDraft((draft) => ({ ...draft, staffAssigned: event.target.value }))}
                                          placeholder="Richard / Team"
                                        />
                                      </div>
                                      <div>
                                        <Label>Invoice Status</Label>
                                        <Select value={bookingDraft.invoiceStatus || "Not issued"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, invoiceStatus: value }))}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Not issued">Not issued</SelectItem>
                                            <SelectItem value="Quote sent">Quote sent</SelectItem>
                                            <SelectItem value="Invoice sent">Invoice sent</SelectItem>
                                            <SelectItem value="Revised">Revised</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label>Payment Status</Label>
                                        <Select value={bookingDraft.paymentStatus || "Not paid"} onValueChange={(value) => setBookingDraft((draft) => ({ ...draft, paymentStatus: value }))}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Not paid">Not paid</SelectItem>
                                            <SelectItem value="Deposit requested">Deposit requested</SelectItem>
                                            <SelectItem value="Partially paid">Partially paid</SelectItem>
                                            <SelectItem value="Paid">Paid</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="sm:col-span-3">
                                        <Label>Quote / Invoice Notes</Label>
                                        <Textarea
                                          value={bookingDraft.quoteNotes || ""}
                                          onChange={(event) => setBookingDraft((draft) => ({ ...draft, quoteNotes: event.target.value }))}
                                          placeholder="Line items, labour, materials, delivery, tax notes, payment link, or quote terms..."
                                        />
                                      </div>
                                      <div className="sm:col-span-3">
                                        <Label>Internal Notes</Label>
                                        <Textarea
                                          value={bookingDraft.adminNotes || ""}
                                          onChange={(event) => setBookingDraft((draft) => ({ ...draft, adminNotes: event.target.value }))}
                                          placeholder="Private notes for follow-up, measurements, pricing, supplier info..."
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  {selectedBooking.statusHistory && selectedBooking.statusHistory.length > 0 && (
                                    <div>
                                      <Label>Status History</Label>
                                      <div className="mt-2 space-y-2">
                                        {selectedBooking.statusHistory.map((entry, index) => (
                                          <div key={`${entry.status}-${entry.changedAt}-${index}`} className="rounded-lg bg-muted p-3">
                                            <p className="font-medium">{entry.status.replace("_", " ")}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(entry.changedAt).toLocaleString()}</p>
                                            {entry.note && <p className="mt-1 text-sm">{entry.note}</p>}
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

        <Card id="website-content-manager" className="mt-8 scroll-mt-6">
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
                  <div key={review.id} className="rounded-xl border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
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

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Website Content Manager</CardTitle>
            <p className="text-sm text-muted-foreground">
              Add adverts, flyers, videos, product cards, project cards, and service cards without editing code. Uploaded advert media appears in the homepage carousel.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:grid-cols-2">
              <div>
                <Label>Category</Label>
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
                <Label>Tag / Category Label</Label>
                <Input value={contentDraft.tag || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, tag: event.target.value }))} placeholder={contentDraft.category === "advert" ? "New Arrival, Discount, Holiday Offer..." : "Security, Door Kit, Before / After..."} />
              </div>
              <div>
                <Label>Booking Value</Label>
                <Input value={contentDraft.bookingValue || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, bookingValue: event.target.value }))} placeholder="door-purchase" />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={contentDraft.description || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, description: event.target.value }))} placeholder={contentDraft.category === "advert" ? "Tell customers what is new, discounted, or available for booking." : "Short customer-facing description"} />
              </div>
              <div className="md:col-span-2">
                <Label>{contentDraft.category === "advert" ? "Button Text / Details" : "Items / Details"}</Label>
                <Input value={contentDraft.items || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, items: event.target.value }))} placeholder={contentDraft.category === "advert" ? "Book This Offer" : "Handles, cylinders, hinges, lock bodies..."} />
              </div>
              <div className="md:col-span-2">
                <Label>Main Media</Label>
                <Input value={contentDraft.image || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, image: event.target.value }))} placeholder="Image/video URL or uploaded media" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload or paste the main image, video, or document for this content item.
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-primary/25 bg-white p-4 md:col-span-2">
                <Label htmlFor="content-flyer-upload" className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="font-semibold text-foreground">{contentUploadLoading ? "Uploading..." : "Upload image, video, or document"}</span>
                  <span className="max-w-lg text-xs text-muted-foreground">
                    Use this for advert flyers, product photos, service images, short videos, PDFs, or Word documents. Videos can be up to 20MB.
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
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={contentDraft.sortOrder} onChange={(event) => setContentDraft((draft) => ({ ...draft, sortOrder: Number(event.target.value) || 0 }))} />
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
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="secondary">{contentCategories.find((category) => category.value === item.category)?.label || item.category}</Badge>
                      <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description || "No description"}</p>
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
