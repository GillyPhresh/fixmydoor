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
  title: "FixMyDoor Services | Door, Lock & Furniture Help in Montreal",
  description:
    "Need door repair, lock rekeying, furniture repair, installation, or hardware sourcing in Montreal? Send photos and get clear help from FixMyDoor Services.",
  keywords:
    "FixMyDoor Services, door repair Montreal, serrurier Montreal, locksmith Montreal, door hardware repair, lock rekeying Montreal, furniture repair Montreal, hardware sourcing Montreal, entry door installation Montreal, Laval door repair, Longueuil door repair",
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
    title: "Door Repair Montreal | Sticking, Sagging & Damaged Doors",
    description:
      "Door not closing, dragging, rubbing, or damaged? FixMyDoor Services helps Montreal customers with door repair, hinges, frames, handles, and clear photo review.",
    keywords:
      "door repair Montreal, Montreal door repair, fixing doors Montreal, sticking door repair, damaged door frame Montreal, door hinge repair, door handle repair, door repairs Quebec, door repair near me, reparation de porte Montreal",
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
    title: "Lock Rekeying Montreal | Door Lock & Handle Help",
    description:
      "Need lock rekeying, cylinder replacement, handle repair, or safer entry hardware in Montreal? Send photos and get clear guidance from FixMyDoor Services.",
    keywords:
      "lock rekeying Montreal, serrurier Montreal, locksmith Montreal, door lock replacement Montreal, rekey front door, lock repair Montreal, door cylinder replacement, handle replacement Montreal, safer door lock, Quebec door hardware",
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
    title: "Furniture Repair Montreal | Cabinets, Drawers, Sofas & Chairs",
    description:
      "Furniture problem in Montreal? FixMyDoor Services helps with cabinets, drawer slides, sofa frames, loose chairs, hardware replacement, and photo-based guidance.",
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
    title: "Furniture Installation Montreal | Setup, Fitting & Hardware",
    description:
      "Need furniture installation in Montreal? Get help with setup, fitting, cabinets, drawer slides, shelves, desks, office furniture, and hardware support.",
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
    title: "Entry Door Installation Montreal | Front Door Fitting",
    description:
      "Planning an entry door installation in Montreal? Get help with measurements, swing direction, front door fitting, hardware matching, and clear next steps.",
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
    title: "Door Alignment Montreal | Hinge Adjustment & Door Gaps",
    description:
      "Door rubbing, dragging, swinging open, or failing to latch? FixMyDoor Services helps Montreal customers with alignment, hinges, gaps, and strike plates.",
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
    title: "Buy Doors Montreal | Entry, Interior, Steel & Glass Options",
    description:
      "Need help buying the right door? FixMyDoor Services can review measurements, style, hardware, and sourcing options for entry, interior, steel, and glass doors.",
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
    title: "Buy Door Hardware Montreal | Locks, Handles, Hinges & Kits",
    description:
      "Need door hardware in Montreal? Get help sourcing locks, handles, hinges, cylinders, backplates, mortise kits, bathroom locks, and entry hardware.",
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
    title: "Furniture Hardware Montreal | Drawer Slides, Hinges & Parts",
    description:
      "Need furniture replacement parts? FixMyDoor Services helps source drawer slides, cabinet hinges, soft-close runners, fittings, and repair hardware.",
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
    title: "Hardware Sourcing Montreal | Door & Furniture Parts",
    description:
      "Looking for door or furniture parts in Montreal? Send photos and measurements for help sourcing locks, hinges, handles, cabinet hardware, and fittings.",
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
    title: "International Door, Furniture & Hardware Requests",
    description:
      "Outside Montreal or Canada? Send door, furniture, or hardware details for Canada-based sourcing guidance, measurements, repair planning, and quote preparation.",
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
