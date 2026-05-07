import axios from "axios";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  CheckCircle2,
  Facebook,
  Globe2,
  Hammer,
  Home as HomeIcon,
  Instagram,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Star,
  Twitter,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { BookingRequest, Review, ReviewRequest } from "@shared/types";
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
});

type BookingFormData = z.infer<typeof bookingSchema>;

const reviewSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  location: z.string().max(100, "Location is too long").optional(),
  rating: z.number().int().min(1).max(5),
  quote: z.string().min(8, "Please write a little more about your experience").max(500, "Review is too long"),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

const serviceIcons: Record<string, typeof HomeIcon> = {
  "door-repair": HomeIcon,
  "door-alignment": CheckCircle2,
  "lock-rekeying": Lock,
  "entry-door-installation": ShieldCheck,
  "furniture-repair": Wrench,
  "door-purchase": ShoppingBag,
  "door-hardware-purchase": PackageCheck,
  "furniture-hardware-purchase": Hammer,
};

export default function Home() {
  const [services, setServices] = useState<ServiceCatalogItem[]>(defaultServiceCatalog);
  const [reviews, setReviews] = useState<Review[]>([]);
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
    };

    try {
      await axios.post("/api/bookings", payload);
      toast.success("Booking request submitted! We'll contact you soon.");
      form.reset();
    } catch (error) {
      toast.error("Unable to submit booking at this time. Please try again later.");
      console.error("Booking submission error:", error);
    }
  };

  const homeServices = services.filter((service) => service.showOnHome);
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

  const onReviewSubmit = async (data: ReviewFormData) => {
    const payload: ReviewRequest = {
      name: data.name.trim(),
      location: data.location?.trim() || undefined,
      rating: data.rating,
      quote: data.quote.trim(),
    };

    try {
      const response = await axios.post<{ review: Review }>("/api/reviews", payload);
      if (response.data.review) {
        setReviews((currentReviews) => [response.data.review, ...currentReviews].slice(0, 9));
      }
      reviewForm.reset({ name: "", location: "", rating: 5, quote: "" });
      toast.success("Thank you. Your review has been added.");
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

    toast.success(`${service.title} selected. Fill in your details and we'll take it from there.`);
  };

  const handleCatalogPick = (bookingValue: string, label: string) => {
    form.setValue("repairType", bookingValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    const currentMessage = form.getValues("message")?.trim();
    if (!currentMessage) {
      form.setValue("message", `I am interested in ${label}. Please contact me with availability, sizing, and pricing.`, {
        shouldDirty: true,
      });
    }

    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById("repair-type-trigger")?.focus();
    }, 350);

    toast.success(`${label} selected. Send your details and we will prepare the next step.`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-primary/15 bg-[#f7efe4]/95 backdrop-blur">
        <div className="border-b border-primary/10 bg-[#3a281f] text-white">
          <div className="container flex max-w-[1180px] flex-wrap items-center justify-center gap-x-5 gap-y-1 py-2 text-center text-[0.72rem] font-semibold sm:justify-between sm:text-xs">
            <span>Canada-based door, lock, and furniture repairs for local and international clients</span>
            <span className="inline-flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-primary" />
              <a href="tel:+14383471823" className="hover:text-primary">+1 (438) 347-1823</a>
            </span>
          </div>
        </div>
        <div className="container flex max-w-[1180px] items-center justify-between gap-3 py-2 sm:gap-4 md:py-2.5">
          <div className="flex min-w-0 items-center gap-2.5 md:gap-4">
            <a href="/" className="flex shrink-0 items-center">
              <img src="/img5150-transparent.png" alt="FixMyDoor logo" className="h-16 w-auto object-contain drop-shadow-[0_12px_22px_rgba(66,40,18,0.16)] sm:h-20 md:h-24" />
            </a>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold leading-tight text-secondary sm:text-base md:text-xl">
                FixMyDoor | Door & Furniture Repairs
              </p>
              <p className="mt-0.5 hidden text-[0.66rem] uppercase tracking-[0.2em] text-secondary/65 sm:block md:text-[0.7rem]">
                Canada-based service with international support
              </p>
            </div>
          </div>
          <div className="hidden gap-6 text-sm font-semibold lg:flex">
            <a href="#services" className="transition hover:text-primary">Services</a>
            <a href="#shop" className="transition hover:text-primary">Shop</a>
            <a href="#before-after" className="transition hover:text-primary">Projects</a>
            <a href="#about" className="transition hover:text-primary">About</a>
            <a href="#testimonials" className="transition hover:text-primary">Reviews</a>
            <a href="#contact" className="transition hover:text-primary">Contact</a>
          </div>
          <a href="tel:+14383471823" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 sm:px-4 sm:text-sm md:px-5">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Call Now</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(212,165,116,0.2),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(66,40,18,0.12),_transparent_34%),linear-gradient(to_bottom,_#f8f3ea,_#ffffff)]">
        <div className="container grid max-w-[1180px] items-center gap-7 py-8 sm:py-10 md:grid-cols-[0.88fr_1.02fr] md:py-12 lg:gap-10">
          <div className="max-w-lg">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-secondary shadow-sm">
              <Globe2 className="h-4 w-4 text-primary" />
              Canada-based. Available internationally.
            </div>
            <h1 className="font-display text-[2rem] font-bold leading-tight text-secondary sm:text-4xl md:text-5xl xl:text-[3.2rem]">
              Smooth doors, secure locks, and repairs that make home feel right again.
            </h1>
            <p className="mt-3 max-w-[34rem] text-[0.98rem] leading-relaxed text-foreground/75 md:text-lg">
              If a front door sticks, a lock feels loose, or a piece of furniture is wearing down,
              FixMyDoor handles it neatly and leaves the space looking better than it did before.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href="#contact" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary/90">
                Book a Repair
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#shop" className="inline-flex items-center justify-center gap-2 rounded-full border border-secondary/20 bg-white px-6 py-3 font-bold text-secondary shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:text-primary">
                <ShoppingBag className="h-4 w-4" />
                Buy Doors & Hardware
              </a>
              <a href="tel:+14383471823" className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-secondary/90">
                <Phone className="h-4 w-4" />
                Call +1 (438) 347-1823
              </a>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 shadow-lg shadow-primary/5">
                <Zap className="mb-3 h-6 w-6 text-primary" />
                <p className="font-bold text-secondary">Fast Scheduling</p>
                <p className="mt-1 text-sm text-foreground/65">Quick replies and simple next steps.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-lg shadow-primary/5">
                <div className="mb-3 text-2xl font-black text-primary">C$</div>
                <p className="font-bold text-secondary">Practical Pricing</p>
                <p className="mt-1 text-sm text-foreground/65">Clear value for repairs, replacements, and installs.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-lg shadow-primary/5">
                <CheckCircle2 className="mb-3 h-6 w-6 text-primary" />
                <p className="font-bold text-secondary">Neat Finish</p>
                <p className="mt-1 text-sm text-foreground/65">Work that looks tidy and feels properly finished.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-5 top-8 h-32 w-32 rounded-full bg-primary/18 blur-3xl" />
            <div className="absolute -right-6 bottom-10 h-40 w-40 rounded-full bg-secondary/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white p-3 shadow-[0_30px_90px_rgba(66,40,18,0.18)]">
              <img src={heroImage} alt="Lock rekeying service at a front door" className="h-[260px] w-full rounded-[24px] object-cover object-center sm:h-[340px] md:h-[470px]" />
              <div className="absolute bottom-5 left-5 right-5 rounded-[24px] bg-white/90 p-4 shadow-lg backdrop-blur md:bottom-7 md:left-7 md:right-7 md:max-w-sm">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Featured Service</p>
                <h2 className="mt-2 text-2xl font-bold text-secondary">Front Door Rekeying</h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                  If a key has gone missing or the lock no longer feels right, we get the entry secure again and keep the door turning smoothly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#2f241c] py-12 text-white md:py-16">
        <div className="container max-w-[1180px]">
          <div className="mb-8 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-primary">Choose Your Path</p>
            <h2 className="mt-3 font-display text-3xl font-bold md:text-5xl">Repair it, replace it, or source the right part.</h2>
            <p className="mx-auto mt-3 max-w-3xl text-white/75">
              FixMyDoor is structured around two practical needs: getting things fixed and helping customers buy the right door, furniture part, or hardware for the job.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {customerPaths.map((path, index) => (
              <a
                key={path.title}
                href={path.href}
                className={`group overflow-hidden rounded-[30px] border border-white/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 ${
                  index === 0 ? "bg-white text-secondary" : "bg-primary text-white"
                }`}
              >
                <span className={`inline-flex rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] ${
                  index === 0 ? "bg-primary/10 text-primary" : "bg-white/18 text-white"
                }`}>
                  {path.label}
                </span>
                <h3 className="mt-5 text-2xl font-bold md:text-3xl">{path.title}</h3>
                <p className={`mt-3 leading-relaxed ${index === 0 ? "text-foreground/70" : "text-white/85"}`}>{path.desc}</p>
                <span className="mt-6 inline-flex items-center gap-2 font-bold">
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
            <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Our Expertise</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Complete Repair Solutions</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
              The layout is tighter, the images make more sense, and the service list is easier to understand at a glance.
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
                    {["Front entry rekeying", "Wood door care", "Sofa frame repair", "Furniture setup"].map((item) => (
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
              {serviceShowcase.map((service) => (
                <article key={service.title} className="overflow-hidden rounded-[28px] border border-primary/12 bg-[linear-gradient(180deg,_#fffdfb,_#f4ede3)] shadow-[0_14px_40px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1">
                  <img
                    src={service.src}
                    alt={service.title}
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

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {homeServices.map((service) => {
              const Icon = serviceIcons[service.bookingValue] ?? Wrench;

              return (
                <button
                  key={service.slug}
                  type="button"
                  onClick={() => handleServicePick(service)}
                  className="group rounded-[24px] bg-white p-6 text-left shadow-lg shadow-primary/5 transition duration-300 hover:-translate-y-1"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-secondary">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/70">{service.summary}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    Choose this service
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section id="shop" className="bg-[linear-gradient(180deg,_#fffdf8,_#f3eadc)] py-16 md:py-[4.5rem]">
        <div className="container max-w-[1180px]">
          <div className="mb-10 flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Buy & Source</p>
              <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Doors, furniture parts, and repair hardware</h2>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
                Browse realistic product categories, then request availability, sizing, and pricing through the booking form. We keep the purchase process practical so you do not buy the wrong part.
              </p>
            </div>
            <a href="#contact" className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary/90">
              Request a Quote
            </a>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {productCategories.map((category) => (
              <article key={category.title} className="overflow-hidden rounded-[32px] border border-primary/12 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.07)]">
                <div className="relative h-64 overflow-hidden bg-[#f8f4ec]">
                  <img src={category.image} alt={category.title} className="h-full w-full object-cover" />
                  <img src={category.accent} alt="" className="absolute bottom-4 right-4 h-24 w-24 rounded-2xl border-4 border-white bg-white object-cover shadow-xl" />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-secondary">{category.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/70">{category.desc}</p>
                  <p className="mt-4 rounded-2xl bg-background p-4 text-sm font-semibold text-secondary">{category.items}</p>
                  <button
                    type="button"
                    onClick={() => handleCatalogPick(category.bookingValue, category.title)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 py-3 font-bold text-white transition hover:bg-primary"
                  >
                    Ask About This
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
                <h3 className="mt-3 text-3xl font-bold">Entry, interior, security, and custom-fit door options</h3>
              </div>
              <button
                type="button"
                onClick={() => handleCatalogPick("door-purchase", "door buying options")}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90"
              >
                Request Door Options
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {doorProducts.map((product) => (
                <button
                  key={product.title}
                  type="button"
                  onClick={() => handleCatalogPick("door-purchase", product.title)}
                  className="group overflow-hidden rounded-[22px] bg-white/8 text-left transition hover:-translate-y-1 hover:bg-white/12"
                >
                  <img src={product.image} alt={product.title} className="h-56 w-full bg-white object-cover transition duration-500 group-hover:scale-[1.03]" />
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
                <h3 className="mt-3 text-3xl font-bold text-secondary">Handles, locks, hinges, cylinders, slides, and cabinet parts</h3>
              </div>
              <button
                type="button"
                onClick={() => handleCatalogPick("door-hardware-purchase", "door and furniture hardware")}
                className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary"
              >
                Request Hardware
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {hardwareProducts.map((product) => (
                <button
                  key={product.title}
                  type="button"
                  onClick={() => handleCatalogPick(product.tag.includes("Drawer") || product.tag.includes("Cabinet") ? "furniture-hardware-purchase" : "door-hardware-purchase", product.title)}
                  className="group overflow-hidden rounded-[22px] border border-primary/10 bg-[#fffaf2] text-left transition hover:-translate-y-1"
                >
                  <img src={product.image} alt={product.title} className="h-48 w-full bg-white object-contain p-3 transition duration-500 group-hover:scale-[1.03]" />
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
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Recent Repairs & Installations</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
              A few examples of the kind of work customers call about most often, laid out in a cleaner and more believable way.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projectGallery.map((project) => (
              <article key={project.title} className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1">
                <img src={project.src} alt={project.title} className="h-[300px] w-full object-cover" />
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

      <section id="about" className="bg-white py-16 md:py-[4.5rem]">
        <div className="container grid max-w-[1180px] gap-8 md:grid-cols-[0.78fr_1.22fr] md:items-center">
          <div className="relative order-2 md:order-1">
            <div className="absolute -left-4 top-8 h-28 w-28 rounded-full bg-primary/18 blur-3xl" />
            <div className="relative mx-auto flex h-full min-h-[520px] max-w-[440px] items-center justify-center overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,_rgba(245,241,232,0.96),_rgba(255,255,255,0.82))] shadow-[0_24px_70px_rgba(66,40,18,0.16)] md:min-h-[560px]">
              <img src={technicianImage} alt="Richard Ampofo working on a door repair" className="h-full w-full object-cover object-top" />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Meet the Expert</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Richard Ampofo</h2>
            <p className="mt-5 text-lg leading-relaxed text-foreground/75">Richard is the person behind FixMyDoor, handling the everyday problems people actually notice: doors that scrape, locks that feel loose, frames that need attention, and furniture that still deserves to be kept.</p>
            <p className="mt-4 text-lg leading-relaxed text-foreground/75">Based in Canada and supporting local and international clients, he keeps the process simple: understand the issue, explain the fix clearly, and leave the job looking clean.</p>
            <p className="mt-4 text-lg leading-relaxed text-foreground/75">The goal is not just to patch the problem, but to make the space feel secure, tidy, and easy to live with again.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Globe2, title: quickHighlights[0].title, text: quickHighlights[0].text },
                { icon: ShieldCheck, title: quickHighlights[1].title, text: quickHighlights[1].text },
                { icon: Zap, title: quickHighlights[2].title, text: quickHighlights[2].text },
              ].map((highlight) => (
                <div key={highlight.title} className="rounded-[24px] bg-background p-5 shadow-sm">
                  <highlight.icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 font-bold text-secondary">{highlight.title}</h3>
                  <p className="mt-2 text-sm text-foreground/68">{highlight.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a href="tel:+14383471823" className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary/90">Schedule Now</a>
              <a href="mailto:info.fixmydoor@gmail.com" className="inline-flex items-center justify-center rounded-full bg-secondary px-6 py-3 font-bold text-white transition hover:bg-secondary/90">Send Email</a>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="bg-gradient-to-b from-background to-white py-16 md:py-[4.5rem]">
        <div className="container max-w-[1180px]">
          <div className="mb-10 flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Client Reviews</p>
              <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Real words from customers</h2>
              <p className="mt-3 max-w-2xl text-foreground/70">
                Customers can now leave their own review directly on the website after a repair.
              </p>
            </div>
            <a href="#write-review" className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-3 text-sm font-bold text-white transition hover:bg-secondary/90">
              Write a Review
            </a>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-start">
            <div className="grid gap-5 sm:grid-cols-2">
              {displayReviews.map((review) => (
                <article key={review.id} className="rounded-[28px] border border-primary/10 bg-white p-6 shadow-[0_16px_44px_rgba(0,0,0,0.06)]">
                  <div className="mb-4 flex gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-5 w-5 ${index < review.rating ? "fill-primary text-primary" : "text-primary/20"}`}
                      />
                    ))}
                  </div>
                  <p className="text-base italic leading-relaxed text-foreground/80">"{review.quote}"</p>
                  <p className="mt-5 font-bold text-secondary">{review.name}</p>
                  <p className="text-sm text-foreground/60">{review.location || "Canada"}</p>
                </article>
              ))}
            </div>

            <div id="write-review" className="rounded-[28px] border border-primary/12 bg-white p-6 shadow-[0_18px_50px_rgba(0,0,0,0.07)] sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.32em] text-primary">Share Feedback</p>
              <h3 className="mt-3 text-2xl font-bold text-secondary">Write your review</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/68">
                Tell future customers what the repair experience was like.
              </p>
              <Form {...reviewForm}>
                <form onSubmit={reviewForm.handleSubmit(onReviewSubmit)} className="mt-6 space-y-4">
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
                      <FormControl><Textarea placeholder="How did the repair go?" className="min-h-28" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="btn-primary w-full" disabled={reviewForm.formState.isSubmitting}>
                    {reviewForm.formState.isSubmitting ? "Submitting..." : "Submit Review"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-divider bg-white py-16 md:py-20">
        <div className="container max-w-[1180px]">
          <h2 className="text-center font-display text-4xl font-bold text-secondary md:text-5xl">How It Works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-4xl font-bold text-white">1</div>
              <h3 className="text-2xl font-semibold text-secondary">Contact Us</h3>
              <p className="mt-3 leading-relaxed text-foreground/70">Call <a href="tel:+14383471823" className="font-semibold text-primary hover:underline">+1 (438) 347-1823</a> or send your repair details through the booking form.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-4xl font-bold text-white">2</div>
              <h3 className="text-2xl font-semibold text-secondary">Confirm the Plan</h3>
              <p className="mt-3 leading-relaxed text-foreground/70">We review the issue, confirm the scope, and guide you to the best next step for your location.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-4xl font-bold text-white">3</div>
              <h3 className="text-2xl font-semibold text-secondary">We Fix It</h3>
              <p className="mt-3 leading-relaxed text-foreground/70">Richard delivers secure, careful workmanship focused on function, finish, and long-term ease of use.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="section-divider bg-background py-16 md:py-20">
        <div className="container grid max-w-[1180px] gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-bold text-secondary md:text-5xl">Get in Touch</h2>
            <div className="mt-8 space-y-6">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-6 w-6 text-primary" /></div>
                <div><p className="font-semibold text-secondary">Phone</p><a href="tel:+14383471823" className="text-lg text-primary hover:underline">+1 (438) 347-1823</a></div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><MessageCircle className="h-6 w-6 text-primary" /></div>
                <div><p className="font-semibold text-secondary">WhatsApp</p><a href="https://wa.me/233242011305" className="text-lg text-primary hover:underline">+233 24 201 1305</a></div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Mail className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-semibold text-secondary">Email</p>
                  <a href="mailto:info.fixmydoor@gmail.com" className="mt-1 inline-block text-lg text-primary hover:underline">info.fixmydoor@gmail.com</a>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Instagram className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-semibold text-secondary">Follow Us</p>
                  <div className="mt-2 flex gap-4">
                    <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-primary transition hover:text-primary/80" aria-label="Instagram"><Instagram className="h-5 w-5" /></a>
                    <a href="https://x.com/fixmydoor?s=11" className="text-primary transition hover:text-primary/80" aria-label="X (Twitter)"><Twitter className="h-5 w-5" /></a>
                    <a href="https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr" className="text-primary transition hover:text-primary/80" aria-label="Facebook"><Facebook className="h-5 w-5" /></a>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><MapPin className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-semibold text-secondary">Head Office</p>
                  <p className="mt-1 text-foreground/70">10158 Rue Berri<br />Montreal, Quebec H3L 2G6<br />Canada</p>
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary">Canada-based, working across international requests</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-primary/12 bg-white p-8 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
            <h3 className="text-2xl font-semibold text-secondary">Book a Repair</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/68">Tell us what needs attention and we will follow up with a clear, practical next step.</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Name *</FormLabel><FormControl><Input placeholder="Your full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Phone *</FormLabel><FormControl><Input type="tel" placeholder="+1 (438) 000-0000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Email *</FormLabel><FormControl><Input type="email" placeholder="your.email@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Address *</FormLabel><FormControl><Input placeholder="Your full address or project location" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="repairType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Service or Product Request *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger id="repair-type-trigger"><SelectValue placeholder="Select a service" /></SelectTrigger></FormControl>
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
                <FormField control={form.control} name="message" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Message</FormLabel><FormControl><Textarea placeholder="Describe your repair needs in detail..." className="min-h-24" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <Button type="submit" className="btn-primary w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Submitting..." : "Submit Booking Request"}</Button>
              </form>
            </Form>
          </div>
        </div>
      </section>

      <div className="fixed bottom-4 left-4 right-4 z-40 flex gap-2 md:hidden">
        <a href="tel:+14383471823" className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-sm font-bold text-white">Call</a>
        <a href="#contact" className="flex-1 rounded-lg bg-secondary px-3 py-2 text-center text-sm font-bold text-white">Book</a>
      </div>

      <footer className="bg-[#2f241c] py-16 text-white">
        <div className="container max-w-[1180px]">
          <div className="mb-12 grid gap-12 md:grid-cols-4">
            <div>
              <img src="/img5150-transparent.png" alt="FixMyDoor logo" className="h-24 w-auto max-w-full object-contain" />
              <p className="mt-4 max-w-xs leading-relaxed text-white/85">Door and furniture repairs handled with care from Canada for homes, businesses, and international requests.</p>
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
                <li className="text-sm">Canada-based, supporting international clients</li>
              </ul>
              <div className="mt-4 flex gap-3">
                <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-white/80 transition hover:text-primary" aria-label="Instagram"><Instagram className="h-6 w-6" /></a>
                <a href="https://x.com/fixmydoor?s=11" className="text-white/80 transition hover:text-primary" aria-label="X (Twitter)"><Twitter className="h-6 w-6" /></a>
                <a href="https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr" className="text-white/80 transition hover:text-primary" aria-label="Facebook"><Facebook className="h-6 w-6" /></a>
              </div>
            </div>
          </div>
          <div className="border-t border-primary/30 pt-8">
            <p className="text-center font-medium text-white/80">&copy; 2026 FixMyDoor. Canada-based door & furniture repair services with international support.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
