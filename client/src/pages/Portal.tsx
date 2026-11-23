import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import "./portal.css";

type Language = "EN" | "FR";
type Kind = "CUSTOMER" | "TECHNICIAN" | "ORGANIZATION";
type Account = { id: string; name: string; email: string; kind: Kind; organizations: { id: string; name: string; role: string }[] };
type Property = { id: string; label: string; type: string; address: string; city: string; province: string; postalCode: string; country: string };
type Booking = { id: string; visitMode: string; repairType: string; status: string; preferredDate?: string | null; appointmentTime?: string | null; createdAt: string; propertyId?: string | null };
type QuoteLine = { id: string; kind: string; description: string; quantity: number; unitCents: number };
type Quote = { id: string; description: string; status: string; currency: string; expiresOn: string; subtotalCents: number; taxLabel: string; taxCents: number; totalCents: number; version: number; lines: QuoteLine[]; job?: { id: string; status: string } | null };
type InvoicePayment = { id: string; cents: number; method: string; reference: string; createdAt: string };
type Invoice = { id: string; number: string; description: string; totalCents: number; paidCents: number; balanceCents: number; currency: string; status: string; dueOn: string; onlinePaymentAvailable: boolean; payments: InvoicePayment[] };
type Job = { id: string; reference?: string; category: string; status: string; startsAt?: string | null; endsAt?: string | null; customerSummary?: string; photos: { id: string; kind: string }[]; technicianResponse?: string; version?: number; location?: string; description?: string; customer?: { name: string; phone: string }; property?: { address: string; city: string; province: string } | null };
type Membership = { plan: string; status: string; billingPeriod: string; startsOn?: string | null; renewsOn?: string | null; includedBenefits: string };
type Dashboard = {
  kind: Kind;
  scope?: { customerId: string; organizationId: string | null; role: string };
  customer?: { id: string; name: string; email?: string; phone: string; preferredContactMethod?: string; category?: string; status?: string };
  profile?: { id: string; name: string; phone: string; city: string; province: string; experience: string; available: boolean };
  properties?: Property[];
  bookings?: Booking[];
  quotations?: Quote[];
  invoices?: Invoice[];
  jobs?: Job[];
  agreements?: { id: string; propertyId: string; scope: string; startOn: string; endOn: string; cents: number; status: string }[];
  communicationPreferences?: Record<string, { granted: boolean; capturedAt: string }>;
  memberships?: { id: string; name: string; role: string }[];
  membership?: Membership | null;
};

