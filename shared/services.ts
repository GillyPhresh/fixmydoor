export interface ServiceCatalogItem {
  slug: string;
  title: string;
  summary: string;
  bookingValue: string;
  showOnHome: boolean;
  showInFooter: boolean;
  showInBooking: boolean;
}

export const serviceCatalog: ServiceCatalogItem[] = [
  {
    slug: "door-repair",
    title: "Door Repairs",
    summary: "For doors that stick, drag, sag, scrape, or refuse to close properly.",
    bookingValue: "door-repair",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "lock-rekeying",
    title: "Lock & Hinge Care",
    summary: "Rekeying, handle changes, and hinge adjustments for doors that need to feel safe again.",
    bookingValue: "lock-rekeying",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "furniture-repair",
    title: "Furniture Repairs",
    summary: "Repairs for furniture that is loose, worn, damaged, or no longer working the way it should.",
    bookingValue: "furniture-repair",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "entry-door-installation",
    title: "Entry Door Installation",
    summary: "A front-door upgrade that fits better, closes better, and improves the entrance.",
    bookingValue: "entry-door-installation",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "door-alignment",
    title: "Door Alignment",
    summary: "For doors that rub, leave gaps, swing badly, or need a cleaner close.",
    bookingValue: "door-alignment",
    showOnHome: false,
    showInFooter: false,
    showInBooking: true,
  },
  {
    slug: "door-purchase",
    title: "Buy Doors",
    summary: "Ask about entry, interior, glass-panel, steel, wood-look, and custom-fit door options.",
    bookingValue: "door-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "door-hardware-purchase",
    title: "Buy Door Hardware",
    summary: "Ask about handles, locks, cylinders, hinges, backplates, and full hardware kits.",
    bookingValue: "door-hardware-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "furniture-hardware-purchase",
    title: "Buy Furniture Hardware",
    summary: "Ask about drawer slides, cabinet hinges, soft-close runners, and repair hardware.",
    bookingValue: "furniture-hardware-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true,
  },
];
