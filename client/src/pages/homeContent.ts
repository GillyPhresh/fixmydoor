import heroImage from "./Images/Why Rekeying Your Locks in Columbus, Ohio Is Essential for Your Home's Security.jpg";
import technicianImage from "./Images/richard-ampofo.jpg";
import doorRepairToolsImage from "./Images/real/door-repair-tools.jpg";
import frontDoorLocksmithImage from "./Images/real/front-door-locksmith-rekeying.jpg";
import fixmydoorDoorShowroomImage from "./Images/real/fixmydoor-door-showroom.png";
import darkGlassEntryDoorImage from "./Images/real/dark-glass-entry-door.jpg";
import classicBrownEntryDoorImage from "./Images/real/classic-brown-entry-door.jpg";
import woodGlassFrontDoorImage from "./Images/real/wood-glass-front-door.jpg";
import entryDoorImage from "./Images/real/modern-farmhouse-entry-door.jpg";
import whiteGlassEntryDoorImage from "./Images/real/white-glass-entry-door.jpg";
import whitePanelInteriorDoorImage from "./Images/real/white-panel-interior-door.jpg";
import brownCustomInteriorDoorImage from "./Images/real/brown-custom-interior-door.jpg";
import woodHallwayInteriorDoorsImage from "./Images/real/wood-hallway-interior-doors.jpg";
import woodOfficeGlassDoorImage from "./Images/real/wood-office-glass-door.jpg";
import commercialDoorCloserImage from "./Images/real/commercial-door-closer.jpg";
import officeDeskRepairImage from "./Images/real/second-hand-office-desk.jpg";
import officeFurnitureSuiteImage from "./Images/real/office-furniture-suite.jpg";
import executiveDeskShowcaseImage from "./Images/real/office-reception-desk.jpg";
import singleOfficeDeskImage from "./Images/real/single-office-desk.jpg";
import officeChairSupportImage from "./Images/real/office-chair-support.jpg";
import builtInOfficeFurnitureImage from "./Images/real/built-in-office-furniture.jpg";
import blackOfficeCabinetsImage from "./Images/real/black-office-cabinets.jpg";
import greyCabinetInstallationImage from "./Images/real/grey-cabinet-installation.jpg";
import bedroomFurnitureInstallationImage from "./Images/real/bedroom-furniture-installation.jpg";
import bedFrameInstallationImage from "./Images/real/bed-frame-installation.jpg";
import blackHandleLockHingeKitImage from "./Images/catalog/black-handle-lock-hinge-kit.jpg";
import chromeBathroomHandleLockKitImage from "./Images/catalog/chrome-bathroom-handle-lock-kit.jpg";
import silverMortiseHandleCylinderKitImage from "./Images/catalog/silver-mortise-handle-cylinder-kit.jpg";
import blackDrawerSlideWithDrawerImage from "./Images/catalog/black-drawer-slide-with-drawer.jpg";
import blackSoftCloseDrawerSlidesImage from "./Images/catalog/black-soft-close-drawer-slides.jpg";
import softCloseCabinetHingesImage from "./Images/catalog/soft-close-cabinet-hinges.jpg";
import chromeBackplateHandleLockKitImage from "./Images/catalog/chrome-backplate-handle-lock-kit.jpg";
import euroCylinderLocksImage from "./Images/catalog/euro-cylinder-locks.jpg";
import cylindricalKnobLockImage from "./Images/catalog/cylindrical-knob-lock.jpg";
import brassMortiseHandleLockImage from "./Images/catalog/brass-mortise-handle-lock.jpg";
import doorHandleStyleGridImage from "./Images/catalog/door-handle-style-grid.jpg";

export { heroImage, technicianImage };

export const featuredService = {
  tag: "Security Upgrade",
  title: "Secure doors, clean fitting, and reliable repairs.",
  desc: "From rekeying an entry door to repairing furniture, FixMyDoor Services focuses on practical work that makes your space safer and easier to use.",
};

export const featuredServiceCollage = [
  {
    src: commercialDoorCloserImage,
    title: "Commercial Door Closer",
    tag: "Entry Door",
    featured: true,
  },
  {
    src: brownCustomInteriorDoorImage,
    title: "Wood Interior Door Fitting",
    tag: "Door Work",
  },
  {
    src: greyCabinetInstallationImage,
    title: "Cabinet Hardware Setup",
    tag: "Furniture",
  },
  {
    src: builtInOfficeFurnitureImage,
    title: "Office Furniture Setup",
    tag: "Setup",
    featured: true,
  },
];

