import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileText,
  Home,
  Mail,
  MessageSquare,
  Phone,
  Scale,
  ShieldCheck,
  UploadCloud,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import LanguageTranslator from "@/components/LanguageTranslator";
import { Button } from "@/components/ui/button";
import { termsConditionsSeoPage } from "@shared/seo";

const SITE_URL = "https://www.fixmydoor.ca";

function setMeta(selector: string, attributeName: "name" | "property", attributeValue: string, content: string) {
  const meta = document.querySelector(selector) || document.createElement("meta");
  meta.setAttribute(attributeName, attributeValue);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

type TermsSection = {
  title: string;
  body: string;
  Icon: LucideIcon;
};

const termsSections: TermsSection[] = [
  {
    title: "Use of this website",
    Icon: FileCheck2,
    body:
      "By using this website, sending a request, booking a service, uploading files, writing a review, or contacting FixMyDoor Services, customers agree to use the website honestly and provide accurate contact, location, service, and request information.",
  },
  {
    title: "Services provided",
    Icon: Wrench,
    body:
      "FixMyDoor Services helps with door repairs, door installations, lock rekeying, hinges, handles, door closers, furniture repair, furniture installation, cabinet hardware, office furniture setup, hardware sourcing, and related customer support.",
  },
  {
    title: "Quotes and estimates",
    Icon: FileText,
    body:
      "Any estimate based on photos, messages, measurements, or online details is for guidance only until the job condition, parts, location, access, and work requirements are confirmed. Final pricing may change if the real condition is different from the information provided.",
  },
  {
    title: "Bookings and availability",
    Icon: CalendarClock,
    body:
      "Requests are accepted 24/7, but service timing depends on availability, location, urgency, parts, weather, access, and the condition of the job. Emergency or after-hours appointments may cost more and are not guaranteed unless confirmed.",
  },
  {
    title: "Customer responsibilities",
    Icon: UserCheck,
    body:
      "Customers are responsible for providing safe access, correct contact details, accurate measurements when available, permission to work at the service location, and clear information about known damage, risks, building rules, or special instructions.",
  },
  {
    title: "Payments and invoices",
    Icon: CreditCard,
    body:
      "Payment terms may depend on the service type, parts, materials, quote, invoice, or agreement. Accepted payment methods may include cash, Interac e-Transfer, card, invoice payment, or other approved methods. Unpaid invoices may delay further service.",
  },
  {
    title: "Photos, videos, files, and uploads",
    Icon: UploadCloud,
    body:
      "Customers may upload or send photos, videos, documents, measurements, and messages to help us understand the request. Customers must only send content they are allowed to share. Uploaded content may be used to review the job, prepare quotes, document work, and support customer service.",
  },
  {
    title: "Notifications, email, SMS, and WhatsApp",
    Icon: Bell,
    body:
      "Customers may receive service-related messages about bookings, quotes, reminders, invoices, reviews, updates, or support by phone, email, SMS, WhatsApp, website notification, or similar contact methods. Browser push notifications only work when the customer or device owner allows them through the browser or app permission prompt.",
  },
  {
    title: "Reviews and public feedback",
    Icon: MessageSquare,
    body:
      "Customers may leave reviews through Google, Facebook, YellowPages, the website, or other platforms. Public review information may appear on the website or business profiles. FixMyDoor Services may reply to reviews professionally and may report abusive, false, or inappropriate content to the platform.",
  },
  {
    title: "Limitations and safety",
    Icon: ShieldCheck,
    body:
      "FixMyDoor Services aims to provide careful, practical service, but hidden damage, old parts, structural issues, unavailable materials, poor prior work, building conditions, or unsafe access may affect the result, cost, timing, or whether the work can be completed.",
  },
];

const customerAgreementPoints = [
  "Provide accurate request details",
  "Allow proper contact follow-up",
  "Understand estimates may change",
  "Use uploads and reviews responsibly",
  "Accept browser notifications only when prompted",
];

const frenchSummary = [
  "En utilisant le site, en envoyant une demande ou en reservant un service, le client accepte de fournir des renseignements exacts et d'utiliser le site de maniere responsable.",
  "Les devis bases sur photos, messages ou mesures sont indicatifs jusqu'a confirmation de l'etat reel du travail, des pieces, de l'acces et des besoins.",
  "Les notifications, courriels, SMS ou messages WhatsApp peuvent etre utilises pour les demandes, rappels, devis, factures, avis et suivis de service.",
];

export default function TermsConditions() {
  const canonicalUrl = `${SITE_URL}${termsConditionsSeoPage.path}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonicalUrl}#terms`,
    name: termsConditionsSeoPage.title,
    description: termsConditionsSeoPage.description,
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
    document.title = termsConditionsSeoPage.title;
    setMeta('meta[name="description"]', "name", "description", termsConditionsSeoPage.description);
    setMeta('meta[name="keywords"]', "name", "keywords", termsConditionsSeoPage.keywords);
    setMeta('meta[property="og:title"]', "property", "og:title", termsConditionsSeoPage.title);
    setMeta('meta[property="og:description"]', "property", "og:description", termsConditionsSeoPage.description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", termsConditionsSeoPage.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", termsConditionsSeoPage.description);
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
              <span className="hidden text-xs font-bold uppercase tracking-[0.14em] text-secondary/60 sm:block">Official Terms & Conditions</span>
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
                Official Terms & Conditions
              </p>
              <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-secondary md:text-6xl">Terms & Conditions</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/72 sm:text-base md:text-lg">
                These terms explain how customers should use the website, request service, accept communications, upload files, handle quotes, and work with FixMyDoor Services.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                {["Service terms", "Quote clarity", "Notification consent"].map((item) => (
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
                  <Link href="/privacy-policy">
                    Privacy Policy
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <aside className="grid gap-3 rounded-[28px] bg-[#2f241c] p-4 text-white shadow-[0_24px_70px_rgba(47,36,28,0.18)] sm:p-5 md:p-6">
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/18">
                    <Scale className="h-6 w-6 text-primary" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">For every visitor</p>
                    <h2 className="mt-1 text-2xl font-bold">Clear customer agreement</h2>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/78">
                  Customers can review the service rules before booking, uploading files, receiving updates, or sending messages.
                </p>
              </div>
              <div className="grid gap-2">
                {customerAgreementPoints.map((item) => (
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
                These Terms & Conditions apply to FixMyDoor Services and the website at{" "}
                <a href={SITE_URL} className="text-primary underline-offset-4 hover:underline">www.fixmydoor.ca</a>.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-foreground/62">
                They may be updated when services, website features, booking tools, notification tools, or business processes change.
              </p>
            </div>

            <div className="mt-4 rounded-[26px] border border-primary/12 bg-white p-4 shadow-[0_18px_52px_rgba(47,36,28,0.08)] sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Terms contact</p>
                  <h2 className="text-lg font-bold text-secondary">Questions?</h2>
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
            {termsSections.map((section, index) => {
              const Icon = section.Icon;

              return (
                <article key={section.title} className="group rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(47,36,28,0.08)] sm:p-5 md:rounded-[28px] md:p-6">
                  <div className="flex gap-3 sm:gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10 sm:h-12 sm:w-12">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-primary">Term {index + 1}</p>
                      <h2 className="mt-1 text-xl font-bold leading-tight text-secondary sm:text-2xl">{section.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/72 md:text-base">{section.body}</p>
                    </div>
                  </div>
                </article>
              );
            })}

            <article className="rounded-[28px] border border-primary/12 bg-[#2f241c] p-5 text-white shadow-[0_18px_52px_rgba(47,36,28,0.16)] md:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Version francaise - resume</p>
              <h2 className="mt-3 text-2xl font-bold">Resume des conditions</h2>
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
                    For questions about these terms, booking rules, quotes, uploads, payments, or notifications, contact FixMyDoor Services at{" "}
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
