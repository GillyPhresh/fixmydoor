import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Home, Mail, Phone, ShieldCheck } from "lucide-react";
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

const policySections = [
  {
    title: "Information we collect",
    body:
      "FixMyDoor Services may collect the information customers choose to send when they contact us, request a quote, book service, write a review, or use website features. This can include name, phone number, email address, service address or area, message details, preferred date and time, uploaded photos, uploaded documents, measurements, booking records, invoice details, and communication history.",
  },
  {
    title: "How we use customer information",
    body:
      "We use customer information to respond to requests, prepare quotes, schedule service, send reminders, manage invoices, provide customer support, improve the website, prevent spam or fraud, and keep accurate service records. We may contact customers by phone, email, SMS, WhatsApp, website notification, or other contact method they provide.",
  },
  {
    title: "Reviews and review widgets",
    body:
      "FixMyDoor Services may display reviews from customers, Google, Facebook, YellowPages, or approved first-party review tools on the website. Public review information may include the reviewer name, rating, review text, review date, and publicly available profile image when provided by the review platform.",
  },
  {
    title: "Photos, files, and service records",
    body:
      "Customers may send photos, measurements, videos, or documents to help us understand a door, lock, furniture, cabinet, hardware, or installation request. These files are used only to review the request, prepare service details, support quotes or invoices, and document the work.",
  },
  {
    title: "Cookies, analytics, and security checks",
    body:
      "The website may use essential cookies, security checks, analytics, logging, and performance tools to keep forms, bookings, admin access, notifications, and website features working properly. These tools help us understand website usage, protect against spam, and improve reliability.",
  },
  {
    title: "Third-party services",
    body:
      "We may use trusted third-party services to operate the website and business, including hosting providers, email services, payment or invoice tools, Google services, YellowPages, Facebook, Instagram, X, WhatsApp, analytics tools, map tools, review widgets, and notification services. These services may process information according to their own privacy policies.",
  },
  {
    title: "How long we keep information",
    body:
      "We keep customer information only as long as reasonably needed for service, communication, business records, legal, accounting, security, and customer support purposes. Customers can contact us to request correction or deletion of personal information where applicable.",
  },
  {
    title: "Information sharing",
    body:
      "FixMyDoor Services does not sell customer personal information. We may share limited information only when needed to provide service, operate the website, comply with legal requirements, prevent fraud, manage reviews, or work with trusted tools that support the business.",
  },
  {
    title: "Customer choices",
    body:
      "Customers can ask us to update, correct, or delete their personal information, unsubscribe from non-essential messages, or stop receiving website notifications where the device or browser supports that option. Some service records may need to be kept for business or legal reasons.",
  },
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
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fffaf2,_#ffffff_42%,_#f8f1e7)] text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav className="border-b border-primary/12 bg-white/95 backdrop-blur">
        <div className="container flex max-w-[1180px] items-center justify-between gap-3 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <img src="/img5150-transparent.png" alt="FixMyDoor Services logo" className="h-14 w-auto shrink-0 object-contain" />
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-bold text-secondary">FixMyDoor Services</span>
              <span className="hidden text-xs font-bold uppercase tracking-[0.14em] text-secondary/60 sm:block">Privacy Policy</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <a href="tel:+14383471823" className="hidden rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white sm:inline-flex">
              Call +1 (438) 347-1823
            </a>
            <LanguageTranslator />
          </div>
        </div>
      </nav>

      <section className="container max-w-[1180px] py-10 md:py-16">
        <div className="grid gap-7 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <p className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-primary">
              Privacy Policy
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-secondary md:text-6xl">Privacy Policy</h1>
            <p className="mt-5 text-base leading-relaxed text-foreground/72 md:text-lg">
              This policy explains how FixMyDoor Services handles customer information, booking details, uploaded photos, website messages, reviews, and review widgets.
            </p>
            <div className="mt-6 rounded-[24px] border border-primary/12 bg-white p-5 shadow-[0_14px_42px_rgba(66,40,18,0.08)]">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <h2 className="mt-3 text-xl font-bold text-secondary">Contact for privacy requests</h2>
              <div className="mt-4 grid gap-2 text-sm font-semibold text-secondary">
                <a href="mailto:info.fixmydoor@gmail.com" className="flex items-center gap-2 rounded-2xl bg-background px-4 py-3 transition hover:text-primary">
                  <Mail className="h-4 w-4 text-primary" />
                  info.fixmydoor@gmail.com
                </a>
                <a href="tel:+14383471823" className="flex items-center gap-2 rounded-2xl bg-background px-4 py-3 transition hover:text-primary">
                  <Phone className="h-4 w-4 text-primary" />
                  +1 (438) 347-1823
                </a>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="bg-primary text-white hover:bg-secondary">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href="/#contact">
                  Contact Us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <article className="rounded-[28px] border border-primary/12 bg-white p-5 shadow-[0_18px_52px_rgba(47,36,28,0.08)] md:p-7">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary">Effective date</p>
              <p className="mt-3 text-base leading-relaxed text-foreground/72">
                This Privacy Policy applies to FixMyDoor Services and the website at <a href={SITE_URL} className="font-bold text-primary">www.fixmydoor.ca</a>. It may be updated when website tools, review widgets, booking features, or business processes change.
              </p>
            </article>

            {policySections.map((section) => (
              <article key={section.title} className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-sm md:p-6">
                <h2 className="text-2xl font-bold text-secondary">{section.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground/72 md:text-base">{section.body}</p>
              </article>
            ))}

            <article className="rounded-[28px] border border-primary/12 bg-[#2f241c] p-5 text-white shadow-[0_18px_52px_rgba(47,36,28,0.16)] md:p-7">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary">Version française - résumé</p>
              <h2 className="mt-3 text-2xl font-bold">Résumé de confidentialité</h2>
              <div className="mt-4 grid gap-3">
                {frenchSummary.map((item) => (
                  <p key={item} className="rounded-2xl bg-white/8 p-4 text-sm leading-relaxed text-white/82">
                    {item}
                  </p>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-primary/10 bg-[#fffaf2] p-5 md:p-6">
              <h2 className="text-2xl font-bold text-secondary">Questions</h2>
              <p className="mt-3 text-sm leading-relaxed text-foreground/72 md:text-base">
                For privacy questions, review display questions, notification requests, or personal information changes, contact FixMyDoor Services at{" "}
                <a href="mailto:info.fixmydoor@gmail.com" className="font-bold text-primary">info.fixmydoor@gmail.com</a>.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
