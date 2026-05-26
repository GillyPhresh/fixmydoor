import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Home, Mail, Phone, Wrench } from "lucide-react";
import { Link } from "wouter";

const helpfulLinks = [
  { href: "/door-repair", label: "Door Repairs" },
  { href: "/entry-door-installation", label: "Door Installations" },
  { href: "/furniture-repair", label: "Furniture Repairs" },
  { href: "/door-hardware", label: "Hardware Sourcing" },
];

export default function NotFound() {
  useEffect(() => {
    document.title = "Page Not Found | FixMyDoor Services";
  }, []);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fffaf2,_#ffffff)] text-foreground">
      <nav className="border-b border-primary/12 bg-white">
        <div className="container flex max-w-[1180px] items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/img5150-transparent.png" alt="FixMyDoor logo" className="h-14 w-auto object-contain" />
            <span className="font-display text-lg font-bold text-secondary">FixMyDoor Services</span>
          </Link>
          <a href="tel:+14383471823" className="hidden rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white sm:inline-flex">
            Call +1 (438) 347-1823
          </a>
        </div>
      </nav>

      <section className="container grid max-w-[1180px] gap-8 py-12 md:grid-cols-[0.85fr_1.15fr] md:items-center md:py-20">
        <div>
          <p className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-primary">404 page</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-secondary md:text-6xl">This page is not available.</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/72">
            The link may have changed, but FixMyDoor Services can still help with door repairs, door installations, furniture repairs, furniture installations, lock and hinge services, and hardware sourcing.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="bg-primary text-white hover:bg-secondary">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="/#contact">
                Contact FixMyDoor Services
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <aside className="rounded-[28px] border border-primary/12 bg-white p-6 shadow-[0_18px_50px_rgba(47,36,28,0.08)]">
          <Wrench className="h-9 w-9 text-primary" />
          <h2 className="mt-4 text-2xl font-bold text-secondary">Try one of these pages</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {helpfulLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-2xl bg-background p-4 text-sm font-bold text-secondary transition hover:bg-primary hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-5 grid gap-3 border-t border-primary/10 pt-5">
            <a href="tel:+14383471823" className="flex items-center gap-3 rounded-2xl bg-[#fffaf2] p-4 text-sm font-bold text-secondary transition hover:text-primary">
              <Phone className="h-5 w-5 text-primary" />
              +1 (438) 347-1823
            </a>
            <a href="mailto:info.fixmydoor@gmail.com" className="flex items-center gap-3 rounded-2xl bg-[#fffaf2] p-4 text-sm font-bold text-secondary transition hover:text-primary">
              <Mail className="h-5 w-5 text-primary" />
              info.fixmydoor@gmail.com
            </a>
          </div>
        </aside>
      </section>
    </main>
  );
}
