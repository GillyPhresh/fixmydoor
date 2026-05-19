import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Globe2, Phone, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveSeoPage, serviceSeoPages } from "@shared/seo";

function setMeta(selector: string, attributeName: "name" | "property", attributeValue: string, content: string) {
  const meta = document.querySelector(selector) || document.createElement("meta");
  meta.setAttribute(attributeName, attributeValue);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

export default function ServicePage() {
  const [location] = useLocation();
  const resolvedPage = resolveSeoPage(location);
  const page = serviceSeoPages[resolvedPage.path] || serviceSeoPages["/door-repair"];

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
      <nav className="border-b border-primary/10 bg-[#f7efe4]/95 backdrop-blur">
        <div className="container flex max-w-[1180px] items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/img5150-transparent.png" alt="FixMyDoor" className="h-14 w-auto object-contain" />
            <span className="font-display text-lg font-bold text-secondary">FixMyDoor</span>
          </Link>
          <a href="tel:+14383471823" className="hidden rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white sm:inline-flex">
            Call +1 (438) 347-1823
          </a>
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
              Call FixMyDoor
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}
