export interface SeoPage {
  path: string;
  title: string;
  description: string;
  keywords: string;
  sitemapPriority: string;
  changeFrequency: "weekly" | "monthly";
}

export interface ServiceSeoPage extends SeoPage {
  eyebrow: string;
  bullets: string[];
  cta: string;
  bookingValue: string;
  structuredServiceName: string;
}

export const homeSeoPage: SeoPage = {
  path: "/",
  title: "FixMyDoor Services | Door Repair, Furniture Repair & Hardware Sourcing",
  description:
    "FixMyDoor Services helps Montreal and Quebec customers with door repair, lock rekeying, entry door installation, furniture repair, furniture installation, and hardware sourcing.",
  keywords:
    "FixMyDoor Services, Montreal door repair, door repair Montreal, door repairs near me Montreal, Quebec door installation, entry door installation Montreal, lock rekeying Montreal, furniture repair Montreal, furniture installation Montreal, door hardware Montreal, Laval door repair, Longueuil door repair, Brossard door repair, Canada door repair",
  sitemapPriority: "1.0",
  changeFrequency: "weekly",
};

export const privacyPolicySeoPage: SeoPage = {
  path: "/privacy-policy",
  title: "Privacy Policy | FixMyDoor Services",
  description:
    "Read the FixMyDoor Services privacy policy for bookings, customer messages, uploaded photos, reviews, website analytics, notifications, and third-party tools.",
  keywords:
    "FixMyDoor Services privacy policy, FixMyDoor privacy, customer data Montreal, booking privacy, review widget privacy, YellowPages reviews, Google reviews",
  sitemapPriority: "0.4",
  changeFrequency: "monthly",
};

export const termsConditionsSeoPage: SeoPage = {
  path: "/terms-and-conditions",
  title: "Terms & Conditions | FixMyDoor Services",
  description:
    "Review the FixMyDoor Services terms and conditions for service requests, quotes, bookings, payments, uploads, reviews, notifications, and customer responsibilities.",
  keywords:
    "FixMyDoor Services terms, FixMyDoor terms and conditions, booking terms Montreal, service terms, quote terms, notification consent, repair service conditions",
  sitemapPriority: "0.4",
  changeFrequency: "monthly",
};

