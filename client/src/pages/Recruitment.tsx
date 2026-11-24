import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, MapPin, ShieldCheck, Wrench } from "lucide-react";
import axios from "axios";
import { useDesignLanguage } from "@/components/language";
import "./commercial.css";

const provinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const statuses = ["NEW", "SCREENING", "INTERVIEW", "CLOSED"] as const;
type Status = typeof statuses[number];
type Application = {
  id: string; name: string; email: string; city: string; province: string;
  experience: string; status: Status; reviewNote: string; version: number;
};
const labels: Record<Status, [string, string]> = {
  NEW: ["New", "Nouvelles"], SCREENING: ["Screening", "Présélection"],
  INTERVIEW: ["Interview", "Entretien"], CLOSED: ["Closed", "Fermées"],
};

function Header({ staff = false }: { staff?: boolean }) {
  const { language, setLanguage, local } = useDesignLanguage();
  return <header className="fd-recruit-header">
    <div className="fd-wrap">
      <a className="fd-recruit-brand" href={staff ? "/admin/commercial" : "/"}><ArrowLeft aria-hidden="true" />{staff ? local("Service management", "Gestion des services") : "FixMyDoor Services"}</a>
      <button className="fd-button fd-button-outline" type="button" onClick={() => setLanguage(language === "en" ? "fr" : "en")} lang={language === "en" ? "fr" : "en"}>{language === "en" ? "Français" : "English"}</button>
    </div>
  </header>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="fd-field"><span>{label}</span>{children}</label>;
}

export function TechnicianApplicationPage() {
  const { language, local } = useDesignLanguage();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const confirmation = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (state === "sent") confirmation.current?.focus(); }, [state]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setState("sending");
    try {
      await axios.post("/api/technician-applications", data);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return <main className="fd-recruit" lang={language} data-no-translate>
    <Header />
    <section className="fd-recruit-intro">
      <div className="fd-wrap">
        <p className="fd-kicker"><Wrench aria-hidden="true" />{local("Technician network", "Réseau de techniciens")}</p>
        <h1>{local("Put your trade skills to work.", "Mettez votre savoir-faire à profit.")}</h1>
        <p>{local("Apply to work with FixMyDoor on repair, installation, and maintenance requests where your skills and service area match.", "Posez votre candidature pour des travaux de réparation, d’installation et d’entretien qui correspondent à vos compétences et à votre secteur.")}</p>
      </div>
    </section>
    <div className="fd-wrap fd-recruit-layout">
      <section className="fd-surface fd-apply">
        {state === "sent" ? <div className="fd-success" role="status"><CheckCircle2 aria-hidden="true" />
          <h2 tabIndex={-1} ref={confirmation}>{local("Application received.", "Candidature reçue.")}</h2>
          <p>{local("Our team will review your details and contact you if there’s a match.", "Notre équipe étudiera votre dossier et vous contactera si votre profil répond à nos besoins.")}</p>
          <a className="fd-button fd-button-outline" href="/">{local("Return to the website", "Retour au site")}</a>
        </div> : <form onSubmit={submit} aria-busy={state === "sending"}>
          <h2>{local("Apply to join", "Poser votre candidature")}</h2>
          <fieldset><legend>{local("Contact and location", "Coordonnées et emplacement")}</legend>
            <div className="fd-field-grid">
              <Field label={local("Full name", "Nom complet")}><input name="name" autoComplete="name" required minLength={2} maxLength={120} /></Field>
              <Field label={local("Email address", "Adresse courriel")}><input name="email" type="email" autoComplete="email" required maxLength={180} /></Field>
              <Field label={local("City", "Ville")}><input name="city" autoComplete="address-level2" required minLength={2} maxLength={100} /></Field>
              <Field label={local("Province or territory", "Province ou territoire")}><select name="province" required defaultValue=""><option value="">{local("Select a province or territory", "Sélectionner une province ou un territoire")}</option>{provinces.map(p => <option key={p}>{p}</option>)}</select></Field>
            </div>
          </fieldset>
          <fieldset><legend>{local("Services and qualifications", "Services et qualifications")}</legend>
            <Field label={local("Tell us about the work you do", "Décrivez les travaux que vous réalisez")}>
              <textarea name="experience" aria-describedby="application-summary" required minLength={10} maxLength={2000} rows={4} />
            </Field>
            <p className="fd-help" id="application-summary">{local("Include your specialties and relevant experience. Leave out licence numbers, IDs, and insurance documents.", "Précisez vos spécialités et votre expérience. N’incluez aucun numéro de permis, pièce d’identité ou document d’assurance.")}</p>
          </fieldset>
          <p className="fd-help"><a href="/privacy-policy">{local("Privacy policy", "Politique de confidentialité")}</a></p>
          {state === "error" && <p className="fd-error" role="alert">{local("We couldn’t submit your application. Check your entries or try again shortly.", "L’envoi a échoué. Vérifiez vos renseignements ou réessayez dans quelques instants.")}</p>}
          <button className="fd-button fd-button-primary" disabled={state === "sending"}>{state === "sending" ? local("Submitting…", "Envoi en cours…") : local("Submit application", "Envoyer la candidature")} <ArrowRight aria-hidden="true" /></button>
        </form>}
      </section>
      <aside className="fd-recruit-process">
        <h2>{local("What happens next", "Les prochaines étapes")}</h2>
        <ol>
          <li><MapPin aria-hidden="true" /><div><h3>{local("Service area review", "Examen du secteur")}</h3><p>{local("We check where you work and the services you offer.", "Nous vérifions votre secteur et les services que vous offrez.")}</p></div></li>
          <li><ClipboardList aria-hidden="true" /><div><h3>{local("Conversation and screening", "Entretien et présélection")}</h3><p>{local("If there’s a match, we’ll contact you for more information.", "Si votre profil correspond à nos besoins, nous vous contacterons pour en savoir plus.")}</p></div></li>
          <li><ShieldCheck aria-hidden="true" /><div><h3>{local("Qualification review", "Vérification des qualifications")}</h3><p>{local("We verify applicable qualifications before assigning work.", "Nous vérifions les qualifications requises avant d’attribuer des travaux.")}</p></div></li>
        </ol>
      </aside>
    </div>
  </main>;
}