const fr: Record<string, string> = {
  "Payment history": "Historique des paiements", Cash: "Espèces", Cheque: "Chèque", "Bank transfer": "Virement bancaire", "Customer portal": "Portail client", "Technician portal": "Portail technicien", "Business portal": "Portail entreprise", "Sign in": "Connexion", "Email address": "Adresse courriel", Password: "Mot de passe", "Full name": "Nom complet", "Create account": "Créer un compte", "Activate your access": "Activer votre accès", "Return to sign in": "Retour à la connexion", "Sign out": "Déconnexion", "English": "English", "Français": "Français", "Welcome back": "Bon retour", "Your services, organized": "Vos services, organisés", "Active services": "Services actifs", "Quotes to review": "Devis à examiner", "Balance due": "Solde dû", Properties: "Propriétés", "Service requests": "Demandes de service", "Request a service": "Demander un service", "Service type": "Type de service", "Visit type": "Type de visite", "On-site service": "Service sur place", "Remote consultation": "Consultation à distance", "Preferred date": "Date souhaitée", "Describe the work": "Décrivez le travail", Submit: "Envoyer", "Your request is in your portal.": "Votre demande est dans votre portail.", Quotations: "Devis", Accept: "Accepter", Decline: "Refuser", Invoices: "Factures", "Online payment is unavailable for this invoice. Contact FixMyDoor to arrange payment.": "Le paiement en ligne n’est pas disponible. Communiquez avec FixMyDoor pour organiser le paiement.", "Service history": "Historique des services", "Communication preferences": "Préférences de communication", "Promotional messages are optional and currently disabled by the business.": "Les communications promotionnelles sont facultatives et désactivées par l’entreprise.", "Save preferences": "Enregistrer les préférences", "Save profile": "Enregistrer le profil", Phone: "Téléphone", "Preferred contact": "Contact préféré", "Choose a property": "Choisir une propriété", "No properties are linked to this account yet.": "Aucune propriété n’est liée à ce compte.", "Contact FixMyDoor to add a property before requesting service.": "Communiquez avec FixMyDoor pour ajouter une propriété avant de demander un service.", "Assigned work": "Travaux assignés", Availability: "Disponibilité", Available: "Disponible", Unavailable: "Indisponible", "Membership foundation": "Adhésion", "No billing is active. Membership plans are records only.": "Aucune facturation n’est active. Les adhésions sont uniquement des dossiers.", "Accept assignment": "Accepter le mandat", "Decline assignment": "Refuser le mandat", "Start work": "Commencer le travail", "Submit completion report": "Envoyer le rapport de fin", "Work performed": "Travaux effectués", Materials: "Matériaux", "Customer summary": "Résumé client", "Labour minutes": "Minutes de travail", "Upload work photo": "Téléverser une photo du travail", "Before photo": "Photo avant", "After photo": "Photo après", "No assigned work right now.": "Aucun travail assigné pour le moment.", "No requests yet.": "Aucune demande pour le moment.", "No quotations to display.": "Aucun devis à afficher.", "No invoices to display.": "Aucune facture à afficher.", "Request additional work": "Demander un autre service", "Update organization profile": "Mettre à jour le profil de l’entreprise", "Organization": "Entreprise", "Membership role": "Rôle", "Upcoming appointment": "Prochain rendez-vous", "Completed": "Terminé", "Pending": "En attente", "In progress": "En cours", "Contact email changes require staff verification.": "Le changement de courriel nécessite une vérification par le personnel.", "Forgot password?": "Mot de passe oublié?", "Recover account": "Récupérer le compte", "Send recovery instructions": "Envoyer les instructions de récupération", "Set a new password": "Définir un nouveau mot de passe", "Complete password reset": "Terminer la réinitialisation", "Recovery link": "Lien de récupération", "Enter the email address linked to your portal account. If eligible, we will provide a recovery link.": "Saisissez l’adresse courriel associée à votre compte. Si celui-ci est admissible, un lien de récupération vous sera fourni.", "Use the verified recovery link sent for your portal account.": "Utilisez le lien de récupération vérifié envoyé pour votre compte.",
};
const translate = (language: Language, value: string) => language === "FR" ? fr[value] ?? value : value;
const money = (cents: number, currency = "CAD") => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
const api = async <T,>(path: string, method = "GET", data?: unknown): Promise<T> => (await axios.request<T>({ url: path, method, data, withCredentials: true, headers: { "Cache-Control": "no-store" } })).data;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="portal-field"><span>{label}</span>{children}</label>;
}
function Badge({ children }: { children: ReactNode }) {
  const value = String(children || "");
  const state = /complete|accepted|active|approved/i.test(value) ? "good" : /declin|cancel|suspend|overdue|reject/i.test(value) ? "bad" : "warm";
  return <span className={`portal-badge ${state}`}>{value.replaceAll("_", " ")}</span>;
}
function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="portal-card"><div className="portal-card-head"><h2>{title}</h2>{action}</div>{children}</section>;
}