export const serviceSeoPages: Record<string, ServiceSeoPage> = {
  "/door-repair": {
    path: "/door-repair",
    eyebrow: "Door Repair",
    title: "Door Repair Services in Montreal - Sticking, Sagging & Damaged Doors Fixed",
    description:
      "Book help for sticking doors, damaged frames, loose handles, hinge problems, poor sealing, and doors that no longer close properly.",
    keywords:
      "door repair Montreal, Montreal door repair, fixing doors Montreal, sticking door repair, damaged door frame Montreal, door hinge repair, door handle repair, door repairs Quebec, door repair near me",
    bullets: ["Sticking, dragging, sagging, or scraping doors", "Frame, latch, hinge, and handle repairs", "Photo-based review before follow-up"],
    cta: "Book Door Repair",
    bookingValue: "door-repair",
    structuredServiceName: "Door repair",
    sitemapPriority: "0.9",
    changeFrequency: "weekly",
  },
  "/lock-rekeying": {
    path: "/lock-rekeying",
    eyebrow: "Lock Rekeying",
    title: "Lock Rekeying & Door Lock Replacement | FixMyDoor Services",
    description:
      "Request lock rekeying, lock replacement, handle changes, cylinder support, and safer entry hardware for homes, rentals, offices, and business spaces.",
    keywords:
      "lock rekeying Montreal, door lock replacement Montreal, rekey front door, lock repair, door cylinder replacement, handle replacement Montreal, safer door lock, Quebec door hardware",
    bullets: ["Rekeying after missing keys or tenant changes", "Cylinder, latch, handle, and hinge support", "Security-focused recommendations"],
    cta: "Request Lock Help",
    bookingValue: "lock-rekeying",
    structuredServiceName: "Lock rekeying and door hardware replacement",
    sitemapPriority: "0.9",
    changeFrequency: "weekly",
  },
  "/furniture-repair": {
    path: "/furniture-repair",
    eyebrow: "Furniture Repair",
    title: "Furniture Repair Services - Sofa Frames, Cabinets, Drawers & More",
    description:
      "Send photos for sofa frame repairs, loose joints, cabinet hinges, drawer slides, chair repairs, and furniture parts that need practical repair or replacement.",
    keywords:
      "furniture repair Montreal, sofa repair Montreal, cabinet repair, drawer slide repair, chair repair Montreal, furniture restoration, furniture parts, furniture repair Quebec",
    bullets: ["Sofa, cabinet, drawer, chair, and table support", "Loose joints, broken parts, and hardware replacement", "Clear next steps from photos and measurements"],
    cta: "Book Furniture Help",
    bookingValue: "furniture-repair",
    structuredServiceName: "Furniture repair",
    sitemapPriority: "0.9",
    changeFrequency: "weekly",
  },
  "/furniture-installation": {
    path: "/furniture-installation",
    eyebrow: "Furniture Installation",
    title: "Furniture Installation Services | Setup, Fitting & Hardware Help",
    description:
      "Request help with furniture installation, setup, fitting, alignment, cabinet hardware, drawer slides, shelves, desks, and practical furniture assembly support.",
    keywords:
      "furniture installation Montreal, furniture setup Montreal, cabinet installation, drawer slide installation, furniture assembly Montreal, cabinet hardware installation, furniture fitting Quebec",
    bullets: ["Furniture setup, fitting, and alignment", "Cabinet, drawer, desk, shelf, and hardware installation", "Photos and measurements reviewed before follow-up"],
    cta: "Book Furniture Installation",
    bookingValue: "furniture-installation",
    structuredServiceName: "Furniture installation",
    sitemapPriority: "0.85",
    changeFrequency: "weekly",
  },
  "/entry-door-installation": {
    path: "/entry-door-installation",
    eyebrow: "Entry Door Installation",
    title: "Entry Door Installation in Montreal - Front Door Replacement & Fitting",
    description:
      "Request help with front door replacement, entry door fitting, hardware matching, swing direction, measurements, delivery, and installation planning.",
    keywords:
      "entry door installation Montreal, front door replacement Montreal, install exterior door, door fitting Montreal, front door installation Quebec, replacement doors, door measurement",
    bullets: ["Front, entry, interior, steel, wood-look, and glass-panel doors", "Measurements, swing direction, hardware, and finish guidance", "Delivery and installation planning when needed"],
    cta: "Ask About Door Installation",
    bookingValue: "entry-door-installation",
    structuredServiceName: "Entry door installation",
    sitemapPriority: "0.85",
    changeFrequency: "weekly",
  },
  "/door-alignment": {
    path: "/door-alignment",
    eyebrow: "Door Alignment",
    title: "Door Alignment & Hinge Adjustment | Fix Doors That Rub or Drag",
    description:
      "Get help with doors that rub, drag, leave gaps, swing open, fail to latch, or need hinge adjustment for a cleaner close.",
    keywords:
      "door alignment, hinge adjustment, door rubbing frame, door dragging floor, door not closing, door gap repair, fix sagging door",
    bullets: ["Doors that rub, scrape, drag, or swing badly", "Hinge, latch, strike plate, and gap checks", "Cleaner closing without replacing the full door when possible"],
    cta: "Request Door Alignment",
    bookingValue: "door-alignment",
    structuredServiceName: "Door alignment and hinge adjustment",
    sitemapPriority: "0.8",
    changeFrequency: "weekly",
  },
  "/door-purchase": {
    path: "/door-purchase",
    eyebrow: "Buy Doors",
    title: "Buy Doors | Entry, Interior, Steel, Wood & Glass Door Sourcing",
    description:
      "Ask FixMyDoor Services to help source entry doors, interior doors, heavy doors, Paladin doors, SED doors, wood-look doors, glass-panel doors, and custom-size options.",
    keywords:
      "buy doors, purchase doors, entry doors for sale, interior doors, heavy doors, Paladin doors, SED doors, glass doors, steel doors, door supplier Canada",
    bullets: ["Entry, interior, heavy-duty, glass-panel, steel, and wood-look options", "Paladin doors, SED doors, heavy doors, and many sizes", "Size, quantity, finish, and hardware guidance before buying"],
    cta: "Ask for Door Quote",
    bookingValue: "door-purchase",
    structuredServiceName: "Door sourcing and buying support",
    sitemapPriority: "0.9",
    changeFrequency: "weekly",
  },
  "/buy-door-hardware": {
    path: "/buy-door-hardware",
    eyebrow: "Buy Door Hardware",
    title: "Buy Door Hardware | Locks, Handles, Hinges, Cylinders & Door Kits",
    description:
      "Source door handles, locks, cylinders, hinges, backplates, mortise kits, bathroom locks, entry hardware, and full door hardware sets.",
    keywords:
      "buy door hardware, door handles, door locks, hinges, lock cylinders, mortise lock, bathroom door lock, door hardware Canada, door equipment",
    bullets: ["Handles, locks, cylinders, hinges, backplates, and full kits", "Bathroom, entry, interior, and security hardware options", "Help matching finish, size, and door type"],
    cta: "Ask for Hardware Quote",
    bookingValue: "door-hardware-purchase",
    structuredServiceName: "Door hardware sourcing",
    sitemapPriority: "0.9",
    changeFrequency: "weekly",
  },
  "/furniture-hardware-purchase": {
    path: "/furniture-hardware-purchase",
    eyebrow: "Buy Furniture Hardware",
    title: "Buy Furniture Hardware | Drawer Slides, Cabinet Hinges & Parts",
    description:
      "Request drawer slides, soft-close runners, cabinet hinges, furniture repair hardware, replacement fittings, and parts for practical furniture fixes.",
    keywords:
      "buy furniture hardware, drawer slides, cabinet hinges, soft close runners, furniture parts, furniture repair hardware, cabinet hardware Canada",
    bullets: ["Drawer slides, soft-close runners, cabinet hinges, and repair parts", "Practical matching support from photos and measurements", "Useful for repairs, replacement, or new furniture setup"],
    cta: "Ask for Furniture Parts",
    bookingValue: "furniture-hardware-purchase",
    structuredServiceName: "Furniture hardware sourcing",
    sitemapPriority: "0.85",
    changeFrequency: "weekly",
  },
  "/door-hardware": {
    path: "/door-hardware",
    eyebrow: "Hardware Sourcing",
    title: "Door & Furniture Hardware Sourcing - Locks, Hinges, Handles & Parts",
    description:
      "Send measurements, photos, quantity, finish, and budget so FixMyDoor Services can help source the right door equipment, furniture parts, locks, hinges, and hardware.",
    keywords:
      "hardware sourcing, door equipment, source door parts, source furniture parts, door hardware sourcing, repair parts, locks hinges handles",
    bullets: ["Door equipment, locks, hinges, handles, and furniture hardware", "Photos, measurements, quantity, finish, and budget review", "Canada-based coordination with international request support"],
    cta: "Ask for Product Quote",
    bookingValue: "door-hardware-purchase",
    structuredServiceName: "Door equipment and hardware sourcing",
    sitemapPriority: "0.85",
    changeFrequency: "weekly",
  },
  "/international-requests": {
    path: "/international-requests",
    eyebrow: "International Requests",
    title: "International Door, Furniture & Hardware Requests | FixMyDoor Services",
    description:
      "FixMyDoor Services is Canada-based and supports international requests for door buying, repair guidance, furniture parts, hardware sourcing, measurements, and quote preparation.",
    keywords:
      "international door requests, international furniture repair support, buy doors internationally, hardware sourcing worldwide, Canada door service international",
    bullets: ["Country, city, time zone, and currency-aware requests", "WhatsApp, email, and phone follow-up", "Door, furniture, and hardware sourcing support"],
    cta: "Send International Request",
    bookingValue: "international-request",
    structuredServiceName: "International door, furniture, and hardware request support",
    sitemapPriority: "0.8",
    changeFrequency: "weekly",
  },
};