export const serviceShowcase = [
  {
    src: frontDoorLocksmithImage,
    title: "Front Door Rekeying & Lock Upgrade",
    desc: "If a key is missing or a lock feels loose, we can rekey, adjust, or recommend safer replacement hardware.",
    tag: "Security Upgrade",
    contain: false,
  },
  {
    src: entryDoorImage,
    title: "Entry Door Replacement",
    desc: "A good front door should open smoothly, close securely, and look clean from the outside.",
    tag: "Exterior Doors",
    contain: false,
  },
  {
    src: officeDeskRepairImage,
    title: "Desk & Cabinet Repairs",
    desc: "Practical repairs for desks, cabinets, drawers, and storage pieces that still have life in them.",
    tag: "Workspace Care",
    contain: false,
  },
  {
    src: executiveDeskShowcaseImage,
    title: "Office Furniture Refresh",
    desc: "Support for office furniture that looks worn, feels loose, or needs stronger hardware.",
    tag: "Office Care",
    contain: false,
  },
];

export const customerPaths = [
  {
    label: "Repair & Installation",
    title: "Fix a door, lock, drawer, or furniture piece",
    desc: "Tell us what is not working. We help with sticking doors, loose handles, damaged frames, drawer slides, hinges, and furniture repairs.",
    cta: "Book a repair",
    href: "#booking-form",
  },
  {
    label: "Buy & Source",
    title: "Find the right door, part, or hardware",
    desc: "Need doors, handles, locks, hinges, slides, or furniture parts? We help you choose before you buy.",
    cta: "Browse Products",
    href: "#shop",
  },
];

export const productCategories = [
  {
    title: "Doors & Entry Systems",
    desc: "Entry, interior, glass-panel, steel, wood-look, Paladin, SED, and heavy-duty doors for homes, rentals, offices, and small shops.",
    items: "Paladin doors, SED doors, heavy doors, entry doors, interior doors, security doors, and sizes for different openings",
    image: fixmydoorDoorShowroomImage,
    accent: classicBrownEntryDoorImage,
    bookingValue: "door-purchase",
  },
  {
    title: "Locks, Handles & Door Hardware",
    desc: "Handles, lock bodies, cylinders, hinges, knobs, and backplates for simple replacements or full hardware upgrades.",
    items: "Handles, cylinders, hinges, lock bodies, backplates, and knob locks",
    image: frontDoorLocksmithImage,
    accent: commercialDoorCloserImage,
    bookingValue: "door-hardware-purchase",
  },
  {
    title: "Furniture Hardware & Tools",
    desc: "Parts for drawers, cabinet doors, shelves, and furniture that needs stronger support or smoother movement.",
    items: "Drawer slides, cabinet hinges, soft-close runners, and mounting hardware",
    image: greyCabinetInstallationImage,
    accent: blackOfficeCabinetsImage,
    bookingValue: "furniture-hardware-purchase",
  },
];

export const doorProducts = [
  { title: "FixMyDoor Door Display", image: fixmydoorDoorShowroomImage, tag: "Paladin & SED Range" },
  { title: "Classic Brown Entry Door", image: classicBrownEntryDoorImage, tag: "Heavy-Duty Entry" },
  { title: "Dark Glass Entry Door", image: darkGlassEntryDoorImage, tag: "Security Entry" },
  { title: "Wood-Glass Front Door", image: woodGlassFrontDoorImage, tag: "Custom-Fit Entry" },
  { title: "White Glass Entry Door", image: whiteGlassEntryDoorImage, tag: "Glass Entry" },
  { title: "Modern Farmhouse Entry Door", image: entryDoorImage, tag: "Exterior Door" },
  { title: "White Interior Panel Door", image: whitePanelInteriorDoorImage, tag: "Interior Door" },
  { title: "Brown Custom Interior Door", image: brownCustomInteriorDoorImage, tag: "Wood Interior" },
  { title: "Wood Hallway Interior Doors", image: woodHallwayInteriorDoorsImage, tag: "Interior Options" },
  { title: "Office Glass & Wood Door", image: woodOfficeGlassDoorImage, tag: "Commercial Door" },
];

export const hardwareProducts = [
  { title: "Black Handle, Lock & Hinge Kit", image: blackHandleLockHingeKitImage, tag: "Door Kit" },
  { title: "Chrome Bathroom Handle Lock Kit", image: chromeBathroomHandleLockKitImage, tag: "Bathroom Lock" },
  { title: "Silver Mortise Handle Cylinder Kit", image: silverMortiseHandleCylinderKitImage, tag: "Mortise Kit" },
  { title: "Chrome Backplate Handle Lock Kit", image: chromeBackplateHandleLockKitImage, tag: "Handle Set" },
  { title: "Euro Cylinder Locks", image: euroCylinderLocksImage, tag: "Cylinder" },
  { title: "Cylindrical Knob Lock", image: cylindricalKnobLockImage, tag: "Knob Lock" },
  { title: "Brass Mortise Handle Lock", image: brassMortiseHandleLockImage, tag: "Premium Handle" },
  { title: "Door Handle Style Set", image: doorHandleStyleGridImage, tag: "Handle Options" },
  { title: "Black Soft-Close Drawer Slides", image: blackSoftCloseDrawerSlidesImage, tag: "Drawer Runner" },
  { title: "Soft-Close Cabinet Hinges", image: softCloseCabinetHingesImage, tag: "Cabinet Hinge" },
];

