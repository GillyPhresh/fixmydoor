import axios from "axios";
import { type ChangeEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Facebook,
  FileText,
  Globe2,
  Instagram,
  Mail,
  MapPin,
  Maximize2,
  Menu,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  RotateCcw,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  Twitter,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import LanguageTranslator from "@/components/LanguageTranslator";
import type { BookingRequest, ContentItem, Review, ReviewRequest } from "@shared/types";
import { serviceCatalog as defaultServiceCatalog, type ServiceCatalogItem } from "@shared/services";
import {
  customerPaths,
  customerReviews,
  doorProducts,
  featuredService,
  featuredServiceCollage,
  hardwareProducts,
  heroImage,
  productCategories,
  projectGallery,
  quickHighlights,
  serviceShowcase,
  technicianImage,
} from "./homeContent";

const bookingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email address"),
  address: z.string().min(5, "Please enter your full address"),
  city: z.string().optional(),
  country: z.string().optional(),
  timeZone: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  urgency: z.string().optional(),
  requestScope: z.string().optional(),
  currency: z.string().optional(),
  repairType: z.string().min(1, "Please select a service type"),
  preferredDate: z.string().optional(),
  message: z.string().optional(),
  dimensions: z.string().optional(),
  quantity: z.string().optional(),
  material: z.string().optional(),
  color: z.string().optional(),
  swingDirection: z.string().optional(),
  deliveryNeeded: z.string().optional(),
  installationNeeded: z.string().optional(),
  budget: z.string().optional(),
  securityAnswer: z.string().refine((value) => value === "verified-customer", "Please confirm that you are a real customer"),
  customerConsent: z.boolean().refine(Boolean, "Please confirm that FixMyDoor Services can contact you about this request"),
});

type BookingFormData = z.infer<typeof bookingSchema>;

const reviewSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  location: z.string().max(100, "Location is too long").optional(),
  rating: z.number().int().min(1).max(5),
  quote: z.string().min(8, "Please write a little more about your experience").max(500, "Review is too long"),
});

type ReviewFormData = z.infer<typeof reviewSchema>;
type CookiePreference = "accepted" | "denied";

const ADVERT_SLIDE_DURATION_MS = 7000;
const SLIDE_HOLD_PAUSE_MS = 12000;
const DOT_SELECTION_PAUSE_MS = 9000;
const SITE_URL = "https://www.fixmydoor.ca";
const NOTIFICATION_CHOICE_KEY = "fixmydoor-push-choice-v1";
const mobileScrollTrackClass = "fixmydoor-mobile-carousel flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:overflow-visible md:pb-0";
const mobileScrollItemClass = "fixmydoor-flip-card w-[84%] max-w-[23rem] flex-none snap-center md:w-auto md:max-w-none md:flex-auto";

type MobileLoopItem<T> = {
  item: T;
  loopKey: string;
  isClone: boolean;
  loopEdge?: "start" | "end";
};

