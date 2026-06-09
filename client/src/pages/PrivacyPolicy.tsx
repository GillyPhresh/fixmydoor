import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  Home,
  LockKeyhole,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Star,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import LanguageTranslator from "@/components/LanguageTranslator";
import { Button } from "@/components/ui/button";
import { privacyPolicySeoPage } from "@shared/seo";

const SITE_URL = "https://www.fixmydoor.ca";

function setMeta(selector: string, attributeName: "name" | "property", attributeValue: string, content: string) {
  const meta = document.querySelector(selector) || document.createElement("meta");
  meta.setAttribute(attributeName, attributeValue);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

type PolicySection = {
  title: string;
  body: string;
  Icon: LucideIcon;
};

const policySections: PolicySection[] = [
  {
    title: "Information we collect",
    Icon: Database,
    body:
      "FixMyDoor Services may collect the information customers choose to send when they contact us, request a quote, book service, write a review, or use website features. This can include name, phone number, email address, service address or area, message details, preferred date and time, uploaded photos, uploaded documents, measurements, booking records, invoice details, and communication history.",
  },
  {
    title: "How we use customer information",
    Icon: UserCheck,
    body:
      "We use customer information to respond to requests, prepare quotes, schedule service, send reminders, manage invoices, provide customer support, improve the website, prevent spam or fraud, and keep accurate service records. We may contact customers by phone, email, SMS, WhatsApp, website notification, or other contact method they provide.",
  },
  {
    title: "Reviews and review widgets",
    Icon: Star,
    body:
      "FixMyDoor Services may display reviews from customers, Google, Facebook, YellowPages, or approved first-party review tools on the website. Public review information may include the reviewer name, rating, review text, review date, and publicly available profile image when provided by the review platform.",
  },
  {
    title: "Photos, files, and service records",
    Icon: FileText,
    body:
      "Customers may send photos, measurements, videos, or documents to help us understand a door, lock, furniture, cabinet, hardware, or installation request. These files are used only to review the request, prepare service details, support quotes or invoices, and document the work.",
  },
  {
    title: "Cookies, analytics, and security checks",
    Icon: LockKeyhole,
    body:
      "The website may use essential cookies, security checks, analytics, logging, and performance tools to keep forms, bookings, admin access, notifications, and website features working properly. These tools help us understand website usage, protect against spam, and improve reliability.",
  },
  {
    title: "Third-party services",
    Icon: Eye,
    body:
      "We may use trusted third-party services to operate the website and business, including hosting providers, email services, payment or invoice tools, Google services, YellowPages, Facebook, Instagram, X, WhatsApp, analytics tools, map tools, review widgets, and notification services. These services may process information according to their own privacy policies.",
  },
  {
    title: "How long we keep information",
    Icon: CalendarCheck,
    body:
      "We keep customer information only as long as reasonably needed for service, communication, business records, legal, accounting, security, and customer support purposes. Customers can contact us to request correction or deletion of personal information where applicable.",
  },
  {
    title: "Information sharing",
    Icon: MessageSquare,
    body:
      "FixMyDoor Services does not sell customer personal information. We may share limited information only when needed to provide service, operate the website, comply with legal requirements, prevent fraud, manage reviews, or work with trusted tools that support the business.",
  },
  {
    title: "Customer choices",
    Icon: Bell,
    body:
      "Customers can ask us to update, correct, or delete their personal information, unsubscribe from non-essential messages, or stop receiving website notifications where the device or browser supports that option. Some service records may need to be kept for business or legal reasons.",
  },
];

const trustHighlights = ["Review widget ready", "Customer data explained", "Google and YellowPages friendly"];

const officialUses = [
  "Bookings and quotes",
  "Uploaded photos and files",
  "Review display",
  "Notifications and reminders",
  "Invoices and support",
];

const frenchSummary = [
  "FixMyDoor Services utilise les renseignements des clients pour repondre aux demandes, preparer les devis, planifier les services, envoyer les rappels, gerer les factures et offrir un soutien clair.",
  "Les avis provenant de Google, Facebook, YellowPages ou d'outils d'avis approuves peuvent etre affiches sur le site avec les renseignements publics fournis par la plateforme.",
  "Nous ne vendons pas les renseignements personnels des clients. Les clients peuvent demander la correction ou la suppression de leurs renseignements lorsque cela est applicable.",
];

export default function PrivacyPolicy() {
  const canonicalUrl = `${SITE_URL}${privacyPolicySeoPage.path}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonicalUrl}#privacy-policy`,
    name: privacyPolicySeoPage.title,
    description: privacyPolicySeoPage.description,
    url: canonicalUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "FixMyDoor Services",
      url: SITE_URL,
    },
    publisher: {
      "@type": "LocalBusiness",
      name: "FixMyDoor Services",
      url: SITE_URL,
      telephone: "+14383471823",
      email: "info.fixmydoor@gmail.com",
    },
    inLanguage: ["en-CA", "fr-CA"],
  };

  useEffect(() => {
    document.title = privacyPolicySeoPage.title;
    setMeta('meta[name="description"]', "name", "description", privacyPolicySeoPage.description);
    setMeta('meta[name="keywords"]', "name", "keywords", privacyPolicySeoPage.keywords);
    setMeta('meta[property="og:title"]', "property", "og:title", privacyPolicySeoPage.title);
    setMeta('meta[property="og:description"]', "property", "og:description", privacyPolicySeoPage.description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", privacyPolicySeoPage.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", privacyPolicySeoPage.description);
  }, [canonicalUrl]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff8ee_0%,_#ffffff_42%,_#f8f1e7_100%)] text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav className="sticky top-0 z-40 border-b border-primary/12 bg-white/92 shadow-[0_12px_30px_rgba(47,36,28,0.05)] backdrop-blur-xl">
        <div className="container flex max-w-[1180px] items-center justify-between gap-2 py-2.5 sm:gap-3 sm:py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-[#fffaf2] px-2 shadow-sm sm:h-14 sm:w-20">
              <img src="/img5150-transparent.png" alt="FixMyDoor Services logo" className="h-10 w-auto object-contain sm:h-12" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-bold text-secondary sm:text-lg">FixMyDoor Services</span>
              <span className="hidden text-xs font-bold uppercase tracking-[0.14em] text-secondary/60 sm:block">Official Privacy Policy</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a href="tel:+14383471823" className="hidden rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(180,101,50,0.18)] sm:inline-flex">
              Call +1 (438) 347-1823
            </a>
            <LanguageTranslator />
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-primary/10">
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_20%_20%,_rgba(180,101,50,0.14),_transparent_42%),radial-gradient(circle_at_80%_0%,_rgba(107,68,35,0.13),_transparent_34%)]" />
        <div className="container relative max-w-[1180px] py-8 sm:py-10 md:py-14">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
            <div className="rounded-[28px] border border-primary/14 bg-white/86 p-5 shadow-[0_24px_70px_rgba(47,36,28,0.10)] backdrop-blur sm:p-7 md:p-9">
              <p className="inline-flex rounded-full border border-primary/16 bg-primary/10 px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-primary sm:text-xs">
                Official Privacy Policy
              </p>
              <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-secondary md:text-6xl">Privacy Policy</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/72 sm:text-base md:text-lg">
                This policy explains how FixMyDoor Services handles customer information, booking details, uploaded photos, website messages, reviews, and review widgets.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                {trustHighlights.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl border border-primary/10 bg-[#fffaf2] px-3 py-2.5 text-xs font-bold text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-primary text-white shadow-[0_14px_34px_rgba(180,101,50,0.2)] hover:bg-secondary">
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Back to Home
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-primary/18 bg-white">
                  <a href="/#contact">
                    Contact Us
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <aside className="grid gap-3 rounded-[28px] bg-[#2f241c] p-4 text-white shadow-[0_24px_70px_rgba(47,36,28,0.18)] sm:p-5 md:p-6">
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/18">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">For customers and platforms</p>
                    <h2 className="mt-1 text-2xl font-bold">Clear privacy coverage</h2>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/78">
                  Built for customer trust, review widgets, service records, notifications, and website contact forms.
                </p>
              </div>
              <div className="grid gap-2">
                {officialUses.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/8 px-3 py-2.5 text-sm font-semibold text-white/84">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="container max-w-[1180px] py-7 md:py-10">
        <div className="grid gap-5 lg:grid-cols-[0.36fr_0.64fr] lg:items-start">
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-[26px] border border-primary/12 bg-white p-4 shadow-[0_18px_52px_rgba(47,36,28,0.08)] sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Effective date</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-secondary">
                This Privacy Policy applies to FixMyDoor Services and the website at{" "}
                <a href={SITE_URL} className="text-primary underline-offset-4 hover:underline">www.fixmydoor.ca</a>.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-foreground/62">
                It may be updated when website tools, review widgets, booking features, or business processes change.
              </p>
            </div>

            <div className="mt-4 rounded-[26px] border border-primary/12 bg-white p-4 shadow-[0_18px_52px_rgba(47,36,28,0.08)] sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Privacy contact</p>
                  <h2 className="text-lg font-bold text-secondary">Need help?</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm font-semibold text-secondary">
                <a href="mailto:info.fixmydoor@gmail.com" className="flex min-w-0 items-center gap-2 rounded-2xl bg-background px-3 py-3 transition hover:text-primary">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span className="break-all">info.fixmydoor@gmail.com</span>
                </a>
                <a href="tel:+14383471823" className="flex items-center gap-2 rounded-2xl bg-background px-3 py-3 transition hover:text-primary">
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  <span>+1 (438) 347-1823</span>
                </a>
              </div>
            </div>
          </aside>

          <div className="grid gap-3.5 sm:gap-4">
            {policySections.map((section, index) => {
              const Icon = section.Icon;

              return (
                <article key={section.title} className="group rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(47,36,28,0.08)] sm:p-5 md:rounded-[28px] md:p-6">
                  <div className="flex gap-3 sm:gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10 sm:h-12 sm:w-12">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-primary">Section {index + 1}</p>
                      <h2 className="mt-1 text-xl font-bold leading-tight text-secondary sm:text-2xl">{section.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/72 md:text-base">{section.body}</p>
                    </div>
                  </div>
                </article>
              );
            })}

            <article className="rounded-[28px] border border-primary/12 bg-[#2f241c] p-5 text-white shadow-[0_18px_52px_rgba(47,36,28,0.16)] md:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Version francaise - resume</p>
              <h2 className="mt-3 text-2xl font-bold">Resume de confidentialite</h2>
              <div className="mt-4 grid gap-3">
                {frenchSummary.map((item) => (
                  <p key={item} className="rounded-2xl bg-white/8 p-4 text-sm leading-relaxed text-white/82">
                    {item}
                  </p>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-primary/10 bg-[#fffaf2] p-5 md:p-6">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <h2 className="text-2xl font-bold text-secondary">Questions</h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/72 md:text-base">
                    For privacy questions, review display questions, notification requests, or personal information changes, contact FixMyDoor Services at{" "}
                    <a href="mailto:info.fixmydoor@gmail.com" className="font-bold text-primary">info.fixmydoor@gmail.com</a>.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