export function RecruitmentReviewPage() {
  const { language, local } = useDesignLanguage();
  const [status, setStatus] = useState<Status>("NEW");
  const [page, setPage] = useState(0);
  const [revision, reload] = useState(0);
  const [rows, setRows] = useState<Application[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"auth" | "load" | "save" | "conflict" | "saved" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const url = "/api/admin/technician-applications";

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setRows([]);
    setHasMore(false);
    axios.get<{ records: Application[]; hasMore: boolean }>(url, {
      params: { status, page }, signal: controller.signal,
    }).then(({ data }) => {
      setRows(data.records);
      setHasMore(data.hasMore);
      setLoaded(true);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setNotice(axios.isAxiosError(error) && error.response?.status === 401 ? "auth" : "load");
    });
    return () => controller.abort();
  }, [status, page, revision]);

  async function save(event: FormEvent<HTMLFormElement>, row: Application) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setNotice(null);
    try {
      await axios.patch(url + "/" + encodeURIComponent(row.id), { ...data, version: row.version });
      setNotice("saved");
      reload(n => n + 1);
    } catch (error) {
      setNotice(axios.isAxiosError(error) && error.response?.status === 409 ? "conflict" : "save");
    } finally {
      setBusy(false);
    }
  }

  const notices = {
    auth: local("Sign in to review applications.", "Connectez-vous pour examiner les candidatures."),
    load: local("Unable to load applications.", "Impossible de charger les candidatures."),
    save: local("Unable to save the review.", "Impossible d’enregistrer l’évaluation."),
    conflict: local("This application changed. Reload before editing.", "La candidature a changé. Rechargez-la avant de la modifier."),
    saved: local("Review saved.", "Évaluation enregistrée."),
  };
  return <main className="fd-recruit fd-review" lang={language} data-no-translate>
    <Header staff />
    <div className="fd-wrap fd-review-body">
      <p className="fd-kicker"><ClipboardList aria-hidden="true" />{local("Recruitment", "Recrutement")}</p>
      <h1>{local("Technician applications", "Candidatures de techniciens")}</h1>
      <p>{local("Review applicants before verifying qualifications in technician management.", "Examinez les candidatures avant de vérifier les qualifications dans la gestion des techniciens.")}</p>
      <div className="fd-work-nav fd-review-filters" role="group" aria-label={local("Filter by status", "Filtrer par statut")}>
        {statuses.map(value => <button key={value} type="button" disabled={busy} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0); setNotice(null); }}>{local(...labels[value])}</button>)}
      </div>
      {notice && <p className={notice === "saved" ? "fd-success" : "fd-error"} role={notice === "saved" ? "status" : "alert"}>{notices[notice]} {notice === "auth" && <a href="/admin">{local("Open sign-in", "Ouvrir la connexion")}</a>} {["load", "conflict"].includes(notice) && <button className="fd-button fd-button-outline" onClick={() => { setNotice(null); reload(n => n + 1); }}>{local("Reload", "Recharger")}</button>}</p>}
      {!loaded && !notice && <p role="status">{local("Loading applications…", "Chargement des candidatures…")}</p>}
      {loaded && rows.length === 0 && <p className="fd-surface fd-no-results">{local("No applications in this status.", "Aucune candidature pour ce statut.")}</p>}
      <div className="fd-review-list">
        {rows.map(row => <article className="fd-surface fd-applicant" key={row.id + ":" + row.version}>
          <div className="fd-applicant-head">
            <div className="fd-avatar" aria-hidden="true">{row.name.trim().slice(0, 1).toUpperCase()}</div>
            <div><h2>{row.name}</h2><p><MapPin aria-hidden="true" /> {row.city}, {row.province}</p></div>
            <span className="fd-status" data-state={row.status}>{local(...labels[row.status])}</span>
          </div>
          <details className="fd-disclosure">
            <summary>{local("Open application", "Ouvrir la candidature")}</summary>
            <dl className="fd-applicant-details">
              <div><dt>{local("Email address", "Adresse courriel")}</dt><dd>{row.email}</dd></div>
              <div><dt>{local("Services and qualifications", "Services et qualifications")}</dt><dd>{row.experience}</dd></div>
            </dl>
            {row.status === "CLOSED" ? <p>{row.reviewNote}</p> : <form onSubmit={event => void save(event, row)}>
              <Field label={local("Review status", "Statut de l’évaluation")}><select name="status" defaultValue={row.status === "NEW" ? "SCREENING" : row.status}>
                {statuses.filter(value => value !== "NEW").map(value => <option key={value} value={value}>{local(...labels[value])}</option>)}
              </select></Field>
              <Field label={local("Staff review note", "Note d’évaluation")}><textarea name="note" required minLength={5} maxLength={1000} defaultValue={row.reviewNote} /></Field>
              <button className="fd-button fd-button-primary" disabled={busy}>{local("Save review", "Enregistrer l’évaluation")}</button>
            </form>}
          </details>
        </article>)}
      </div>
      {(page > 0 || hasMore) && <div className="fd-actions">
        <button className="fd-button fd-button-outline" disabled={!page || busy} onClick={() => setPage(n => n - 1)}>{local("Previous", "Précédent")}</button>
        <button className="fd-button fd-button-outline" disabled={!hasMore || busy} onClick={() => setPage(n => n + 1)}>{local("Next", "Suivant")}</button>
      </div>}
    </div>
  </main>;
}