function createMobileLoopItems<T>(items: T[], getKey: (item: T, index: number) => string): MobileLoopItem<T>[] {
  if (items.length <= 1) {
    return items.map((item, index) => ({
      item,
      loopKey: getKey(item, index),
      isClone: false,
    }));
  }

  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  return [
    {
      item: lastItem,
      loopKey: `loop-start-${getKey(lastItem, items.length - 1)}`,
      isClone: true,
      loopEdge: "start",
    },
    ...items.map((item, index) => ({
      item,
      loopKey: getKey(item, index),
      isClone: false,
    })),
    {
      item: firstItem,
      loopKey: `loop-end-${getKey(firstItem, 0)}`,
      isClone: true,
      loopEdge: "end",
    },
  ];
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type DisplayAdvert = {
  id: string;
  title: string;
  description: string;
  tag: string;
  image: string;
  isVideo: boolean;
  cta: string;
  bookingValue: string;
  updatedAt?: string;
  alt: string;
};

type SiteUpdateEvent = {
  type: "advert" | "review" | "notification";
  title: string;
  message: string;
  url?: string;
};

const navLinks = [
  { href: "#services", label: "Services" },
  { href: "#shop", label: "Shop" },
  { href: "#before-after", label: "Projects" },
  { href: "#about", label: "About" },
  { href: "#testimonials", label: "Reviews" },
  { href: "#contact", label: "Contact" },
];

const BUSINESS_WHATSAPP_NUMBER = "233242011305";
const BUSINESS_WHATSAPP_DISPLAY = "+233 24 201 1305";
const CLIENT_WHATSAPP_MESSAGE = "Hello FixMyDoor Services, I need help with a door, lock, furniture, or hardware request. Please contact me.";
const BUSINESS_WHATSAPP_URL = `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(CLIENT_WHATSAPP_MESSAGE)}`;
const NON_CANADIAN_LOCATION_PATTERN = /\b(united states|usa|u\.s\.a\.|america|ghana|nigeria|uk|united kingdom|england|germany|france|italy|spain|netherlands|uae|dubai|india|china|jamaica|south africa|australia|mexico)\b|,\s*(ny|tx|fl|wa|ga|il|pa|oh|mi|az|nj|va|ma|md|tn|mo|mn|wi|co|sc|al|la|ky|or|ok|ct|ut|nv)\b/i;

function isCanadaLocation(value?: string) {
  const normalized = (value || "").trim().toLowerCase();
  return !normalized || ["canada", "ca", "can"].includes(normalized);
}

const isVideoMedia = (media?: string) =>
  Boolean(media && (media.startsWith("data:video/") || /\.(mp4|webm|ogg)(\?.*)?$/i.test(media)));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function pointerDistance(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) {
    return 0;
  }

  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function toAbsoluteUrl(value?: string) {
  if (!value || value.startsWith("data:")) {
    return undefined;
  }

  try {
    return new URL(value, SITE_URL).toString();
  } catch {
    return undefined;
  }
}

function getAdvertAlt(advert: Pick<DisplayAdvert, "title" | "tag">) {
  return `${advert.title} promotion from FixMyDoor Services${advert.tag ? ` for ${advert.tag}` : ""}`;
}

const serviceAreaNotes = [
  "Based in Montreal at 10158 Rue Berri.",
  "Serving Montreal, Laval, Longueuil, Brossard, the West Island, nearby Quebec areas, and other Canadian locations by request.",
  "International customers can contact us for sourcing, measurements, repair advice, and product guidance.",
];

const coreServiceDetails = [
  {
    title: "Door Repairs",
    text: "We fix doors that stick, scrape, sag, rattle, or refuse to close properly, then explain the best repair option clearly.",
  },
  {
    title: "Door Installations",
    text: "We help with entry, interior, heavy-duty, wood, steel, glass-panel, and custom-fit doors, including measurements and hardware matching.",
  },
  {
    title: "Furniture Repairs",
    text: "We repair loose sofa frames, cabinet doors, drawers, desks, chairs, shelves, and furniture that needs stronger support.",
  },
  {
    title: "Furniture Installations",
    text: "We install and adjust furniture for homes, rentals, offices, and small business spaces.",
  },
  {
    title: "Locks, Hinges & Hardware",
    text: "We help with rekeying, replacement locks, handles, hinges, drawer slides, cabinet hinges, knobs, and matching parts.",
  },
  {
    title: "Hardware Sourcing",
    text: "Before you buy, we help find doors, furniture hardware, repair parts, and fittings that match your size and style.",
  },
];

const trustDetails = [
  "Clear guidance before work begins",
  "Photo review for faster answers",
  "Booking records and tracking links",
  "Canada-based service with worldwide request support",
  "Urgent door and lock issues reviewed as availability allows",
  "Follow-up for the agreed repair or installation scope",
  "Repair, installation, and sourcing handled together",
  "Customer details used only for service communication",
];

const faqItems = [
  {
    question: "Can I send photos before booking?",
    answer: "Yes. Add up to three photos in the request form so we can understand the issue before we call.",
  },
  {
    question: "Can you help me buy the right door or hardware?",
    answer: "Yes. Share the size, finish, swing direction, and installation needs. We will help you choose before you buy.",
  },
  {
    question: "Do you work only in Montreal?",
    answer: "FixMyDoor Services is based in Montreal and also helps nearby Quebec areas, other Canadian locations, and international sourcing requests.",
  },
  {
    question: "Do you handle urgent or emergency door issues?",
    answer: "Yes. Mark the request urgent, call, or send WhatsApp. Availability depends on location, timing, and the issue.",
  },
  {
    question: "Is there follow-up after the work?",
    answer: "Yes. Send photos and booking details if something needs review after the agreed work.",
  },
  {
    question: "Will I receive updates after booking?",
    answer: "Yes. Your confirmation email includes a tracking link, and status changes can also be sent by email.",
  },
];

export default function Home() {
  const [services, setServices] = useState<ServiceCatalogItem[]>(defaultServiceCatalog);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [cookieBannerOpen, setCookieBannerOpen] = useState(false);
  const [humanCheckConfirmed, setHumanCheckConfirmed] = useState(false);
  const [activeAdvertIndex, setActiveAdvertIndex] = useState(0);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [advertDismissed, setAdvertDismissed] = useState(false);
  const [lightboxAdvert, setLightboxAdvert] = useState<DisplayAdvert | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPromptOpen, setNotificationPromptOpen] = useState(false);
  const [notificationPromptLoading, setNotificationPromptLoading] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const advertPauseUntilRef = useRef(0);
  const formReadyAtRef = useRef(Date.now());
  const contentSignatureRef = useRef("");
  const contentFetchInFlightRef = useRef(false);
  const notificationRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const logoPulseRef = useRef<HTMLSpanElement | null>(null);
  const advertNotificationKeysRef = useRef<Set<string> | null>(null);
  const reviewNotificationKeysRef = useRef<Set<string> | null>(null);
  const lightboxPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lightboxPinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const lightboxDragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      country: "Canada",
      timeZone: "",
      preferredContactMethod: "WhatsApp",
      urgency: "Standard",
      requestScope: "Repair or service request",
      currency: "CAD",
      repairType: "",
      preferredDate: "",
      message: "",
      dimensions: "",
      quantity: "",
      material: "",
      color: "",
      swingDirection: "",
      deliveryNeeded: "",
      installationNeeded: "",
      budget: "",
      securityAnswer: "",
      customerConsent: false,
    },
  });
  const reviewForm = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      name: "",
      location: "",
      rating: 5,
      quote: "",
    },
  });

  const registerNotificationWorker = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      notificationRegistrationRef.current = registration;
      return registration;
    } catch (error) {
      console.error("Notification worker registration error:", error);
      return null;
    }
  }, []);

  const refreshInstalledApp = useCallback(async () => {
    try {
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : null;
      await registration?.update();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    } catch (error) {
      console.error("App refresh update check failed:", error);
    } finally {
      window.location.reload();
    }
  }, []);

  const subscribeForPushNotifications = useCallback(async (registration: ServiceWorkerRegistration) => {
    if (!registration.pushManager) {
      throw new Error("Push notifications are not available on this device.");
    }

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

    await axios.post("/api/push/subscribe", { ...subscription.toJSON(), audience: "visitor" });
    return subscription;
  }, []);

  const notifyVisitor = useCallback((event: SiteUpdateEvent) => {
    toast.message(event.title, {
      description: event.message,
      action: event.url
        ? {
            label: "View",
            onClick: () => {
              window.location.href = event.url || "/";
            },
          }
        : undefined,
    });

    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const notificationOptions = {
      body: event.message,
      icon: "/icons/main-icon-v2-192x192.png",
      badge: "/icons/main-icon-v2-96x96.png",
      tag: `fixmydoor-${event.type}`,
      renotify: true,
      silent: false,
      vibrate: [180, 80, 180],
      data: { url: event.url || "/" },
    } as NotificationOptions;

    const registration = notificationRegistrationRef.current;
    if (registration?.showNotification) {
      registration.showNotification(event.title, notificationOptions).catch((error) => {
        console.error("Notification display error:", error);
      });
      return;
    }

    try {
      new Notification(event.title, notificationOptions);
    } catch (error) {
      console.error("Notification display error:", error);
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      toast.error("Browser notifications are not available on this device.");
      return;
    }

    try {
      setNotificationPromptLoading(true);
      const registration = await registerNotificationWorker();
      if (!registration) {
        throw new Error("Service worker registration failed.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationsEnabled(false);
        setNotificationPromptOpen(false);
        window.localStorage.setItem(NOTIFICATION_CHOICE_KEY, "denied");
        window.localStorage.removeItem("fixmydoor-notifications-enabled");
        toast.message("Notifications were not enabled.");
        return;
      }

      await subscribeForPushNotifications(registration);
      registration.showNotification("FixMyDoor notifications are on", {
        body: "Service updates, adverts, and review alerts can now appear on this device.",
        icon: "/icons/main-icon-v2-192x192.png",
        badge: "/icons/main-icon-v2-96x96.png",
        tag: "fixmydoor-alerts-enabled",
        renotify: true,
        silent: false,
        data: { url: "/" },
      } as NotificationOptions).catch((error) => {
        console.error("Notification confirmation display error:", error);
      });
      setNotificationsEnabled(true);
      setNotificationPromptOpen(false);
      window.localStorage.setItem(NOTIFICATION_CHOICE_KEY, "allowed");
      window.localStorage.setItem("fixmydoor-notifications-enabled", "true");
      toast.success("FixMyDoor Services updates are enabled.");
    } catch (error) {
      console.error("Push notification setup error:", error);
      toast.error("Unable to enable notifications right now.");
    } finally {
      setNotificationPromptLoading(false);
    }
  }, [registerNotificationWorker, subscribeForPushNotifications]);

  useEffect(() => {
    const savedPreference = window.localStorage.getItem("fixmydoor-cookie-choice-v2");
    const savedHumanCheck = window.localStorage.getItem("fixmydoor-human-check-v2");
    const isVerified = savedHumanCheck === "verified";

    setHumanCheckConfirmed(isVerified);

    if ((savedPreference !== "accepted" && savedPreference !== "denied") || !isVerified) {
      setCookieBannerOpen(true);
    }
  }, []);

  useEffect(() => {
    const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setNotificationSupported(supported);

    if (!supported) {
      return;
    }

    const enabled = Notification.permission === "granted";
    setNotificationsEnabled(enabled);
    const savedChoice = window.localStorage.getItem(NOTIFICATION_CHOICE_KEY);
    if (!enabled && !savedChoice && Notification.permission === "default") {
      const timer = window.setTimeout(() => setNotificationPromptOpen(true), 2200);
      return () => window.clearTimeout(timer);
    }

    if (enabled) {
      window.localStorage.setItem(NOTIFICATION_CHOICE_KEY, "allowed");
      window.localStorage.setItem("fixmydoor-notifications-enabled", "true");
      registerNotificationWorker().then((registration) => {
        if (registration) {
          subscribeForPushNotifications(registration).catch((error) => {
            console.error("Push re-subscribe error:", error);
          });
        }
      });
    }
  }, [registerNotificationWorker, subscribeForPushNotifications]);

  useEffect(() => {
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateStandaloneState = () => {
      setIsStandaloneApp(standaloneQuery.matches || Boolean(navigatorWithStandalone.standalone));
    };

    updateStandaloneState();
    standaloneQuery.addEventListener?.("change", updateStandaloneState);
    return () => standaloneQuery.removeEventListener?.("change", updateStandaloneState);
  }, []);

  useEffect(() => {
    const updateHeader = () => {
      setHeaderCompact(window.scrollY > 18);
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    let frame = 0;
    let active = true;
    const startedAt = performance.now();

    const animateLogoPulse = (now: number) => {
      const indicator = logoPulseRef.current;
      if (!active || !indicator) {
        return;
      }

      const wave = (Math.sin((now - startedAt) / 420) + 1) / 2;
      const scale = 1 + wave * 0.28;
      indicator.style.transform = `scale(${scale})`;
      indicator.style.opacity = String(0.82 + (scale - 1) * 0.55);
      frame = window.requestAnimationFrame(animateLogoPulse);
    };

    frame = window.requestAnimationFrame(animateLogoPulse);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let active = true;

    axios.get<{ services: ServiceCatalogItem[] }>("/api/services")
      .then(({ data }) => {
        if (active && Array.isArray(data.services) && data.services.length > 0) {
          setServices(data.services);
        }
      })
      .catch((error) => {
        console.error("Service catalog load error:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadContent = (signal?: AbortSignal) => {
      if (contentFetchInFlightRef.current) {
        return;
      }

      contentFetchInFlightRef.current = true;
      axios.get<{ items: ContentItem[] }>("/api/content", { signal })
        .then(({ data }) => {
          if (active && Array.isArray(data.items)) {
            const activeAdvertItems = data.items.filter((item) => item.category === "advert" && item.active);
            const nextAdvertKeys = new Set(activeAdvertItems.map((item) => `${item.id}:${item.updatedAt || item.createdAt}`));
            const previousAdvertKeys = advertNotificationKeysRef.current;
            const newAdvert = previousAdvertKeys
              ? activeAdvertItems.find((item) => !previousAdvertKeys.has(`${item.id}:${item.updatedAt || item.createdAt}`))
              : undefined;

            const nextSignature = JSON.stringify(data.items.map((item) => [
              item.id,
              item.updatedAt,
              item.active,
              item.sortOrder,
            ]));

            if (nextSignature !== contentSignatureRef.current) {
              contentSignatureRef.current = nextSignature;
              setContentItems(data.items);
            }

            advertNotificationKeysRef.current = nextAdvertKeys;
            if (newAdvert) {
              notifyVisitor({
                type: "advert",
                title: "New FixMyDoor Services advert",
                message: newAdvert.title,
                url: "/#booking-form",
              });
            }
          }
        })
        .catch((error) => {
          if (axios.isCancel(error)) {
            return;
          }
          console.error("Content load error:", error);
        })
        .finally(() => {
          contentFetchInFlightRef.current = false;
        });
    };

    const controller = new AbortController();
    loadContent(controller.signal);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadContent();
      }
    }, 90000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadContent();
      }
    };
    const handleSiteRefresh = () => {
      loadContent();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("fixmydoor:refresh-content", handleSiteRefresh);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("fixmydoor:refresh-content", handleSiteRefresh);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadReviews = () => {
      axios.get<{ reviews: Review[] }>("/api/reviews?limit=9")
        .then(({ data }) => {
          if (active && Array.isArray(data.reviews)) {
            const nextReviewKeys = new Set(data.reviews.map((review) => review.id));
            const previousReviewKeys = reviewNotificationKeysRef.current;
            const newReview = previousReviewKeys
              ? data.reviews.find((review) => !previousReviewKeys.has(review.id))
              : undefined;

            setReviews(data.reviews);
            reviewNotificationKeysRef.current = nextReviewKeys;

            if (newReview) {
              notifyVisitor({
                type: "review",
                title: "New FixMyDoor Services review",
                message: `${newReview.rating}-star review from ${newReview.name}`,
                url: "/#testimonials",
              });
            }
          }
        })
        .catch((error) => {
          console.error("Review load error:", error);
        });
    };

    loadReviews();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadReviews();
      }
    }, 90000);
    const handleSiteRefresh = () => {
      loadReviews();
    };
    window.addEventListener("fixmydoor:refresh-reviews", handleSiteRefresh);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("fixmydoor:refresh-reviews", handleSiteRefresh);
    };
  }, [notifyVisitor]);

  useEffect(() => {
    if (!("EventSource" in window)) {
      return;
    }

    const events = new EventSource("/api/site-events");
    const handleSiteUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as SiteUpdateEvent;
        if (payload.type === "notification") {
          notifyVisitor(payload);
          return;
        }

        window.dispatchEvent(new Event(payload.type === "review" ? "fixmydoor:refresh-reviews" : "fixmydoor:refresh-content"));
      } catch (error) {
        console.error("Site update event error:", error);
      }
    };

    events.addEventListener("site-update", handleSiteUpdate);
    events.onerror = () => {
      events.close();
    };

    return () => {
      events.removeEventListener("site-update", handleSiteUpdate);
      events.close();
    };
  }, [notifyVisitor]);

  const onSubmit = async (data: BookingFormData) => {
    const payload: BookingRequest = {
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      address: data.address.trim(),
      city: data.city?.trim() || undefined,
      country: data.country?.trim() || undefined,
      timeZone: data.timeZone?.trim() || undefined,
      preferredContactMethod: data.preferredContactMethod?.trim() || undefined,
      urgency: data.urgency?.trim() || undefined,
      requestScope: data.requestScope?.trim() || undefined,
      currency: data.currency?.trim() || undefined,
      repairType: data.repairType,
      preferredDate: data.preferredDate || undefined,
      message: data.message?.trim() || undefined,
      photos: photoPreviews,
      dimensions: data.dimensions?.trim() || undefined,
      quantity: data.quantity?.trim() || undefined,
      material: data.material?.trim() || undefined,
      color: data.color?.trim() || undefined,
      swingDirection: data.swingDirection?.trim() || undefined,
      deliveryNeeded: data.deliveryNeeded?.trim() || undefined,
      installationNeeded: data.installationNeeded?.trim() || undefined,
      budget: data.budget?.trim() || undefined,
      securityAnswer: data.securityAnswer.trim(),
      customerConsent: data.customerConsent,
      submittedAt: new Date(formReadyAtRef.current).toISOString(),
      website: "",
    };

    try {
      const response = await axios.post<{ success: boolean; trackingUrl?: string; email?: { customer?: boolean; admin?: boolean; queued?: boolean } }>("/api/bookings", payload);
      const emailStatus = response.data.email;
      const trackingUrl = response.data.trackingUrl;
      const toastOptions = trackingUrl
        ? {
            action: {
              label: "Track request",
              onClick: () => window.open(trackingUrl, "_blank", "noopener,noreferrer"),
            },
          }
        : undefined;

      if (emailStatus?.queued) {
        toast.message("Your request was received.", {
          description: "Email is still being sent. Use the tracking button here if the email is delayed.",
          ...toastOptions,
        });
      } else if (emailStatus && (!emailStatus.customer || !emailStatus.admin)) {
        toast.warning("Your request was saved, but email delivery needs attention. Please call or WhatsApp us if no email arrives.", toastOptions);
      } else {
        toast.success("Thanks, your request was received. A tracking link is available now.", toastOptions);
      }
      form.reset();
      setPhotoPreviews([]);
      formReadyAtRef.current = Date.now();
    } catch (error) {
      toast.error("Unable to submit booking at this time. Please try again later.");
      console.error("Booking submission error:", error);
    }
  };

  const footerServices = services.filter((service) => service.showInFooter);
  const bookingServices = services.filter((service) => service.showInBooking);
  const displayReviews = reviews.length > 0 ? reviews : customerReviews.map((review, index) => ({
    id: `default-${index}`,
    name: review.name,
    location: review.location,
    rating: 5,
    quote: review.quote,
    createdAt: "",
  }));
  const featuredReviews = displayReviews.slice(0, 3);
  const dynamicItems = (category: ContentItem["category"]) =>
    contentItems
      .filter((item) => item.category === category && item.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  const dynamicServiceShowcase = dynamicItems("serviceShowcase").map((item) => ({
    src: item.image || heroImage,
    title: item.title,
    desc: item.description || "",
    tag: item.tag || "Service",
    contain: false,
  }));
  const dynamicProductCategories = dynamicItems("productCategory").map((item) => ({
    title: item.title,
    desc: item.description || "",
    items: item.items || "Ask us about sizes, finish, delivery, and installation",
    image: item.image || doorProducts[0].image,
    accent: item.accentImage || item.image || doorProducts[1].image,
    bookingValue: item.bookingValue || "door-purchase",
  }));
  const dynamicDoorProducts = dynamicItems("doorProduct").map((item) => ({
    title: item.title,
    image: item.image || doorProducts[0].image,
    tag: item.tag || "Door Option",
  }));
  const dynamicHardwareProducts = dynamicItems("hardwareProduct").map((item) => ({
    title: item.title,
    image: item.image || hardwareProducts[0].image,
    tag: item.tag || "Hardware",
  }));
  const dynamicProjectGallery = dynamicItems("projectGallery").map((item) => ({
    src: item.image || projectGallery[0].src,
    title: item.title,
    desc: item.description || "",
    category: item.tag || "Project",
  }));
  const dynamicAdverts: DisplayAdvert[] = dynamicItems("advert").map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description || "See what is available now and send a request for details.",
    tag: item.tag || "Promotion",
    image: item.image || heroImage,
    isVideo: isVideoMedia(item.image),
    cta: item.items || "Send Request",
    bookingValue: item.bookingValue || "consultation",
    updatedAt: item.updatedAt || item.createdAt,
    alt: getAdvertAlt({ title: item.title, tag: item.tag || "Promotion" }),
  }));
  const displayedServiceShowcase = dynamicServiceShowcase.length > 0 ? dynamicServiceShowcase : serviceShowcase;
  const displayedProductCategories = dynamicProductCategories.length > 0 ? dynamicProductCategories : productCategories;
  const displayedDoorProducts = dynamicDoorProducts.length > 0 ? dynamicDoorProducts : doorProducts;
  const displayedHardwareProducts = dynamicHardwareProducts.length > 0 ? dynamicHardwareProducts : hardwareProducts;
  const displayedProjectGallery = dynamicProjectGallery.length > 0 ? dynamicProjectGallery : projectGallery;
  const displayedAdverts = dynamicAdverts;
  const desktopProjectGallery = displayedProjectGallery.slice(0, 6);
  const customerPathLoopItems = createMobileLoopItems(customerPaths, (item) => item.title);
  const coreServiceLoopItems = createMobileLoopItems(coreServiceDetails, (item) => item.title);
  const serviceShowcaseLoopItems = createMobileLoopItems(displayedServiceShowcase, (item) => item.title);
  const productCategoryLoopItems = createMobileLoopItems(displayedProductCategories, (item) => item.title);
  const doorProductLoopItems = createMobileLoopItems(displayedDoorProducts, (item) => item.title);
  const hardwareProductLoopItems = createMobileLoopItems(displayedHardwareProducts, (item) => item.title);
  const projectGalleryLoopItems = createMobileLoopItems(displayedProjectGallery, (item) => item.title);
  const reviewLoopItems = createMobileLoopItems(featuredReviews, (item) => item.id);
  const displayedAdvertsSignature = displayedAdverts.map((advert) => `${advert.id}:${advert.updatedAt || advert.title}`).join("|");
  const reviewSchemaItems = reviews.slice(0, 9);
  const averageRating = reviewSchemaItems.length > 0
    ? reviewSchemaItems.reduce((total, review) => total + review.rating, 0) / reviewSchemaItems.length
    : 0;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${SITE_URL}/#business`,
        name: "FixMyDoor Services",
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/img5150-transparent.png`,
        image: `${SITE_URL}/og-fixmydoor-service.jpg`,
        description: "Door repairs, door installations, furniture repairs, lock rekeying, and hardware sourcing in Montreal, Quebec, Canada.",
        telephone: "+1-438-347-1823",
        email: "info.fixmydoor@gmail.com",
        address: {
          "@type": "PostalAddress",
          streetAddress: "10158 Rue Berri",
          addressLocality: "Montreal",
          addressRegion: "QC",
          addressCountry: "CA",
        },
        areaServed: ["Montreal", "Laval", "Longueuil", "Brossard", "Quebec", "Canada"],
        openingHours: "Mo-Su 08:00-20:00",
        priceRange: "$$",
        sameAs: ["https://www.fixmydoor.ca"],
        ...(reviewSchemaItems.length > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: Number(averageRating.toFixed(1)),
                reviewCount: reviewSchemaItems.length,
                bestRating: 5,
                worstRating: 1,
              },
              review: reviewSchemaItems.map((review) => ({
                "@type": "Review",
                "@id": `${SITE_URL}/#review-${review.id}`,
                author: {
                  "@type": "Person",
                  name: review.name,
                },
                datePublished: review.createdAt || undefined,
                reviewBody: review.quote,
                reviewRating: {
                  "@type": "Rating",
                  ratingValue: review.rating,
                  bestRating: 5,
                  worstRating: 1,
                },
              })),
            }
          : {}),
      },
      ...displayedAdverts.map((advert, index) => ({
        "@type": "Offer",
        "@id": `${SITE_URL}/#promotion-${advert.id || index}`,
        name: advert.title,
        description: advert.description,
        image: toAbsoluteUrl(advert.image),
        url: `${SITE_URL}/#booking-form`,
        availability: "https://schema.org/InStock",
        itemOffered: {
          "@type": "Service",
          name: advert.title,
          description: advert.description,
          provider: {
            "@id": `${SITE_URL}/#business`,
          },
        },
      })),
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
  const watchedAddress = form.watch("address");
  const watchedCountry = form.watch("country");
  const showInternationalRequestDetails = !isCanadaLocation(watchedCountry) || NON_CANADIAN_LOCATION_PATTERN.test(watchedAddress || "");

  const pauseAdvertSlider = (duration = SLIDE_HOLD_PAUSE_MS) => {
    advertPauseUntilRef.current = Date.now() + duration;
  };

  const dismissAdvert = () => {
    window.sessionStorage.setItem("fixmydoor-dismissed-ad-signature", displayedAdvertsSignature);
    setAdvertDismissed(true);
  };

  const openAdvertLightbox = (advert: DisplayAdvert) => {
    pauseAdvertSlider(DOT_SELECTION_PAUSE_MS);
    lightboxPointersRef.current.clear();
    lightboxPinchRef.current = null;
    lightboxDragRef.current = null;
    setLightboxAdvert(advert);
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  };

  const closeAdvertLightbox = () => {
    setLightboxAdvert(null);
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
    lightboxPointersRef.current.clear();
    lightboxPinchRef.current = null;
    lightboxDragRef.current = null;
  };

  const updateLightboxZoom = (nextZoom: number | ((currentZoom: number) => number)) => {
    setLightboxZoom((currentZoom) => {
      const resolvedZoom = typeof nextZoom === "function" ? nextZoom(currentZoom) : nextZoom;
      const clampedZoom = clamp(resolvedZoom, 1, 5);
      if (clampedZoom === 1) {
        setLightboxPan({ x: 0, y: 0 });
      }
      return clampedZoom;
    });
  };

  const handleLightboxWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateLightboxZoom((currentZoom) => currentZoom + (event.deltaY > 0 ? -0.18 : 0.18));
  };

  const handleLightboxPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    lightboxPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const points = Array.from(lightboxPointersRef.current.values());
    if (points.length >= 2) {
      lightboxPinchRef.current = {
        distance: pointerDistance(points),
        zoom: lightboxZoom,
      };
      lightboxDragRef.current = null;
      return;
    }

    if (lightboxZoom > 1) {
      lightboxDragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX: lightboxPan.x,
        panY: lightboxPan.y,
      };
    }
  };

  const handleLightboxPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!lightboxPointersRef.current.has(event.pointerId)) {
      return;
    }

    lightboxPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(lightboxPointersRef.current.values());

    if (points.length >= 2 && lightboxPinchRef.current) {
      const nextDistance = pointerDistance(points);
      if (nextDistance > 0 && lightboxPinchRef.current.distance > 0) {
        updateLightboxZoom(lightboxPinchRef.current.zoom * (nextDistance / lightboxPinchRef.current.distance));
      }
      return;
    }

    const drag = lightboxDragRef.current;
    if (drag && drag.pointerId === event.pointerId && lightboxZoom > 1) {
      setLightboxPan({
        x: drag.panX + event.clientX - drag.x,
        y: drag.panY + event.clientY - drag.y,
      });
    }
  };

  const handleLightboxPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    lightboxPointersRef.current.delete(event.pointerId);
    if (lightboxPointersRef.current.size < 2) {
      lightboxPinchRef.current = null;
    }
    if (lightboxDragRef.current?.pointerId === event.pointerId) {
      lightboxDragRef.current = null;
    }
  };

  const showPreviousAdvert = () => {
    if (displayedAdverts.length === 0) {
      return;
    }
    pauseAdvertSlider(DOT_SELECTION_PAUSE_MS);
    setActiveAdvertIndex((currentIndex) => (
      currentIndex === 0 ? displayedAdverts.length - 1 : currentIndex - 1
    ));
  };

  const showNextAdvert = () => {
    if (displayedAdverts.length === 0) {
      return;
    }
    pauseAdvertSlider(DOT_SELECTION_PAUSE_MS);
    setActiveAdvertIndex((currentIndex) => (currentIndex + 1) % displayedAdverts.length);
  };

  useEffect(() => {
    setActiveAdvertIndex(0);
  }, [displayedAdverts.length]);

  useEffect(() => {
    setAdvertDismissed(window.sessionStorage.getItem("fixmydoor-dismissed-ad-signature") === displayedAdvertsSignature);
  }, [displayedAdvertsSignature]);

  useEffect(() => {
    if (!lightboxAdvert) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAdvertLightbox();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxAdvert]);

  useEffect(() => {
    if (displayedAdverts.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      if (Date.now() < advertPauseUntilRef.current) {
        return;
      }

      setActiveAdvertIndex((currentIndex) => (currentIndex + 1) % displayedAdverts.length);
    }, ADVERT_SLIDE_DURATION_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [displayedAdverts.length]);

  useEffect(() => {
    const pauseTrack = (event: Event) => {
      const track = event.currentTarget as HTMLElement;
      track.dataset.pauseUntil = String(Date.now() + 10000);
    };

    const getCarouselItems = (track: HTMLElement) =>
      Array.from(track.children).filter((child): child is HTMLElement => child instanceof HTMLElement);

    const getOriginalCarouselItems = (track: HTMLElement) =>
      getCarouselItems(track).filter((item) => item.dataset.loopClone !== "true");

    const getClosestCarouselItem = (track: HTMLElement) => {
      const items = getCarouselItems(track);
      if (!items.length) {
        return undefined;
      }

      return items.reduce((closest, item) => {
        const closestDistance = Math.abs(track.scrollLeft - closest.offsetLeft);
        const itemDistance = Math.abs(track.scrollLeft - item.offsetLeft);
        return itemDistance < closestDistance ? item : closest;
      }, items[0]);
    };

    const setInstantCarouselPosition = (track: HTMLElement, left: number) => {
      track.classList.add("fixmydoor-carousel-resetting");
      track.scrollTo({ left, behavior: "auto" });
      window.setTimeout(() => {
        track.classList.remove("fixmydoor-carousel-resetting");
      }, 40);
    };

    const primeTrackPosition = (track: HTMLElement) => {
      if (
        track.dataset.loopPrimed === "true" ||
        window.matchMedia("(min-width: 768px)").matches ||
        track.scrollWidth <= track.clientWidth + 8
      ) {
        return;
      }

      const firstOriginal = getOriginalCarouselItems(track)[0];
      if (!firstOriginal) {
        return;
      }

      track.dataset.loopPrimed = "true";
      setInstantCarouselPosition(track, firstOriginal.offsetLeft);
    };

    const loopTrackEdges = (track: HTMLElement) => {
      if (window.matchMedia("(min-width: 768px)").matches || track.scrollWidth <= track.clientWidth + 8) {
        return;
      }

      const originals = getOriginalCarouselItems(track);
      if (originals.length < 2) {
        return;
      }

      const closestItem = getClosestCarouselItem(track);
      if (!closestItem?.dataset.loopEdge) {
        return;
      }

      const target = closestItem.dataset.loopEdge === "start" ? originals[originals.length - 1] : originals[0];
      setInstantCarouselPosition(track, target.offsetLeft);
    };

    const handleTrackResize = (entries: ResizeObserverEntry[]) => {
      entries.forEach((entry) => {
        const track = entry.target as HTMLElement;
        track.dataset.loopPrimed = "false";
        window.setTimeout(() => primeTrackPosition(track), 60);
      });
    };

    const resizeObserver = new ResizeObserver(handleTrackResize);

    const handleTrackPointerUp = (event: Event) => {
      const track = event.currentTarget as HTMLElement;
      window.clearTimeout(Number(track.dataset.loopTimer || "0"));
      const timerId = window.setTimeout(() => loopTrackEdges(track), 120);
      track.dataset.loopTimer = String(timerId);
    };

    const handleTrackScroll = (event: Event) => {
      const track = event.currentTarget as HTMLElement;
      if (track.classList.contains("fixmydoor-carousel-resetting")) {
        return;
      }

      window.clearTimeout(Number(track.dataset.loopTimer || "0"));
      const timerId = window.setTimeout(() => loopTrackEdges(track), 90);
      track.dataset.loopTimer = String(timerId);
    };

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const card = entry.target as HTMLElement;
        if (!entry.isIntersecting) {
          return;
        }

        card.classList.add("is-visible");
        revealObserver.unobserve(card);
      });
    }, {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.24,
    });

    const trackObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const track = entry.target as HTMLElement;
        track.dataset.inView = entry.isIntersecting ? "true" : "false";

        if (entry.isIntersecting && track.dataset.startedInView !== "true") {
          track.dataset.startedInView = "true";
          track.dataset.pauseUntil = String(Date.now() + 900);
          track.querySelectorAll<HTMLElement>(".fixmydoor-flip-card").forEach((card, index) => {
            card.style.setProperty("--flip-delay", `${Math.min(index * 90, 540)}ms`);
            revealObserver.observe(card);
          });
        }
      });
    }, {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.18,
    });

    const wireTracks = () => {
      document.querySelectorAll<HTMLElement>(".fixmydoor-mobile-carousel").forEach((track) => {
        if (track.dataset.autoCarouselReady === "true") {
          return;
        }

        track.dataset.autoCarouselReady = "true";
        track.dataset.inView = "false";
        track.dataset.loopPrimed = "false";
        track.addEventListener("pointerdown", pauseTrack);
        track.addEventListener("pointerup", handleTrackPointerUp);
        track.addEventListener("pointercancel", handleTrackPointerUp);
        track.addEventListener("touchend", handleTrackPointerUp, { passive: true });
        track.addEventListener("touchstart", pauseTrack, { passive: true });
        track.addEventListener("wheel", pauseTrack, { passive: true });
        track.addEventListener("scroll", handleTrackScroll, { passive: true });
        resizeObserver.observe(track);
        window.setTimeout(() => primeTrackPosition(track), 80);
        trackObserver.observe(track);
      });
    };

    wireTracks();

    const timer = window.setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        window.matchMedia("(min-width: 768px)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const tracks = document.querySelectorAll<HTMLElement>(".fixmydoor-mobile-carousel");
      tracks.forEach((track) => {
        if (track.dataset.inView !== "true") {
          return;
        }

        const pauseUntil = Number(track.dataset.pauseUntil || "0");
        if (pauseUntil > Date.now()) {
          return;
        }

        primeTrackPosition(track);

        const items = getCarouselItems(track);
        if (items.length < 2 || track.scrollWidth <= track.clientWidth + 8) {
          return;
        }

        const currentItem = getClosestCarouselItem(track);
        const currentIndex = currentItem ? items.indexOf(currentItem) : 0;
        const nextItem = items[Math.min(currentIndex + 1, items.length - 1)] || items[1] || items[0];
        track.scrollTo({ left: nextItem.offsetLeft, behavior: "smooth" });
      });
    }, 8000);

    return () => {
      window.clearInterval(timer);
      document.querySelectorAll<HTMLElement>(".fixmydoor-mobile-carousel").forEach((track) => {
        track.removeEventListener("pointerdown", pauseTrack);
        track.removeEventListener("pointerup", handleTrackPointerUp);
        track.removeEventListener("pointercancel", handleTrackPointerUp);
        track.removeEventListener("touchend", handleTrackPointerUp);
        track.removeEventListener("touchstart", pauseTrack);
        track.removeEventListener("wheel", pauseTrack);
        track.removeEventListener("scroll", handleTrackScroll);
        window.clearTimeout(Number(track.dataset.loopTimer || "0"));
        resizeObserver.unobserve(track);
        trackObserver.unobserve(track);
      });
      resizeObserver.disconnect();
      revealObserver.disconnect();
      trackObserver.disconnect();
    };
  }, [displayedServiceShowcase.length, displayedProductCategories.length, displayedDoorProducts.length, displayedHardwareProducts.length, displayedProjectGallery.length, featuredReviews.length]);

  const scrollToContactForm = () => {
    document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>("#booking-form input[name='name']")?.focus({ preventScroll: true });
    }, 500);
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const files = selectedFiles.slice(0, 3);

    if (selectedFiles.length > 3) {
      toast.warning("You can upload up to 3 photos for one request.");
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file.`);
        return false;
      }

      if (file.size > 1_800_000) {
        toast.error(`${file.name} is too large. Please use images under 1.8MB.`);
        return false;
      }

      return true;
    });

    const readFile = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    try {
      const previews = await Promise.all(validFiles.map(async (file) => {
        const dataUrl = await readFile(file);
        const response = await axios.post<{ url: string }>("/api/media", { dataUrl, fileName: file.name });
        return response.data.url;
      }));
      setPhotoPreviews(previews);
    } catch (error) {
      toast.error("Unable to upload one of the selected photos.");
      console.error("Photo read error:", error);
    }
  };

  const onReviewSubmit = async (data: ReviewFormData) => {
    const payload: ReviewRequest = {
      name: data.name.trim(),
      location: data.location?.trim() || undefined,
      rating: data.rating,
      quote: data.quote.trim(),
    };

    try {
      const response = await axios.post<{ review: Review }>("/api/reviews", payload);
      if (response.data.review?.status === "APPROVED") {
        setReviews((currentReviews) => [response.data.review, ...currentReviews].slice(0, 9));
      }
      reviewForm.reset({ name: "", location: "", rating: 5, quote: "" });
      setReviewFormOpen(false);
      toast.success("Thank you. Your review was sent and will appear after approval.");
    } catch (error) {
      toast.error("Unable to submit review right now. Please try again later.");
      console.error("Review submission error:", error);
    }
  };

  const handleServicePick = (service: ServiceCatalogItem) => {
    form.setValue("repairType", service.bookingValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    scrollToContactForm();

    toast.success(`${service.title} selected. Add your details and we'll follow up.`);
  };

  const handleCatalogPick = (bookingValue: string, label: string) => {
    form.setValue("repairType", bookingValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    const currentMessage = form.getValues("message")?.trim();
    if (!currentMessage) {
      form.setValue("message", `I'm interested in ${label}. Please contact me with availability, sizing, and pricing.`, {
        shouldDirty: true,
      });
    }

    scrollToContactForm();

    toast.success(`${label} selected. Add your details and we'll follow up.`);
  };

  const openReviewForm = () => {
    setReviewFormOpen(true);
    window.setTimeout(() => {
      document.getElementById("write-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const saveCookiePreference = (preference: CookiePreference) => {
    if (!humanCheckConfirmed) {
      toast.error("Please confirm you are a real visitor before continuing.");
      return;
    }

    window.localStorage.setItem("fixmydoor-cookie-choice-v2", preference);
    window.localStorage.setItem("fixmydoor-human-check-v2", "verified");
    setCookieBannerOpen(false);
    toast.success(preference === "accepted" ? "Cookie preference saved." : "Optional cookies declined.");
  };

  const scrollMobileCarousel = (trackId: string, direction: -1 | 1) => {
    const track = document.getElementById(trackId);
    if (!track) {
      return;
    }

    track.dataset.pauseUntil = String(Date.now() + 7000);

    const items = Array.from(track.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    if (items.length <= 1) {
      return;
    }

    const currentIndex = items.reduce((closestIndex, item, index) => {
      const closestDistance = Math.abs(track.scrollLeft - items[closestIndex].offsetLeft);
      const itemDistance = Math.abs(track.scrollLeft - item.offsetLeft);
      return itemDistance < closestDistance ? index : closestIndex;
    }, 0);
    const fallbackIndex = direction > 0 ? 1 : items.length - 2;
    const nextIndex = currentIndex + direction;
    const nextItem = items[nextIndex] || items[fallbackIndex] || items[0];

    track.scrollTo({ left: nextItem.offsetLeft, behavior: "smooth" });
  };

  const renderMobileCarouselControls = (trackId: string, count: number, dark = false) => {
    if (count <= 1) {
      return null;
    }

    return (
      <div className={`mt-3 flex items-center justify-center gap-3 md:hidden ${dark ? "text-white" : "text-secondary"}`}>
        <button
          type="button"
          onClick={() => scrollMobileCarousel(trackId, -1)}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition ${dark ? "border-white/14 bg-white/10 hover:bg-white/18" : "border-primary/12 bg-white hover:border-primary hover:text-primary"}`}
          aria-label="Show previous item"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: Math.min(count, 5) }).map((_, index) => (
            <span key={index} className={`h-1.5 rounded-full ${index === 0 ? "w-5 bg-primary" : dark ? "w-1.5 bg-white/35" : "w-1.5 bg-secondary/25"}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => scrollMobileCarousel(trackId, 1)}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition ${dark ? "bg-primary text-white hover:bg-primary/90" : "bg-secondary text-white hover:bg-primary"}`}
          aria-label="Show next item"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav className={`sticky top-0 z-50 border-b border-primary/15 bg-[#f7efe4]/96 shadow-[0_8px_28px_rgba(47,36,28,0.06)] backdrop-blur transition-all duration-300 ${headerCompact ? "shadow-[0_12px_32px_rgba(47,36,28,0.12)]" : ""}`}>
        <div className={`container flex max-w-[1180px] items-center justify-between gap-2 transition-all duration-300 sm:gap-4 md:py-2.5 ${headerCompact ? "py-1" : "py-1.5"}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <a href="/" className="group flex shrink-0 items-center" aria-label="FixMyDoor Services homepage">
              <span className={`relative inline-flex items-center justify-center rounded-[1.35rem] border border-white/70 bg-white/88 px-2 shadow-[0_12px_26px_rgba(66,40,18,0.12)] ring-1 ring-primary/10 transition-all duration-300 ${headerCompact ? "h-11" : "h-12"} sm:h-16 md:h-20`}>
                <img src="/img5150-transparent.png" alt="FixMyDoor logo" decoding="async" className={`w-auto object-contain drop-shadow-[0_10px_18px_rgba(66,40,18,0.14)] transition-all duration-300 ${headerCompact ? "h-10" : "h-11"} sm:h-16 md:h-20`} />
                <span
                  ref={logoPulseRef}
                  className="absolute -right-1 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12),0_0_18px_rgba(16,185,129,0.65)]"
                  aria-hidden="true"
                />
              </span>
            </a>
            <div className="hidden min-w-0 max-w-[13.5rem] min-[430px]:block sm:max-w-[20rem] md:max-w-[28rem] lg:max-w-[23rem] xl:max-w-[30rem]">
              <p className="truncate font-display text-[0.82rem] font-bold leading-tight text-secondary sm:text-base md:text-lg">
                FixMyDoor Services | Door & Furniture Repairs
              </p>
              <p className="mt-0.5 truncate text-[0.56rem] font-semibold uppercase leading-tight tracking-[0.08em] text-secondary/65 sm:text-[0.63rem] sm:tracking-[0.12em] md:text-[0.68rem]">
                Repairs, installations, doors, furniture, and hardware sourcing.
              </p>
            </div>
          </div>
          <div className="hidden gap-2 text-xs font-semibold xl:flex 2xl:gap-4 2xl:text-sm">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-primary">{link.label}</a>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <a href="tel:+14383471823" className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-primary px-2.5 text-[0.72rem] font-extrabold text-white shadow-[0_12px_26px_rgba(180,101,50,0.24)] ring-1 ring-white/40 transition hover:-translate-y-0.5 hover:bg-primary/90 min-[380px]:px-3 sm:h-11 sm:px-4 sm:text-sm">
              <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden min-[380px]:inline sm:inline">Call Now</span>
              <span className="min-[380px]:hidden">Call</span>
            </a>
            <LanguageTranslator className="h-10 sm:h-11" />
            {isStandaloneApp && (
              <button
                type="button"
                onClick={refreshInstalledApp}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-white text-secondary shadow-[0_10px_22px_rgba(47,36,28,0.10)] ring-1 ring-white/70 transition hover:bg-primary hover:text-white sm:h-11 sm:w-auto sm:px-3"
                aria-label="Refresh FixMyDoor app"
                title="Refresh app"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="ml-2 hidden text-xs font-extrabold sm:inline">Refresh</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border text-secondary shadow-[0_10px_22px_rgba(47,36,28,0.10)] ring-1 ring-white/70 transition-all duration-300 lg:hidden ${mobileMenuOpen ? "border-primary bg-secondary text-white" : "border-primary/15 bg-white hover:bg-primary/10"}`}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div className={`border-t border-primary/10 bg-white/62 px-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all duration-300 min-[430px]:hidden ${headerCompact ? "py-1" : "py-1.5"}`}>
          <p className="font-display text-[0.82rem] font-bold leading-tight text-secondary">
            FixMyDoor Services | Door & Furniture Repairs
          </p>
          <p className="mt-0.5 text-[0.62rem] font-semibold uppercase leading-tight tracking-[0.08em] text-secondary/65">
            Repairs, installations, doors, furniture, and hardware sourcing.
          </p>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-primary/10 bg-white lg:hidden">
            <div className="container grid max-w-[1180px] gap-2 py-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-2xl bg-background px-4 py-3 text-sm font-bold text-secondary"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,_#f8f3ea,_#ffffff)]">
        <div className="container grid max-w-[1180px] items-center gap-4 py-4 sm:py-7 md:grid-cols-[0.9fr_1fr] md:py-8 lg:gap-8">
          <div className="max-w-lg">
            <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-primary/18 bg-white px-3.5 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-secondary shadow-sm">
              <Globe2 className="h-4 w-4 text-primary" />
              Montreal-based. Requests welcome.
            </div>
            <h1 className="font-display text-[1.9rem] font-bold leading-[1.06] text-secondary sm:text-4xl md:text-[3.05rem] xl:text-[3.25rem]">
              Door, lock, furniture, or hardware problem?
            </h1>
            <p className="mt-3 max-w-[32rem] text-[0.94rem] leading-relaxed text-foreground/75 md:text-[1.03rem]">
              Send a photo or short note. FixMyDoor Services will review it and guide you to the right repair, installation, or product.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <button type="button" onClick={scrollToContactForm} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-3.5 py-2.5 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(180,101,50,0.24)] ring-1 ring-white/50 transition hover:-translate-y-0.5 hover:bg-primary/90 sm:px-4">
                <span className="sm:hidden">Book Repair</span>
                <span className="hidden sm:inline">Book a Repair</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#shop" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-secondary/15 bg-white px-3.5 py-2.5 text-sm font-extrabold text-secondary shadow-[0_10px_24px_rgba(47,36,28,0.08)] transition hover:-translate-y-0.5 hover:border-primary hover:text-primary sm:px-4">
                <ShoppingBag className="h-4 w-4" />
                <span className="sm:hidden">Shop Parts</span>
                <span className="hidden sm:inline">Shop Doors & Hardware</span>
              </a>
              <a href="tel:+14383471823" className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-secondary px-3.5 py-2.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(47,36,28,0.18)] transition hover:-translate-y-0.5 hover:bg-secondary/90 sm:col-span-1 sm:px-4">
                <Phone className="h-4 w-4" />
                <span className="sm:hidden">Call +1 (438) 347-1823</span>
                <span className="hidden sm:inline">Call +1 (438) 347-1823</span>
              </a>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-2.5">
              <div className="flex items-start gap-2.5 rounded-[18px] border border-primary/10 bg-white p-3 shadow-[0_12px_28px_rgba(47,36,28,0.06)] sm:block sm:p-3.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0 sm:mb-2 sm:h-5 sm:w-5" />
                <div>
                  <p className="text-[0.78rem] font-extrabold leading-tight text-secondary sm:text-sm">Quick Reply</p>
                  <p className="mt-0.5 text-[0.72rem] leading-snug text-foreground/65 sm:mt-1 sm:text-xs sm:leading-relaxed">Tell us the issue. We will guide you from there.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-[18px] border border-primary/10 bg-white p-3 shadow-[0_12px_28px_rgba(47,36,28,0.06)] sm:block sm:p-3.5">
                <div className="mt-0.5 text-base font-black leading-none text-primary sm:mt-0 sm:mb-2 sm:text-xl">C$</div>
                <div>
                  <p className="text-[0.78rem] font-extrabold leading-tight text-secondary sm:text-sm">Fair C$ Pricing</p>
                  <p className="mt-0.5 text-[0.72rem] leading-snug text-foreground/65 sm:mt-1 sm:text-xs sm:leading-relaxed">Clear answers before any work starts.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-[18px] border border-primary/10 bg-white p-3 shadow-[0_12px_28px_rgba(47,36,28,0.06)] sm:block sm:p-3.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0 sm:mb-2 sm:h-5 sm:w-5" />
                <div>
                  <p className="text-[0.78rem] font-extrabold leading-tight text-secondary sm:text-sm">Neat Finish</p>
                  <p className="mt-0.5 text-[0.72rem] leading-snug text-foreground/65 sm:mt-1 sm:text-xs sm:leading-relaxed">Careful work without messy shortcuts.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white p-2 shadow-[0_24px_70px_rgba(66,40,18,0.16)] md:rounded-[32px] md:p-3 md:shadow-[0_30px_90px_rgba(66,40,18,0.18)]">
              <img src={heroImage} alt="Front door lock rekeying service" loading="eager" decoding="async" className="h-[235px] w-full rounded-[22px] object-cover object-center sm:h-[320px] md:h-[430px] md:rounded-[24px]" />
              <div className="absolute bottom-4 left-4 right-4 rounded-[20px] border border-white/70 bg-white/94 p-3 shadow-[0_14px_30px_rgba(47,36,28,0.16)] md:bottom-7 md:left-7 md:right-7 md:max-w-sm md:rounded-[24px] md:p-4">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Featured Service</p>
                <h2 className="mt-1 text-lg font-bold text-secondary md:mt-2 md:text-2xl">Rekeying & Entry Security</h2>
                <p className="mt-1 text-xs leading-relaxed text-foreground/70 md:mt-2 md:text-sm">
                  Lost key, tenant change, or loose handle? We can rekey, adjust, or recommend secure hardware.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {notificationPromptOpen && notificationSupported && !notificationsEnabled && (
        <aside className="fixed bottom-4 left-3 right-3 z-50 sm:left-auto sm:right-5 sm:max-w-[24rem]" aria-live="polite">
          <div className="overflow-hidden rounded-[24px] border border-primary/18 bg-white shadow-[0_24px_70px_rgba(47,36,28,0.22)]">
            <div className="flex gap-3 bg-[#2f241c] p-4 text-white">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FAF6F0]">
                <img src="/icons/main-icon-v2-96x96.png" alt="" className="h-9 w-9 object-contain" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">FixMyDoor updates</p>
                <h2 className="mt-1 text-lg font-bold leading-tight">Stay updated with FixMyDoor Services.</h2>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  No app install needed. Allow notifications to receive helpful tips, service updates, and new offers.
                </p>
              </div>
            </div>
            <div className="flex gap-2 bg-[#fffaf2] p-3">
              <button
                type="button"
                onClick={enableNotifications}
                disabled={notificationPromptLoading}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-black text-white transition hover:bg-primary/90 disabled:opacity-70"
              >
                {notificationPromptLoading ? "Enabling..." : "Allow"}
              </button>
              <button
                type="button"
                onClick={() => {
                  window.localStorage.setItem(NOTIFICATION_CHOICE_KEY, "dismissed");
                  setNotificationPromptOpen(false);
                }}
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-primary/18 bg-white px-4 py-2.5 text-sm font-black text-secondary transition hover:border-primary hover:text-primary"
              >
                No Thanks
              </button>
            </div>
          </div>
        </aside>
      )}

      {displayedAdverts.length > 0 && !advertDismissed && (
        <aside
          className={`fixed left-3 right-3 z-40 sm:left-auto sm:right-5 sm:w-[25rem] ${notificationPromptOpen && notificationSupported && !notificationsEnabled ? "bottom-[15rem] sm:bottom-[15.5rem]" : "bottom-3 sm:bottom-5"}`}
          onPointerDown={() => pauseAdvertSlider()}
          onPointerUp={() => pauseAdvertSlider(DOT_SELECTION_PAUSE_MS)}
          onPointerCancel={() => pauseAdvertSlider(DOT_SELECTION_PAUSE_MS)}
          onMouseEnter={() => pauseAdvertSlider(DOT_SELECTION_PAUSE_MS)}
          aria-live="polite"
          aria-label="FixMyDoor Services promotion"
        >
          <div className="relative overflow-hidden rounded-[26px] border border-white/70 bg-white/94 shadow-[0_24px_70px_rgba(47,36,28,0.24)] ring-1 ring-primary/15 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,165,116,0.30),_transparent_42%),linear-gradient(135deg,_rgba(255,250,243,0.96),_rgba(255,255,255,0.92)_55%,_rgba(241,223,205,0.86))]" />
            <button
              type="button"
              onClick={dismissAdvert}
              className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/92 text-secondary shadow-[0_10px_20px_rgba(47,36,28,0.14)] transition hover:-translate-y-0.5 hover:bg-secondary hover:text-white"
              aria-label="Dismiss promotion"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative flex transition-transform duration-[760ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform" style={{ transform: `translateX(-${activeAdvertIndex * 100}%)` }}>
              {displayedAdverts.map((advert, index) => (
                <article key={`${advert.title}-${index}`} className="min-w-full">
                  <div className="grid grid-cols-[6.75rem_1fr] gap-0 sm:grid-cols-[8rem_1fr]">
                    <button
                      type="button"
                      onClick={() => openAdvertLightbox(advert)}
                      className="group relative min-h-[8.75rem] overflow-hidden bg-secondary text-left sm:min-h-[9.75rem]"
                      aria-label={`Open ${advert.title} promotion fullscreen`}
                    >
                      {advert.isVideo ? (
                        <video src={advert.image} className="h-full w-full object-cover" autoPlay muted loop playsInline />
                      ) : (
                        <img src={advert.image} alt={advert.alt} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-secondary/42 via-transparent to-white/8" />
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.16em] text-white shadow-lg">
                        <Bell className="h-3 w-3" />
                        Ad
                      </span>
                      <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-secondary shadow-lg transition group-hover:scale-105" aria-hidden="true">
                        <Maximize2 className="h-4 w-4" />
                      </span>
                    </button>
                    <div className="flex min-w-0 flex-col p-3.5 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">
                          {advert.tag}
                        </span>
                        <span className="shrink-0 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-secondary/45">
                          {index + 1}/{displayedAdverts.length}
                        </span>
                      </div>
                      <h2 className="mt-1.5 max-h-[2.7rem] overflow-hidden font-display text-[1.05rem] font-bold leading-tight text-secondary sm:max-h-[3rem] sm:text-[1.2rem]">
                        {advert.title}
                      </h2>
                      <p className="mt-1.5 max-h-10 overflow-hidden text-[0.78rem] leading-relaxed text-foreground/68 sm:max-h-11 sm:text-[0.82rem]">
                        {advert.description}
                      </p>
                      <div className="mt-auto flex items-center gap-2 pt-3">
                        <button
                          type="button"
                          onClick={() => handleCatalogPick(advert.bookingValue, advert.title)}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-secondary px-3 text-[0.76rem] font-black text-white shadow-[0_12px_24px_rgba(47,36,28,0.16)] transition hover:-translate-y-0.5 hover:bg-primary"
                        >
                          {advert.cta}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={BUSINESS_WHATSAPP_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/18 bg-white text-secondary shadow-[0_10px_22px_rgba(47,36,28,0.08)] transition hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                          aria-label="Message FixMyDoor Services on WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="relative flex items-center justify-between gap-3 border-t border-primary/10 bg-white/72 px-3.5 py-2.5 backdrop-blur sm:px-4">
              <div className="flex items-center gap-1.5">
                {displayedAdverts.map((advert, index) => (
                  <button
                    key={`${advert.title}-${index}`}
                    type="button"
                    onClick={() => {
                      pauseAdvertSlider(DOT_SELECTION_PAUSE_MS);
                      setActiveAdvertIndex(index);
                    }}
                    className={`h-2 rounded-full transition-all ${activeAdvertIndex === index ? "w-6 bg-primary" : "w-2 bg-secondary/22 hover:bg-secondary/38"}`}
                    aria-label={`Show advert ${index + 1}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {notificationSupported && (
                  <button
                    type="button"
                    onClick={enableNotifications}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${notificationsEnabled ? "border-primary bg-primary text-white" : "border-primary/14 bg-white text-secondary hover:border-primary hover:text-primary"}`}
                    aria-label={notificationsEnabled ? "FixMyDoor update notifications enabled" : "Enable FixMyDoor update notifications"}
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </button>
                )}
                {displayedAdverts.length > 1 && (
                  <>
                  <button
                    type="button"
                    onClick={showPreviousAdvert}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/14 bg-white text-secondary transition hover:border-primary hover:text-primary"
                    aria-label="Show previous advert"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextAdvert}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-white transition hover:bg-primary"
                    aria-label="Show next advert"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}

      {lightboxAdvert && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#140f0b]/88 p-3 text-white backdrop-blur-md sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${lightboxAdvert.title} promotion preview`}
        >
          <button type="button" className="absolute inset-0 cursor-zoom-out" onClick={closeAdvertLightbox} aria-label="Close promotion preview" />
          <div className="relative grid h-full max-h-[calc(100vh-1.5rem)] w-full max-w-6xl grid-rows-[auto_1fr_auto] overflow-hidden rounded-[28px] border border-white/14 bg-[#211813] shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:max-h-[calc(100vh-2.5rem)]">
            <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
              <div className="min-w-0">
                <p className="truncate text-[0.66rem] font-black uppercase tracking-[0.22em] text-primary">{lightboxAdvert.tag}</p>
                <h2 className="truncate font-display text-lg font-bold sm:text-2xl">{lightboxAdvert.title}</h2>
              </div>
              <button
                type="button"
                onClick={closeAdvertLightbox}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-secondary shadow-lg transition hover:-translate-y-0.5 hover:bg-primary hover:text-white"
                aria-label="Close promotion preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="relative min-h-0 overflow-hidden bg-black/34 touch-none"
              onWheel={handleLightboxWheel}
              onPointerDown={handleLightboxPointerDown}
              onPointerMove={handleLightboxPointerMove}
              onPointerUp={handleLightboxPointerEnd}
              onPointerCancel={handleLightboxPointerEnd}
            >
              <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-white/12 bg-black/44 p-1.5 backdrop-blur">
                <button type="button" onClick={() => updateLightboxZoom((currentZoom) => currentZoom - 0.25)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-secondary transition hover:bg-primary hover:text-white" aria-label="Zoom out">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-12 text-center text-xs font-black">{Math.round(lightboxZoom * 100)}%</span>
                <button type="button" onClick={() => updateLightboxZoom((currentZoom) => currentZoom + 0.25)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-secondary transition hover:bg-primary hover:text-white" aria-label="Zoom in">
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => { setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }); }} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-secondary transition hover:bg-primary hover:text-white" aria-label="Reset zoom">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              <div className="flex h-full min-h-[18rem] items-center justify-center overflow-hidden p-4 sm:min-h-[28rem] sm:p-8">
                {lightboxAdvert.isVideo ? (
                  <video
                    src={lightboxAdvert.image}
                    className="max-h-full max-w-full rounded-[18px] object-contain shadow-2xl"
                    style={{ transform: `translate3d(${lightboxPan.x}px, ${lightboxPan.y}px, 0) scale(${lightboxZoom})`, transformOrigin: "center", transition: lightboxPointersRef.current.size ? "none" : "transform 160ms ease" }}
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <img
                    src={lightboxAdvert.image}
                    alt={lightboxAdvert.alt}
                    className="max-h-full max-w-full select-none rounded-[18px] object-contain shadow-2xl"
                    draggable={false}
                    style={{ transform: `translate3d(${lightboxPan.x}px, ${lightboxPan.y}px, 0) scale(${lightboxZoom})`, transformOrigin: "center", transition: lightboxPointersRef.current.size ? "none" : "transform 160ms ease" }}
                  />
                )}
              </div>
            </div>

            <div className="relative z-10 flex flex-col gap-3 border-t border-white/10 bg-white/8 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl text-sm leading-relaxed text-white/78">{lightboxAdvert.description}</p>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => handleCatalogPick(lightboxAdvert.bookingValue, lightboxAdvert.title)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-primary/90">
                  {lightboxAdvert.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a href={BUSINESS_WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-secondary shadow-lg transition hover:-translate-y-0.5 hover:text-primary">
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="bg-[#2f241c] py-9 text-white md:py-10">
        <div className="container max-w-[1180px]">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Choose Your Path</p>
              <h2 className="mt-2 font-display text-2xl font-bold md:text-4xl">Need a repair or the right part?</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-white/72">
              Choose the path that matches your need. We will review the details and guide you through the next step with clear, practical advice.
            </p>
          </div>

          <div className="overflow-hidden md:overflow-visible">
            <div id="customer-path-mobile-carousel" className={`${mobileScrollTrackClass} gap-3 md:grid md:grid-cols-2 md:gap-4`}>
            {customerPathLoopItems.map(({ item: path, loopKey, isClone, loopEdge }, index) => (
              <a
                key={loopKey}
                href={path.href}
                data-loop-clone={isClone || undefined}
                data-loop-edge={loopEdge}
                aria-hidden={isClone || undefined}
                tabIndex={isClone ? -1 : undefined}
                className={`group ${mobileScrollItemClass} ${isClone ? "md:hidden" : ""} min-h-[13rem] overflow-hidden rounded-[24px] border border-white/10 p-5 shadow-[0_14px_38px_rgba(0,0,0,0.14)] transition hover:-translate-y-1 ${
                  path.label === "Repair & Installation" ? "bg-white text-secondary" : "bg-primary text-white"
                }`}
              >
                <span className={`inline-flex rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.22em] ${
                  path.label === "Repair & Installation" ? "bg-primary/10 text-primary" : "bg-white/18 text-white"
                }`}>
                  {path.label}
                </span>
                <h3 className="mt-4 text-xl font-bold md:text-2xl">{path.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${path.label === "Repair & Installation" ? "text-foreground/68" : "text-white/82"}`}>{path.desc}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                  {path.cta}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </a>
            ))}
            </div>
            {renderMobileCarouselControls("customer-path-mobile-carousel", customerPaths.length, true)}
          </div>
        </div>
      </section>

      <section className="bg-white py-8 md:py-14">
        <div className="container max-w-[1180px]">
          <div className="mb-5 grid gap-3 md:mb-6 md:grid-cols-[0.75fr_1.25fr] md:items-end md:gap-4">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary md:text-xs md:tracking-[0.34em]">Core Services</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-secondary md:mt-3 md:text-4xl">What FixMyDoor Services does</h2>
            </div>
            <p className="text-sm leading-relaxed text-foreground/72 md:text-base">
              FixMyDoor Services helps with repairs, installations, furniture setup, and hardware sourcing. Share the issue, and we will guide you clearly.
            </p>
          </div>

          <div className="overflow-hidden md:overflow-visible">
            <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3`}>
              {coreServiceLoopItems.map(({ item: service, loopKey, isClone, loopEdge }) => (
                <article key={loopKey} data-loop-clone={isClone || undefined} data-loop-edge={loopEdge} aria-hidden={isClone || undefined} className={`${mobileScrollItemClass} ${isClone ? "md:hidden" : ""} rounded-[18px] border border-primary/10 bg-[#fffaf2] p-4 shadow-[0_10px_24px_rgba(47,36,28,0.05)] md:rounded-[22px] md:p-5`}>
                  <h3 className="text-base font-bold text-secondary md:text-xl">{service.title}</h3>
                  <p className="mt-1.5 text-[0.82rem] leading-relaxed text-foreground/72 md:mt-2 md:text-sm">{service.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-secondary/10 bg-secondary p-3 text-white md:mt-8 md:rounded-[24px] md:p-6">
            <div className="grid gap-3 md:grid-cols-[0.7fr_1.3fr] md:items-center md:gap-4">
              <div>
                <div className="flex items-center gap-2 md:block">
                  <ShieldCheck className="h-6 w-6 shrink-0 text-primary md:h-8 md:w-8" />
                  <h3 className="text-lg font-bold md:mt-3 md:text-2xl">Trust before the first visit</h3>
                </div>
                <p className="mt-1.5 hidden text-sm leading-relaxed text-white/76 md:block">
                  The goal is simple: make the problem clear, protect the customer record, and recommend the next step that fits the job.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {trustDetails.map((detail, index) => (
                  <div key={detail} className={`gap-1.5 rounded-2xl bg-white/8 p-2 text-[0.72rem] font-semibold leading-snug text-white/86 md:flex md:gap-2 md:p-3 md:text-sm ${index > 3 ? "hidden md:flex" : "flex"}`}>
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary md:h-4 md:w-4" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="bg-white py-10 md:py-[4.5rem]">
        <div className="container max-w-[1180px]">
          <div className="mb-8 text-center md:mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary md:text-sm md:tracking-[0.4em]">What We Handle</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:mt-4 md:text-5xl">Real fixes for everyday door and furniture problems</h2>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-foreground/70 md:mt-4 md:text-lg">
              Doors, locks, hinges, cabinets, and furniture wear down with daily use. We explain the options clearly and focus on the solution that is most likely to work well.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="overflow-hidden rounded-[28px] bg-secondary p-5 text-white shadow-[0_22px_60px_rgba(66,40,18,0.2)] md:rounded-[32px] md:p-8">
              <div className="grid gap-5 md:gap-8">
                <div className="max-w-3xl">
                  <span className="inline-flex rounded-full bg-white/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white/90">{featuredService.tag}</span>
                  <h3 className="mt-3 font-display text-2xl font-bold leading-tight md:mt-4 md:text-3xl">{featuredService.title}</h3>
                  <p className="mt-3 max-w-xl text-sm text-white/82 md:mt-4 md:text-base">{featuredService.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-2 md:mt-6 md:gap-3">
                    {["Front-door rekeying", "Wood door fitting", "Sofa frame repair", "Furniture setup"].map((item) => (
                      <span key={item} className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white/90">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 min-[481px]:grid-cols-3 md:gap-3 lg:grid-cols-3 lg:p-2">
                  {featuredServiceCollage.map((item, index) => (
                    <figure key={`${item.title}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-[0_14px_34px_rgba(0,0,0,0.14)]">
                      <img
                        src={item.src}
                        alt={item.title}
                        loading={index < 4 ? "eager" : "lazy"}
                        decoding="async"
                        className="block h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-secondary/88 via-secondary/18 to-transparent" />
                      <figcaption className="absolute inset-x-0 bottom-0 p-2 md:p-3">
                        <span className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-white/72 md:text-[0.62rem]">{item.tag}</span>
                        <p className="mt-1 text-xs font-bold leading-tight text-white md:text-sm">{item.title}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </article>

            <div className="overflow-hidden md:overflow-visible">
              <div id="services-mobile-carousel" className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-5`}>
              {serviceShowcaseLoopItems.map(({ item: service, loopKey, isClone, loopEdge }, index) => (
                <article key={loopKey} data-loop-clone={isClone || undefined} data-loop-edge={loopEdge} aria-hidden={isClone || undefined} className={`${mobileScrollItemClass} ${isClone ? "md:hidden" : ""} overflow-hidden rounded-[24px] border border-primary/12 bg-[linear-gradient(180deg,_#fffdfb,_#f4ede3)] shadow-[0_14px_40px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 md:rounded-[28px]`}>
                  <img
                    src={service.src}
                    alt={service.title}
                    loading="lazy"
                    decoding="async"
                    className={`h-44 w-full md:h-52 ${service.contain ? "bg-white p-4 object-contain" : "object-cover"}`}
                  />
                  <div className="p-5">
                    <span className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-primary">{service.tag}</span>
                    <h3 className="mt-3 text-xl font-bold text-secondary">{service.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/70">{service.desc}</p>
                  </div>
                </article>
              ))}
              </div>
              {renderMobileCarouselControls("services-mobile-carousel", displayedServiceShowcase.length)}
            </div>
          </div>

        </div>
      </section>

      <section id="shop" className="bg-[linear-gradient(180deg,_#fffdf8,_#f3eadc)] py-10 md:py-[4.5rem]">
        <div className="container max-w-[1180px]">
          <div className="mb-7 flex flex-col gap-4 text-center md:mb-10 md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary md:text-sm md:tracking-[0.4em]">Buy & Source</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:mt-4 md:text-5xl">Need a door, handle, lock, hinge, or furniture part?</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/70 md:mt-4 md:text-lg">
                Tell us what you want to repair, replace, or purchase. We will help you compare the options before you spend money on the wrong item.
              </p>
            </div>
            <button type="button" onClick={scrollToContactForm} className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.2)] transition hover:-translate-y-0.5 hover:bg-primary/90">
              Ask for a Quote
            </button>
          </div>

          <div className="overflow-hidden md:overflow-visible">
            <div id="product-categories-mobile-carousel" className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3`}>
            {productCategoryLoopItems.map(({ item: category, loopKey, isClone, loopEdge }, index) => (
              <article key={loopKey} data-loop-clone={isClone || undefined} data-loop-edge={loopEdge} aria-hidden={isClone || undefined} className={`${mobileScrollItemClass} ${isClone ? "md:hidden" : ""} overflow-hidden rounded-[28px] border border-primary/12 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.07)] md:rounded-[32px]`}>
                <div className="relative h-52 overflow-hidden bg-[#f8f4ec] md:h-64">
                  <img src={category.image} alt={category.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <img src={category.accent} alt="" loading="lazy" decoding="async" className="absolute bottom-4 right-4 h-24 w-24 rounded-2xl border-4 border-white bg-white object-cover shadow-xl" />
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="text-xl font-bold text-secondary md:text-2xl">{category.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/70">{category.desc}</p>
                  <p className="mt-4 rounded-2xl bg-background p-4 text-sm font-semibold text-secondary">{category.items}</p>
                  <button
                    type="button"
                    onClick={() => handleCatalogPick(category.bookingValue, category.title)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,36,28,0.14)] transition hover:-translate-y-0.5 hover:bg-primary"
                  >
                    Ask About This Item
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
            </div>
            {renderMobileCarouselControls("product-categories-mobile-carousel", displayedProductCategories.length)}
          </div>

          <div className="mt-8 rounded-[28px] bg-[#2f241c] p-5 text-white shadow-[0_22px_70px_rgba(47,36,28,0.2)] sm:p-8 md:mt-12 md:rounded-[34px]">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Door Buying Gallery</p>
                <h3 className="mt-3 text-2xl font-bold md:text-3xl">Paladin, SED, heavy-duty, entry, interior, and custom-fit doors</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
                  Ask about the door type, opening size, finish, and hardware needs before buying, so the final choice fits the space properly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCatalogPick("door-purchase", "door buying options")}
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.2)] transition hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Ask About Doors
              </button>
            </div>

            <div className="overflow-hidden md:overflow-visible">
              <div id="door-products-mobile-carousel" className={`${mobileScrollTrackClass} md:grid md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5`}>
              {doorProductLoopItems.map(({ item: product, loopKey, isClone, loopEdge }, index) => (
                <button
                  key={loopKey}
                  type="button"
                  onClick={() => handleCatalogPick("door-purchase", product.title)}
                  data-loop-clone={isClone || undefined}
                  data-loop-edge={loopEdge}
                  aria-hidden={isClone || undefined}
                  className={`group flex h-full flex-col ${mobileScrollItemClass} ${isClone ? "md:hidden" : ""} overflow-hidden rounded-[22px] bg-white/8 text-left transition hover:-translate-y-1 hover:bg-white/12`}
                >
                  <img src={product.image} alt={product.title} loading="lazy" decoding="async" className="h-56 w-full shrink-0 bg-white object-cover object-center transition duration-500 group-hover:scale-[1.03] md:h-52 lg:h-60 xl:h-64" />
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary">{product.tag}</span>
                    <p className="mt-2 font-bold text-white">{product.title}</p>
                  </div>
                </button>
              ))}
              </div>
              {renderMobileCarouselControls("door-products-mobile-carousel", displayedDoorProducts.length, true)}
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-primary/12 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] sm:p-8 md:mt-10 md:rounded-[34px]">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Hardware & Tools</p>
                <h3 className="mt-3 text-2xl font-bold text-secondary md:text-3xl">Handles, locks, hinges, drawer slides, and cabinet parts</h3>
              </div>
              <button
                type="button"
                onClick={() => handleCatalogPick("door-hardware-purchase", "door and furniture hardware")}
                className="inline-flex items-center justify-center rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,36,28,0.14)] transition hover:-translate-y-0.5 hover:bg-primary"
              >
                Ask About Hardware
              </button>
            </div>

            <div className="overflow-hidden md:overflow-visible">
              <div id="hardware-products-mobile-carousel" className={`${mobileScrollTrackClass} md:grid md:grid-cols-3 md:gap-4 lg:grid-cols-5`}>
              {hardwareProductLoopItems.map(({ item: product, loopKey, isClone, loopEdge }, index) => (
                <button
                  key={loopKey}
                  type="button"
                  onClick={() => handleCatalogPick(product.tag.includes("Drawer") || product.tag.includes("Cabinet") ? "furniture-hardware-purchase" : "door-hardware-purchase", product.title)}
                  data-loop-clone={isClone || undefined}
                  data-loop-edge={loopEdge}
                  aria-hidden={isClone || undefined}
                  className={`group ${mobileScrollItemClass} ${isClone ? "md:hidden" : ""} overflow-hidden rounded-[22px] border border-primary/10 bg-[#fffaf2] text-left transition hover:-translate-y-1`}
                >
                  <img src={product.image} alt={product.title} loading="lazy" decoding="async" className="h-40 w-full bg-white object-contain p-3 transition duration-500 group-hover:scale-[1.03] md:h-48" />
                  <div className="p-4">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary">{product.tag}</span>
                    <p className="mt-2 font-bold text-secondary">{product.title}</p>
                  </div>
                </button>
              ))}
              </div>
              {renderMobileCarouselControls("hardware-products-mobile-carousel", displayedHardwareProducts.length)}
            </div>
          </div>
        </div>
      </section>

      <section id="before-after" className="bg-gradient-to-b from-background to-white py-10 md:py-[4.5rem]">
        <div className="container max-w-[1180px]">
          <div className="mb-8 text-center md:mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary md:text-sm md:tracking-[0.4em]">Our Work</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:mt-4 md:text-5xl">Recent jobs customers usually ask about</h2>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-foreground/70 md:mt-4 md:text-lg">
              These examples reflect the types of door, lock, hardware, and furniture requests customers often ask us to review.
            </p>
          </div>

          <div className="overflow-hidden md:hidden">
            <div id="project-gallery-mobile-carousel" className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-6 xl:grid-cols-3`}>
            {projectGalleryLoopItems.map(({ item: project, loopKey, isClone, loopEdge }, index) => (
              <article key={loopKey} data-loop-clone={isClone || undefined} data-loop-edge={loopEdge} aria-hidden={isClone || undefined} className={`${mobileScrollItemClass} ${isClone ? "md:hidden" : ""} overflow-hidden rounded-[26px] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 md:rounded-[30px]`}>
                <img src={project.src} alt={project.title} loading="lazy" decoding="async" className="h-56 w-full object-cover md:h-[300px]" />
                <div className="p-5 md:p-6">
                  <span className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-primary">{project.category}</span>
                  <h3 className="mt-3 text-2xl font-bold text-secondary">{project.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/70">{project.desc}</p>
                </div>
              </article>
            ))}
            </div>
            {renderMobileCarouselControls("project-gallery-mobile-carousel", displayedProjectGallery.length)}
          </div>

          <div className="hidden md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:gap-6">
            {desktopProjectGallery.map((project) => (
              <article key={project.title} className="overflow-hidden rounded-[26px] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 md:rounded-[30px]">
                <img src={project.src} alt={project.title} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
                <div className="p-5 md:p-6">
                  <span className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-primary">{project.category}</span>
                  <h3 className="mt-3 text-xl font-bold text-secondary">{project.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/70">{project.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="bg-white py-8 md:py-10">
        <div className="container grid max-w-[1180px] gap-6 md:grid-cols-[0.58fr_1.42fr] md:items-start">
          <div className="relative order-2 md:order-1">
            <div className="relative mx-auto flex h-[280px] max-w-[240px] items-center justify-center overflow-hidden rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,_#f7efe4,_#ffffff)] shadow-[0_16px_42px_rgba(66,40,18,0.13)] sm:h-[340px] sm:max-w-[300px] md:mx-0 md:h-[380px] md:max-w-[320px] md:rounded-[26px]">
              <img src={technicianImage} alt="Richard Ampofo working on a door repair" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary">Meet the Expert</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:text-4xl">Richard Ampofo</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/75 md:mt-4 md:text-base">
              Richard runs FixMyDoor Services with a simple approach: look at the problem, explain the options clearly, and do the work in a way that feels solid when you use it again.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/75 md:mt-3 md:text-base">
              The business is based in Canada and can also help with international repair questions or product requests.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Globe2, title: quickHighlights[0].title, text: quickHighlights[0].text },
                { icon: ShieldCheck, title: quickHighlights[1].title, text: quickHighlights[1].text },
                { icon: Zap, title: quickHighlights[2].title, text: quickHighlights[2].text },
              ].map((highlight) => (
                <div key={highlight.title} className="rounded-[20px] bg-background p-4 shadow-sm">
                  <highlight.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-2 text-sm font-bold text-secondary">{highlight.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/68">{highlight.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="bg-gradient-to-b from-background to-white py-8 md:py-12">
        <div className="container max-w-[1180px]">
          <div className="mb-6 flex flex-col gap-3 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary">Client Reviews</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:text-4xl">What customers have said</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/70">
                After a job, customers can leave their own review here so others know what to expect.
              </p>
            </div>
            <button type="button" onClick={openReviewForm} className="inline-flex items-center justify-center rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,36,28,0.14)] transition hover:-translate-y-0.5 hover:bg-secondary/90">
              Write a Review
            </button>
          </div>

          <div className={`grid gap-5 ${reviewFormOpen ? "lg:grid-cols-[1fr_0.62fr]" : ""} lg:items-start`}>
            <div className="overflow-hidden md:overflow-visible">
              <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-3 md:gap-4`}>
              {reviewLoopItems.map(({ item: review, loopKey, isClone, loopEdge }, index) => (
                <article key={loopKey} data-loop-clone={isClone || undefined} data-loop-edge={loopEdge} aria-hidden={isClone || undefined} className={`${mobileScrollItemClass} ${isClone ? "md:hidden" : ""} rounded-[22px] border border-primary/10 bg-white p-4 shadow-[0_12px_34px_rgba(0,0,0,0.05)]`}>
                  <div className="mb-3 flex gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${index < review.rating ? "fill-primary text-primary" : "text-primary/20"}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm italic leading-relaxed text-foreground/80">"{review.quote}"</p>
                  <p className="mt-4 font-bold text-secondary">{review.name}</p>
                  <p className="text-sm text-foreground/60">{review.location || "Canada"}</p>
                </article>
              ))}
              </div>
            </div>

            {reviewFormOpen && (
            <div id="write-review" className="scroll-mt-28 rounded-[24px] border border-primary/12 bg-white p-5 shadow-[0_14px_40px_rgba(0,0,0,0.06)]">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Share Feedback</p>
              <h3 className="mt-2 text-xl font-bold text-secondary">Write your review</h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground/68">
                Share what happened, what was fixed, and how the service felt.
              </p>
              <Form {...reviewForm}>
                <form onSubmit={reviewForm.handleSubmit(onReviewSubmit)} className="mt-4 space-y-3">
                  <FormField control={reviewForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Name *</FormLabel>
                      <FormControl><Input placeholder="Your name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={reviewForm.control} name="location" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">City / Province</FormLabel>
                      <FormControl><Input placeholder="Montreal, QC" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={reviewForm.control} name="rating" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Rating *</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Choose a rating" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="5">5 stars</SelectItem>
                          <SelectItem value="4">4 stars</SelectItem>
                          <SelectItem value="3">3 stars</SelectItem>
                          <SelectItem value="2">2 stars</SelectItem>
                          <SelectItem value="1">1 star</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={reviewForm.control} name="quote" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Review *</FormLabel>
                      <FormControl><Textarea placeholder="Tell us how the repair went." className="min-h-24" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="btn-primary w-full" disabled={reviewForm.formState.isSubmitting}>
                    {reviewForm.formState.isSubmitting ? "Sending..." : "Send Review"}
                  </Button>
                </form>
              </Form>
            </div>
            )}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-divider bg-white py-6 md:py-8">
        <div className="container max-w-[1180px]">
          <div className="mb-3 flex flex-col gap-2 text-center md:mb-4 md:flex-row md:items-center md:justify-between md:text-left">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary md:text-xs md:tracking-[0.28em]">How It Works</p>
              <h2 className="mt-1 font-display text-xl font-bold text-secondary md:text-3xl">Simple from first message to finished job.</h2>
            </div>
            <button type="button" onClick={scrollToContactForm} className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.18)] transition hover:-translate-y-0.5 hover:bg-primary/90">
              Start Booking
            </button>
          </div>
          <div className="rounded-[20px] border border-primary/10 bg-background p-3 md:hidden">
            {[
              ["1", "Contact", "Send the issue, photos, and location."],
              ["2", "Plan", "We review the details and confirm the next step."],
              ["3", "Complete", "We repair, install, or source the right item."],
            ].map(([number, title, text]) => (
              <div key={number} className="flex items-center gap-3 border-b border-primary/10 py-2.5 last:border-b-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{number}</span>
                <div>
                  <h3 className="text-sm font-bold text-secondary">{title}</h3>
                  <p className="text-xs leading-relaxed text-foreground/68">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden gap-3 md:grid md:grid-cols-3">
            <div className="flex gap-3 rounded-[20px] border border-primary/10 bg-background p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">1</div>
              <div>
                <h3 className="text-base font-semibold text-secondary">Contact Us</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">Send the issue, photos, and location.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[20px] border border-primary/10 bg-background p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">2</div>
              <div>
                <h3 className="text-base font-semibold text-secondary">Confirm the Plan</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">We review details and agree on the next step.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[20px] border border-primary/10 bg-background p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">3</div>
              <div>
                <h3 className="text-base font-semibold text-secondary">Fix or Source It</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">We repair neatly or help find the right item.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,_#fffdf8,_#f4eadc)] py-5 md:py-12">
        <div className="container max-w-[1180px]">
          <div className="grid gap-2 md:hidden">
            <details className="group rounded-[18px] border border-primary/10 bg-white p-4 shadow-sm" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-secondary">
                Service areas
                <span className="text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                We coordinate from Montreal and welcome requests from Quebec, other parts of Canada, and international customers who need sourcing or repair guidance.
              </p>
            </details>
            <details className="group rounded-[18px] border border-primary/10 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-secondary">
                Workmanship promise
                <span className="text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                We aim for repairs that feel solid in daily use. If follow-up is needed within the agreed scope, send photos and the booking details for review.
              </p>
            </details>
            <details className="group rounded-[18px] border border-primary/10 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-secondary">
                Clear request records
                <span className="text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                Requests are saved in the dashboard, sent to the team, and confirmed to customers with a tracking link.
              </p>
            </details>
            <details className="group rounded-[18px] border border-primary/10 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-secondary">
                Privacy note
                <span className="text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                Contact details are used only for service communication. Please do not send lock codes or private access details through the form.
              </p>
            </details>
          </div>

          <div className="hidden gap-5 md:grid lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[28px] bg-[#2f241c] p-6 text-white shadow-[0_18px_50px_rgba(47,36,28,0.18)] md:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Service Areas</p>
              <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">Canada-based, open to international requests</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                FixMyDoor Services is organized from Montreal, but you can contact us from other locations too. Send the repair, installation, door, or hardware request and we will let you know what is realistic.
              </p>
              <div className="mt-4 grid gap-3 md:mt-5">
                {serviceAreaNotes.map((note, index) => (
                  <div key={note} className={`gap-3 rounded-2xl bg-white/8 p-4 ${index > 0 ? "hidden md:flex" : "flex"}`}>
                    <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm leading-relaxed text-white/84">{note}</p>
                  </div>
                ))}
              </div>
            </article>

            <div className="grid gap-5 md:grid-cols-2">
              <article className="rounded-[24px] border border-primary/12 bg-white p-5 shadow-[0_14px_38px_rgba(0,0,0,0.055)] md:rounded-[28px] md:p-6">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-2xl font-bold text-secondary">Workmanship promise</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  We aim for repairs that feel solid when you use them again. If something needs follow-up after the agreed work, contact us quickly so it can be reviewed properly.
                </p>
              </article>
              <article className="rounded-[24px] border border-primary/12 bg-white p-5 shadow-[0_14px_38px_rgba(0,0,0,0.055)] md:rounded-[28px] md:p-6">
                <FileText className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-2xl font-bold text-secondary">Clear request records</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Every submitted request is saved in the dashboard, emailed to the team, and confirmed to the customer with a tracking link for status updates.
                </p>
              </article>
              <article className="hidden rounded-[28px] border border-primary/12 bg-white p-6 shadow-[0_14px_38px_rgba(0,0,0,0.055)] md:col-span-2 md:block">
                <h3 className="text-2xl font-bold text-secondary">Privacy note</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Customer contact details are collected only to respond to repair, installation, quote, review, or product requests. Do not send sensitive lock codes or private access details through the form.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-5 md:py-12">
        <div className="container max-w-[1180px]">
          <div className="mb-4 text-center md:mb-6">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary md:text-xs md:tracking-[0.34em]">Questions Customers Ask</p>
            <h2 className="mt-2 font-display text-xl font-bold text-secondary md:mt-3 md:text-4xl">A few answers before you book</h2>
          </div>
          <div className="grid gap-2 md:hidden">
            {faqItems.map((item, index) => (
              <details key={item.question} className="group rounded-[18px] border border-primary/10 bg-background p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-secondary">
                  <span>{item.question}</span>
                  <span className="text-primary transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-foreground/70">{item.answer}</p>
              </details>
            ))}
          </div>
          <div className="hidden gap-4 md:grid md:grid-cols-2">
            {faqItems.map((item, index) => (
              <article key={item.question} className="rounded-[24px] border border-primary/10 bg-background p-5">
                <h3 className="text-lg font-bold text-secondary">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-background pb-3 pt-8 md:pb-4 md:pt-10">
        <div className="container grid max-w-[1180px] gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-stretch">
          <div className="rounded-[26px] border border-primary/12 bg-white p-5 shadow-[0_16px_42px_rgba(0,0,0,0.055)] sm:p-6">
            <h2 className="font-display text-3xl font-bold text-secondary md:text-4xl">Get in Touch</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-foreground/68">Send the details you have, even if you are not sure what the problem is called. We will help you choose the next step.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-1">
              <div className="flex gap-3 rounded-[20px] bg-background p-4 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-5 w-5 text-primary" /></div>
                <div><p className="font-semibold text-secondary">Phone</p><a href="tel:+14383471823" className="text-base font-semibold text-primary hover:underline">+1 (438) 347-1823</a></div>
              </div>
              <div className="flex gap-3 rounded-[20px] bg-background p-4 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><MessageCircle className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="font-semibold text-secondary">WhatsApp</p>
                  <a href={BUSINESS_WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-base font-semibold text-primary hover:underline">
                    {BUSINESS_WHATSAPP_DISPLAY}
                  </a>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/60">Opens WhatsApp with a ready message.</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-[20px] bg-background p-4 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Mail className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="font-semibold text-secondary">Email</p>
                  <a href="mailto:info.fixmydoor@gmail.com" className="mt-1 inline-block text-base font-semibold text-primary hover:underline">info.fixmydoor@gmail.com</a>
                </div>
              </div>
              <div className="flex gap-3 rounded-[20px] bg-background p-4 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Instagram className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="font-semibold text-secondary">Follow Us</p>
                  <div className="mt-2 flex gap-3">
                    <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-primary transition hover:text-primary/80" aria-label="Instagram"><Instagram className="h-5 w-5" /></a>
                    <a href="https://x.com/fixmydoor?s=11" className="text-primary transition hover:text-primary/80" aria-label="X (Twitter)"><Twitter className="h-5 w-5" /></a>
                    <a href="https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr" className="text-primary transition hover:text-primary/80" aria-label="Facebook"><Facebook className="h-5 w-5" /></a>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 rounded-[20px] bg-background p-4 shadow-sm sm:col-span-2 md:col-span-1">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><MapPin className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="font-semibold text-secondary">Head Office</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/70">10158 Rue Berri, Montreal, Quebec H3L 2G6, Canada</p>
                  <p className="mt-2 inline-flex rounded-xl bg-primary/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary">Canada-based, open to international requests</p>
                </div>
              </div>
              <details className="group rounded-[18px] bg-[#2f241c] p-4 text-white shadow-[0_14px_34px_rgba(47,36,28,0.16)] sm:col-span-2 md:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="block text-[0.66rem] font-bold uppercase tracking-[0.2em] text-primary">Before You Send</span>
                    <span className="mt-1 block text-sm font-bold">A clear request gets a faster reply.</span>
                  </span>
                  <span className="text-primary transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-3 grid gap-2">
                  <p className="rounded-2xl bg-white/8 p-3 text-xs leading-relaxed text-white/78">
                    For repairs, tell us what is faulty, where it is located, and upload a useful photo. For buying, share the item, size, color, quantity, and any style reference you have.
                  </p>
                </div>
              </details>
              <div className="hidden rounded-[22px] bg-[#2f241c] p-5 text-white shadow-[0_14px_34px_rgba(47,36,28,0.16)] sm:col-span-2 md:col-span-1 md:block">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Before You Send</p>
                <h3 className="mt-2 text-xl font-bold">A clear request gets a faster reply.</h3>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-white/8 p-3">
                    <p className="font-semibold">For repairs</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/76">Tell us what is faulty, where it is located, and upload a photo of the damaged door, lock, hinge, drawer, sofa, cabinet, or furniture part.</p>
                  </div>
                  <div className="rounded-2xl bg-white/8 p-3">
                    <p className="font-semibold">For buying</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/76">Share the item you want, the size if known, preferred color, quantity, and a photo or screenshot of the style you like.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="booking-form" className="scroll-mt-28 rounded-[26px] border border-primary/12 bg-white p-5 shadow-[0_16px_42px_rgba(0,0,0,0.055)] sm:scroll-mt-32 sm:p-6 md:scroll-mt-28">
            <h3 className="text-2xl font-semibold text-secondary">Tell Us What You Need</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/68">Tell us what is happening. A short note, your location, and a photo are enough to start.</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Name *</FormLabel><FormControl><Input placeholder="Your full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Phone *</FormLabel><FormControl><Input type="tel" placeholder="+1 (438) 000-0000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Email *</FormLabel><FormControl><Input type="email" placeholder="your.email@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Address *</FormLabel><FormControl><Input placeholder="Where is the job located?" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">City / Province</FormLabel><FormControl><Input placeholder="Montreal, Quebec" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Country</FormLabel><FormControl><Input placeholder="Canada, USA, Ghana..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                {showInternationalRequestDetails && (
                <div className="sm:col-span-2 rounded-[22px] border border-primary/10 bg-[#fffaf2] p-4">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-bold text-secondary">International request details</p>
                      <p className="text-xs leading-relaxed text-foreground/65">Shown because the address or country looks outside Canada. These details help us reply at the right time and quote in the right context.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="timeZone" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Time Zone</FormLabel><FormControl><Input placeholder="Example: EST, GMT, UTC+1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="preferredContactMethod" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground">Best Contact Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                            <SelectItem value="Phone Call">Phone Call</SelectItem>
                            <SelectItem value="Email">Email</SelectItem>
                            <SelectItem value="SMS">SMS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="urgency" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground">Urgency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Choose urgency" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="Urgent">Urgent</SelectItem>
                            <SelectItem value="Same-day if available">Same-day if available</SelectItem>
                            <SelectItem value="Emergency">Emergency</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="currency" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground">Preferred Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Choose currency" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="CAD">CAD</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GHS">GHS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="requestScope" render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="font-semibold text-foreground">Request Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Choose request type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Repair or service request">Repair or service request</SelectItem>
                            <SelectItem value="Buy or source products">Buy or source products</SelectItem>
                            <SelectItem value="International product guidance">International product guidance</SelectItem>
                            <SelectItem value="Delivery or installation inquiry">Delivery or installation inquiry</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
                )}
                <FormField control={form.control} name="repairType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">What Do You Need? *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger id="repair-type-trigger"><SelectValue placeholder="Choose what you need help with" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {bookingServices.map((service) => (
                          <SelectItem key={service.slug} value={service.bookingValue}>{service.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="preferredDate" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Preferred Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <details className="group sm:col-span-2 rounded-[22px] border border-primary/10 bg-background p-3 shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] bg-white px-3 py-3 text-left transition group-open:bg-[#fffaf2]">
                    <div className="flex min-w-0 items-center gap-2.5">
                    <Ruler className="h-5 w-5 text-primary" />
                      <div className="min-w-0">
                        <p className="font-bold text-secondary">Measurements & buying details</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-foreground/65">Optional. Click to add size, quantity, color, delivery, or installation details.</p>
                      </div>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-black leading-none text-primary transition group-open:rotate-45">+</span>
                  </summary>
                  <div className="mt-3 grid gap-4 rounded-[18px] bg-white p-3 sm:grid-cols-2 sm:p-4">
                    <FormField control={form.control} name="dimensions" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground">Size / Measurements</FormLabel>
                        <p className="text-xs leading-relaxed text-foreground/60">Write width x height, thickness, or rough opening size if you know it. Example: door 32 x 80 inches, thickness 1.75 inches.</p>
                        <FormControl><Input placeholder="Example: 32 x 80 inches, 1.75 inch thick" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Quantity</FormLabel><FormControl><Input placeholder="Example: 1 door, 4 hinges" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="material" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Material</FormLabel><FormControl><Input placeholder="Wood, steel, glass, fabric..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="color" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Color / Finish</FormLabel><FormControl><Input placeholder="Black, brown, chrome, white..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="swingDirection" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground">Door Swing</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Choose if known" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Left hand">Left hand</SelectItem>
                            <SelectItem value="Right hand">Right hand</SelectItem>
                            <SelectItem value="Outward swing">Outward swing</SelectItem>
                            <SelectItem value="Inward swing">Inward swing</SelectItem>
                            <SelectItem value="Not sure">Not sure</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="budget" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Budget / Price Range</FormLabel><FormControl><Input placeholder="Example: C$300 - C$700" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="deliveryNeeded" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground">Delivery Needed?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                            <SelectItem value="Not sure">Not sure</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="installationNeeded" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground">Installation Needed?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                            <SelectItem value="Not sure">Not sure</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </details>
                <div className="sm:col-span-2 rounded-[22px] border border-dashed border-primary/30 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Upload className="mt-1 h-5 w-5 text-primary" />
                      <div>
                        <p className="font-bold text-secondary">Upload photos</p>
                        <p className="text-xs leading-relaxed text-foreground/65">Optional, but very helpful. Upload the faulty door/furniture/lock/hinge, or upload the item/style you want to buy. Add up to 3 images under 1.8MB each.</p>
                      </div>
                    </div>
                    <Input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="max-w-xs bg-background" />
                  </div>
                  {photoPreviews.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {photoPreviews.map((photo, index) => (
                        <img key={`${photo.slice(0, 30)}-${index}`} src={photo} alt={`Uploaded preview ${index + 1}`} decoding="async" className="h-28 w-full rounded-2xl object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                <FormField control={form.control} name="message" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel className="font-semibold text-foreground">Message</FormLabel><FormControl><Textarea placeholder="What is not working, or what are you trying to buy?" className="min-h-20" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="securityAnswer" render={({ field }) => (
                  <FormItem className="sm:col-span-2 rounded-[20px] border border-primary/12 bg-[#fffaf2] p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value === "verified-customer"}
                          onCheckedChange={(checked) => field.onChange(checked === true ? "verified-customer" : "")}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="font-semibold text-foreground">Protected request verification *</FormLabel>
                        <p className="mt-1 text-xs leading-relaxed text-foreground/65">
                          Confirm this is a real customer request. The form also uses timing checks, spam traps, rate limits, and secure server validation.
                        </p>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="customerConsent" render={({ field }) => (
                  <FormItem className="sm:col-span-2 rounded-[18px] bg-background p-4">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                      </FormControl>
                      <div>
                        <FormLabel className="font-semibold text-foreground">I agree that FixMyDoor Services can contact me about this request.</FormLabel>
                        <p className="mt-1 text-xs leading-relaxed text-foreground/65">Your details are used to respond to your booking, quote, repair, or product request.</p>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )} />
                <Button type="submit" className="btn-primary w-full sm:col-span-2" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Sending..." : "Send Request"}</Button>
              </form>
            </Form>
          </div>
        </div>
      </section>

      <footer className="relative overflow-hidden bg-[linear-gradient(135deg,_#241a14,_#342318_58%,_#1b130f)] text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="container relative max-w-[1180px] py-2 md:py-5">
          <div className="md:hidden">
            <div className="flex items-center gap-2.5 rounded-[18px] border border-primary/18 bg-white/[0.06] p-2.5">
              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-[14px] bg-white/90 px-2">
                <img src="/img5150-transparent.png" alt="FixMyDoor logo" loading="lazy" decoding="async" className="h-8 w-auto object-contain" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold">FixMyDoor Services</h3>
                <p className="mt-0.5 text-[0.64rem] font-bold uppercase tracking-[0.14em] text-white/62">Door & Furniture Repairs</p>
              </div>
            </div>
            <div className="mt-2 grid gap-2">
              <details className="group rounded-[15px] border border-white/10 bg-white/[0.055] p-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
                  Contact
                  <span className="text-primary transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-2 grid gap-1.5 text-xs">
                  <a href="tel:+14383471823" className="rounded-xl bg-white/8 px-3 py-2 font-semibold text-white/86">+1 (438) 347-1823</a>
                  <a href="mailto:info.fixmydoor@gmail.com" className="rounded-xl bg-white/8 px-3 py-2 font-semibold text-white/86">info.fixmydoor@gmail.com</a>
                  <a href={BUSINESS_WHATSAPP_URL} target="_blank" rel="noreferrer" className="rounded-xl bg-white/8 px-3 py-2 font-semibold text-white/86">WhatsApp: {BUSINESS_WHATSAPP_DISPLAY}</a>
                </div>
              </details>
              <details className="group rounded-[15px] border border-white/10 bg-white/[0.055] p-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
                  Quick Links
                  <span className="text-primary transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                  {navLinks.slice(0, 6).map((link) => (
                    <a key={link.href} href={link.href} className="rounded-xl bg-white/8 px-3 py-2 font-semibold text-white/78">{link.label}</a>
                  ))}
                </div>
              </details>
              <details className="group rounded-[15px] border border-white/10 bg-white/[0.055] p-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
                  Services
                  <span className="text-primary transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-2 grid gap-1.5 text-xs">
                  {footerServices.slice(0, 4).map((service) => (
                    <button key={service.slug} type="button" onClick={() => handleServicePick(service)} className="rounded-xl bg-white/8 px-3 py-2 text-left font-semibold text-white/78">
                      {service.title}
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5">
              <p className="text-[0.68rem] leading-relaxed text-white/58">&copy; 2017-2026 FixMyDoor Services.</p>
              <div className="flex gap-1.5">
                <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80" aria-label="Instagram"><Instagram className="h-3.5 w-3.5" /></a>
                <a href="https://x.com/fixmydoor?s=11" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80" aria-label="X (Twitter)"><Twitter className="h-3.5 w-3.5" /></a>
                <a href="https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80" aria-label="Facebook"><Facebook className="h-3.5 w-3.5" /></a>
              </div>
            </div>
          </div>

          <div className="hidden gap-3 md:grid md:grid-cols-[1.1fr_0.75fr_0.75fr_1fr]">
            <div className="overflow-hidden rounded-[24px] border border-primary/18 bg-[linear-gradient(180deg,_rgba(255,255,255,0.09),_rgba(255,255,255,0.04))] p-3 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-[18px] bg-white/88 px-2 py-1.5 shadow-[0_10px_20px_rgba(66,40,18,0.1)]">
                  <img src="/img5150-transparent.png" alt="FixMyDoor logo" loading="lazy" decoding="async" className="h-12 w-auto max-w-full object-contain drop-shadow-[0_8px_12px_rgba(66,40,18,0.16)]" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">FixMyDoor Services</h3>
                  <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.18em] text-white/68">Door & Furniture Repairs</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/76">
                FixMyDoor Services helps homeowners, landlords, offices, and businesses with door repairs, lock care, furniture fixes, and product sourcing from Canada.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-white/88">Door repairs</span>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-white/88">Locks & hinges</span>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.055] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.1)]">
              <h4 className="font-display text-base font-bold">Explore</h4>
              <div className="mt-2 h-1 w-12 rounded-full bg-primary" />
              <div className="mt-3 grid gap-1.5">
                {navLinks.slice(0, 5).map((link) => (
                  <a key={link.href} href={link.href} className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm font-semibold text-white/78 transition hover:bg-white/8 hover:text-primary">
                    {link.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.055] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.1)]">
              <h4 className="font-display text-base font-bold">Services</h4>
              <div className="mt-2 h-1 w-12 rounded-full bg-primary" />
              <div className="mt-3 grid gap-1.5">
                {footerServices.slice(0, 4).map((service) => (
                  <button
                    key={service.slug}
                    type="button"
                    onClick={() => handleServicePick(service)}
                    className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-sm font-semibold text-white/78 transition hover:bg-white/8 hover:text-primary"
                  >
                    {service.title}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.075] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.1)]">
              <h4 className="font-display text-base font-bold">Contact</h4>
              <div className="mt-2 h-1 w-12 rounded-full bg-primary" />
              <div className="mt-3 space-y-2">
                <a href="tel:+14383471823" className="flex gap-2 rounded-xl bg-white/8 p-2 transition hover:bg-white/12">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15"><Phone className="h-3.5 w-3.5 text-primary" /></span>
                  <span className="text-sm font-semibold text-white/86">+1 (438) 347-1823</span>
                </a>
                <a href="mailto:info.fixmydoor@gmail.com" className="flex gap-2 rounded-xl bg-white/8 p-2 transition hover:bg-white/12">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15"><Mail className="h-3.5 w-3.5 text-primary" /></span>
                  <span className="break-all text-sm font-semibold text-white/86">info.fixmydoor@gmail.com</span>
                </a>
                <a href={BUSINESS_WHATSAPP_URL} target="_blank" rel="noreferrer" className="flex gap-2 rounded-xl bg-white/8 p-2 transition hover:bg-white/12">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15"><MessageCircle className="h-3.5 w-3.5 text-primary" /></span>
                  <span className="text-sm font-semibold text-white/86">WhatsApp: {BUSINESS_WHATSAPP_DISPLAY}</span>
                </a>
              </div>
              <div className="mt-3 flex gap-2">
                <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-primary hover:text-white" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>
                <a href="https://x.com/fixmydoor?s=11" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-primary hover:text-white" aria-label="X (Twitter)"><Twitter className="h-4 w-4" /></a>
                <a href="https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-primary hover:text-white" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>
              </div>
            </div>
          </div>

          <div className="mt-5 hidden flex-col gap-2 border-t border-white/10 pt-4 text-xs text-white/60 md:flex md:flex-row md:items-center md:justify-between">
            <p>&copy; 2017-2026 FixMyDoor Services. Door and furniture repair support from Canada.</p>
            <p>Canada-based service. International requests welcome.</p>
          </div>
        </div>
      </footer>

      {cookieBannerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1f1712]/72 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[560px] rounded-[28px] border border-primary/20 bg-white p-5 text-secondary shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Security Check</p>
                <p className="mt-1 font-display text-2xl font-bold">Before you continue</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                  This quick check helps protect booking requests from spam. Essential cookies keep the website, booking form, and admin login working properly.
                </p>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[20px] border border-primary/12 bg-[#fffaf2] p-4">
              <Checkbox
                checked={humanCheckConfirmed}
                onCheckedChange={(checked) => setHumanCheckConfirmed(checked === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-bold text-secondary">I am a real visitor, not an automated bot.</span>
                <span className="mt-1 block text-xs leading-relaxed text-foreground/65">
                  You only need to confirm this once on this device unless your browser storage is cleared.
                </span>
              </span>
            </label>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => saveCookiePreference("denied")}
                className="rounded-2xl border border-secondary/15 px-4 py-3 text-sm font-bold text-secondary transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!humanCheckConfirmed}
              >
                Deny optional cookies
              </button>
              <button
                type="button"
                onClick={() => saveCookiePreference("accepted")}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!humanCheckConfirmed}
              >
                Accept and continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
