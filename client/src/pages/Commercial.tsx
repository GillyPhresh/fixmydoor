import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import axios from "axios";
import Delivery from "./Delivery";
import type {
  Customer,
  Property,
  Booking,
  Quotation,
  QuoteLine,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./commercial.css";

const api = axios.create({ baseURL: "/api/admin/commercial" });
type BookingSummary = Pick<
  Booking,
  | "id"
  | "name"
  | "repairType"
  | "visitMode"
  | "status"
  | "customerId"
  | "propertyId"
  | "preferredDate"
  | "appointmentTime"
>;
type QuoteSummary = Pick<
  Quotation,
  "id" | "description" | "status" | "totalCents" | "customerId" | "propertyId"
>;
type Profile = Omit<Customer, "createdAt"> & {
  createdAt: string;
  properties: Property[];
  bookings: BookingSummary[];
  quotations: QuoteSummary[];
};
type Estimate = Omit<Quotation, "createdAt"> & {
  createdAt: string;
  lines: QuoteLine[];
  customer: { name: string };
  property: { label: string } | null;
};
type RequestDetail = BookingSummary &
  Pick<
    Booking,
    | "phone"
    | "email"
    | "address"
    | "preferredContactMethod"
    | "message"
    | "adminNotes"
  > & { photos: string[] };
type Text = (en: string, fr: string) => string;
const money = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    n / 100
  );
