import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Building2, CheckCircle2, Flag, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageTranslator from "@/components/LanguageTranslator";

const SITE_URL = "https://www.fixmydoor.ca";
const GHANA_PHONE_DISPLAY = "+233 55 900 4048";
const GHANA_PHONE_TEL = "+233559004048";
const GHANA_WHATSAPP_URL = "https://wa.me/233559004048?text=Hello%20FixMyDoor%20Services%20Ghana%2C%20I%20need%20help%20with%20doors%2C%20furniture%2C%20installation%2C%20or%20repairs.";
const GHANA_EMAIL = "info.fixmydoor@gmail.com";
const GHANA_MANAGER_PHOTO = "/ghana-manager-emmanuella-asare-konadu.heic";

const ghanaServices = [
  "Wholesale and retail of all kinds of doors",
  "Installation of all kinds of doors",
  "Selling of all kinds of furniture",
  "Furniture installation",
  "Door repairs",
  "Furniture repairs",
];

function setMeta(selector: string, attributeName: "name" | "property", attributeValue: string, content: string) {
  const meta = document.querySelector(selector) || document.createElement("meta");
  meta.setAttribute(attributeName, attributeValue);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

export default function GhanaBranch() {
  const canonicalUrl = `${SITE_URL}/ghana-branch`;
  const pageTitle = "FixMyDoor Services Ghana | Doors, Furniture & Installation in Kumasi";
  const pageDescription =
    "FixMyDoor Services Ghana in Kumasi offers door sales, door installation, furniture sales, furniture installation, door repairs, and furniture repairs.";

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${canonicalUrl}#ghana-branch`,
        name: "FixMyDoor Services Ghana",
        url: canonicalUrl,
        logo: `${SITE_URL}/img5150-transparent.png`,
        image: `${SITE_URL}/og-fixmydoor-service.jpg`,
        description: pageDescription,
        telephone: GHANA_PHONE_TEL,
        email: GHANA_EMAIL,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Kumasi",
          addressCountry: "GH",
        },
        areaServed: ["Kumasi", "Ashanti Region", "Ghana"],
        branchOf: {
          "@type": "LocalBusiness",
          name: "FixMyDoor Services",
          url: SITE_URL,
        },
        employee: {
          "@type": "Person",
          name: "Emmanuella Asare Konadu",
          jobTitle: "Managing Director",
        },
        knowsAbout: ghanaServices,
        priceRange: "$$",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Ghana Branch", item: canonicalUrl },
        ],
      },
    ],
  };

  useEffect(() => {
    document.title = pageTitle;
    setMeta('meta[name="description"]', "name", "description", pageDescription);
    setMeta(
      'meta[name="keywords"]',
      "name",
      "keywords",
      "FixMyDoor Services Ghana, doors Kumasi, door installation Ghana, furniture sales Kumasi, furniture installation Ghana, door repairs Ghana, furniture repairs Ghana",
    );
    setMeta('meta[property="og:title"]', "property", "og:title", pageTitle);
    setMeta('meta[property="og:description"]', "property", "og:description", pageDescription);
    setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", pageTitle);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", pageDescription);

    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", canonicalUrl);
    document.head.appendChild(canonical);

    const existingAlternates = document.querySelectorAll('link[data-ghana-branch-alt="true"]');
    existingAlternates.forEach((item) => item.remove());
    [
      ["en-gh", canonicalUrl],
      ["en-ca", `${SITE_URL}/`],
      ["x-default", canonicalUrl],
    ].forEach(([lang, href]) => {
      const alternate = document.createElement("link");
      alternate.setAttribute("rel", "alternate");
      alternate.setAttribute("hreflang", lang);
      alternate.setAttribute("href", href);
      alternate.setAttribute("data-ghana-branch-alt", "true");
      document.head.appendChild(alternate);
    });
  }, [canonicalUrl, pageDescription, pageTitle]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f8f1e7,_#fffaf3_48%,_#ffffff)] text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav className="sticky top-0 z-40 border-b border-primary/12 bg-[#f7efe4]/95 shadow-[0_10px_30px_rgba(47,36,28,0.06)] backdrop-blur">
        <div className="container flex max-w-[1180px] items-center justify-between gap-3 py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/70 bg-white px-2 shadow-sm">
              <img src="/img5150-transparent.png" alt="FixMyDoor Services" className="h-12 w-auto object-contain" />
            </span>
            <span className="hidden min-[430px]:block">
              <span className="block font-display text-base font-bold text-secondary">FixMyDoor Services Ghana</span>
              <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-secondary/60">Kumasi branch</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <a href={`tel:${GHANA_PHONE_TEL}`} className="inline-flex h-10 items-center rounded-2xl bg-primary px-3 text-xs font-black text-white sm:px-4 sm:text-sm">
              Call Ghana
            </a>
            <LanguageTranslator className="h-10" />
          </div>
        </div>
      </nav>

      <section className="container grid max-w-[1180px] gap-6 py-8 md:grid-cols-[1fr_0.82fr] md:items-center md:py-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-primary">
            <Flag className="h-4 w-4" />
            Ghana Branch
          </p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-secondary md:text-6xl">FixMyDoor Services Ghana</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground/72 md:text-lg">
            The Kumasi branch supports customers in Ghana with doors, furniture, installation, wholesale and retail supply, and practical repair services under the FixMyDoor Services brand.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={GHANA_WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(180,101,50,0.22)] transition hover:-translate-y-0.5">
              WhatsApp Ghana Branch
              <MessageCircle className="h-4 w-4" />
            </a>
            <a href={`tel:${GHANA_PHONE_TEL}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">
              <Phone className="h-4 w-4" />
              {GHANA_PHONE_DISPLAY}
            </a>
          </div>
        </div>

        <aside className="rounded-[30px] border border-primary/12 bg-white p-5 shadow-[0_24px_70px_rgba(66,40,18,0.12)]">
          <div className="rounded-[24px] bg-[#2f241c] p-5 text-white">
            <div className="flex items-center gap-4">
              <span className="relative inline-flex h-20 w-20 shrink-0 overflow-hidden rounded-[1.35rem] border border-white/20 bg-[#FAF6F0] shadow-lg ring-2 ring-primary/35">
                <picture>
                  <source srcSet={GHANA_MANAGER_PHOTO} type="image/heic" />
                  <img
                    src="/img5150-transparent.png"
                    alt="Emmanuella Asare Konadu, Managing Director of FixMyDoor Services Ghana"
                    className="h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                </picture>
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Managing Director</p>
                <h2 className="font-display text-2xl font-bold">Emmanuella Asare Konadu</h2>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/82">
              Emmanuella Asare Konadu leads FixMyDoor Services Ghana, coordinating customer support, product supply, installation planning, and service delivery for door and furniture needs in Kumasi and surrounding Ghanaian markets.
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-background p-4">
              <MapPin className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-bold text-secondary">Kumasi, Ghana</p>
            </div>
            <div className="rounded-2xl bg-background p-4">
              <Building2 className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-bold text-secondary">Doors, furniture, supply, repairs</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="container max-w-[1180px] pb-12">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.78fr]">
          <article className="rounded-[28px] border border-primary/12 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-primary">Ghana Services</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-secondary">What the Ghana branch handles</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {ghanaServices.map((service) => (
                <div key={service} className="flex gap-3 rounded-2xl bg-background p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm font-semibold leading-relaxed text-foreground/76">{service}</p>
                </div>
              ))}
            </div>
          </article>

          <aside className="rounded-[28px] border border-primary/12 bg-[#fff7ef] p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-primary">Contact Ghana Branch</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-secondary">Reach the Kumasi team</h2>
            <div className="mt-5 grid gap-3">
              <a href={`tel:${GHANA_PHONE_TEL}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold text-secondary shadow-sm transition hover:text-primary">
                <Phone className="h-5 w-5 text-primary" />
                {GHANA_PHONE_DISPLAY}
              </a>
              <a href={GHANA_WHATSAPP_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold text-secondary shadow-sm transition hover:text-primary">
                <MessageCircle className="h-5 w-5 text-primary" />
                WhatsApp {GHANA_PHONE_DISPLAY}
              </a>
              <a href={`mailto:${GHANA_EMAIL}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold text-secondary shadow-sm transition hover:text-primary">
                <Mail className="h-5 w-5 text-primary" />
                {GHANA_EMAIL}
              </a>
            </div>
            <div className="mt-5 rounded-2xl bg-secondary p-4 text-white">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                This page is for the Ghana branch only. Canada and Montreal service requests should continue through the main FixMyDoor Services booking form.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="container max-w-[1180px] pb-14">
        <div className="rounded-[28px] border border-primary/12 bg-white p-5 text-center shadow-sm md:flex md:items-center md:justify-between md:text-left">
          <div>
            <h2 className="font-display text-2xl font-bold text-secondary">Need the Canada branch instead?</h2>
            <p className="mt-1 text-sm text-foreground/68">Return to the main website for Montreal, Quebec, Canada, and international request support.</p>
          </div>
          <Button asChild className="mt-4 bg-secondary md:mt-0">
            <Link href="/">
              Visit Canada Website
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