export const projectGallery = [
  {
    src: doorRepairToolsImage,
    title: "Door Repair Preparation",
    desc: "A practical repair setup with tools ready for door adjustment, sealing, hardware work, and final checks.",
    category: "Door Repair",
  },
  {
    src: frontDoorLocksmithImage,
    title: "Lock Rekeying & Hardware Check",
    desc: "When access changes or a lock feels unreliable, the entry hardware can be checked, adjusted, rekeyed, or replaced.",
    category: "Security Upgrade",
  },
  {
    src: entryDoorImage,
    title: "Entry Door Install",
    desc: "A front-door update with cleaner gaps, a smoother swing, and more reliable daily use.",
    category: "Door Upgrade",
  },
  {
    src: classicBrownEntryDoorImage,
    title: "Heavy-Duty Entry Door Option",
    desc: "A strong exterior door style for customers comparing secure entry options before buying or installing.",
    category: "Entry Door",
  },
  {
    src: darkGlassEntryDoorImage,
    title: "Security Entry Door Fit",
    desc: "Heavy-duty and glass-panel entry doors need accurate measurements, hardware matching, and clean alignment.",
    category: "Security Door",
  },
  {
    src: woodGlassFrontDoorImage,
    title: "Custom Wood-Glass Door",
    desc: "Custom-fit front doors can improve the entrance while keeping the lockset, hinges, and frame practical.",
    category: "Custom Door",
  },
  {
    src: whiteGlassEntryDoorImage,
    title: "Glass Entry Door Refresh",
    desc: "A brighter entry door style that improves curb appeal while keeping daily use practical.",
    category: "Exterior Finish",
  },
  {
    src: whitePanelInteriorDoorImage,
    title: "Interior Door Tune-Up",
    desc: "Alignment help for interior doors that scrape, swing badly, or will not sit properly in the frame.",
    category: "Interior Repair",
  },
  {
    src: woodOfficeGlassDoorImage,
    title: "Office Door Installation",
    desc: "Commercial and office doors need clean fitting, working hardware, and a professional finish.",
    category: "Office Door",
  },
  {
    src: officeFurnitureSuiteImage,
    title: "Office Furniture Setup",
    desc: "Office desks, storage, and wall cabinets need careful fitting so the workspace looks clean and functions well.",
    category: "Office Furniture",
  },
  {
    src: singleOfficeDeskImage,
    title: "Single Office Desk Fit",
    desc: "Desk setup and alignment support for small offices, private rooms, and workstations.",
    category: "Desk Setup",
  },
  {
    src: officeChairSupportImage,
    title: "Office Chair & Workstation Support",
    desc: "Workspace support includes furniture selection, assembly, and practical advice for daily comfort.",
    category: "Workspace Care",
  },
  {
    src: blackOfficeCabinetsImage,
    title: "Cabinet Handle & Storage Work",
    desc: "Cabinet doors, handles, shelves, and storage units can be adjusted or fitted for better use.",
    category: "Cabinet Hardware",
  },
  {
    src: bedroomFurnitureInstallationImage,
    title: "Bedroom Furniture Installation",
    desc: "Furniture installation can include bed frames, headboards, drawers, and matching hardware.",
    category: "Furniture Setup",
  },
  {
    src: bedFrameInstallationImage,
    title: "Bed Frame Assembly",
    desc: "Bed frames and bedroom furniture need secure assembly, clean alignment, and stable support.",
    category: "Furniture Assembly",
  },
];

export const customerReviews = [
  {
    quote: "Richard fixed my front door quickly, and the finished work looked very clean.",
    name: "Sarah M.",
    location: "Montreal, QC",
  },
  {
    quote: "We called for a lock adjustment and door realignment. The work was neat, clear, and handled well.",
    name: "Daniel T.",
    location: "Ottawa, ON",
  },
  {
    quote: "The door closes properly now, and the handle feels secure again.",
    name: "Melissa R.",
    location: "Calgary, AB",
  },
];

export const quickHighlights = [
  {
    title: "Canada-Based Reach",
    text: "Based in Canada, with support for customers who contact us from other regions.",
  },
  {
    title: "Trusted Workmanship",
    text: "Careful service for doors, locks, hinges, cabinets, and furniture.",
  },
  {
    title: "Fast Response",
    text: "Prompt replies, clear timing, and follow-up that is easy to understand.",
  },
];
