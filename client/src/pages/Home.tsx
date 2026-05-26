import axios from "axios";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
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
  CheckCircle2,
  Facebook,
  FileText,
  Globe2,
  Instagram,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
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
const mobileScrollTrackClass = "fixmydoor-mobile-carousel flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:overflow-visible md:pb-0";
const mobileScrollItemClass = "fixmydoor-flip-card w-[86%] max-w-[24rem] flex-none snap-center md:w-auto md:max-w-none md:flex-auto";

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

const serviceAreaNotes = [
  "Head office in Montreal at 10158 Rue Berri for local coordination.",
  "Requests are welcome from Montreal, Laval, Longueuil, Brossard, the West Island, nearby Quebec communities, and other parts of Canada.",
  "International requests are welcome for sourcing, measurements, repair guidance, and product questions.",
];

const coreServiceDetails = [
  {
    title: "Door Repairs",
    text: "Sticking, sagging, noisy, loose, damaged, or hard-to-close doors. We review the frame, hinges, latch, handle, and daily use so the repair plan is practical.",
  },
  {
    title: "Door Installations",
    text: "Entry, interior, replacement, heavy-duty, wood, steel, glass-panel, and custom-fit door requests. We can help with measurements, swing direction, hardware matching, delivery, and installation planning.",
  },
  {
    title: "Furniture Repairs",
    text: "Loose sofa frames, cabinet doors, drawers, desks, chairs, shelves, and furniture pieces that need stronger support, better hardware, or careful repair.",
  },
  {
    title: "Furniture Installations",
    text: "Furniture setup, fitting, alignment, hardware installation, and practical installation support for homes, rentals, offices, and small business spaces.",
  },
  {
    title: "Locks, Hinges & Hardware",
    text: "Lock rekeying, lock replacement, handles, cylinders, hinges, drawer slides, cabinet hinges, backplates, knobs, and matching replacement parts.",
  },
  {
    title: "Hardware Sourcing",
    text: "Door hardware, furniture hardware, repair parts, doors, equipment, and product guidance before you spend money on the wrong size, finish, or style.",
  },
];

const trustDetails = [
  "Clear explanation before work starts",
  "Photo-based review for faster answers",
  "Booking records and tracking links",
  "Canada-based service with worldwide requests welcome",
  "Urgent door and lock issues reviewed as quickly as availability allows",
  "Follow-up available for the agreed repair or installation scope",
  "Repair, installation, and sourcing support in one place",
  "Customer details used only to respond to the request",
];

