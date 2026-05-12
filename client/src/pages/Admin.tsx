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
import { Calendar, Download, Phone, User, MapPin, Mail, Search, Filter, LogOut, Trash2, Eye, Save, Star, KeyRound, MessageCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Booking, BookingStatus, BookingUpdateRequest, ContentItem, ContentItemRequest, Review, ReviewStatus } from "@shared/types";

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

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchStats();
      fetchReviews();
      fetchContentItems();
    }
  }, [authenticated]);

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
  }, [authenticated, debouncedSearch, statusFilter, currentPage]);

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

  const openBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setBookingDraft({
      appointmentTime: booking.appointmentTime || "",
      quoteAmount: booking.quoteAmount || "",
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

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image flyer or product photo.");
      return;
    }

    if (file.size > 1_800_000) {
      toast.error("Please use an image under 1.8MB so the website stays fast.");
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
      const dataUrl = await readFile(file);
      setContentDraft((draft) => ({ ...draft, image: dataUrl }));
      toast.success("Flyer image attached. Save the content item to publish it.");
    } catch (err) {
      toast.error("Unable to read the selected image.");
    }
  };

  const exportBookings = () => {
    window.open("/api/bookings/export", "_blank");
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f7efe5] via-white to-[#f3dfc7] px-4">
        <Card className="w-full max-w-md border-[#dec4a3] shadow-xl">
          <CardHeader className="items-center text-center">
            <img
              src="/img5150-transparent.png"
              alt="FixMyDoor logo"
              className="mb-3 h-28 w-auto object-contain"
            />
            <CardTitle className="text-2xl font-display text-secondary">Admin Login</CardTitle>
            <p className="text-sm text-muted-foreground">
              FixMyDoor booking dashboard
            </p>
          </CardHeader>
          <CardContent>
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="relative mb-8 rounded-3xl border border-[#ead8bf] bg-white/85 p-6 text-center shadow-sm">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
            <img
              src="/img5150-transparent.png"
              alt="FixMyDoor logo"
              className="h-24 w-auto object-contain"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8a5a2d]">
                FixMyDoor
              </p>
              <h1 className="text-3xl font-display font-bold text-secondary md:text-4xl">
                Admin Dashboard
              </h1>
              <p className="text-foreground/70">
                View and manage customer booking requests
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center md:absolute md:right-6 md:top-6 md:mt-0">
            <Button
              type="button"
              onClick={() => document.getElementById("admin-password-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="bg-[#8a5a2d] text-white hover:bg-[#71451f]"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Change Password
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalBookings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingBookings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.thisWeekBookings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.completedBookings}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card id="admin-password-card" className="mb-8 scroll-mt-6 border-[#ead8bf]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Change Admin Password
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Use this after the first Railway login so the default password is replaced with your own private password.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
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
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Saving..." : "Update Password"}
              </Button>
            </form>
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

        <div className="mb-6 flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name, email, phone, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
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
          <Button type="button" variant="outline" onClick={exportBookings} className="lg:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Booking Requests ({bookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No bookings found.
              </p>
            ) : (
              <div className="overflow-x-auto">
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
                                      <Button type="button" size="sm" onClick={saveBookingWorkflow}>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Details
                                      </Button>
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

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Review Moderation ({reviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              Add adverts, flyers, product cards, project cards, and service cards without editing code. Uploaded flyers appear in the homepage advert carousel.
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
              <div>
                <Label>Main Image</Label>
                <Input value={contentDraft.image || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, image: event.target.value }))} placeholder="/src/pages/Images/..." />
              </div>
              <div>
                <Label>Accent Image</Label>
                <Input value={contentDraft.accentImage || ""} onChange={(event) => setContentDraft((draft) => ({ ...draft, accentImage: event.target.value }))} placeholder="Optional second image" />
              </div>
              <div className="rounded-2xl border border-dashed border-primary/25 bg-white p-4 md:col-span-2">
                <Label htmlFor="content-flyer-upload" className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="font-semibold text-foreground">Upload flyer or promotion photo</span>
                  <span className="max-w-lg text-xs text-muted-foreground">
                    Use this for advert flyers, product photos, or service images. Keep files under 1.8MB for faster loading.
                  </span>
                </Label>
                <Input id="content-flyer-upload" type="file" accept="image/*" className="sr-only" onChange={handleContentImageUpload} />
                {contentDraft.image && (
                  <div className="mt-4 overflow-hidden rounded-2xl border bg-muted/20">
                    <img src={contentDraft.image} alt="Selected content preview" className="max-h-56 w-full object-contain" />
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
