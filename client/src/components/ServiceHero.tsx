import { ArrowRight, DoorOpen, MapPin, Video } from "lucide-react";
import door from "@/pages/Images/real/entry-design-1240.webp";
import doorSmall from "@/pages/Images/real/entry-design-640.webp";
import { useDesignLanguage } from "./language";

export default function ServiceHero({ onBook, onRemote }: { onBook: () => void; onRemote: () => void }) {
  const { language, local } = useDesignLanguage();
  return <section className="fd-hero" id="main-content" lang={language} data-no-translate>
    <div className="fd-wrap fd-hero-grid">
      <div className="fd-hero-copy">
        <p className="fd-kicker"><MapPin aria-hidden="true" />Montréal, Québec</p>
        <h1>{local("Door, furniture & property repairs", "Réparation de portes, de meubles et entretien immobilier")}</h1>
        <p className="fd-intro">{local(
          "Request a repair, installation, or maintenance visit. Tell us what needs attention and we’ll confirm the right next step for your location.",
          "Demandez une réparation, une installation ou une visite d’entretien. Décrivez vos besoins et nous vous proposerons la suite selon votre emplacement.",
        )}</p>
        <div className="fd-actions">
          <button className="fd-button fd-button-primary" onClick={onBook}>{local("Request a service", "Demander un service")} <ArrowRight aria-hidden="true" /></button>
          <a className="fd-button fd-button-outline" href="#services">{local("Explore services", "Explorer les services")}</a>
        </div>
        <button className="fd-text-action" onClick={onRemote}><Video aria-hidden="true" />{local("Request a remote consultation", "Demander une consultation à distance")}</button>
      </div>
      <figure className="fd-hero-photo">
        <img src={door} srcSet={doorSmall + " 640w, " + door + " 1240w"} sizes="(min-width: 900px) 50vw, 100vw" alt={local("Wood entry door with a narrow glass inset", "Porte d’entrée en bois avec un vitrage vertical")} fetchPriority="high" decoding="async" />
        <figcaption><DoorOpen aria-hidden="true" /><span>{local("Door repair & installation", "Réparation et installation de portes")}</span></figcaption>
      </figure>
    </div>
  </section>;
}
