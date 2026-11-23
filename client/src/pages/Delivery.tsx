import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import type { Technician, Job, JobEvent, ServiceGrant } from "@prisma/client";
import { categories, nextStates } from "../../../shared/delivery";

const api = axios.create({ baseURL: "/api/admin/commercial/delivery" });
type Tech = Technician & {
  grants: ServiceGrant[];
  jobs: Pick<Job, "id" | "description" | "status">[];
};
type Order = Job & {
  photos: { id: string; kind: string }[];
  history: JobEvent[];
  quote: {
    customerId: string;
    bookingId: string | null;
    propertyId: string | null;
  };
};
type T = (en: string, fr: string) => string;
function fields(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(
    Array.from(new FormData(e.currentTarget), ([k, v]) => [k, String(v)])
  );
}
function Input({
  name,
  label,
  value = "",
  type = "text",
  optional = false,
}: {
  name: string;
  label: string;
  value?: string;
  type?: string;
  optional?: boolean;
}) {
  return (
    <label className="cm-field">
      {label}
      <input
        name={name}
        defaultValue={value}
        type={type}
        required={!optional}
        min={type === "number" ? 0 : undefined}
      />
    </label>
  );
}
function Category() {
  return (
    <select name="category" aria-label="Service category">
      {categories.map(c => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}
function useList<R>(path: string, rev: number) {
  const [rows, set] = useState<R[]>([]),
    [error, fail] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    fail(false);
    set([]);
    api
      .get<R[]>(path, { signal: ctl.signal })
      .then(r => set(r.data))
      .catch(() => {
        if (!ctl.signal.aborted) fail(true);
      });
    return () => ctl.abort();
  }, [path, rev]);
  return { rows, error };
}
export default function Delivery({ quoteId, t }: { quoteId: string; t: T }) {
  const [rev, refresh] = useState(0),
    [error, fail] = useState(""),
    [busy, lock] = useState(false),
    [techId, selectTech] = useState(""),
    [jobId, selectJob] = useState(""),
    [filter, setFilter] = useState(""),
    [unassigned, onlyOpen] = useState(false);
  const techs = useList<Tech>("/technicians?" + filter, rev),
    jobs = useList<Order>("/jobs", rev);
  const tech = techs.rows.find(x => x.id === techId),
    job =
      jobs.rows.find(x => x.id === jobId) ||
      jobs.rows.find(x => quoteId && x.quoteId === quoteId);
  async function save(fn: () => Promise<unknown>) {
    if (busy) return;
    lock(true);
    fail("");
    try {
      await fn();
      refresh(x => x + 1);
    } catch (e) {
      fail(
        axios.isAxiosError(e) && typeof e.response?.data?.error === "string"
          ? e.response.data.error
          : t("Could not save.", "Échec de l’enregistrement.")
      );
    } finally {
      lock(false);
    }
  }
  return (
    <fieldset disabled={busy}>
      <h2>{t("Service delivery", "Interventions")}</h2>
      {(error || techs.error || jobs.error) && (
        <p role="alert">
          {error || t("Could not load records.", "Chargement impossible.")}{" "}
          <button onClick={() => refresh(x => x + 1)}>
            {t("Retry", "Réessayer")}
          </button>
        </p>
      )}
      <h3>{t("Technicians", "Techniciens")}</h3>
      <form
        onSubmit={e => {
          const f = fields(e);
          setFilter(
            new URLSearchParams(
              Object.entries(f).filter(([, v]) => v)
            ).toString()
          );
        }}
      >
        <Input name="name" label={t("Name", "Nom")} optional />
        <Input
          name="city"
          label={t("Coverage city", "Ville desservie")}
          optional
        />
        <select aria-label="Category filter" name="category">
          <option value="">{t("All services", "Tous les services")}</option>
          {categories.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Availability" name="available">
          <option value="">
            {t("Any availability", "Toute disponibilité")}
          </option>
          <option value="true">{t("Available", "Disponible")}</option>
          <option value="false">{t("Unavailable", "Indisponible")}</option>
        </select>
        <button>{t("Search", "Rechercher")}</button>
      </form>
      <select
        aria-label="Technician"
        value={tech?.id || ""}
        onChange={e => selectTech(e.target.value)}
      >
        <option value="">{t("New technician", "Nouveau technicien")}</option>
        {techs.rows.map(p => (
          <option value={p.id} key={p.id}>
            {p.name} · {p.status}
          </option>
        ))}
      </select>
      <form
        key={tech?.id || "new"}
        onSubmit={e => {
          const f = fields(e);
          void save(async () => {
            const data = { ...f, available: f.available === "on" };
            if (tech) await api.put("/technicians/" + tech.id, data);
            else {
              const r = await api.post("/technicians", data);
              setFilter("");
              selectTech(r.data.id);
            }
          });
        }}
      >
        <Input
          name="name"
          label={t("Full name", "Nom complet")}
          value={tech?.name}
        />
        <Input
          name="email"
          type="email"
          label={t("Email", "Courriel")}
          value={tech?.email}
        />
        <Input
          name="phone"
          label={t("Phone", "Téléphone")}
          value={tech?.phone}
        />
        <Input name="city" label={t("City", "Ville")} value={tech?.city} />
        <Input name="province" label="Province" value={tech?.province} />
        <Input
          name="experience"
          label={t("Experience", "Expérience")}
          value={tech?.experience}
          optional
        />
        <Input
          name="notes"
          label={t("Private notes", "Notes internes")}
          value={tech?.notes}
          optional
        />
        <label>
          <input
            type="checkbox"
            name="available"
            defaultChecked={tech?.available}
          />{" "}
          {t("Available for dispatch", "Disponible pour affectation")}
        </label>
        <button>{t("Save technician", "Enregistrer le technicien")}</button>
      </form>
      {tech && (
        <section>
          <h4>
            {tech.name} · {tech.status}
          </h4>
          {(
            {
              APPLICANT: ["PENDING_VERIFICATION", "INACTIVE"],
              PENDING_VERIFICATION: ["APPROVED", "INACTIVE"],
              APPROVED: ["SUSPENDED", "INACTIVE"],
              SUSPENDED: ["PENDING_VERIFICATION", "INACTIVE"],
              INACTIVE: ["PENDING_VERIFICATION"],
            }[tech.status] || []
          ).map(status => (
            <button
              key={status}
              onClick={() =>
                save(() =>
                  api.post("/technicians/" + tech.id + "/review", { status })
                )
              }
            >
              {status}
            </button>
          ))}
          <h4>{t("Verified coverage", "Autorisations vérifiées")}</h4>
          {tech.grants.map(g => (
            <p key={g.id}>
              {g.category} · {g.city}, {g.province} · {g.evidence} ·{" "}
              {g.expiresOn}
            </p>
          ))}
          <form
            onSubmit={e => {
              const f = fields(e);
              void save(() =>
                api.post("/technicians/" + tech.id + "/grants", {
                  ...f,
                  scopeReviewed: f.scopeReviewed === "on",
                  licensingReviewed: f.licensingReviewed === "on",
                })
              );
            }}
          >
            <Category />
            <Input
              name="city"
              label={t("Authorized city", "Ville autorisée")}
            />
            <Input name="province" label="Province" />
            <Input
              name="expiresOn"
              type="date"
              label={t("Valid through", "Valide jusqu’au")}
            />
            <Input
              name="evidence"
              label={t(
                "Private verification reference",
                "Référence privée de vérification"
              )}
            />
            <label>
              <input name="scopeReviewed" required type="checkbox" />
              {t("Service scope verified", "Portée vérifiée")}
            </label>
            <label>
              <input name="licensingReviewed" required type="checkbox" />
              {t(
                "Licensing requirements reviewed",
                "Exigences de licence vérifiées"
              )}
            </label>
            <button>
              {t("Record verification", "Consigner la vérification")}
            </button>
          </form>
          <h4>{t("Assigned jobs", "Interventions attribuées")}</h4>
          {tech.jobs.map(j => (
            <button key={j.id} onClick={() => selectJob(j.id)}>
              {j.description} · {j.status}
            </button>
          ))}
        </section>
      )}
      <h3>{t("Jobs", "Interventions")}</h3>
      {quoteId && !jobs.rows.some(j => j.quoteId === quoteId) && (
        <form
          onSubmit={e => {
            const f = fields(e);
            void save(async () =>
              selectJob((await api.post("/jobs", { ...f, quoteId })).data.id)
            );
          }}
        >
          <Category />
          <Input name="city" label={t("City", "Ville")} />
          <Input name="province" label="Province" />
          <Input
            name="location"
            label={t("Service location", "Lieu de service")}
          />
          <Input
            name="internalNotes"
            label={t("Private job notes", "Notes internes")}
            optional
          />
          <button>{t("Create job", "Créer l’intervention")}</button>
        </form>
      )}
      <label>
        <input
          type="checkbox"
          checked={unassigned}
          onChange={e => onlyOpen(e.target.checked)}
        />
        {t("Unassigned jobs only", "Interventions à attribuer")}
      </label>
      {jobs.rows
        .filter(
          j =>
            !unassigned ||
            (!j.technicianId &&
              ["DRAFT", "READY", "ON_HOLD"].includes(j.status))
        )
        .map(j => (
          <p key={j.id}>
            <button onClick={() => selectJob(j.id)}>
              {j.description} · {j.status} · {j.id}
            </button>
          </p>
        ))}
      {job && (
        <JobDetail
          key={job.id + job.version}
          job={job}
          rev={rev}
          save={save}
          t={t}
        />
      )}
    </fieldset>
  );
}
function JobDetail({
  job,
  rev,
  save,
  t,
}: {
  job: Order;
  rev: number;
  save: (f: () => Promise<unknown>) => Promise<void>;
  t: T;
}) {
  const eligible = useList<{ id: string; name: string }>(
      "/jobs/" + job.id + "/eligible",
      rev
    ),
    [status, next] = useState(nextStates[job.status]?.[0] || "");
  const agreement = JSON.parse(job.agreement) as { totalCents: number };
  return (
    <section>
      <h3>
        {job.description} · {job.status}
      </h3>
      <p>
        {job.id} · {job.category} · {job.location}, {job.city}, {job.province} ·
        CAD {(agreement.totalCents / 100).toFixed(2)}
      </p>
      <a href={"#customer/" + job.quote.customerId}>
        {t("Customer", "Client")}
      </a>{" "}
      · <a href={"#quote/" + job.quoteId}>{t("Quotation", "Devis")}</a>{" "}
      {job.quote.propertyId && (
        <a
          href={
            "#property/" + job.quote.customerId + "/" + job.quote.propertyId
          }
        >
          {t("Property", "Propriété")}
        </a>
      )}{" "}
      {job.quote.bookingId && (
        <a href={"#booking/" + job.quote.bookingId}>
          {t("Booking and photos", "Demande et photos")}
        </a>
      )}
      <p>
        {job.reference} · {job.internalNotes}
      </p>
      {job.completedAt && (
        <p>
          {job.workPerformed} · {job.labourMinutes} min · {job.materials} ·{" "}
          {job.customerSummary}
        </p>
      )}
      {job.photos.map(p => (
        <a
          key={p.id}
          href={
            "/api/admin/commercial/delivery/jobs/" + job.id + "/photos/" + p.id
          }
          target="_blank"
          rel="noreferrer"
        >
          {p.kind} · {p.id}{" "}
        </a>
      ))}
      {!["CANCELLED", "COMPLETED"].includes(job.status) && (
        <form
          onSubmit={e => {
            e.preventDefault();
            const values = new FormData(e.currentTarget),
              file = values.get("photo");
            void save(async () => {
              if (!(file instanceof File) || file.size > 1800000)
                throw Error("Photo size");
              const image = await new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(String(r.result));
                r.onerror = reject;
                r.readAsDataURL(file);
              });
              await api.post("/jobs/" + job.id + "/photos", {
                kind: values.get("kind"),
                image,
              });
            });
          }}
        >
          <label>
            {t(
              "Work photo (maximum 1.8 MB)",
              "Photo de chantier (maximum 1,8 Mo)"
            )}
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <select aria-label="Photo stage" name="kind">
            <option value="BEFORE">{t("Before", "Avant")}</option>
            <option value="AFTER">{t("After", "Après")}</option>
          </select>
          <button>
            {t("Save private photo", "Enregistrer la photo privée")}
          </button>
        </form>
      )}
      <ol>
        {job.history.map(h => (
          <li key={h.id}>
            {new Date(h.createdAt).toLocaleString()} · {h.status}{" "}
            {h.technicianId}{" "}
            {h.startsAt && new Date(h.startsAt).toLocaleString()}{" "}
            {h.endsAt && new Date(h.endsAt).toLocaleString()}
          </li>
        ))}
      </ol>
      {status && (
        <form
          onSubmit={e => {
            const f = fields(e);
            void save(() =>
              api.post("/jobs/" + job.id + "/actions", {
                ...f,
                status,
                version: job.version,
                ...(status === "SCHEDULED"
                  ? {
                      startsAt: new Date(f.startsAt).toISOString(),
                      endsAt: new Date(f.endsAt).toISOString(),
                    }
                  : {}),
                ...(status === "COMPLETED"
                  ? { labourMinutes: Number(f.labourMinutes) }
                  : {}),
              })
            );
          }}
        >
          <select
            aria-label="Next status"
            value={status}
            onChange={e => next(e.target.value)}
          >
            {nextStates[job.status].map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {status === "ASSIGNED" && (
            <label>
              {t("Eligible technician", "Technicien admissible")}
              <select name="technicianId" required defaultValue="">
                <option value="">
                  {t("Choose technician", "Choisir un technicien")}
                </option>
                {eligible.rows.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {eligible.error &&
                t("Could not load eligibility.", "Admissibilité indisponible.")}
            </label>
          )}
          {status === "SCHEDULED" && (
            <>
              <Input
                name="startsAt"
                label={t("Start (local time)", "Début (heure locale)")}
                type="datetime-local"
              />
              <Input
                name="endsAt"
                label={t("End (local time)", "Fin (heure locale)")}
                type="datetime-local"
              />
            </>
          )}
          {status === "COMPLETED" && (
            <>
              <Input
                name="workPerformed"
                label={t("Work performed", "Travaux effectués")}
              />
              <Input
                name="materials"
                label={t("Materials", "Matériaux")}
                optional
              />
              <Input
                name="labourMinutes"
                type="number"
                label={t("Labour (minutes)", "Main-d’œuvre (minutes)")}
              />
              <Input
                name="customerSummary"
                label={t("Customer summary", "Résumé pour le client")}
              />
            </>
          )}
          <button>{t("Update job", "Mettre à jour")}</button>
        </form>
      )}
    </section>
  );
}
