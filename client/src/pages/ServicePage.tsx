import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Globe2, Phone, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

const servicePages = {
  "/door-repair": {
    eyebrow: "Door Repair",
    title: "Door repair for homes, rentals, offices, and commercial spaces",
    description: "FixMyDoor helps with sticking doors, damaged frames, loose handles, poor sealing, hinges, and everyday door problems that affect safety and comfort.",
    bullets: ["Swing correction and alignment", "Frame, latch, hinge, and handle support", "Repair guidance for Canada and international requests"],
    cta: "Book Door Repair",
    bookingValue: "door-repair",
  },
  "/lock-rekeying": {
    eyebrow: "Lock Rekeying",
    title: "Lock rekeying, handle replacement, and tighter entry security",
    description: "If keys are missing, a lock feels loose, or hardware needs replacing, FixMyDoor helps customers restore safer access without guessing the wrong solution.",
    bullets: ["Front door rekeying and lock advice", "Cylinder, handle, and latch support", "Security-focused recommendations"],
    cta: "Request Lock Help",
    bookingValue: "lock-rekeying",
  },
  "/furniture-repair": {
    eyebrow: "Furniture Repair",
    title: "Furniture repair support for practical, everyday fixes",
    description: "Get help with sofa frames, loose furniture joints, cabinet hardware, drawer slides, hinges, and furniture parts that need repair or replacement.",
    bullets: ["Sofa, cabinet, chair, and drawer support", "Hardware replacement guidance", "Photo-based review before follow-up"],
    cta: "Book Furniture Help",
    bookingValue: "furniture-repair",
  },
  "/door-hardware": {
    eyebrow: "Doors & Hardware",
    title: "Buy or source doors, handles, locks, hinges, and furniture parts",
    description: "Share measurements, preferred finish, quantity, and photos. FixMyDoor helps customers choose the right products before spending money on the wrong part.",
    bullets: ["Paladin, SED, heavy-duty, entry, and interior doors", "Handles, cylinders, hinges, drawer slides, and cabinet parts", "Product sourcing support for international requests"],
    cta: "Ask for Product Quote",
    bookingValue: "door-hardware-purchase",
  },
  "/international-requests": {
    eyebrow: "International Requests",
    title: "Canada-based service with international product and repair support",
    description: "FixMyDoor is based in Canada and can help customers abroad with measurements, product sourcing, repair guidance, and clear next steps.",
    bullets: ["Country, time zone, and currency-aware requests", "WhatsApp, email, and phone follow-up", "Product sourcing and quote preparation"],
    cta: "Send International Request",
    bookingValue: "international-request",
  },
} as const;

export default function ServicePage() {
  const [location] = useLocation();
  const page = servicePages[location as keyof typeof servicePages] || servicePages["/door-repair"];

  useEffect(() => {
    document.title = `${page.eyebrow} | FixMyDoor Services`;
    const description = document.querySelector('meta[name="description"]') || document.createElement("meta");
    description.setAttribute("name", "description");
    description.setAttribute("content", page.description);
    document.head.appendChild(description);
  }, [page]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_#f8f1e7,_#ffffff_55%,_#f4e2ca)] text-foreground">
      <nav className="border-b border-primary/10 bg-[#f7efe4]/95 backdrop-blur">
        <div className="container flex max-w-[1180px] items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/img5150-transparent.png" alt="FixMyDoor" className="h-14 w-auto object-contain" />
            <span className="font-display text-lg font-bold text-secondary">FixMyDoor</span>
          </Link>
          <a href="tel:+14383471823" className="hidden rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white sm:inline-flex">
            Call +1 (438) 347-1823
          </a>
        </div>
      </nav>

      <section className="container grid max-w-[1180px] gap-8 py-10 md:grid-cols-[1fr_0.8fr] md:items-center md:py-16">
        <div>
          <p className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-primary">{page.eyebrow}</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-secondary md:text-6xl">{page.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground/72 md:text-lg">{page.description}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="/#contact"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(180,101,50,0.22)] transition hover:-translate-y-0.5"
            >
              {page.cta}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/#shop" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-secondary shadow-sm transition hover:-translate-y-0.5">
              <ShoppingBag className="h-4 w-4" />
              View Products
            </a>
          </div>
        </div>

        <aside className="rounded-[30px] border border-primary/12 bg-white p-6 shadow-[0_22px_65px_rgba(66,40,18,0.12)]">
          <Globe2 className="h-9 w-9 text-primary" />
          <h2 className="mt-4 text-2xl font-bold text-secondary">What customers can send</h2>
          <div className="mt-5 grid gap-3">
            {page.bullets.map((bullet) => (
              <div key={bullet} className="flex gap-3 rounded-2xl bg-background p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm font-semibold leading-relaxed text-foreground/76">{bullet}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-[#2f241c] p-4 text-white">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <p className="mt-2 text-sm leading-relaxed text-white/78">
              Add photos, measurements, city/country, time zone, and preferred contact method for faster follow-up.
            </p>
          </div>
        </aside>
      </section>

      <section className="container max-w-[1180px] pb-10">
        <div className="rounded-[28px] bg-white p-5 shadow-sm md:flex md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-secondary">Need help now?</h2>
            <p className="mt-1 text-sm text-foreground/68">Call, email, or send a request with photos and measurements.</p>
          </div>
          <Button asChild className="mt-4 bg-secondary md:mt-0">
            <a href="tel:+14383471823">
              <Phone className="mr-2 h-4 w-4" />
              Call FixMyDoor
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}
