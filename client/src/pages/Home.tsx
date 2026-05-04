import axios from "axios";
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
  Home as HomeIcon,
  Instagram,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
  Twitter,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { BookingRequest } from "@shared/types";
import { customerReviews, featuredService, featuredServiceCollage, heroImage, projectGallery, quickHighlights, serviceShowcase, technicianImage } from "./homeContent";

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

export default function Home() {
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-primary/15 bg-[#f7efe4]/95 backdrop-blur">
        <div className="container flex items-center justify-between gap-4 py-3">
          <a href="/" className="flex items-center">
            <img src="/img5150-transparent.png" alt="FixMyDoor logo" className="h-14 w-auto object-contain sm:h-16 md:h-20" />
          </a>
          <div className="hidden gap-8 text-sm font-semibold md:flex">
            <a href="#services" className="transition hover:text-primary">Services</a>
            <a href="#before-after" className="transition hover:text-primary">Projects</a>
            <a href="#about" className="transition hover:text-primary">About</a>
            <a href="#testimonials" className="transition hover:text-primary">Reviews</a>
            <a href="#contact" className="transition hover:text-primary">Contact</a>
          </div>
          <a href="tel:+148383471823" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 md:px-5">
            Call Now
          </a>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(212,165,116,0.18),_transparent_38%),linear-gradient(to_bottom,_#f8f3ea,_#ffffff)]">
        <div className="container grid items-center gap-10 py-12 md:grid-cols-[0.95fr_1.05fr] md:py-20">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-secondary shadow-sm">
              <Globe2 className="h-4 w-4 text-primary" />
              Serving all of Canada
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight text-secondary md:text-6xl">
              Beautiful Doors. Safer Locks. Cleaner Repairs That Make Your Space Feel Right Again.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-foreground/75 md:text-xl">
              FixMyDoor brings sharp, dependable repair work from Montreal to clients across Canada,
              with secure lock service, better-fitting doors, furniture care, and a finish that looks intentionally done.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a href="#contact" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary/90">
                Book a Repair
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="tel:+148383471823" className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-secondary/90">
                <Phone className="h-4 w-4" />
                Call +1 (483) 834-7182
              </a>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 shadow-lg shadow-primary/5">
                <Zap className="mb-3 h-6 w-6 text-primary" />
                <p className="font-bold text-secondary">Fast Scheduling</p>
                <p className="mt-1 text-sm text-foreground/65">Quick replies, clear next steps, and practical timing.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-lg shadow-primary/5">
                <div className="mb-3 text-2xl font-black text-primary">C$</div>
                <p className="font-bold text-secondary">Practical Pricing</p>
                <p className="mt-1 text-sm text-foreground/65">Smart value for repair, replacement, and installation work.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-lg shadow-primary/5">
                <CheckCircle2 className="mb-3 h-6 w-6 text-primary" />
                <p className="font-bold text-secondary">Neat Finish</p>
                <p className="mt-1 text-sm text-foreground/65">Repairs that look cleaner, tighter, and fully resolved.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-5 top-8 h-32 w-32 rounded-full bg-primary/18 blur-3xl" />
            <div className="absolute -right-6 bottom-10 h-40 w-40 rounded-full bg-secondary/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white p-3 shadow-[0_30px_90px_rgba(66,40,18,0.18)]">
              <img src={heroImage} alt="Lock rekeying service at a front door" className="h-[360px] w-full rounded-[24px] object-cover object-center md:h-[560px]" />
              <div className="absolute bottom-8 left-8 right-8 rounded-[24px] bg-white/88 p-5 shadow-lg backdrop-blur md:max-w-sm">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Featured Service</p>
                <h2 className="mt-2 text-2xl font-bold text-secondary">Front Door Rekeying & Security Care</h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                  Make your entry feel safer and more polished with smoother lock action, cleaner hardware, and better daily confidence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="bg-white py-20">
        <div className="container">
          <div className="mb-14 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Our Expertise</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Complete Repair Solutions</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
              A cleaner mix of door, lock, and furniture work arranged so each image supports the right service and the layout stays polished.
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

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: HomeIcon, title: "Door Repairs", desc: "Swing correction, frame repair, sealing, and hardware fixes that make doors feel right again." },
              { icon: Lock, title: "Lock & Hinge Care", desc: "Rekeying, handle replacement, hinge adjustments, and tighter day-to-day security." },
              { icon: Wrench, title: "Furniture Repairs", desc: "Available by booking for practical restoration that improves both use and appearance." },
            ].map((service) => (
              <div key={service.title} className="rounded-[24px] bg-white p-6 shadow-lg shadow-primary/5">
                <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-secondary">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="before-after" className="bg-gradient-to-b from-background to-white py-20">
        <div className="container">
          <div className="mb-14 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Our Work</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Recent Repairs & Installations</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
              Each image now follows the right description, so the gallery reads like real project work instead of a mixed image board.
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

      <section id="about" className="bg-white py-20">
        <div className="container grid gap-10 md:grid-cols-[0.78fr_1.22fr] md:items-center">
          <div className="relative order-2 md:order-1">
            <div className="absolute -left-4 top-8 h-28 w-28 rounded-full bg-primary/18 blur-3xl" />
            <div className="relative mx-auto flex h-full min-h-[520px] max-w-[440px] items-center justify-center overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,_rgba(245,241,232,0.96),_rgba(255,255,255,0.82))] p-5 shadow-[0_24px_70px_rgba(66,40,18,0.16)] md:min-h-[560px]">
              <img src={technicianImage} alt="Richard Ampofo working on a door repair" className="h-full w-full max-h-[560px] object-contain object-center" />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Meet the Expert</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">Richard Ampofo</h2>
            <p className="mt-5 text-lg leading-relaxed text-foreground/75">Richard is the hands behind FixMyDoor: a skilled technician trusted for clean repairs, reliable lock work, and practical solutions that immediately improve how a door feels and functions.</p>
            <p className="mt-4 text-lg leading-relaxed text-foreground/75">Based in Montreal and supporting clients across Canada, he approaches each repair with a simple goal: leave the space safer, smoother, and noticeably better than he found it.</p>
            <p className="mt-4 text-lg leading-relaxed text-foreground/75">From damaged frames to misaligned doors and tired hardware, the work is handled with care, clear communication, and a finish that feels properly done.</p>
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
              <a href="tel:+148383471823" className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary/90">Schedule Now</a>
              <a href="mailto:info.fixmydoor@gmail.com" className="inline-flex items-center justify-center rounded-full bg-secondary px-6 py-3 font-bold text-white transition hover:bg-secondary/90">Send Email</a>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="bg-gradient-to-b from-background to-white py-20">
        <div className="container">
          <div className="mb-14 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.4em] text-primary">Client Reviews</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-secondary md:text-5xl">What Our Customers Say</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {customerReviews.map((review) => (
              <article key={review.name} className="rounded-[28px] border border-primary/10 bg-white p-8 shadow-[0_16px_44px_rgba(0,0,0,0.06)]">
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-base italic leading-relaxed text-foreground/80">"{review.quote}"</p>
                <p className="mt-6 font-bold text-secondary">{review.name}</p>
                <p className="text-sm text-foreground/60">{review.location}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-divider bg-white">
        <div className="container">
          <h2 className="text-center font-display text-4xl font-bold text-secondary md:text-5xl">How It Works</h2>
          <div className="mt-16 grid gap-8 md:grid-cols-3 md:gap-12">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-4xl font-bold text-white">1</div>
              <h3 className="text-2xl font-semibold text-secondary">Contact Us</h3>
              <p className="mt-3 leading-relaxed text-foreground/70">Call <a href="tel:+148383471823" className="font-semibold text-primary hover:underline">+1 (483) 834-7182</a> or send your repair details through the booking form.</p>
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

      <section id="contact" className="section-divider bg-background">
        <div className="container grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-bold text-secondary md:text-5xl">Get in Touch</h2>
            <div className="mt-8 space-y-6">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-6 w-6 text-primary" /></div>
                <div><p className="font-semibold text-secondary">Phone</p><a href="tel:+148383471823" className="text-lg text-primary hover:underline">+1 (483) 834-7182</a></div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><MessageCircle className="h-6 w-6 text-primary" /></div>
                <div><p className="font-semibold text-secondary">WhatsApp</p><a href="https://wa.me/233242011305" className="text-lg text-primary hover:underline">+233 24 201 1305</a></div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"><Mail className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-semibold text-secondary">Email</p>
                  <div className="mt-1 space-y-1">
                    <div><span className="text-sm text-foreground/60">Business:</span><a href="mailto:info.fixmydoor@gmail.com" className="ml-1 text-lg text-primary hover:underline">info.fixmydoor@gmail.com</a></div>
                    <div><span className="text-sm text-foreground/60">Personal:</span><a href="mailto:ampofor55@gmail.com" className="ml-1 text-lg text-primary hover:underline">ampofor55@gmail.com</a></div>
                  </div>
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
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary">Serving clients across Canada</p>
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
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel className="font-semibold text-foreground">Address *</FormLabel><FormControl><Input placeholder="Your full address anywhere in Canada" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="repairType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Service Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="door-repair">Door Repair</SelectItem>
                        <SelectItem value="door-alignment">Door Alignment</SelectItem>
                        <SelectItem value="lock-rekeying">Lock Rekeying</SelectItem>
                        <SelectItem value="entry-door-installation">Entry Door Installation</SelectItem>
                        <SelectItem value="furniture-repair">Furniture Repair</SelectItem>
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
        <a href="tel:+148383471823" className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-sm font-bold text-white">Call</a>
        <a href="#contact" className="flex-1 rounded-lg bg-secondary px-3 py-2 text-center text-sm font-bold text-white">Book</a>
      </div>

      <footer className="bg-[#2f241c] py-16 text-white">
        <div className="container">
          <div className="mb-12 grid gap-12 md:grid-cols-4">
            <div>
              <img src="/img5150-transparent.png" alt="FixMyDoor logo" className="h-24 w-auto max-w-full object-contain" />
              <p className="mt-4 max-w-xs leading-relaxed text-white/85">Professional door and furniture repair services based in Montreal and serving clients across Canada.</p>
            </div>
            <div>
              <h4 className="mb-4 font-bold" style={{ fontFamily: "Montserrat" }}>Quick Links</h4>
              <ul className="space-y-3 text-white/80">
                <li><a href="#services" className="transition hover:text-primary">Services</a></li>
                <li><a href="#before-after" className="transition hover:text-primary">Projects</a></li>
                <li><a href="#about" className="transition hover:text-primary">About</a></li>
                <li><a href="#contact" className="transition hover:text-primary">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold" style={{ fontFamily: "Montserrat" }}>Our Services</h4>
              <ul className="space-y-3 text-white/80">
                <li className="transition hover:text-primary">Door Repair</li>
                <li className="transition hover:text-primary">Lock Rekeying</li>
                <li className="transition hover:text-primary">Entry Door Installation</li>
                <li className="transition hover:text-primary">Furniture Repairs</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold" style={{ fontFamily: "Montserrat" }}>Get in Touch</h4>
              <ul className="space-y-3 text-white/80">
                <li><a href="tel:+148383471823" className="font-semibold transition hover:text-primary">+1 (483) 834-7182</a></li>
                <li><a href="https://wa.me/233242011305" className="text-sm transition hover:text-primary">WhatsApp: +233 24 201 1305</a></li>
                <li className="text-sm">Montreal HQ, serving all of Canada</li>
              </ul>
              <div className="mt-4 flex gap-3">
                <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-white/80 transition hover:text-primary" aria-label="Instagram"><Instagram className="h-6 w-6" /></a>
                <a href="https://x.com/fixmydoor?s=11" className="text-white/80 transition hover:text-primary" aria-label="X (Twitter)"><Twitter className="h-6 w-6" /></a>
                <a href="https://www.facebook.com/share/1Mc9zS8fXa/?mibextid=wwXIfr" className="text-white/80 transition hover:text-primary" aria-label="Facebook"><Facebook className="h-6 w-6" /></a>
              </div>
            </div>
          </div>
          <div className="border-t border-primary/30 pt-8">
            <p className="text-center font-medium text-white/80">&copy; 2026 FixMyDoor. Door & Furniture Repair Services across Canada.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
