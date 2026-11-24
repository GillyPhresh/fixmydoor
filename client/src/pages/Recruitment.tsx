import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import "./commercial.css";

const provinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const statuses = ["NEW", "SCREENING", "INTERVIEW", "CLOSED"] as const;
type Status = typeof statuses[number];
type Application = {
  id: string; name: string; email: string; city: string; province: string;
  experience: string; status: Status; reviewNote: string; version: number;
};

export function TechnicianApplicationPage() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
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

  return <main className="cm-shell">
    <a href="/">← FixMyDoor Services</a>
    <h1>Apply to join our technician network</h1>
    <p>Postuler pour rejoindre notre réseau de techniciens</p>
    <p>Tell us where you work and what services you’re qualified to provide. Our team reviews applications before offering work.</p>
    <p>Indiquez votre région et les services que vous êtes qualifié à offrir. Notre équipe examine les candidatures avant de proposer du travail.</p>
    {state === "sent" ? <p role="status">Application received. · Candidature reçue.</p> :
      <form className="cm-panel" onSubmit={submit}>
        <label className="cm-field">Name · Nom<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
        <label className="cm-field">Email · Courriel<input name="email" type="email" autoComplete="email" required maxLength={180} /></label>
        <label className="cm-field">City · Ville<input name="city" autoComplete="address-level2" required minLength={2} maxLength={100} /></label>
        <label className="cm-field">Province or territory · Province ou territoire<select name="province" required defaultValue=""><option value="">Select · Sélectionner</option>{provinces.map(p => <option key={p}>{p}</option>)}</select></label>
        <label className="cm-field">Services, experience and qualifications · Services, expérience et qualifications
          <textarea name="experience" required minLength={10} maxLength={2000} rows={5} />
        </label>
        <p>Share a summary only. Leave out licence numbers, IDs and insurance documents. · Donnez un résumé sans numéro de permis, pièce d’identité ni document d’assurance.</p>
        {state === "error" && <p role="alert">Could not submit. Check the fields or retry later. · Vérifiez les champs ou réessayez plus tard.</p>}
        <button disabled={state === "sending"}>Submit application · Envoyer la candidature</button>
      </form>}
  </main>;
}

export function RecruitmentReviewPage() {
  const [status, setStatus] = useState<Status>("NEW");
  const [page, setPage] = useState(0);
  const [revision, reload] = useState(0);
  const [rows, setRows] = useState<Application[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
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
      setNotice(axios.isAxiosError(error) && error.response?.status === 401
        ? "Sign in to the admin dashboard to review applications."
        : "Unable to load applications. Refresh to retry.");
    });
    return () => controller.abort();
  }, [status, page, revision]);

  async function save(event: FormEvent<HTMLFormElement>, row: Application) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setNotice("");
    try {
      await axios.patch(url + "/" + encodeURIComponent(row.id), { ...data, version: row.version });
      setNotice("Review saved.");
      reload(n => n + 1);
    } catch (error) {
      setNotice(axios.isAxiosError(error) && error.response?.status === 409
        ? "This application changed. Reload before editing." : "Unable to save the review.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="cm-shell">
    <a href="/admin/commercial">← Service management</a>
    <h1>Technician applications</h1>
    <p>Review applications here. Verify qualifications and create approved profiles through the existing technician workflow.</p>
    <label className="cm-field">Status<select value={status} onChange={event => {
      const next = statuses.find(value => value === event.target.value);
      if (next) { setStatus(next); setPage(0); setNotice(""); }
    }}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
    {notice && <p role="status">{notice}</p>}
    {loaded && rows.length === 0 && <p>No applications in this status.</p>}
    {rows.map(row => <article className="cm-panel" key={row.id + ":" + row.version}>
      <h2>{row.name}</h2><p>{row.city}, {row.province} · {row.email}</p><p>{row.experience}</p>
      {row.status === "CLOSED" ? <p>{row.reviewNote}</p> : <form onSubmit={event => void save(event, row)}>
        <label className="cm-field">Next status<select name="status" defaultValue={row.status === "NEW" ? "SCREENING" : row.status}>
          {statuses.filter(value => value !== "NEW").map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label className="cm-field">Staff review note<textarea name="note" required minLength={5} maxLength={1000} defaultValue={row.reviewNote} /></label>
        <button disabled={busy}>Save review</button>
      </form>}
    </article>)}
    <button disabled={!page || busy} onClick={() => setPage(n => n - 1)}>Previous</button>{" "}
    <button disabled={!hasMore || busy} onClick={() => setPage(n => n + 1)}>Next</button>
  </main>;
}
