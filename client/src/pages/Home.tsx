import axios from "axios";
import { type ChangeEvent, useEffect, useState } from "react";
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
  customerConsent: z.boolean().refine(Boolean, "Please confirm that FixMyDoor can contact you about this request"),
});

type BookingFormData = z.infer<typeof bookingSchema>;

const reviewSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  location: z.string().max(100, "Location is too long").optional(),
  rating: z.number().int().min(1).max(5),
  quote: z.string().min(8, "Please write a little more about your experience").max(500, "Review is too long"),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

const navLinks = [
  { href: "#services", label: "Services" },
  { href: "#shop", label: "Shop" },
  { href: "#before-after", label: "Projects" },
  { href: "#about", label: "About" },
  { href: "#testimonials", label: "Reviews" },
  { href: "#contact", label: "Contact" },
];

const serviceAreaNotes = [
  "Montreal-based head office for local coordination.",
  "Canada-wide booking support for homes, rentals, offices, and small commercial spaces.",
  "International requests are welcome for product sourcing, measurements, and repair guidance.",
];

const faqItems = [
  {
    question: "Can I send photos before booking?",
    answer: "Yes. Add up to three photos in the request form so we can understand the door, lock, furniture, or part before calling you.",
  },
  {
    question: "Can you help me buy the right door or hardware?",
    answer: "Yes. Share the size, quantity, finish, swing direction, and whether you need delivery or installation. We will help narrow the options.",
  },
  {
    question: "Do you work only in Montreal?",
    answer: "The business address is in Montreal, but FixMyDoor supports Canada-based requests and international product or repair questions.",
  },
  {
    question: "Will I receive updates after booking?",
    answer: "Yes. Your confirmation email includes a tracking link, and admin status changes can send an update email.",
  },
];