function cents(raw: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return NaN;
  const [whole, fraction = ""] = raw.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
const go = (...parts: string[]) => {
  location.hash = parts.join("/");
};
function useRecord<T>(url: string | null, refresh: number) {
  const [state, set] = useState<{ key: string; data?: T; failed?: boolean }>({
    key: "",
  });
  const key = url + "|" + refresh;
  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    api
      .get<T>(url, { signal: ctrl.signal })
      .then(r => set({ key, data: r.data }))
      .catch(() => {
        if (!ctrl.signal.aborted) set({ key, failed: true });
      });
    return () => ctrl.abort();
  }, [url, key]);
  return state.key === key ? state : { key };
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="cm-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
type Spec = [string, string, string, boolean?, string[]?];
const customerFields: Spec[] = [
  ["name", "Customer name", "Nom du client", true],
  ["category", "Category", "Catégorie", true, ["Individual", "Business"]],
  ["email", "Email", "Courriel"],
  ["phone", "Phone", "Téléphone"],
  [
    "preferredContactMethod",
    "Preferred contact method",
    "Mode de contact préféré",
  ],
  ["notes", "Staff notes", "Notes internes"],
];
const propertyFields: Spec[] = [
  ["label", "Property name", "Nom du site", true],
  [
    "type",
    "Property type",
    "Type de propriété",
    true,
    ["Residential", "Commercial", "Multi-unit", "Other"],
  ],
  ["address", "Street address", "Adresse", true],
  ["city", "City", "Ville", true],
  ["province", "Province or region", "Province ou région", true],
  ["postalCode", "Postal code", "Code postal"],
  ["country", "Country", "Pays", true],
  [
    "accessInstructions",
    "Private access instructions",
    "Consignes d’accès privées",
  ],
  ["notes", "Maintenance notes", "Notes d’entretien"],
];
const translations: Record<string, string> = {
  Individual: "Particulier",
  Business: "Entreprise",
  Residential: "Résidentiel",
  Commercial: "Commercial",
  "Multi-unit": "Immeuble collectif",
  Other: "Autre",
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  DECLINED: "Refusé",
  EXPIRED: "Expiré",
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  COMPLETED: "Terminé",
  IN_PROGRESS: "En cours",
  CANCELLED: "Annulé",
};
type Save = (action: () => Promise<unknown>) => Promise<void>;
function Editor({
  fields,
  initial,
  save,
  t,
}: {
  fields: Spec[];
  initial?: object;
  save: (data: Record<string, string>) => void;
  t: Text;
}) {
  return (
    <form
      className="cm-grid"
      onSubmit={e => {
        e.preventDefault();
        save(
          Object.fromEntries(
            Array.from(new FormData(e.currentTarget), ([k, v]) => [
              k,
              String(v),
            ])
          )
        );
      }}
    >
      {fields.map(([k, en, fr, required, options]) => {
        const initialValue = String(
          Object.entries(initial ?? {}).find(([n]) => n === k)?.[1] ??
            options?.[0] ??
            (k === "country" ? "Canada" : "")
        );
        return (
          <Field key={k} label={t(en, fr)}>
            {options ? (
              <select name={k} defaultValue={initialValue}>
                {options.map(o => (
                  <option key={o} value={o}>
                    {t(o, translations[o] ?? o)}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                name={k}
                defaultValue={initialValue}
                type={k === "email" ? "email" : "text"}
                required={required}
                maxLength={k === "notes" ? 3000 : undefined}
              />
            )}
          </Field>
        );
      })}
      <Button>{t("Save", "Enregistrer")}</Button>
    </form>
  );
}
function QuoteForm({
  profile,
  estimate,
  bookingId,
  propertyId,
  onSave,
  t,
}: {
  profile: Profile;
  estimate?: Estimate;
  bookingId: string;
  propertyId: string;
  onSave: Save;
  t: Text;
}) {
  const [items, setItems] = useState(
    () =>
      estimate?.lines.map(l => ({
        kind: l.kind,
        description: l.description,
        quantity: String(l.quantity),
        price: (l.unitCents / 100).toFixed(2),
      })) ?? [{ kind: "Labour", description: "", quantity: "1", price: "0.00" }]
  );
  const [tax, setTax] = useState(((estimate?.taxCents ?? 0) / 100).toFixed(2));
  const [site, setSite] = useState(estimate?.propertyId ?? propertyId);
  const [job, setJob] = useState(estimate?.bookingId ?? bookingId);
  const subtotal = items.reduce(
    (n, i) => n + Number(i.quantity) * cents(i.price),
    0
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    void onSave(async () => {
      const body = {
        ...values,
        customerId: profile.id,
        propertyId: site || null,
        bookingId: job || null,
        taxCents: cents(tax),
        version: estimate?.version,
        lines: items.map(i => ({
          kind: i.kind,
          description: i.description,
          quantity: Number(i.quantity),
          unitCents: cents(i.price),
        })),
      };
      const r = estimate
        ? await api.put("/quotes/" + estimate.id, body)
        : await api.post("/quotes", body);
      go("quote", r.data.id);
    });
  }
  return (
    <form onSubmit={submit}>
      <h2>
        {t("Quotation draft", "Brouillon de devis")} · {profile.name}
      </h2>
      <Field label={t("Service description", "Description du service")}>
        <Input
          name="description"
          required
          defaultValue={estimate?.description}
        />
      </Field>
      <div className="cm-grid">
        <Field label={t("Property", "Propriété")}>
          <select
            value={site}
            onChange={e => {
              setSite(e.target.value);
              setJob("");
            }}
          >
            <option value="">—</option>
            {profile.properties.map(p => (
              <option value={p.id} key={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Booking", "Demande")}>
          <select value={job} onChange={e => setJob(e.target.value)}>
            <option value="">—</option>
            {profile.bookings
              .filter(b => (b.propertyId ?? "") === site)
              .map(b => (
                <option value={b.id} key={b.id}>
                  {b.repairType} · {b.id}
                </option>
              ))}
          </select>
        </Field>
      </div>
      {items.map((line, index) => {
        const update = (k: keyof typeof line, v: string) =>
          setItems(items.map((i, n) => (n === index ? { ...i, [k]: v } : i)));
        return (
          <fieldset key={index}>
            <legend>
              {t("Item", "Poste")} {index + 1}
            </legend>
            <div className="cm-grid">
              <Field label={t("Type", "Type")}>
                <select
                  value={line.kind}
                  onChange={e => update("kind", e.target.value)}
                >
                  <option value="Labour">{t("Labour", "Main-d’œuvre")}</option>
                  <option value="Material">{t("Material", "Matériaux")}</option>
                </select>
              </Field>
              <Field label={t("Item description", "Description du poste")}>
                <Input
                  required
                  value={line.description}
                  onChange={e => update("description", e.target.value)}
                />
              </Field>
              <Field label={t("Quantity", "Quantité")}>
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  required
                  value={line.quantity}
                  onChange={e => update("quantity", e.target.value)}
                />
              </Field>
              <Field label={t("Unit price (CAD)", "Prix unitaire (CAD)")}>
                <Input
                  required
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                  value={line.price}
                  onChange={e => update("price", e.target.value)}
                />
              </Field>
            </div>
            <button
              type="button"
              disabled={items.length === 1}
              onClick={() => setItems(items.filter((_, n) => n !== index))}
            >
              {t("Remove item", "Retirer le poste")}
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        disabled={items.length >= 100}
        onClick={() =>
          setItems([
            ...items,
            { kind: "Material", description: "", price: "0.00", quantity: "1" },
          ])
        }
      >
        {t("Add item", "Ajouter un poste")}
      </button>
      <div className="cm-grid">
        <Field label={t("Tax label", "Nom de la taxe")}>
          <Input
            name="taxLabel"
            required={cents(tax) > 0}
            defaultValue={estimate?.taxLabel}
          />
        </Field>
        <Field label={t("Tax amount (CAD)", "Montant de taxe (CAD)")}>
          <Input
            required
            inputMode="decimal"
            pattern="[0-9]+(\.[0-9]{1,2})?"
            value={tax}
            onChange={e => setTax(e.target.value)}
          />
        </Field>
        <Field label={t("Valid through", "Valable jusqu’au")}>
          <Input
            type="date"
            name="expiresOn"
            required
            defaultValue={estimate?.expiresOn}
          />
        </Field>
        <Field label={t("Staff notes", "Notes internes")}>
          <Input name="notes" defaultValue={estimate?.notes} />
        </Field>
      </div>
      <p>
        {t("Subtotal", "Sous-total")} {money(subtotal)} · Total CAD{" "}
        {money(subtotal + cents(tax))}
      </p>
      <Button>{t("Save draft", "Enregistrer le brouillon")}</Button>
    </form>
  );
}

const directories: Record<string, [string, string]> = {
  customers: ["Customers", "Clients"],
  properties: ["Properties", "Propriétés"],
  bookings: ["Bookings", "Demandes"],
  remote: ["Remote consultations", "Consultations à distance"],
  quotes: ["Quotations", "Devis"],
};
type Row = {
  id: string;
  name?: string;
  label?: string;
  description?: string;
  repairType?: string;
  category?: string;
  address?: string;
  status?: string;
  customerId?: string;
};
export default function Commercial() {
  const [hash, setHash] = useState(location.hash);
  const [fr, setFr] = useState(
    localStorage.getItem("fixmydoor-language") === "fr"
  );
  const [q, search] = useState(""),
    [category, filter] = useState(""),
    [page, paginate] = useState(0);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [rev, reload] = useState(0);
  useEffect(() => {
    const change = () => {
      setHash(location.hash);
      search("");
      filter("");
      paginate(0);
      setError("");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const [view = "customers", id = "", context = "", site = ""] = (
    hash.slice(1) || "customers"
  ).split("/");
  const t: Text = (en, french) => (fr ? french : en);
  const status = (s: string) => (fr ? (translations[s] ?? s) : s);
  const directory = directories[view];
  const query = new URLSearchParams({ q, page: String(page) });
  if (view === "remote") query.set("remote", "yes");
  if (view === "customers" && category) query.set("category", category);
  const rows = useRecord<Row[]>(
    directory
      ? "/" + (view === "remote" ? "bookings" : view) + "?" + query
      : null,
    rev
  );
  const request = useRecord<RequestDetail>(
    view === "booking"
      ? "/bookings/" + id
      : view === "newCustomer" && context
        ? "/bookings/" + context
        : null,
    rev
  );
  const quote = useRecord<Estimate>(
    ["quote", "editQuote"].includes(view) ? "/quotes/" + id : null,
    rev
  );
  const profileId =
    view === "editQuote"
      ? quote.data?.customerId
      : [
            "customer",
            "editCustomer",
            "newProperty",
            "property",
            "editProperty",
            "newQuote",
          ].includes(view)
        ? id
        : null;
  const profile = useRecord<Profile>(
    profileId ? "/customers/" + profileId : null,
    rev
  );
  const save: Save = async action => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      reload(n => n + 1);
    } catch (e) {
      const message =
        axios.isAxiosError(e) && typeof e.response?.data?.error === "string"
          ? e.response.data.error
          : "";
      setError(
        fr
          ? "Vérifiez les champs et les associations, puis actualisez la fiche."
          : message || "Unable to save. Check the fields and reload the record."
      );
    } finally {
      setBusy(false);
    }
  };
  const p = profile.data,
    b = request.data,
    est = quote.data,
    prop = p?.properties.find(x => x.id === context);
  const link = (label: string, ...parts: string[]) => (
    <a href={"#" + parts.join("/")}>{label}</a>
  );
  const histories = (jobs: BookingSummary[], quotes: QuoteSummary[]) => (
    <>
      <h3>{t("Service history", "Historique des services")}</h3>
      {jobs.length ? (
        jobs.map(j => (
          <div key={j.id}>
            {link(j.repairType + " · " + status(j.status), "booking", j.id)}
          </div>
        ))
      ) : (
        <p>{t("No linked bookings.", "Aucune demande associée.")}</p>
      )}
      <h3>{t("Quotations", "Devis")}</h3>
      {quotes.length ? (
        quotes.map(x => (
          <div key={x.id}>
            {link(
              x.description +
                " · " +
                money(x.totalCents) +
                " · " +
                status(x.status),
              "quote",
              x.id
            )}
          </div>
        ))
      ) : (
        <p>{t("No quotations yet.", "Aucun devis pour le moment.")}</p>
      )}
    </>
  );
  const loading = Boolean(
    (directory && !rows.data) ||
      (profileId && !p) ||
      ((view === "booking" || (view === "newCustomer" && context)) && !b) ||
      (["quote", "editQuote"].includes(view) && !est)
  );
  return (
    <main className="cm-shell" data-no-translate>
      <header>
        <a href="/admin">← {t("Admin dashboard", "Tableau de bord")}</a>
        <button onClick={() => setFr(!fr)}>
          {fr ? "English" : "Français"}
        </button>
      </header>
      <h1>{t("Service management", "Gestion des services")}</h1>
      <nav aria-label={t("Service management", "Gestion des services")}>
        {Object.entries(directories).map(([k, labels]) => (
          <a
            key={k}
            aria-current={view === k ? "page" : undefined}
            href={"#" + k}
          >
            {t(...labels)}
          </a>
        ))}
        <a href="#delivery">{t("Service delivery", "Interventions")}</a>
      </nav>
      {error && <p role="alert">{error}</p>}
      {[rows, request, profile, quote].some(s => s.failed) ? (
        <p role="alert">
          {t(
            "Unable to load this record.",
            "Impossible de charger cette fiche."
          )}{" "}
          <button onClick={() => reload(n => n + 1)}>
            {t("Retry", "Réessayer")}
          </button>
        </p>
      ) : loading ? (
        <p role="status">{t("Loading…", "Chargement…")}</p>
      ) : null}
      <fieldset className="cm-panel" disabled={busy} key={hash}>
        {view === "delivery" && <Delivery quoteId={id} t={t} />}
        {directory && (
          <>
            <h2>
              {context
                ? t(
                    "Choose a customer for this booking",
                    "Choisir un client pour cette demande"
                  )
                : t(...directory)}
            </h2>
            <div className="cm-grid">
              <Field label={t("Search", "Recherche")}>
                <Input
                  value={q}
                  onChange={e => {
                    search(e.target.value);
                    paginate(0);
                  }}
                />
              </Field>
              {view === "customers" && (
                <Field label={t("Category", "Catégorie")}>
                  <select
                    value={category}
                    onChange={e => {
                      filter(e.target.value);
                      paginate(0);
                    }}
                  >
                    <option value="">{t("All", "Toutes")}</option>
                    {["Individual", "Business"].map(c => (
                      <option key={c} value={c}>
                        {status(c)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            {view === "customers" &&
              link(
                t("New customer", "Nouveau client"),
                "newCustomer",
                "",
                context
              )}
            {rows.data?.map(r => (
              <div key={r.id} className="cm-row">
                {view === "properties"
                  ? link(r.label ?? r.id, "property", r.customerId ?? "", r.id)
                  : view === "quotes"
                    ? link(r.description ?? r.id, "quote", r.id)
                    : view === "customers"
                      ? link(r.name ?? r.id, "customer", r.id, context)
                      : link(r.name + " · " + r.repairType, "booking", r.id)}
                <small>
                  {status(r.status ?? r.category ?? r.address ?? "")}
                </small>
              </div>
            ))}
            {rows.data?.length === 0 && (
              <p>{t("No matching records.", "Aucune fiche correspondante.")}</p>
            )}
            <div>
              <button disabled={!page} onClick={() => paginate(page - 1)}>
                {t("Previous", "Précédent")}
              </button>{" "}
              <button
                disabled={rows.data?.length !== 40}
                onClick={() => paginate(page + 1)}
              >
                {t("Next", "Suivant")}
              </button>
            </div>
          </>
        )}
        {((view === "newCustomer" && (!context || b)) ||
          (view === "editCustomer" && p)) && (
          <>
            <h2>{t("Customer profile", "Fiche client")}</h2>
            <Editor
              t={t}
              fields={customerFields}
              initial={view === "editCustomer" ? p : b}
              save={values =>
                save(async () => {
                  const result = id
                    ? await api.put("/customers/" + id, values)
                    : await api.post("/customers", values);
                  go("customer", result.data.id, context);
                })
              }
            />
          </>
        )}
        {view === "customer" && p && (
          <>
            <h2>{p.name}</h2>
            <small>
              {p.id} · {new Date(p.createdAt).toLocaleDateString()} ·{" "}
              {status(p.category)}
            </small>
            <p>
              {[p.phone, p.email, p.preferredContactMethod]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p>{p.notes}</p>
            {link(
              t("Edit profile", "Modifier la fiche"),
              "editCustomer",
              p.id,
              context
            )}
            {context && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const propertyId =
                    new FormData(e.currentTarget).get("propertyId") || null;
                  void save(async () => {
                    await api.put("/bookings/" + context + "/link", {
                      customerId: p.id,
                      propertyId,
                    });
                    go("booking", context);
                  });
                }}
              >
                <Field
                  label={t(
                    "Property for this booking",
                    "Propriété pour cette demande"
                  )}
                >
                  <select name="propertyId">
                    <option value="">—</option>
                    {p.properties.map(x => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button>
                  {t("Confirm booking association", "Confirmer l’association")}
                </Button>
              </form>
            )}
            <h3>{t("Properties", "Propriétés")}</h3>
            {p.properties.map(x => (
              <div key={x.id}>{link(x.label, "property", p.id, x.id)}</div>
            ))}
            {link(
              t("Add property", "Ajouter une propriété"),
              "newProperty",
              p.id,
              context
            )}{" "}
            · {link(t("New quotation", "Nouveau devis"), "newQuote", p.id)}
            {histories(p.bookings, p.quotations)}
          </>
        )}
        {(view === "newProperty" || (view === "editProperty" && prop)) && p && (
          <>
            <h2>
              {p.name} · {t("Property details", "Fiche propriété")}
            </h2>
            <Editor
              t={t}
              fields={propertyFields}
              initial={prop}
              save={values =>
                save(async () => {
                  const r = prop
                    ? await api.put("/properties/" + prop.id, values)
                    : await api.post(
                        "/customers/" + p.id + "/properties",
                        values
                      );
                  if (view === "newProperty" && context)
                    go("customer", p.id, context);
                  else go("property", p.id, r.data.id);
                })
              }
            />
          </>
        )}
        {view === "property" && p && prop && (
          <>
            <h2>{prop.label}</h2>
            {link(p.name, "customer", p.id)}
            <p>
              {[
                prop.address,
                prop.city,
                prop.province,
                prop.postalCode,
                prop.country,
              ].join(", ")}
            </p>
            <p>
              {status(prop.type)} · {prop.accessInstructions}
            </p>
            <p>{prop.notes}</p>
            {link(
              t("Edit property", "Modifier la propriété"),
              "editProperty",
              p.id,
              prop.id
            )}{" "}
            ·{" "}
            {link(
              t("New quotation", "Nouveau devis"),
              "newQuote",
              p.id,
              "",
              prop.id
            )}
            {histories(
              p.bookings.filter(x => x.propertyId === prop.id),
              p.quotations.filter(x => x.propertyId === prop.id)
            )}
          </>
        )}
        {view === "booking" && b && (
          <>
            <h2>
              {b.name} · {b.repairType}
            </h2>
            <small>
              {b.id} · {status(b.status)}
            </small>
            <p>
              {b.visitMode === "REMOTE"
                ? t("Remote consultation", "Consultation à distance")
                : t("On-site visit", "Visite sur place")}
            </p>
            <p>
              {[
                b.preferredDate,
                b.preferredContactMethod,
                b.email,
                b.phone,
                b.address,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p>{b.message}</p>
            {b.photos.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {t("Private photo", "Photo privée")} {i + 1}{" "}
              </a>
            ))}
            <p>
              {link(
                t(
                  "Associate customer and property",
                  "Associer un client et une propriété"
                ),
                "customers",
                "",
                b.id
              )}
            </p>
            {b.customerId && (
              <p>
                {link(
                  t("Customer profile", "Fiche client"),
                  "customer",
                  b.customerId
                )}{" "}
                ·{" "}
                {link(
                  t("New quotation", "Nouveau devis"),
                  "newQuote",
                  b.customerId,
                  b.id,
                  b.propertyId ?? ""
                )}
              </p>
            )}
            <form
              onSubmit={e => {
                e.preventDefault();
                const fields = Object.fromEntries(
                  new FormData(e.currentTarget)
                );
                void save(() => axios.patch("/api/bookings/" + b.id, fields));
              }}
            >
              <Field label={t("Booking status", "État de la demande")}>
                <select name="status" defaultValue={b.status}>
                  {[
                    "PENDING",
                    "CONFIRMED",
                    "IN_PROGRESS",
                    "COMPLETED",
                    "CANCELLED",
                  ].map(value => (
                    <option key={value} value={value}>
                      {status(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Appointment time", "Heure du rendez-vous")}>
                <Input
                  name="appointmentTime"
                  defaultValue={b.appointmentTime ?? ""}
                />
              </Field>
              <Field
                label={t(
                  "Private service outcome",
                  "Résultat interne du service"
                )}
              >
                <textarea
                  name="adminNotes"
                  maxLength={1000}
                  defaultValue={b.adminNotes ?? ""}
                />
              </Field>
              <Button>
                {t("Save booking details", "Enregistrer la demande")}
              </Button>
            </form>
          </>
        )}
        {(view === "newQuote" || (view === "editQuote" && est)) && p && (
          <QuoteForm
            profile={p}
            estimate={est}
            bookingId={context}
            propertyId={site}
            onSave={save}
            t={t}
          />
        )}
        {view === "quote" && est && (
          <>
            <article className="cm-print">
              <small>FixMyDoor Services</small>
              <h2>{t("Quotation", "Devis")} · CAD</h2>
              <p>{est.id}</p>
              <p>
                {est.customer.name} {est.property?.label}
              </p>
              <p>
                {new Date(est.createdAt).toLocaleDateString()} ·{" "}
                {t("Valid through", "Valable jusqu’au")} {est.expiresOn} ·{" "}
                {status(est.status)}
              </p>
              <h3>{est.description}</h3>
              {est.lines.map(l => (
                <div key={l.id} className="cm-row">
                  <span>{l.description}</span>
                  <span>
                    {l.quantity} × {money(l.unitCents)} ={" "}
                    {money(l.quantity * l.unitCents)}
                  </span>
                </div>
              ))}
              <p>
                {t("Subtotal", "Sous-total")} {money(est.subtotalCents)}
              </p>
              <p>
                {est.taxLabel || t("Tax", "Taxe")} {money(est.taxCents)}
              </p>
              <strong>Total CAD {money(est.totalCents)}</strong>
            </article>
            <aside>
              <p>{est.notes}</p>
              {est.status === "ACCEPTED" &&
                link(
                  t("Create or open job", "Créer ou ouvrir l’intervention"),
                  "delivery",
                  est.id
                )}
              {link(est.customer.name, "customer", est.customerId)} ·{" "}
              <button onClick={() => window.print()}>
                {t("Print quotation", "Imprimer le devis")}
              </button>
              {est.status === "DRAFT" &&
                link(
                  t("Edit draft", "Modifier le brouillon"),
                  "editQuote",
                  est.id
                )}
              {(est.status === "DRAFT"
                ? ["SENT"]
                : est.status === "SENT"
                  ? ["ACCEPTED", "DECLINED", "EXPIRED"]
                  : []
              ).map(s => (
                <button
                  key={s}
                  onClick={() =>
                    save(() =>
                      api.patch("/quotes/" + est.id + "/status", {
                        version: est.version,
                        status: s,
                      })
                    )
                  }
                >
                  {t("Mark", "Marquer")} {status(s)}
                </button>
              ))}
            </aside>
          </>
        )}
      </fieldset>
    </main>
  );
}