export default function Portal() {
  const [location, setLocation] = useLocation();
  const [language, setLanguage] = useState<Language>("EN");
  const [account, setAccount] = useState<Account | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryUrl, setRecoveryUrl] = useState("");
  const [invitationAccepted, setInvitationAccepted] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<Record<string, { workPerformed: string; materials: string; customerSummary: string; labourMinutes: number }>>({});
  const t = (value: string) => translate(language, value);

  const loadDashboard = useCallback(async (current: Account, orgId = "") => {
    try {
      const suffix = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";
      const result = await api<Dashboard>(`/api/portal/dashboard${suffix}`);
      setDashboard(result);
    } catch {
      setDashboard(null);
      setError("Your portal data could not be loaded. Please refresh or sign in again.");
    }
    void current;
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const current = await api<Account>("/api/portal/me");
      setAccount(current);
      const preferredOrg = current.kind === "ORGANIZATION" ? current.organizations[0]?.id || "" : "";
      setOrganizationId(preferredOrg);
      await loadDashboard(current, preferredOrg);
    } catch {
      setAccount(null);
      setDashboard(null);
    }
  }, [loadDashboard]);

  useEffect(() => {
    if (location === "/portal/invite" || location === "/portal/recover") {
      const token = window.location.hash.slice(1);
      window.history.replaceState(null, "", window.location.pathname);
      if (location === "/portal/invite") setInvitationToken(token);
      else setRecoveryToken(token);
      return;
    }
    void hydrate();
  }, [location, hydrate]);

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/portal/auth/login", "POST", { email: String(form.get("email") || ""), password: String(form.get("password") || "") });
      await hydrate(); setLocation("/portal");
    } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Sign-in failed." : "Sign-in failed."); }
    finally { setBusy(false); }
  };

  const onAcceptInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("confirmPassword") || "")) { setError("The passwords do not match."); setBusy(false); return; }
    try {
      const result = await api<{ email: string }>("/api/portal/invitations/accept", "POST", { token: invitationToken, name: String(form.get("name") || ""), password });
      setInviteEmail(result.email); setInvitationAccepted(true); setInvitationToken(""); setNotice("Access activated. Sign in with the email address that received the invitation.");
    } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Invitation could not be activated." : "Invitation could not be activated."); }
    finally { setBusy(false); }
  };

  const onRequestRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setNotice(""); setRecoveryUrl(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ accepted: boolean; recoveryUrl?: string }>("/api/portal/auth/recovery", "POST", { email: String(form.get("email") || "") });
      setRecoveryUrl(result.recoveryUrl || "");
      setNotice("If this account is eligible, recovery instructions will be provided.");
    } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Recovery could not be started." : "Recovery could not be started."); }
    finally { setBusy(false); }
  };

  const onCompleteRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("confirmPassword") || "")) { setError("The passwords do not match."); setBusy(false); return; }
    try {
      await api("/api/portal/auth/recovery/complete", "POST", { token: recoveryToken, password });
      setRecoveryToken(""); setLocation("/portal/login"); setNotice("Your password was updated. Sign in with your new password.");
    } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "The recovery link is invalid or expired." : "The recovery link is invalid or expired."); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    await api("/api/portal/auth/logout", "POST").catch(() => undefined);
    setAccount(null); setDashboard(null); setLocation("/portal/login");
  };
  const switchOrganization = async (id: string) => {
    setOrganizationId(id); setError("");
    if (account) await loadDashboard(account, id);
  };
  const mutate = async (path: string, data: unknown, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await api(path, "POST", data); setNotice(message); if (account) await loadDashboard(account, organizationId); }
    catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "The action failed." : "The action failed."); }
    finally { setBusy(false); }
  };

  const activeCount = useMemo(() => dashboard?.jobs?.filter(job => !["COMPLETED", "CANCELLED"].includes(job.status)).length ?? 0, [dashboard]);
  const balance = useMemo(() => dashboard?.invoices?.reduce((sum, item) => sum + item.balanceCents, 0) ?? 0, [dashboard]);

  if (!account) {
    const inviteMode = location === "/portal/invite";
    const recoveryMode = location === "/portal/recover";
    return <main className="portal-page" lang={language === "FR" ? "fr" : "en"}>
      <div className="portal-topline"><a className="portal-brand" href="/">FIXMYDOOR <span>SERVICES</span></a><button className="portal-quiet" onClick={() => setLanguage(language === "EN" ? "FR" : "EN")}>{t(language === "EN" ? "Français" : "English")}</button></div>
      <section className="portal-auth-card">
        <div className="portal-eyebrow">FIXMYDOOR SERVICES</div>
        <h1>{inviteMode ? t("Activate your access") : recoveryMode ? recoveryToken ? t("Set a new password") : t("Recover account") : t("Your services, organized")}</h1>
        <p>{inviteMode ? "Create a secure password to activate your staff-issued invitation." : recoveryMode ? recoveryToken ? t("Use the verified recovery link sent for your portal account.") : t("Enter the email address linked to your portal account. If eligible, we will provide a recovery link.") : "Access service requests, quotations, appointments and property history in one place."}</p>
        {notice && <div className="portal-notice">{notice}</div>}{error && <div className="portal-error" role="alert">{error}</div>}
        {inviteMode && !invitationToken && !invitationAccepted ? <p className="portal-error">This invitation link is missing or has expired. Ask FixMyDoor staff for a new invitation.</p> : null}
        {inviteMode && invitationToken && !invitationAccepted ? <form className="portal-form" onSubmit={onAcceptInvite}>
          <Field label={t("Full name")}><input name="name" required maxLength={120} autoComplete="name" /></Field>
          <Field label={t("Password")}><input name="password" required type="password" minLength={12} maxLength={100} autoComplete="new-password" /></Field>
          <small>Use at least 12 characters with uppercase, lowercase, number and symbol.</small>
          <Field label="Confirm password"><input name="confirmPassword" required type="password" minLength={12} maxLength={100} autoComplete="new-password" /></Field>
          <button className="portal-primary" disabled={busy}>{busy ? "Working…" : t("Create account")}</button>
        </form> : null}
        {recoveryMode && !recoveryToken ? <form className="portal-form" onSubmit={onRequestRecovery}>
          <Field label={t("Email address")}><input name="email" type="email" required autoComplete="username" /></Field>
          <button className="portal-primary" disabled={busy}>{busy ? "Working…" : t("Send recovery instructions")}</button>
          {recoveryUrl && <a href={recoveryUrl}>{t("Recovery link")}</a>}
        </form> : null}
        {recoveryMode && recoveryToken ? <form className="portal-form" onSubmit={onCompleteRecovery}>
          <Field label={t("Password")}><input name="password" required type="password" minLength={12} maxLength={100} autoComplete="new-password" /></Field>
          <small>Use at least 12 characters with uppercase, lowercase, number and symbol.</small>
          <Field label="Confirm password"><input name="confirmPassword" required type="password" minLength={12} maxLength={100} autoComplete="new-password" /></Field>
          <button className="portal-primary" disabled={busy}>{busy ? "Working…" : t("Complete password reset")}</button>
        </form> : null}
        {!inviteMode && !recoveryMode || invitationAccepted ? <form className="portal-form" onSubmit={onLogin}>
          <Field label={t("Email address")}><input name="email" type="email" required autoComplete="username" defaultValue={inviteEmail} /></Field>
          <Field label={t("Password")}><input name="password" type="password" required maxLength={100} autoComplete="current-password" /></Field>
          <button className="portal-primary" disabled={busy}>{busy ? "Working…" : t("Sign in")}</button>
          <a href="/portal/recover">{t("Forgot password?")}</a>
        </form> : null}
        {recoveryMode ? <a className="portal-auth-foot" href="/portal/login">{t("Return to sign in")}</a> : <div className="portal-auth-foot">Portal access is issued by FixMyDoor staff. Booking references alone cannot create an account.</div>}
      </section>
    </main>;
  }

  if (!dashboard) return <main className="portal-page"><div className="portal-loading">{error || "Loading your secure portal…"}<button className="portal-secondary" onClick={() => void hydrate()}>Retry</button></div></main>;
  const technician = dashboard.kind === "TECHNICIAN";
  const properties = dashboard.properties || [];
  const role = dashboard.scope?.role || "CUSTOMER";
  const canRequest = !technician && role !== "BILLING";

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const response = await api<{ trackingUrl: string }>("/api/portal/requests", "POST", { propertyId: String(form.get("propertyId") || ""), service: String(form.get("service") || ""), visitMode: String(form.get("visitMode") || "ONSITE"), preferredDate: String(form.get("preferredDate") || "") || undefined, message: String(form.get("message") || ""), ...(organizationId ? { organizationId } : {}) }).catch(e => { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Request could not be saved." : "Request could not be saved."); return null; });
    if (response) { setError(""); setNotice(`Request saved. Track it at ${response.trackingUrl}`); formElement.reset(); if (account) await loadDashboard(account, organizationId); }
  };
  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await mutate("/api/portal/profile", { name: form.get("name"), phone: form.get("phone"), preferredContactMethod: form.get("preferredContactMethod") }, "Profile saved.");
  };
  const savePreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try { await api("/api/portal/communication-preferences", "PUT", { emailMarketing: form.get("emailMarketing") === "on", smsMarketing: form.get("smsMarketing") === "on" }); setNotice("Your communication preference was saved."); if (account) await loadDashboard(account, organizationId); }
    catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Preferences could not be saved." : "Preferences could not be saved."); }
    finally { setBusy(false); }
  };

  return <main className="portal-page" lang={language === "FR" ? "fr" : "en"}>
    <header className="portal-header">
      <a className="portal-brand" href="/">FIXMYDOOR <span>SERVICES</span></a>
      <div className="portal-header-actions">
        {account.organizations.length > 0 && <label className="portal-org-select"><span>{t("Organization")}</span><select value={organizationId} onChange={event => void switchOrganization(event.target.value)}>{account.kind === "CUSTOMER" && <option value="">Personal account</option>}{account.organizations.map(org => <option key={org.id} value={org.id}>{org.name} · {t(org.role)}</option>)}</select></label>}
        <button className="portal-quiet" onClick={() => setLanguage(language === "EN" ? "FR" : "EN")}>{t(language === "EN" ? "Français" : "English")}</button>
        <button className="portal-quiet" onClick={() => void logout()}>{t("Sign out")}</button>
      </div>
    </header>
    <section className="portal-hero">
      <div><div className="portal-eyebrow">{technician ? t("Technician portal") : account.kind === "ORGANIZATION" || organizationId ? t("Business portal") : t("Customer portal")}</div><h1>{t("Welcome back")}, {technician ? dashboard.profile?.name : dashboard.customer?.name || account.name}</h1><p>{technician ? "Your approved assignments, availability and work reports." : t("Your services, organized")}</p></div>
      <div className="portal-hero-mark">FM<span>D</span></div>
    </section>
    {notice && <div className="portal-notice" role="status">{notice}</div>}{error && <div className="portal-error" role="alert">{error}</div>}

    {technician ? <>
      <div className="portal-metrics"><div><span>{t("Assigned work")}</span><strong>{activeCount}</strong></div><div><span>{t("Availability")}</span><strong className={dashboard.profile?.available ? "portal-green" : "portal-muted"}>{dashboard.profile?.available ? t("Available") : t("Unavailable")}</strong></div><div><span>{t("Membership foundation")}</span><strong>{dashboard.membership?.plan || "—"}</strong></div></div>
      <div className="portal-grid">
        <Card title={t("Technician portal")}>
          <form className="portal-form" onSubmit={async event => { event.preventDefault(); const f = new FormData(event.currentTarget); setBusy(true); try { await api("/api/portal/technician/profile", "PATCH", { phone: f.get("phone"), city: f.get("city"), province: f.get("province"), experience: f.get("experience"), available: f.get("available") === "on" }); setNotice("Technician profile saved."); if (account) await loadDashboard(account); } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Profile could not be saved." : "Profile could not be saved."); } finally { setBusy(false); } }}>
            <Field label={t("Phone")}><input name="phone" required defaultValue={dashboard.profile?.phone} /></Field><Field label="City"><input name="city" required defaultValue={dashboard.profile?.city} /></Field><Field label="Province"><input name="province" required defaultValue={dashboard.profile?.province} /></Field><Field label="Skills and experience"><textarea name="experience" maxLength={2000} defaultValue={dashboard.profile?.experience} /></Field><label className="portal-check"><input name="available" type="checkbox" defaultChecked={dashboard.profile?.available} />{t("Available")}</label><button className="portal-secondary" disabled={busy}>{t("Save profile")}</button>
          </form>
          <div className="portal-membership"><h3>{t("Membership foundation")}</h3>{dashboard.membership ? <><strong>{dashboard.membership.plan}</strong><p><Badge>{dashboard.membership.status}</Badge> · {dashboard.membership.billingPeriod}</p><p>{safeBenefits(dashboard.membership.includedBenefits).join(" · ")}</p></> : <p>{t("No billing is active. Membership plans are records only.")}</p>}</div>
        </Card>
        <Card title={t("Assigned work")}>
          {(dashboard.jobs || []).length === 0 ? <p className="portal-empty">{t("No assigned work right now.")}</p> : <div className="portal-stack">{dashboard.jobs?.map(job => <article className="portal-job" key={job.id}>
            <div className="portal-card-head"><div><div className="portal-eyebrow">{job.reference || job.category}</div><h3>{job.description || job.category}</h3></div><Badge>{job.status}</Badge></div>
            <p>{job.property?.address || job.location}{job.property?.city ? ` · ${job.property.city}, ${job.property.province}` : ""}</p><p>{job.customer?.name} · {job.customer?.phone}</p>
            {job.startsAt && <p>{t("Upcoming appointment")}: {new Date(job.startsAt).toLocaleString()}</p>}
            {job.status === "ASSIGNED" && job.technicianResponse !== "ACCEPTED" && <div className="portal-actions"><button className="portal-primary" disabled={busy} onClick={() => void mutate(`/api/portal/technician/jobs/${job.id}/response`, { response: "ACCEPTED", version: job.version }, "Assignment accepted.")}>{t("Accept assignment")}</button><button className="portal-secondary" disabled={busy} onClick={() => void mutate(`/api/portal/technician/jobs/${job.id}/response`, { response: "DECLINED", version: job.version }, "Assignment declined and returned to dispatch.")}>{t("Decline assignment")}</button></div>}
            {job.status === "SCHEDULED" && job.technicianResponse !== "ACCEPTED" && <button className="portal-primary" disabled={busy} onClick={() => void mutate(`/api/portal/technician/jobs/${job.id}/response`, { response: "ACCEPTED", version: job.version }, "Assignment accepted.")}>{t("Accept assignment")}</button>}
            {job.status === "SCHEDULED" && job.technicianResponse === "ACCEPTED" && <button className="portal-primary" disabled={busy} onClick={() => void mutate(`/api/portal/technician/jobs/${job.id}/start`, { version: job.version }, "Work started.")}>{t("Start work")}</button>}
            {job.status === "IN_PROGRESS" && <form className="portal-form" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); void mutate(`/api/portal/technician/jobs/${job.id}/complete`, { version: job.version, workPerformed: f.get("workPerformed"), materials: f.get("materials"), customerSummary: f.get("customerSummary"), labourMinutes: Number(f.get("labourMinutes") || 0) }, "Completion report submitted for staff review."); }}>
              <Field label={t("Work performed")}><textarea name="workPerformed" required minLength={5} maxLength={4000} /></Field><Field label={t("Materials")}><textarea name="materials" maxLength={2000} /></Field><Field label={t("Customer summary")}><textarea name="customerSummary" required minLength={5} maxLength={2000} /></Field><Field label={t("Labour minutes")}><input name="labourMinutes" type="number" min={0} max={100000} defaultValue={0} /></Field><button className="portal-primary" disabled={busy}>{t("Submit completion report")}</button>
            </form>}
            {(job.status === "SCHEDULED" || job.status === "IN_PROGRESS") && job.technicianResponse === "ACCEPTED" && <Field label={t("Upload work photo")}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 1_800_000) { setError("Choose an image under 1.8 MB."); return; } const reader = new FileReader(); reader.onload = () => { const data = String(reader.result || ""); void mutate(`/api/portal/jobs/${job.id}/photos`, { kind: job.status === "SCHEDULED" ? "BEFORE" : "AFTER", image: data }, "Work photo uploaded securely."); }; reader.readAsDataURL(file); }} /></Field>}
            {job.photos.map(photo => <a key={photo.id} className="portal-photo" href={`/api/portal/jobs/${job.id}/photos/${photo.id}`} target="_blank" rel="noreferrer">{t(photo.kind === "BEFORE" ? "Before photo" : "After photo")}</a>)}
          </article>)}</div>}
        </Card>
      </div>
    </> : <>
      <div className="portal-metrics"><div><span>{t("Active services")}</span><strong>{activeCount}</strong></div><div><span>{t("Quotes to review")}</span><strong>{dashboard.quotations?.filter(q => q.status === "SENT").length ?? 0}</strong></div><div><span>{t("Balance due")}</span><strong>{money(balance)}</strong></div><div><span>{t("Properties")}</span><strong>{properties.length}</strong></div></div>
      <div className="portal-grid">
        <Card title={t("Request a service")}>
          {properties.length === 0 ? <p className="portal-empty">{t("No properties are linked to this account yet.")} {t("Contact FixMyDoor to add a property before requesting service.")}</p> : canRequest ? <form className="portal-form" onSubmit={submitRequest}>
            <Field label={t("Choose a property")}><select name="propertyId" required defaultValue=""><option value="" disabled>{t("Choose a property")}</option>{properties.map(property => <option key={property.id} value={property.id}>{property.label} · {property.address}</option>)}</select></Field>
            <Field label={t("Service type")}><input name="service" required minLength={2} maxLength={160} list="portal-services" placeholder="e.g. Door adjustment" /><datalist id="portal-services"><option>Door repair</option><option>Furniture assembly</option><option>Property maintenance</option><option>Remote consultation</option></datalist></Field>
            <Field label={t("Visit type")}><select name="visitMode"><option value="ONSITE">{t("On-site service")}</option><option value="REMOTE">{t("Remote consultation")}</option></select></Field>
            <Field label={t("Preferred date")}><input name="preferredDate" type="date" min={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label={t("Describe the work")}><textarea name="message" maxLength={5000} /></Field>
            <button className="portal-primary" disabled={busy}>{t("Submit")}</button>
          </form> : <p className="portal-empty">This account has billing-only access. Ask an organization administrator to submit requests.</p>}
        </Card>
        <Card title={t("Service requests")}>
          {(dashboard.bookings || []).length ? <div className="portal-stack">{dashboard.bookings?.map(booking => <article className="portal-list-row" key={booking.id}><div><strong>{booking.repairType}</strong><small>{new Date(booking.createdAt).toLocaleDateString()} · {booking.visitMode === "REMOTE" ? t("Remote consultation") : t("On-site service")}{booking.preferredDate ? ` · ${booking.preferredDate}` : ""}</small></div><Badge>{booking.status}</Badge></article>)}</div> : <p className="portal-empty">{t("No requests yet.")}</p>}
        </Card>
        <Card title={t("Quotations")}>
          {(dashboard.quotations || []).length ? <div className="portal-stack">{dashboard.quotations?.map(quote => <article className="portal-job" key={quote.id}><div className="portal-card-head"><h3>{quote.description}</h3><Badge>{quote.status}</Badge></div><p>Valid through {quote.expiresOn} · {money(quote.totalCents, quote.currency)}</p><ul className="portal-lines">{quote.lines.map(line => <li key={line.id}>{line.description} · {line.quantity} × {money(line.unitCents, quote.currency)}</li>)}</ul>{quote.status === "SENT" && <div className="portal-actions"><button className="portal-primary" disabled={busy} onClick={() => void mutate("/api/portal/quotations/" + quote.id + "/decision", { decision: "ACCEPTED", version: quote.version, ...(organizationId ? { organizationId } : {}) }, "Quotation accepted.")}>{t("Accept")}</button><button className="portal-secondary" disabled={busy} onClick={() => void mutate("/api/portal/quotations/" + quote.id + "/decision", { decision: "DECLINED", version: quote.version, ...(organizationId ? { organizationId } : {}) }, "Quotation declined.")}>{t("Decline")}</button></div>}</article>)}</div> : <p className="portal-empty">{t("No quotations to display.")}</p>}
        </Card>
        <Card title={t("Invoices")}>
          {(dashboard.invoices || []).length ? <div className="portal-stack">{dashboard.invoices?.map(invoice => <article className="portal-list-row" key={invoice.id}><div><strong>{invoice.number} · {invoice.description}</strong><small>Due {invoice.dueOn} · {t("Balance due")}: {money(invoice.balanceCents, invoice.currency)}</small><small>{t("Online payment is unavailable for this invoice. Contact FixMyDoor to arrange payment.")}</small>
              {invoice.payments?.length > 0 && <details>
                <summary>{t("Payment history")}</summary>
                <ul>{invoice.payments.map(payment => <li key={payment.id}>
                  <time dateTime={payment.createdAt}>{payment.createdAt.slice(0, 10)}</time>
                  {" · "}{money(payment.cents, invoice.currency)}
                  {" · "}{t(payment.method === "BANK_TRANSFER" ? "Bank transfer" : payment.method === "CHEQUE" ? "Cheque" : "Cash")}{" · "}{payment.reference}
                </li>)}</ul>
              </details>}</div><Badge>{invoice.status}</Badge></article>)}</div> : <p className="portal-empty">{t("No invoices to display.")}</p>}
        </Card>
        <Card title={t("Service history")}>
          {(dashboard.jobs || []).length ? <div className="portal-stack">{dashboard.jobs?.map(job => <article className="portal-list-row" key={job.id}><div><strong>{job.reference || job.category}</strong><small>{job.category} · {job.startsAt ? new Date(job.startsAt).toLocaleString() : ""}</small>{job.customerSummary && <small>{job.customerSummary}</small>}{job.photos.map(photo => <a className="portal-photo" key={photo.id} href={`/api/portal/jobs/${job.id}/photos/${photo.id}${organizationId ? `?organizationId=${organizationId}` : ""}`} target="_blank" rel="noreferrer">{photo.kind} photo</a>)}</div><Badge>{job.status}</Badge></article>)}</div> : <p className="portal-empty">{t("No requests yet.")}</p>}
        </Card>
        <Card title={t("Properties")}>
          {properties.map(property => <article className="portal-list-row" key={property.id}><div><strong>{property.label}</strong><small>{property.type} · {property.address}, {property.city}, {property.province} {property.postalCode}</small></div><Badge>{property.country}</Badge></article>)}
          {dashboard.agreements?.map(agreement => <article className="portal-list-row" key={agreement.id}><div><strong>{t("Maintenance agreement")}</strong><small>{agreement.scope} · {agreement.startOn} – {agreement.endOn}</small></div><Badge>{agreement.status}</Badge></article>)}
        </Card>
        {dashboard.customer?.category === "Individual" && <Card title={t("Your profile")}>
          <form className="portal-form" onSubmit={submitProfile}><Field label={t("Full name")}><input name="name" required defaultValue={dashboard.customer.name} /></Field><Field label={t("Email address")}><input value={dashboard.customer.email || account.email} readOnly /></Field><p className="portal-help">{t("Contact email changes require staff verification.")}</p><Field label={t("Phone")}><input name="phone" defaultValue={dashboard.customer.phone} /></Field><Field label={t("Preferred contact")}><select name="preferredContactMethod" defaultValue={dashboard.customer.preferredContactMethod || "Email"}><option>Email</option><option>Phone</option><option>SMS</option><option>Email or phone</option></select></Field><button className="portal-secondary" disabled={busy}>{t("Save profile")}</button></form>
          <form className="portal-preferences" onSubmit={savePreferences}><h3>{t("Communication preferences")}</h3><p>{t("Promotional messages are optional and currently disabled by the business.")}</p><label className="portal-check"><input type="checkbox" name="emailMarketing" defaultChecked={dashboard.communicationPreferences?.EMAIL?.granted || false} />Email promotions</label><label className="portal-check"><input type="checkbox" name="smsMarketing" defaultChecked={dashboard.communicationPreferences?.SMS?.granted || false} />SMS promotions</label><button className="portal-secondary" disabled={busy}>{t("Save preferences")}</button></form>
        </Card>}
        {dashboard.customer?.status && <Card title={t("Update organization profile")}>
          <p>{dashboard.customer.name} · {role.replaceAll("_", " ")}</p>
          {role === "ORG_ADMIN" && <form className="portal-form" onSubmit={async event => { event.preventDefault(); const f = new FormData(event.currentTarget); setBusy(true); try { await api(`/api/portal/organizations/${organizationId}`, "PATCH", { name: f.get("name"), email: f.get("email"), phone: f.get("phone") }); setNotice("Organization profile saved."); if (account) await loadDashboard(account, organizationId); } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Organization could not be saved." : "Organization could not be saved."); } finally { setBusy(false); } }}><Field label="Organization name"><input name="name" defaultValue={dashboard.customer.name} required /></Field><Field label={t("Email address")}><input name="email" type="email" defaultValue={dashboard.customer.email} required /></Field><Field label={t("Phone")}><input name="phone" defaultValue={dashboard.customer.phone} /></Field><button className="portal-secondary">{t("Save profile")}</button></form>}
        </Card>}
      </div>
    </>}
    <footer className="portal-footer">FixMyDoor Services · Montréal, Québec · <a href="/privacy-policy">Privacy</a> · <a href="/terms-and-conditions">Terms</a></footer>
  </main>;
}

function safeBenefits(value: string) {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; }
  catch { return []; }
}