export const seoRouteAliases: Record<string, string> = {
  "/buy-doors": "/door-purchase",
  "/door-installation": "/entry-door-installation",
  "/door-equipment": "/buy-door-hardware",
  "/door-hardware-purchase": "/buy-door-hardware",
  "/hardware-sourcing": "/door-hardware",
  "/buy-furniture-hardware": "/furniture-hardware-purchase",
  "/furniture-parts": "/furniture-hardware-purchase",
  "/furniture-setup": "/furniture-installation",
};

export const seoPages: Record<string, SeoPage> = {
  [homeSeoPage.path]: homeSeoPage,
  [privacyPolicySeoPage.path]: privacyPolicySeoPage,
  [termsConditionsSeoPage.path]: termsConditionsSeoPage,
  ...serviceSeoPages,
};

export const sitemapRoutes = [homeSeoPage.path, ...Object.keys(serviceSeoPages), privacyPolicySeoPage.path, termsConditionsSeoPage.path];

export function normalizeSeoPath(pathname = "/") {
  const withoutQuery = pathname.split("?")[0].split("#")[0] || "/";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : "/";
}

export function resolveSeoPage(pathname = "/") {
  const normalizedPath = normalizeSeoPath(pathname);
  const canonicalPath = seoRouteAliases[normalizedPath] || normalizedPath;
  return seoPages[canonicalPath] || homeSeoPage;
}
