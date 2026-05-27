import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Globe2, Phone, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageTranslator from "@/components/LanguageTranslator";
import { resolveSeoPage, serviceSeoPages } from "@shared/seo";

const SITE_URL = "https://www.fixmydoor.ca";

function setMeta(selector: string, attributeName: "name" | "property", attributeValue: string, content: string) {
  const meta = document.querySelector(selector) || document.createElement("meta");
  meta.setAttribute(attributeName, attributeValue);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

const defaultServiceDetail = {
  common: [
    "Customers can send photos, measurements, location details, and a brief note about the issue.",
    "We review the request and explain whether repair, replacement, installation, or sourcing is the best next step.",
    "Each request is saved with a tracking link so follow-up remains organized.",
  ],
  process: [
    "Send the issue, photo, and location.",
    "We confirm the details, urgency, and most practical next step.",
    "We repair, install, or help source the correct item.",
  ],
  trust:
    "FixMyDoor Services keeps the process clear for homeowners, tenants, landlords, offices, shops, and property managers. Canada-based requests and international product questions are welcome.",
};

const serviceDetails: Record<string, typeof defaultServiceDetail> = {
  "/door-repair": {
    common: [
      "Doors that stick, drag, rub the floor, scrape the frame, or no longer latch correctly.",
      "Loose handles, damaged frames, hinge problems, weather gaps, and everyday wear from heavy use.",
      "Repair guidance when you are not sure whether the door can be fixed or needs replacement.",
    ],
    process: [
      "Share photos of the door, frame, hinges, handle, and latch area.",
      "We review alignment, hardware, damage, and safety concerns before suggesting the next step.",
      "The goal is a door that opens, closes, locks, and feels stable again.",
    ],
    trust:
      "Door repair should be practical, clear, and focused on daily use. FixMyDoor Services explains the options before work starts so you understand what is being repaired and why.",
  },
  "/lock-rekeying": {
    common: [
      "Missing keys, tenant changes, worn locks, loose handles, and entry hardware that no longer feels secure.",
      "Cylinder, latch, strike plate, handle, hinge, and lock-body issues.",
      "Security upgrades when a customer wants better control of who can access the property.",
    ],
    process: [
      "Send the lock type, door photo, and whether keys are missing or access needs to change.",
      "We review whether rekeying, adjustment, replacement, or hardware sourcing is the better route.",
      "We help restore safer access while keeping the process straightforward.",
    ],
    trust:
      "Lock and hinge work is about safety and confidence. FixMyDoor Services handles these requests carefully and avoids asking customers to send private access codes through the website form.",
  },
  "/furniture-repair": {
    common: [
      "Loose sofa frames, broken furniture supports, damaged chairs, cabinet doors, drawers, desks, and shelves.",
      "Furniture pieces that wobble, sag, scrape, fail to close, or need replacement hardware.",
      "Repair decisions when the item still has value but needs stronger support or better parts.",
    ],
    process: [
      "Send photos of the damaged area, the full furniture piece, and any missing or broken hardware.",
      "We review whether repair, reinforcement, or replacement parts make sense.",
      "The goal is a cleaner, stronger, more usable furniture piece.",
    ],
    trust:
      "Furniture repair should preserve what is still useful and replace only what needs attention. FixMyDoor Services gives practical guidance before customers spend money on new items.",
  },
  "/furniture-installation": {
    common: [
      "Furniture setup, fitting, alignment, and practical installation support for homes, rentals, offices, and shops.",
      "Cabinet doors, drawer slides, shelves, desks, workstations, handles, hinges, and other furniture hardware.",
      "Installation help when the furniture or part needs a cleaner fit, stronger support, or better daily function.",
    ],
    process: [
      "Send photos of the furniture, installation area, hardware, quantity, and measurements if available.",
      "We review what needs to be assembled, fitted, aligned, reinforced, or replaced.",
      "The goal is furniture that is installed neatly, opens and closes properly, and feels stable in everyday use.",
    ],
    trust:
      "Furniture installation is easier when the parts, space, and hardware are clear before work starts. FixMyDoor Services helps organize those details so the job is more predictable.",
  },
  "/entry-door-installation": {
    common: [
      "Front door replacement, entry door fitting, damaged exterior doors, and upgrades for a cleaner entrance.",
      "Questions about measurements, swing direction, door type, delivery, installation, and hardware matching.",
      "Entry, interior, steel, wood-look, glass-panel, heavy-duty, and custom-fit door requests.",
    ],
    process: [
      "Send the opening size, door photos, preferred style, swing direction, and installation needs.",
      "We confirm what information is missing before a door is ordered or installed.",
      "The goal is a better-fitting door with hardware that works properly.",
    ],
    trust:
      "A door installation can become expensive when measurements or hardware are wrong. FixMyDoor Services helps clarify those details before the customer commits.",
  },
  "/door-purchase": {
    common: [
      "Customers looking for entry doors, interior doors, heavy-duty doors, Paladin doors, SED doors, or custom-size options.",
      "Questions about finish, material, swing direction, frame condition, delivery, and installation.",
      "Buying guidance before spending money on a door that may not fit the opening.",
    ],
    process: [
      "Send the door opening size, current door photos, quantity, preferred style, and budget.",
      "We help narrow down suitable options and clarify hardware or installation needs.",
      "The goal is to buy the right door for the space, not just the first available door.",
    ],
    trust:
      "Door sourcing works best when measurements and use case are clear. FixMyDoor Services helps customers compare practical options before purchase.",
  },
  "/buy-door-hardware": {
    common: [
      "Handles, locks, cylinders, hinges, backplates, knobs, mortise kits, and full door hardware sets.",
      "Hardware matching when finish, size, backset, or lock type is unclear.",
      "Replacement planning for entry, bathroom, interior, and security hardware.",
    ],
    process: [
      "Send photos of the existing hardware, door edge, latch, and any measurements you have.",
      "We review the finish, lock type, size, and compatibility before suggesting options.",
      "The goal is hardware that fits and works with the door.",
    ],
    trust:
      "Small hardware differences can stop a repair from working. FixMyDoor Services helps customers check the details before buying handles, locks, hinges, or cylinders.",
  },
  "/furniture-hardware-purchase": {
    common: [
      "Drawer slides, cabinet hinges, soft-close runners, brackets, fittings, and replacement furniture parts.",
      "Furniture hardware that is loose, broken, missing, undersized, or difficult to match.",
      "Sourcing support from photos and measurements.",
    ],
    process: [
      "Send photos of the part, furniture piece, mounting area, quantity, and any measurements.",
      "We help identify what type of replacement part is likely needed.",
      "The goal is a part that fits, supports the furniture properly, and avoids repeat failure.",
    ],
    trust:
      "Furniture hardware can look similar but fit differently. FixMyDoor Services helps customers slow down the buying process enough to choose a practical match.",
  },
  "/door-hardware": {
    common: [
      "Door equipment, repair parts, locks, hinges, handles, drawer slides, cabinet hinges, and furniture hardware.",
      "Sourcing questions from customers in Canada or outside Canada.",
      "Requests that need photos, measurements, finish, quantity, delivery, or installation planning.",
    ],
    process: [
      "Send clear photos, measurements, location, quantity, and what you want the item to do.",
      "We review the request and ask for any missing information before recommending next steps.",
      "The goal is practical sourcing support with fewer wrong purchases.",
    ],
    trust:
      "Hardware sourcing should be specific. FixMyDoor Services helps customers move from a photo or rough idea to a clearer product request.",
  },
  "/international-requests": {
    common: [
      "Customers outside Canada asking about doors, furniture repairs, hardware, parts, measurements, or product guidance.",
      "Requests that need time zone, currency, country, city, photos, and preferred contact method.",
      "International sourcing questions where clear communication matters.",
    ],
    process: [
      "Send your country, city, time zone, photos, measurements, quantity, and preferred currency.",
      "We review whether the request is repair guidance, product sourcing, delivery, or installation planning.",
      "The goal is a clear response even when the customer is outside Canada.",
    ],
    trust:
      "International requests need extra context. FixMyDoor Services asks for the right details up front so follow-up is easier across time zones.",
  },
};

function buildServiceFaqs(page: (typeof serviceSeoPages)[string]) {
  return [
    {
      question: `What information should I send for ${page.eyebrow.toLowerCase()}?`,
      answer: "Send photos, measurements if available, your city or country, and a short note about what is not working. That helps us understand whether repair, installation, replacement, or sourcing is the right next step.",
    },
    {
      question: "Can FixMyDoor Services help customers outside Montreal?",
      answer: "Yes. FixMyDoor Services is based in Montreal and welcomes Quebec, Canada-wide, and international requests for door, furniture, and hardware support.",
    },
    {
      question: "Will I receive clear guidance before work starts?",
      answer: "Yes. We aim to explain the practical next step before customers spend money on the wrong part, door, furniture hardware, or service.",
    },
  ];
}

export default function ServicePage() {
  const [location] = useLocation();
  const resolvedPage = resolveSeoPage(location);
  const page = serviceSeoPages[resolvedPage.path] || serviceSeoPages["/door-repair"];
  const detail = serviceDetails[page.path] || defaultServiceDetail;
  const serviceFaqs = buildServiceFaqs(page);
  const canonicalUrl = `${SITE_URL}${page.path}`;
  const serviceStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${canonicalUrl}#service`,
        name: page.structuredServiceName,
        description: page.description,
        serviceType: page.structuredServiceName,
        url: canonicalUrl,
        provider: {
          "@id": `${SITE_URL}/#business`,
          name: "FixMyDoor Services",
        },
        areaServed: ["Montreal", "Quebec", "Canada", "International requests"],
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        mainEntity: serviceFaqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: page.eyebrow, item: canonicalUrl },
        ],
      },
    ],
  };

  useEffect(() => {
    document.title = page.title;
    setMeta('meta[name="description"]', "name", "description", page.description);
    setMeta('meta[name="keywords"]', "name", "keywords", page.keywords);
    setMeta('meta[property="og:title"]', "property", "og:title", page.title);
    setMeta('meta[property="og:description"]', "property", "og:description", page.description);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", page.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", page.description);
  }, [page]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_#f8f1e7,_#ffffff_55%,_#f4e2ca)] text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceStructuredData) }} />
      <nav className="border-b border-primary/10 bg-[#f7efe4]/95 backdrop-blur">
        <div className="container flex max-w-[1180px] items-center justify-between gap-2 py-2 sm:gap-4 sm:py-3">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <img src="/img5150-transparent.png" alt="FixMyDoor" className="h-12 w-auto shrink-0 object-contain sm:h-14" />
            <span className="hidden min-w-0 max-w-[18rem] min-[430px]:block sm:max-w-[24rem] md:max-w-[32rem]">
              <span className="block truncate font-display text-[0.82rem] font-bold leading-tight text-secondary sm:text-base md:text-lg">
                FixMyDoor Services | Door & Furniture Repairs
              </span>
              <span className="mt-0.5 block truncate text-[0.56rem] font-semibold uppercase leading-tight tracking-[0.08em] text-secondary/65 sm:text-[0.63rem] sm:tracking-[0.12em] md:text-[0.68rem]">
                Repairs, installations, doors, furniture, and hardware sourcing.
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a href="tel:+14383471823" className="hidden rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white sm:inline-flex">
              Call +1 (438) 347-1823
            </a>
            <LanguageTranslator />
          </div>
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
              Call FixMyDoor Services
            </a>
          </Button>
        </div>
      </section>

      <section className="container max-w-[1180px] pb-12">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[28px] border border-primary/12 bg-white p-6 shadow-[0_16px_44px_rgba(66,40,18,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Service Details</p>
            <h2 className="mt-3 text-3xl font-bold text-secondary">Common reasons customers contact us</h2>
            <div className="mt-5 grid gap-3">
              {detail.common.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-background p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-foreground/76">{item}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-primary/12 bg-[#2f241c] p-6 text-white shadow-[0_16px_44px_rgba(66,40,18,0.12)]">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">How We Work</p>
            <h2 className="mt-3 text-3xl font-bold">Simple, clear, and documented</h2>
            <div className="mt-5 grid gap-3">
              {detail.process.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-white/8 p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{index + 1}</span>
                  <p className="text-sm leading-relaxed text-white/82">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-2xl bg-white/8 p-4 text-sm leading-relaxed text-white/82">{detail.trust}</p>
          </article>
        </div>
      </section>

      <section className="container max-w-[1180px] pb-12">
        <div className="grid gap-5 rounded-[28px] border border-primary/12 bg-white p-5 shadow-[0_16px_44px_rgba(66,40,18,0.08)] md:grid-cols-[0.78fr_1.22fr] md:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold text-secondary">Questions customers ask</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/68">
              These answers help customers understand the request before calling or sending photos.
            </p>
          </div>
          <div className="grid gap-3">
            {serviceFaqs.map((item) => (
              <details key={item.question} className="group rounded-2xl bg-background p-4">
                <summary className="cursor-pointer list-none text-sm font-bold text-secondary marker:hidden">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-foreground/72">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
