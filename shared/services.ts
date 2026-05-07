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
    summary: "We fix doors that drag, stick, sag, or no longer close the way they should.",
    bookingValue: "door-repair",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "lock-rekeying",
    title: "Lock & Hinge Care",
    summary: "Rekeying, handle changes, and hinge adjustments that make the door feel safe and easy to use.",
    bookingValue: "lock-rekeying",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "furniture-repair",
    title: "Furniture Repairs",
    summary: "Helpful repairs for worn or damaged furniture so it looks better and works properly again.",
    bookingValue: "furniture-repair",
    showOnHome: true,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "entry-door-installation",
    title: "Entry Door Installation",
    summary: "A cleaner front-door upgrade with better fit, better swing, and a stronger first impression.",
    bookingValue: "entry-door-installation",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "door-alignment",
    title: "Door Alignment",
    summary: "Quiet the rub, close the gaps, and get the door moving smoothly again.",
    bookingValue: "door-alignment",
    showOnHome: false,
    showInFooter: false,
    showInBooking: true,
  },
  {
    slug: "door-purchase",
    title: "Buy Doors",
    summary: "Request entry, interior, glass-panel, steel, wood-look, and custom-fit door options.",
    bookingValue: "door-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "door-hardware-purchase",
    title: "Buy Door Hardware",
    summary: "Request handles, locks, cylinders, hinges, backplates, and complete door hardware kits.",
    bookingValue: "door-hardware-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true,
  },
  {
    slug: "furniture-hardware-purchase",
    title: "Buy Furniture Hardware",
    summary: "Request drawer slides, cabinet hinges, soft-close runners, and furniture repair hardware.",
    bookingValue: "furniture-hardware-purchase",
    showOnHome: false,
    showInFooter: true,
    showInBooking: true,
  },
];