export default function Home() {
  const [services, setServices] = useState<ServiceCatalogItem[]>(defaultServiceCatalog);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
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

    axios.get<{ items: ContentItem[] }>("/api/content")
      .then(({ data }) => {
        if (active && Array.isArray(data.items)) {
          setContentItems(data.items);
        }
      })
      .catch((error) => {
        console.error("Content load error:", error);
      });

    return () => {
      active = false;
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
      customerConsent: data.customerConsent,
    };

    try {
      await axios.post("/api/bookings", payload);
      toast.success("Thanks, your request was sent. Check your email for the tracking link.");
      form.reset();
      setPhotoPreviews([]);
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
  const displayedServiceShowcase = dynamicServiceShowcase.length > 0 ? dynamicServiceShowcase : serviceShowcase;
  const displayedProductCategories = dynamicProductCategories.length > 0 ? dynamicProductCategories : productCategories;
  const displayedDoorProducts = dynamicDoorProducts.length > 0 ? dynamicDoorProducts : doorProducts;
  const displayedHardwareProducts = dynamicHardwareProducts.length > 0 ? dynamicHardwareProducts : hardwareProducts;
  const displayedProjectGallery = dynamicProjectGallery.length > 0 ? dynamicProjectGallery : projectGallery;

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
      const previews = await Promise.all(validFiles.map(readFile));
      setPhotoPreviews(previews);
    } catch (error) {
      toast.error("Unable to read one of the selected photos.");
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

    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById("repair-type-trigger")?.focus();
    }, 350);

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

    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById("repair-type-trigger")?.focus();
    }, 350);

    toast.success(`${label} selected. Add your details and we'll follow up.`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-primary/15 bg-[#f7efe4]/96 shadow-[0_8px_28px_rgba(47,36,28,0.06)] backdrop-blur">
        <div className="border-b border-primary/10 bg-[#3a281f] text-white">
          <div className="container flex max-w-[1180px] flex-wrap items-center justify-center gap-x-5 gap-y-1 py-1 text-center text-[0.68rem] font-semibold sm:justify-between sm:text-[0.72rem]">
            <span>Based in Canada. Helping with repairs, installs, doors, and hardware requests worldwide.</span>
            <span className="inline-flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-primary" />
              <a href="tel:+14383471823" className="hover:text-primary">+1 (438) 347-1823</a>
            </span>
          </div>
        </div>
        <div className="container flex max-w-[1180px] items-center justify-between gap-3 py-1.5 sm:gap-4 md:py-2">
          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            <a href="/" className="flex shrink-0 items-center">
              <img src="/img5150-transparent.png" alt="FixMyDoor logo" className="h-14 w-auto object-contain drop-shadow-[0_10px_18px_rgba(66,40,18,0.14)] sm:h-16 md:h-[4.5rem]" />
            </a>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold leading-tight text-secondary sm:text-base md:text-lg">
                FixMyDoor | Door & Furniture Repairs
              </p>
              <p className="mt-0.5 hidden text-[0.6rem] uppercase tracking-[0.18em] text-secondary/65 sm:block md:text-[0.64rem]">
                Canada-based service. International requests welcome.
              </p>
            </div>
          </div>
          <div className="hidden gap-4 text-sm font-semibold lg:flex xl:gap-5">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-primary">{link.label}</a>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href="tel:+14383471823" className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-[0_10px_22px_rgba(180,101,50,0.18)] transition hover:-translate-y-0.5 hover:bg-primary/90 sm:px-4 sm:text-sm">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Call Now</span>
              <span className="sm:hidden">Call</span>
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-white text-secondary shadow-sm lg:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
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

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(212,165,116,0.2),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(66,40,18,0.12),_transparent_34%),linear-gradient(to_bottom,_#f8f3ea,_#ffffff)]">
        <div className="container grid max-w-[1180px] items-center gap-5 py-5 sm:py-7 md:grid-cols-[0.9fr_1fr] md:py-8 lg:gap-8">
          <div className="max-w-lg">
            <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-primary/18 bg-white px-3.5 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-secondary shadow-sm">
              <Globe2 className="h-4 w-4 text-primary" />
              Based in Canada. Available for international requests.
            </div>
            <h1 className="font-display text-[2.05rem] font-bold leading-[1.04] text-secondary sm:text-4xl md:text-[3.05rem] xl:text-[3.35rem]">
              Doors that close right. Hardware that fits.
            </h1>
            <p className="mt-3 max-w-[32rem] text-[0.96rem] leading-relaxed text-foreground/75 md:text-[1.03rem]">
              If a door sticks, a lock feels loose, or furniture hardware keeps giving trouble, we help you fix it properly or find the right replacement.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href="#contact" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.24)] transition hover:-translate-y-0.5 hover:bg-primary/90">
                Book a Repair
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#shop" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-secondary/15 bg-white px-5 py-2.5 text-sm font-bold text-secondary shadow-[0_10px_24px_rgba(47,36,28,0.08)] transition hover:-translate-y-0.5 hover:border-primary hover:text-primary">
                <ShoppingBag className="h-4 w-4" />
                Shop Doors & Hardware
              </a>
              <a href="tel:+14383471823" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,36,28,0.18)] transition hover:-translate-y-0.5 hover:bg-secondary/90">
                <Phone className="h-4 w-4" />
                Call +1 (438) 347-1823
              </a>
            </div>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-3.5 shadow-lg shadow-primary/5">
                <Zap className="mb-2 h-5 w-5 text-primary" />
                <p className="font-bold text-secondary">Fast Scheduling</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/65">Send the issue and we will guide the next step.</p>
              </div>
              <div className="rounded-2xl bg-white p-3.5 shadow-lg shadow-primary/5">
                <div className="mb-2 text-xl font-black text-primary">C$</div>
                <p className="font-bold text-secondary">Fair Pricing</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/65">Straight answers before work begins.</p>
              </div>
              <div className="rounded-2xl bg-white p-3.5 shadow-lg shadow-primary/5">
                <CheckCircle2 className="mb-2 h-5 w-5 text-primary" />
                <p className="font-bold text-secondary">Clean Finish</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/65">Careful work without messy shortcuts.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-5 top-8 h-32 w-32 rounded-full bg-primary/18 blur-3xl" />
            <div className="absolute -right-6 bottom-10 h-40 w-40 rounded-full bg-secondary/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white p-3 shadow-[0_30px_90px_rgba(66,40,18,0.18)]">
              <img src={heroImage} alt="Lock rekeying service at a front door" className="h-[250px] w-full rounded-[24px] object-cover object-center sm:h-[320px] md:h-[430px]" />
              <div className="absolute bottom-5 left-5 right-5 rounded-[24px] bg-white/90 p-4 shadow-lg backdrop-blur md:bottom-7 md:left-7 md:right-7 md:max-w-sm">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Featured Service</p>
                <h2 className="mt-2 text-2xl font-bold text-secondary">Front Door Rekeying</h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                  If a key goes missing or a lock starts acting up, we can rekey the entry and get the door feeling secure again.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

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

          <div className="grid gap-4 md:grid-cols-2">
            {customerPaths.map((path, index) => (
              <a
                key={path.title}
                href={path.href}
                className={`group overflow-hidden rounded-[24px] border border-white/10 p-5 shadow-[0_14px_38px_rgba(0,0,0,0.14)] transition hover:-translate-y-1 ${
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
      </section>

      <section id="services" className="bg-white py-16 md:py-[4.5rem]">
        <div className="container max-w-[1180px]">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">What We Handle</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Real fixes for everyday door and furniture problems</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
              Doors, locks, hinges, cabinets, and furniture all wear down with daily use. We keep the explanation simple and focus on what will actually solve the problem.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="overflow-hidden rounded-[32px] bg-secondary p-8 text-white shadow-[0_22px_60px_rgba(66,40,18,0.2)]">
              <div className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr] xl:items-center">
                <div className="max-w-lg">
                  <span className="inline-flex rounded-full bg-white/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white/90">{featuredService.tag}</span>
                  <h3 className="mt-4 font-display text-3xl font-bold leading-tight">{featuredService.title}</h3>
                  <p className="mt-4 max-w-xl text-white/82">{featuredService.desc}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {["Front-door rekeying", "Wood door fitting", "Sofa frame repair", "Furniture setup"].map((item) => (
                      <span key={item} className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white/90">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {featuredServiceCollage.map((item) => (
                    <figure key={item.title} className={`group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 ${item.featured ? "sm:col-span-2" : ""}`}>
                      <img
                        src={item.src}
                        alt={item.title}
                        loading="lazy"
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

            <div className="grid gap-5 sm:grid-cols-2">
              {displayedServiceShowcase.map((service) => (
                <article key={service.title} className="overflow-hidden rounded-[28px] border border-primary/12 bg-[linear-gradient(180deg,_#fffdfb,_#f4ede3)] shadow-[0_14px_40px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1">
                  <img
                    src={service.src}
                    alt={service.title}
                    loading="lazy"
                    className={`h-52 w-full ${service.contain ? "bg-white p-4 object-contain" : "object-cover"}`}
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
      </section>

      <section id="shop" className="bg-[linear-gradient(180deg,_#fffdf8,_#f3eadc)] py-16 md:py-[4.5rem]">
        <div className="container max-w-[1180px]">
          <div className="mb-10 flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Buy & Source</p>
              <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Need a door, handle, lock, hinge, or furniture part?</h2>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
                Tell us what you are trying to fix or replace. We can help you narrow down the right product before you spend money on the wrong item.
              </p>
            </div>
            <a href="#contact" className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.2)] transition hover:-translate-y-0.5 hover:bg-primary/90">
              Ask for a Quote
            </a>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {displayedProductCategories.map((category) => (
              <article key={category.title} className="overflow-hidden rounded-[32px] border border-primary/12 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.07)]">
                <div className="relative h-64 overflow-hidden bg-[#f8f4ec]">
                  <img src={category.image} alt={category.title} loading="lazy" className="h-full w-full object-cover" />
                  <img src={category.accent} alt="" loading="lazy" className="absolute bottom-4 right-4 h-24 w-24 rounded-2xl border-4 border-white bg-white object-cover shadow-xl" />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-secondary">{category.title}</h3>
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

          <div className="mt-12 rounded-[34px] bg-[#2f241c] p-5 text-white shadow-[0_22px_70px_rgba(47,36,28,0.2)] sm:p-8">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Door Buying Gallery</p>
                <h3 className="mt-3 text-3xl font-bold">Paladin, SED, heavy-duty, entry, interior, and custom-fit doors</h3>
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {displayedDoorProducts.map((product) => (
                <button
                  key={product.title}
                  type="button"
                  onClick={() => handleCatalogPick("door-purchase", product.title)}
                  className="group overflow-hidden rounded-[22px] bg-white/8 text-left transition hover:-translate-y-1 hover:bg-white/12"
                >
                  <img src={product.image} alt={product.title} loading="lazy" className="h-56 w-full bg-white object-cover transition duration-500 group-hover:scale-[1.03]" />
                  <div className="p-4">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary">{product.tag}</span>
                    <p className="mt-2 font-bold text-white">{product.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-[34px] border border-primary/12 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] sm:p-8">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Hardware & Tools</p>
                <h3 className="mt-3 text-3xl font-bold text-secondary">Handles, locks, hinges, drawer slides, and cabinet parts</h3>
              </div>
              <button
                type="button"
                onClick={() => handleCatalogPick("door-hardware-purchase", "door and furniture hardware")}
                className="inline-flex items-center justify-center rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,36,28,0.14)] transition hover:-translate-y-0.5 hover:bg-primary"
              >
                Ask About Hardware
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {displayedHardwareProducts.map((product) => (
                <button
                  key={product.title}
                  type="button"
                  onClick={() => handleCatalogPick(product.tag.includes("Drawer") || product.tag.includes("Cabinet") ? "furniture-hardware-purchase" : "door-hardware-purchase", product.title)}
                  className="group overflow-hidden rounded-[22px] border border-primary/10 bg-[#fffaf2] text-left transition hover:-translate-y-1"
                >
                  <img src={product.image} alt={product.title} loading="lazy" className="h-48 w-full bg-white object-contain p-3 transition duration-500 group-hover:scale-[1.03]" />
                  <div className="p-4">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary">{product.tag}</span>
                    <p className="mt-2 font-bold text-secondary">{product.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="before-after" className="bg-gradient-to-b from-background to-white py-16 md:py-[4.5rem]">
        <div className="container max-w-[1180px]">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Our Work</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Recent jobs customers usually ask about</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
              These examples show the type of door, lock, and furniture work we are often asked to look at.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {displayedProjectGallery.map((project) => (
              <article key={project.title} className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1">
                <img src={project.src} alt={project.title} loading="lazy" className="h-[300px] w-full object-cover" />
                <div className="p-6">
                  <span className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-primary">{project.category}</span>
                  <h3 className="mt-3 text-2xl font-bold text-secondary">{project.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/70">{project.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="bg-white py-9 md:py-10">
        <div className="container grid max-w-[1180px] gap-6 md:grid-cols-[0.58fr_1.42fr] md:items-start">
          <div className="relative order-2 md:order-1">
            <div className="absolute -left-4 top-8 h-28 w-28 rounded-full bg-primary/18 blur-3xl" />
            <div className="relative mx-auto flex h-[330px] max-w-[285px] items-center justify-center overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,_#f7efe4,_#ffffff)] shadow-[0_16px_42px_rgba(66,40,18,0.13)] sm:h-[360px] sm:max-w-[310px] md:mx-0 md:h-[380px] md:max-w-[320px]">
              <img src={technicianImage} alt="Richard Ampofo working on a door repair" loading="lazy" className="h-full w-full object-cover object-top" />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary">Meet the Expert</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:text-4xl">Richard Ampofo</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/75">
              Richard runs FixMyDoor with a simple approach: look at the problem, explain the options clearly, and do the work in a way that feels solid when you use it again.
            </p>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/75">
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
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href="tel:+14383471823" className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.2)] transition hover:-translate-y-0.5 hover:bg-primary/90">Schedule Now</a>
              <a href="mailto:info.fixmydoor@gmail.com" className="inline-flex items-center justify-center rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,36,28,0.14)] transition hover:-translate-y-0.5 hover:bg-secondary/90">Send Email</a>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="bg-gradient-to-b from-background to-white py-10 md:py-12">
        <div className="container max-w-[1180px]">
          <div className="mb-6 flex flex-col gap-3 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary">Client Reviews</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:text-4xl">What customers have said</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/70">
                After a job, customers can leave their own review here so others know what to expect.
              </p>
            </div>
            <a href="#write-review" className="inline-flex items-center justify-center rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,36,28,0.14)] transition hover:-translate-y-0.5 hover:bg-secondary/90">
              Write a Review
            </a>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_0.62fr] lg:items-start">
            <div className="grid gap-4 md:grid-cols-3">
              {featuredReviews.map((review) => (
                <article key={review.id} className="rounded-[22px] border border-primary/10 bg-white p-4 shadow-[0_12px_34px_rgba(0,0,0,0.05)]">
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

            <div id="write-review" className="rounded-[24px] border border-primary/12 bg-white p-5 shadow-[0_14px_40px_rgba(0,0,0,0.06)]">
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
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-divider bg-white py-9 md:py-10">
        <div className="container max-w-[1180px]">
          <div className="mb-5 flex flex-col gap-2 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">How It Works</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-secondary md:text-4xl">Simple from the first message to the finished job.</h2>
            </div>
            <a href="#contact" className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.2)] transition hover:-translate-y-0.5 hover:bg-primary/90">
              Start Booking
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-primary/10 bg-background p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">1</div>
              <h3 className="text-lg font-semibold text-secondary">Contact Us</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">Call <a href="tel:+14383471823" className="font-semibold text-primary hover:underline">+1 (438) 347-1823</a> or send a few details about what you need.</p>
            </div>
            <div className="rounded-[22px] border border-primary/10 bg-background p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg font-bold text-white">2</div>
              <h3 className="text-lg font-semibold text-secondary">Confirm the Plan</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">We look at the issue, ask the right questions, and agree on the next step.</p>
            </div>
            <div className="rounded-[22px] border border-primary/10 bg-background p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">3</div>
              <h3 className="text-lg font-semibold text-secondary">Fix or Source It</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">We finish the repair neatly, or help match the right product to the job.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,_#fffdf8,_#f4eadc)] py-10 md:py-12">
        <div className="container max-w-[1180px]">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[28px] bg-[#2f241c] p-6 text-white shadow-[0_18px_50px_rgba(47,36,28,0.18)] md:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Service Areas</p>
              <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">Canada-based, with support for international requests</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                FixMyDoor is organized from Montreal, but the service conversation is not limited to one city. Send your repair, installation, door, or hardware request and we will confirm what is realistic for your location.
              </p>
              <div className="mt-5 grid gap-3">
                {serviceAreaNotes.map((note) => (
                  <div key={note} className="flex gap-3 rounded-2xl bg-white/8 p-4">
                    <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm leading-relaxed text-white/84">{note}</p>
                  </div>
                ))}
              </div>
            </article>

            <div className="grid gap-5 md:grid-cols-2">
              <article className="rounded-[28px] border border-primary/12 bg-white p-6 shadow-[0_14px_38px_rgba(0,0,0,0.055)]">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-2xl font-bold text-secondary">Workmanship promise</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  We aim for repairs that feel solid when you use them again. If something needs follow-up after the agreed work, contact us quickly so it can be reviewed properly.
                </p>
              </article>
              <article className="rounded-[28px] border border-primary/12 bg-white p-6 shadow-[0_14px_38px_rgba(0,0,0,0.055)]">
                <FileText className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-2xl font-bold text-secondary">Clear request records</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Every submitted request is saved in the dashboard, emailed to the team, and confirmed to the customer with a tracking link for status updates.
                </p>
              </article>
              <article className="rounded-[28px] border border-primary/12 bg-white p-6 shadow-[0_14px_38px_rgba(0,0,0,0.055)] md:col-span-2">
                <h3 className="text-2xl font-bold text-secondary">Privacy note</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Customer contact details are collected only to respond to repair, installation, quote, review, or product requests. Do not send sensitive lock codes or private access details through the form.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-10 md:py-12">
        <div className="container max-w-[1180px]">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary">Questions Customers Ask</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-secondary md:text-4xl">A few answers before you book</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {faqItems.map((item) => (
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
            <p className="mt-2 max-w-md text-sm leading-relaxed text-foreground/68">Send the details you have, even if you are not sure what the problem is called. We will help you sort out the next step.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-1">
              <div className="flex gap-3 rounded-[20px] bg-background p-4 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-5 w-5 text-primary" /></div>
                <div><p className="font-semibold text-secondary">Phone</p><a href="tel:+14383471823" className="text-base font-semibold text-primary hover:underline">+1 (438) 347-1823</a></div>
              </div>
              <div className="flex gap-3 rounded-[20px] bg-background p-4 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><MessageCircle className="h-5 w-5 text-primary" /></div>
                <div><p className="font-semibold text-secondary">WhatsApp</p><a href="https://wa.me/233242011305" className="text-base font-semibold text-primary hover:underline">+233 24 201 1305</a></div>
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
            </div>
          </div>

          <div className="rounded-[26px] border border-primary/12 bg-white p-5 shadow-[0_16px_42px_rgba(0,0,0,0.055)] sm:p-6">
            <h3 className="text-2xl font-semibold text-secondary">Tell Us What You Need</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/68">Tell us what is happening. A short description is enough to start the conversation.</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Name *</FormLabel><FormControl><Input placeholder="Your full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Phone *</FormLabel><FormControl><Input type="tel" placeholder="+1 (438) 000-0000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Email *</FormLabel><FormControl><Input type="email" placeholder="your.email@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Address *</FormLabel><FormControl><Input placeholder="Where is the job located?" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                      <p className="text-xs leading-relaxed text-foreground/65">Add what you know. If you are not sure, leave it blank and we will ask during follow-up.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="dimensions" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Size / Measurements</FormLabel><FormControl><Input placeholder="Example: 32 x 80 inches" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                        <p className="text-xs leading-relaxed text-foreground/65">Optional, but very helpful. Add up to 3 images under 1.8MB each.</p>
                      </div>
                    </div>
                    <Input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="max-w-xs bg-background" />
                  </div>
                  {photoPreviews.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {photoPreviews.map((photo, index) => (
                        <img key={`${photo.slice(0, 30)}-${index}`} src={photo} alt={`Uploaded preview ${index + 1}`} className="h-28 w-full rounded-2xl object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                <FormField control={form.control} name="message" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel className="font-semibold text-foreground">Message</FormLabel><FormControl><Textarea placeholder="What is not working, or what are you trying to buy?" className="min-h-20" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="customerConsent" render={({ field }) => (
                  <FormItem className="sm:col-span-2 rounded-[18px] bg-background p-4">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                      </FormControl>
                      <div>
                        <FormLabel className="font-semibold text-foreground">I agree that FixMyDoor can contact me about this request.</FormLabel>
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

      <div className="fixed bottom-4 left-4 right-4 z-40 flex gap-2 md:hidden">
        <a href="tel:+14383471823" className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-sm font-bold text-white">Call</a>
        <a href="#contact" className="flex-1 rounded-lg bg-secondary px-3 py-2 text-center text-sm font-bold text-white">Book</a>
      </div>

      <footer className="bg-[#2f241c] py-8 text-white">
        <div className="container max-w-[1180px]">
          <div className="mb-8 grid gap-8 md:grid-cols-4">
            <div>
              <img src="/img5150-transparent.png" alt="FixMyDoor logo" className="h-20 w-auto max-w-full object-contain" />
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/85">Door, lock, and furniture help from Canada for homeowners, businesses, and customers making international requests.</p>
            </div>
            <div>
              <h4 className="mb-4 font-bold" style={{ fontFamily: "Montserrat" }}>Quick Links</h4>
              <ul className="space-y-3 text-white/80">
                <li><a href="#services" className="transition hover:text-primary">Services</a></li>
                <li><a href="#shop" className="transition hover:text-primary">Shop</a></li>
                <li><a href="#before-after" className="transition hover:text-primary">Projects</a></li>
                <li><a href="#about" className="transition hover:text-primary">About</a></li>
                <li><a href="#contact" className="transition hover:text-primary">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold" style={{ fontFamily: "Montserrat" }}>Our Services</h4>
              <ul className="space-y-3 text-white/80">
                {footerServices.map((service) => (
                  <li key={service.slug}>
                    <button
                      type="button"
                      onClick={() => handleServicePick(service)}
                      className="transition hover:text-primary"
                    >
                      {service.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold" style={{ fontFamily: "Montserrat" }}>Get in Touch</h4>
              <ul className="space-y-3 text-white/80">
                <li><a href="tel:+14383471823" className="font-semibold transition hover:text-primary">+1 (438) 347-1823</a></li>
                <li><a href="https://wa.me/233242011305" className="text-sm transition hover:text-primary">WhatsApp: +233 24 201 1305</a></li>
                <li className="text-sm">Based in Canada. International requests welcome.</li>
              </ul>
              <div className="mt-4 flex gap-3">
                <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-white/80 transition hover:text-primary" aria-label="Instagram"><Instagram className="h-6 w-6" /></a>
                <a href="https://x.com/fixmydoor?s=11" className="text-white/80 transition hover:text-primary" aria-label="X (Twitter)"><Twitter className="h-6 w-6" /></a>
                <a href="https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr" className="text-white/80 transition hover:text-primary" aria-label="Facebook"><Facebook className="h-6 w-6" /></a>
              </div>
            </div>
          </div>
          <div className="border-t border-primary/30 pt-5">
            <p className="text-center font-medium text-white/80">&copy; 2026 FixMyDoor. Door and furniture repair support from Canada.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