const faqItems = [
  {
    question: "Can I send photos before booking?",
    answer: "Yes. Add up to three photos in the request form. It helps us understand the door, lock, furniture, or part before we call you.",
  },
  {
    question: "Can you help me buy the right door or hardware?",
    answer: "Yes. Share the size, quantity, finish, swing direction, and whether you need delivery or installation. We will help narrow down the options.",
  },
  {
    question: "Do you work only in Montreal?",
    answer: "FixMyDoor Services is based in Montreal and welcomes requests from nearby Quebec communities, other parts of Canada, and international customers who need sourcing or repair guidance.",
  },
  {
    question: "Do you handle urgent or emergency door issues?",
    answer: "Yes. Mark the request as urgent or emergency in the form, call directly, or send a WhatsApp message. Availability depends on location, timing, and the type of issue.",
  },
  {
    question: "Is there follow-up after the work?",
    answer: "If something needs review after the agreed repair or installation scope, contact FixMyDoor Services quickly with photos and the booking details so it can be checked properly.",
  },
  {
    question: "Will I receive updates after booking?",
    answer: "Yes. Your confirmation email includes a tracking link. When your request is updated, you can also receive an email update.",
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
  const advertPauseUntilRef = useRef(0);
  const formReadyAtRef = useRef(Date.now());
  const contentSignatureRef = useRef("");
  const contentFetchInFlightRef = useRef(false);
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
    const updateHeader = () => {
      setHeaderCompact(window.scrollY > 18);
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
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
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let active = true;

    axios.get<{ reviews: Review[] }>("/api/reviews?limit=9")
      .then(({ data }) => {
        if (active && Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
      })
      .catch((error) => {
        console.error("Review load error:", error);
      });

    return () => {
      active = false;
    };
  }, []);

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
  const dynamicAdverts = dynamicItems("advert").map((item) => ({
    title: item.title,
    description: item.description || "See what is available now and send a request for details.",
    tag: item.tag || "Promotion",
    image: item.image || heroImage,
    isVideo: isVideoMedia(item.image),
    cta: item.items || "Send Request",
    bookingValue: item.bookingValue || "consultation",
  }));
  const displayedServiceShowcase = dynamicServiceShowcase.length > 0 ? dynamicServiceShowcase : serviceShowcase;
  const displayedProductCategories = dynamicProductCategories.length > 0 ? dynamicProductCategories : productCategories;
  const displayedDoorProducts = dynamicDoorProducts.length > 0 ? dynamicDoorProducts : doorProducts;
  const displayedHardwareProducts = dynamicHardwareProducts.length > 0 ? dynamicHardwareProducts : hardwareProducts;
  const displayedProjectGallery = dynamicProjectGallery.length > 0 ? dynamicProjectGallery : projectGallery;
  const displayedAdverts = dynamicAdverts;
  const watchedAddress = form.watch("address");
  const watchedCountry = form.watch("country");
  const showInternationalRequestDetails = !isCanadaLocation(watchedCountry) || NON_CANADIAN_LOCATION_PATTERN.test(watchedAddress || "");

  const pauseAdvertSlider = (duration = SLIDE_HOLD_PAUSE_MS) => {
    advertPauseUntilRef.current = Date.now() + duration;
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
        track.addEventListener("pointerdown", pauseTrack);
        track.addEventListener("touchstart", pauseTrack, { passive: true });
        track.addEventListener("wheel", pauseTrack, { passive: true });
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

        const items = Array.from(track.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
        if (items.length < 2 || track.scrollWidth <= track.clientWidth + 8) {
          return;
        }

        const currentIndex = items.reduce((closestIndex, item, index) => {
          const currentDistance = Math.abs(track.scrollLeft - items[closestIndex].offsetLeft);
          const nextDistance = Math.abs(track.scrollLeft - item.offsetLeft);
          return nextDistance < currentDistance ? index : closestIndex;
        }, 0);
        const nextItem = items[(currentIndex + 1) % items.length];

        track.scrollTo({
          left: nextItem.offsetLeft,
          behavior: "smooth",
        });
      });
    }, 8000);

    return () => {
      window.clearInterval(timer);
      document.querySelectorAll<HTMLElement>(".fixmydoor-mobile-carousel").forEach((track) => {
        track.removeEventListener("pointerdown", pauseTrack);
        track.removeEventListener("touchstart", pauseTrack);
        track.removeEventListener("wheel", pauseTrack);
        trackObserver.unobserve(track);
      });
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className={`sticky top-0 z-50 border-b border-primary/15 bg-[#f7efe4]/96 shadow-[0_8px_28px_rgba(47,36,28,0.06)] backdrop-blur transition-all duration-300 ${headerCompact ? "shadow-[0_12px_32px_rgba(47,36,28,0.12)]" : ""}`}>
        <div className={`container flex max-w-[1180px] items-center justify-between gap-2 transition-all duration-300 sm:gap-4 md:py-2.5 ${headerCompact ? "py-1" : "py-1.5"}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <a href="/" className="group flex shrink-0 items-center" aria-label="FixMyDoor Services homepage">
              <span className={`relative inline-flex items-center justify-center rounded-[1.35rem] border border-white/70 bg-white/88 px-2 shadow-[0_12px_26px_rgba(66,40,18,0.12)] ring-1 ring-primary/10 transition-all duration-300 ${headerCompact ? "h-11" : "h-12"} sm:h-16 md:h-20`}>
                <img src="/img5150-transparent.png" alt="FixMyDoor logo" decoding="async" className={`w-auto object-contain drop-shadow-[0_10px_18px_rgba(66,40,18,0.14)] transition-all duration-300 ${headerCompact ? "h-10" : "h-11"} sm:h-16 md:h-20`} />
                <span className="absolute -right-1 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" aria-hidden="true" />
              </span>
            </a>
            <div className="hidden min-w-0 min-[430px]:block">
              <p className="truncate font-display text-sm font-bold leading-tight text-secondary sm:text-base md:text-lg">
                FixMyDoor Services | Door & Furniture Repairs
              </p>
              <p className="mt-0.5 hidden text-[0.63rem] uppercase tracking-[0.16em] text-secondary/65 sm:block md:text-[0.68rem]">
                Repairs, installations, doors, furniture, and hardware sourcing.
              </p>
            </div>
          </div>
          <div className="hidden gap-4 text-sm font-semibold lg:flex xl:gap-5">
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
              Canada-based. You can ask from anywhere.
            </div>
            <h1 className="font-display text-[2.05rem] font-bold leading-[1.04] text-secondary sm:text-4xl md:text-[3.05rem] xl:text-[3.35rem]">
              Door trouble? We will help you sort it out.
            </h1>
            <p className="mt-3 max-w-[32rem] text-[0.96rem] leading-relaxed text-foreground/75 md:text-[1.03rem]">
              Send a photo, a quick note, or the size you have. We will tell you what can be repaired, what should be replaced, and the next step that makes sense.
            </p>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button type="button" onClick={scrollToContactForm} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.24)] transition hover:-translate-y-0.5 hover:bg-primary/90">
                Book a repair
                <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#shop" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-secondary/15 bg-white px-5 py-2.5 text-sm font-bold text-secondary shadow-[0_10px_24px_rgba(47,36,28,0.08)] transition hover:-translate-y-0.5 hover:border-primary hover:text-primary">
                <ShoppingBag className="h-4 w-4" />
                Shop doors & hardware
              </a>
              <a href="tel:+14383471823" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,36,28,0.18)] transition hover:-translate-y-0.5 hover:bg-secondary/90">
                <Phone className="h-4 w-4" />
                Call +1 (438) 347-1823
              </a>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
              <div className="rounded-2xl bg-white p-2.5 text-center shadow-lg shadow-primary/5 sm:p-3.5 sm:text-left">
                <Zap className="mx-auto mb-1.5 h-4 w-4 text-primary sm:mx-0 sm:mb-2 sm:h-5 sm:w-5" />
                <p className="text-xs font-bold leading-tight text-secondary sm:text-base">Quick Reply</p>
                <p className="mt-1 hidden text-xs leading-relaxed text-foreground/65 sm:block">Tell us the issue and we will guide you from there.</p>
              </div>
              <div className="rounded-2xl bg-white p-2.5 text-center shadow-lg shadow-primary/5 sm:p-3.5 sm:text-left">
                <div className="mb-1.5 text-base font-black text-primary sm:mb-2 sm:text-xl">C$</div>
                <p className="text-xs font-bold leading-tight text-secondary sm:text-base">Fair C$ Pricing</p>
                <p className="mt-1 hidden text-xs leading-relaxed text-foreground/65 sm:block">Clear answers before any work starts.</p>
              </div>
              <div className="rounded-2xl bg-white p-2.5 text-center shadow-lg shadow-primary/5 sm:p-3.5 sm:text-left">
                <CheckCircle2 className="mx-auto mb-1.5 h-4 w-4 text-primary sm:mx-0 sm:mb-2 sm:h-5 sm:w-5" />
                <p className="text-xs font-bold leading-tight text-secondary sm:text-base">Neat Finish</p>
                <p className="mt-1 hidden text-xs leading-relaxed text-foreground/65 sm:block">Careful work without messy shortcuts.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white p-2.5 shadow-[0_24px_70px_rgba(66,40,18,0.16)] md:rounded-[32px] md:p-3 md:shadow-[0_30px_90px_rgba(66,40,18,0.18)]">
              <img src={heroImage} alt="Lock rekeying service at a front door" loading="eager" decoding="async" className="h-[210px] w-full rounded-[22px] object-cover object-center sm:h-[320px] md:h-[430px] md:rounded-[24px]" />
              <div className="absolute bottom-3 left-3 right-3 rounded-[20px] bg-white/92 p-3 shadow-lg backdrop-blur md:bottom-7 md:left-7 md:right-7 md:max-w-sm md:rounded-[24px] md:p-4">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Featured Service</p>
                <h2 className="mt-1 text-xl font-bold text-secondary md:mt-2 md:text-2xl">Front Door Rekeying</h2>
                <p className="mt-1 text-xs leading-relaxed text-foreground/70 md:mt-2 md:text-sm">
                  If a key goes missing or the lock starts acting up, we can rekey the entry and help the door feel secure again.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {displayedAdverts.length > 0 && (
        <section className="bg-white py-4 md:py-6">
          <div className="container max-w-[1180px]">
            <div
              className="overflow-hidden rounded-[28px] border border-primary/12 bg-[linear-gradient(135deg,_#fffaf3,_#ffffff_58%,_#f1dfcd)] shadow-[0_18px_48px_rgba(66,40,18,0.10)] md:rounded-[32px]"
              onPointerDown={() => pauseAdvertSlider()}
              onPointerUp={() => pauseAdvertSlider(DOT_SELECTION_PAUSE_MS)}
              onPointerCancel={() => pauseAdvertSlider(DOT_SELECTION_PAUSE_MS)}
              onMouseEnter={() => pauseAdvertSlider(DOT_SELECTION_PAUSE_MS)}
              aria-live="polite"
            >
              <div className="flex transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform" style={{ transform: `translateX(-${activeAdvertIndex * 100}%)` }}>
                {displayedAdverts.map((advert, index) => (
                  <article key={`${advert.title}-${index}`} className="grid min-w-full gap-0 md:grid-cols-[1.03fr_0.97fr] md:items-stretch">
                    <div className="flex flex-col justify-center p-5 sm:p-6 md:p-7">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary px-3 py-1 text-[0.66rem] font-bold uppercase tracking-[0.22em] text-white">
                            {advert.tag}
                          </span>
                          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-secondary/55">Latest Offer</span>
                        </div>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-secondary/55">
                          {index + 1}/{displayedAdverts.length}
                        </span>
                      </div>
                      <h2 className="mt-4 font-display text-[1.8rem] font-bold leading-tight text-secondary sm:text-[2.1rem]">
                        {advert.title}
                      </h2>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground/72 md:text-[0.97rem]">
                        {advert.description}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleCatalogPick(advert.bookingValue, advert.title)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(47,36,28,0.12)] transition hover:-translate-y-0.5 hover:bg-primary"
                        >
                          {advert.cta}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <a
                          href={BUSINESS_WHATSAPP_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/18 bg-white px-5 py-2.5 text-sm font-bold text-secondary shadow-[0_10px_22px_rgba(47,36,28,0.08)] transition hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                        <div className="ml-auto hidden items-center gap-2 md:flex">
                          <button
                            type="button"
                            onClick={showPreviousAdvert}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/14 bg-white text-secondary transition hover:border-primary hover:text-primary"
                            aria-label="Show previous advert"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={showNextAdvert}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-white transition hover:bg-primary"
                            aria-label="Show next advert"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="relative min-h-[220px] overflow-hidden bg-[linear-gradient(160deg,_#6b3f43_0%,_#845057_46%,_#ecd8c3_100%)] md:min-h-[280px]">
                      {advert.isVideo ? (
                        <video src={advert.image} className="h-full min-h-[220px] w-full object-cover md:min-h-[280px]" autoPlay muted loop playsInline controls />
                      ) : (
                        <img src={advert.image} alt={advert.title} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="h-full min-h-[220px] w-full object-contain p-4 md:min-h-[280px] md:p-5" />
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary/22 via-transparent to-white/6" />
                    </div>
                  </article>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-primary/10 bg-white/80 px-5 py-3 backdrop-blur sm:px-6">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-secondary/60">
                  Published promotions from admin
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 gap-2">
                    {displayedAdverts.map((advert, index) => (
                      <button
                        key={`${advert.title}-${index}`}
                        type="button"
                        onClick={() => {
                          pauseAdvertSlider(DOT_SELECTION_PAUSE_MS);
                          setActiveAdvertIndex(index);
                        }}
                        className={`h-2.5 rounded-full transition-all ${activeAdvertIndex === index ? "w-7 bg-primary" : "w-2.5 bg-secondary/20 hover:bg-secondary/35"}`}
                        aria-label={`Show advert ${index + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 md:hidden">
                    <button
                      type="button"
                      onClick={showPreviousAdvert}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/14 bg-white text-secondary transition hover:border-primary hover:text-primary"
                      aria-label="Show previous advert"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={showNextAdvert}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-white transition hover:bg-primary"
                      aria-label="Show next advert"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-[#2f241c] py-9 text-white md:py-10">
        <div className="container max-w-[1180px]">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Choose Your Path</p>
              <h2 className="mt-2 font-display text-2xl font-bold md:text-4xl">Need a repair or the right part?</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-white/72">
              Start with the option that matches your situation. We will help you figure out what to do next.
            </p>
          </div>

          <div className="overflow-hidden md:overflow-visible">
            <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-4`}>
            {customerPaths.map((path, index) => (
              <a
                key={path.title}
                href={path.href}
                className={`group ${mobileScrollItemClass} overflow-hidden rounded-[24px] border border-white/10 p-5 shadow-[0_14px_38px_rgba(0,0,0,0.14)] transition hover:-translate-y-1 ${
                  index === 0 ? "bg-white text-secondary" : "bg-primary text-white"
                }`}
              >
                <span className={`inline-flex rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.22em] ${
                  index === 0 ? "bg-primary/10 text-primary" : "bg-white/18 text-white"
                }`}>
                  {path.label}
                </span>
                <h3 className="mt-4 text-xl font-bold md:text-2xl">{path.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${index === 0 ? "text-foreground/68" : "text-white/82"}`}>{path.desc}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                  {path.cta}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </a>
            ))}
            </div>
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
              FixMyDoor Services is built for practical repair, installation, and sourcing requests. Customers can contact us for one small fix, a full door replacement, furniture installation, or help finding the right hardware before buying.
            </p>
          </div>

          <div className="overflow-hidden md:overflow-visible">
            <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3`}>
              {coreServiceDetails.map((service) => (
                <article key={service.title} className={`${mobileScrollItemClass} rounded-[18px] border border-primary/10 bg-[#fffaf2] p-4 shadow-[0_10px_24px_rgba(47,36,28,0.05)] md:rounded-[22px] md:p-5`}>
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
              Doors, locks, hinges, cabinets, and furniture all wear down with daily use. We keep the explanation simple and focus on what will actually solve the problem.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="overflow-hidden rounded-[28px] bg-secondary p-5 text-white shadow-[0_22px_60px_rgba(66,40,18,0.2)] md:rounded-[32px] md:p-8">
              <div className="grid gap-5 md:gap-8 xl:grid-cols-[0.88fr_1.12fr] xl:items-center">
                <div className="max-w-lg">
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
                <div className="grid gap-4 sm:grid-cols-2">
                  {featuredServiceCollage.map((item, index) => (
                    <figure key={item.title} className={`group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 ${item.featured ? "sm:col-span-2" : ""} ${index > 0 ? "hidden sm:block" : ""}`}>
                      <img
                        src={item.src}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className={`w-full object-cover transition duration-500 group-hover:scale-[1.03] ${item.featured ? "h-48 md:h-52" : "h-40 md:h-44"}`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-secondary/85 via-secondary/15 to-transparent" />
                      <figcaption className="absolute inset-x-0 bottom-0 p-4">
                        <span className="text-[0.7rem] font-bold uppercase tracking-[0.24em] text-white/75">{item.tag}</span>
                        <p className="mt-2 text-lg font-bold text-white">{item.title}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </article>

            <div className="overflow-hidden md:overflow-visible">
              <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-5`}>
              {displayedServiceShowcase.map((service, index) => (
                <article key={service.title} className={`${mobileScrollItemClass} overflow-hidden rounded-[24px] border border-primary/12 bg-[linear-gradient(180deg,_#fffdfb,_#f4ede3)] shadow-[0_14px_40px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 md:rounded-[28px]`}>
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
                Tell us what you want to fix, replace, or buy. We will help you choose the right option before you spend money on the wrong item.
              </p>
            </div>
            <button type="button" onClick={scrollToContactForm} className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.2)] transition hover:-translate-y-0.5 hover:bg-primary/90">
              Ask for a Quote
            </button>
          </div>

          <div className="overflow-hidden md:overflow-visible">
            <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3`}>
            {displayedProductCategories.map((category, index) => (
              <article key={category.title} className={`${mobileScrollItemClass} overflow-hidden rounded-[28px] border border-primary/12 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.07)] md:rounded-[32px]`}>
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
          </div>

          <div className="mt-8 rounded-[28px] bg-[#2f241c] p-5 text-white shadow-[0_22px_70px_rgba(47,36,28,0.2)] sm:p-8 md:mt-12 md:rounded-[34px]">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Door Buying Gallery</p>
                <h3 className="mt-3 text-2xl font-bold md:text-3xl">Paladin, SED, heavy-duty, entry, interior, and custom-fit doors</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
                  Different sizes are available, so you can ask about the type of door and opening size you need before buying.
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
              <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-3 md:gap-4 lg:grid-cols-5`}>
              {displayedDoorProducts.map((product, index) => (
                <button
                  key={product.title}
                  type="button"
                  onClick={() => handleCatalogPick("door-purchase", product.title)}
                  className={`group ${mobileScrollItemClass} overflow-hidden rounded-[22px] bg-white/8 text-left transition hover:-translate-y-1 hover:bg-white/12`}
                >
                  <img src={product.image} alt={product.title} loading="lazy" decoding="async" className="h-48 w-full bg-white object-cover transition duration-500 group-hover:scale-[1.03] md:h-56" />
                  <div className="p-4">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary">{product.tag}</span>
                    <p className="mt-2 font-bold text-white">{product.title}</p>
                  </div>
                </button>
              ))}
              </div>
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
              <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-3 md:gap-4 lg:grid-cols-5`}>
              {displayedHardwareProducts.map((product, index) => (
                <button
                  key={product.title}
                  type="button"
                  onClick={() => handleCatalogPick(product.tag.includes("Drawer") || product.tag.includes("Cabinet") ? "furniture-hardware-purchase" : "door-hardware-purchase", product.title)}
                  className={`group ${mobileScrollItemClass} overflow-hidden rounded-[22px] border border-primary/10 bg-[#fffaf2] text-left transition hover:-translate-y-1`}
                >
                  <img src={product.image} alt={product.title} loading="lazy" decoding="async" className="h-40 w-full bg-white object-contain p-3 transition duration-500 group-hover:scale-[1.03] md:h-48" />
                  <div className="p-4">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary">{product.tag}</span>
                    <p className="mt-2 font-bold text-secondary">{product.title}</p>
                  </div>
                </button>
              ))}
              </div>
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
              These examples show the type of door, lock, and furniture work we are often asked to look at.
            </p>
          </div>

          <div className="overflow-hidden md:overflow-visible">
            <div className={`${mobileScrollTrackClass} md:grid md:grid-cols-2 md:gap-6 xl:grid-cols-3`}>
            {displayedProjectGallery.map((project, index) => (
              <article key={project.title} className={`${mobileScrollItemClass} overflow-hidden rounded-[26px] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 md:rounded-[30px]`}>
                <img src={project.src} alt={project.title} loading="lazy" decoding="async" className="h-56 w-full object-cover md:h-[300px]" />
                <div className="p-5 md:p-6">
                  <span className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-primary">{project.category}</span>
                  <h3 className="mt-3 text-2xl font-bold text-secondary">{project.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/70">{project.desc}</p>
                </div>
              </article>
            ))}
            </div>
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
              {featuredReviews.map((review, index) => (
                <article key={review.id} className={`${mobileScrollItemClass} rounded-[22px] border border-primary/10 bg-white p-4 shadow-[0_12px_34px_rgba(0,0,0,0.05)]`}>
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
          <div className="mb-4 flex flex-col gap-2 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">How It Works</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-secondary md:text-3xl">Simple from first message to finished job.</h2>
            </div>
            <button type="button" onClick={scrollToContactForm} className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.18)] transition hover:-translate-y-0.5 hover:bg-primary/90">
              Start Booking
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
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

      <section className="bg-[linear-gradient(180deg,_#fffdf8,_#f4eadc)] py-8 md:py-12">
        <div className="container max-w-[1180px]">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
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

      <section className="bg-white py-8 md:py-12">
        <div className="container max-w-[1180px]">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary">Questions Customers Ask</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:text-4xl">A few answers before you book</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {faqItems.map((item, index) => (
              <article key={item.question} className={`rounded-[24px] border border-primary/10 bg-background p-5 ${index > 1 ? "hidden md:block" : ""}`}>
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
              <div className="rounded-[22px] bg-[#2f241c] p-5 text-white shadow-[0_14px_34px_rgba(47,36,28,0.16)] sm:col-span-2 md:col-span-1">
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
                <div className="sm:col-span-2 rounded-[22px] border border-primary/10 bg-background p-4">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-bold text-secondary">Helpful details for repairs or buying</p>
                      <p className="text-xs leading-relaxed text-foreground/65">Add what you know. These details help us understand the job faster and avoid asking the same questions later.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                </div>
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
        <div className="container relative max-w-[1180px] py-4 md:py-5">
          <div className="grid gap-3 md:grid-cols-[1.1fr_0.75fr_0.75fr_1fr]">
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

          <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
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
