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
> & {invoice:{id:string;status:string}|null};
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
  > & {
    photos: string[];
    consultation: {
      serviceType: string;
      scheduledAt: string;
      durationMinutes: number;
      completedAt: string | null;
      outcome: string;
    } | null;
    quotations: {
      id: string;
      description: string;
      totalCents: number;
      invoice: { id: string; status: string } | null;
    }[];
  };
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
  const invoice = useRecord<{
    number: string;
    customerName: string;
    description: string;
    status: string;
    dueOn: string;
    subtotalCents: number;
    gstRegistration: string;
    qstRegistration: string;
    gstCents: number;
    qstCents: number;
    issuedAt: string | null;
    totalCents: number;
    taxCents: number;
    paidCents: number;
    payments: {
      id: string;
      method: string;
      reference: string;
      cents: number;
    }[];
    taxLabel: string;
    lines: string;
  }>(view === "invoice" ? "/invoices/" + id : null, rev);
  const [sharedInvoice, setSharedInvoice] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const invoiceList = useRecord<
    {
      id: string;
      number: string;
      status: string;
      customerName: string;
      totalCents: number;
      paidCents: number;
    }[]
  >(
    view === "invoices"
      ? "/invoices?" +
          new URLSearchParams({
            q,
            page: String(page),
            ...(category ? { status: category } : {}),
          })
      : null,
    rev
  );
  const agreements = useRecord<
    {
      id: string;
      scope: string;
      status: string;
      nextOn: string;
      endOn: string;
      cents: number;
      occurrences: { id: string; dueOn: string; quoteId: string }[];
    }[]
  >(view === "property" ? "/properties/" + context + "/agreements" : null, rev);
  const overview = useRecord<{
    counts: number[];
    upcoming: {
      scope: string;
      due: string;
      customerId: string;
      propertyId: string;
    }[];
  }>(view === "overview" ? "/overview" : null, rev);
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
            {x.invoice&&link(t("Invoice","Facture")+" · "+x.invoice.status,"invoice",x.invoice.id)}
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
        <a href="#overview">{t("Overview", "Vue d’ensemble")}</a>
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
        <a href="#invoices">{t("Invoices", "Factures")}</a>
        <a href="/admin/portals">{t("Portal access", "Accès au portail")}</a>
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
        {view === "overview" && overview.data && (
          <section>
            <h2>{t("Commercial overview", "Vue d’ensemble commerciale")}</h2>
            {[
              ["bookings", "New requests", "Nouvelles demandes"],
              [
                "remote",
                "Remote requests awaiting confirmation",
                "Consultations à confirmer",
              ],
              ["quotes", "Pending quotations", "Devis en attente"],
              ["quotes", "Accepted quotations", "Devis acceptés"],
              [
                "delivery",
                "Jobs awaiting assignment",
                "Interventions à attribuer",
              ],
              ["delivery", "Scheduled jobs", "Interventions planifiées"],
              [
                "delivery",
                "Completed jobs awaiting invoice",
                "Interventions à facturer",
              ],
              ["invoices", "Open invoices", "Factures ouvertes"],
              ["invoices", "Paid invoices", "Factures payées"],
            ].map(([path, en, fr], i) => (
              <p key={en}>
                <a href={"#" + path}>
                  {t(en, fr)} · {overview.data!.counts[i]}
                </a>
              </p>
            ))}
            <h3>{t("Upcoming maintenance", "Entretien à venir")}</h3>
            {overview.data.upcoming.map((a, i) => (
              <p key={i}>
                <a href={"#property/" + a.customerId + "/" + a.propertyId}>
                  {a.scope} · {a.due}
                </a>
              </p>
            ))}
          </section>
        )}
        {view === "invoices" && (
          <section>
            <h2>{t("Invoices", "Factures")}</h2>
            <Field
              label={t(
                "Invoice number or customer",
                "Numéro de facture ou client"
              )}
            >
              <Input
                value={q}
                onChange={e => {
                  search(e.target.value);
                  paginate(0);
                }}
              />
            </Field>
            <select
              aria-label={t("Invoice status", "Statut de facture")}
              value={category}
              onChange={e => {
                filter(e.target.value);
                paginate(0);
              }}
            >
              <option value="">{t("All statuses", "Tous les statuts")}</option>
              {["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID"].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {invoiceList.failed && (
              <p role="alert">
                {t("Could not load invoices", "Chargement impossible")}
              </p>
            )}
            {invoiceList.data?.map(i => (
              <p key={i.id}>
                <a href={"#invoice/" + i.id}>
                  {i.number} · {i.customerName}
                </a>{" "}
                · {i.status} · {t("Balance", "Solde")}{" "}
                {money(i.totalCents - i.paidCents)}
              </p>
            ))}
            <button disabled={!page} onClick={() => paginate(page - 1)}>
              {t("Previous", "Précédent")}
            </button>
            <button
              disabled={invoiceList.data?.length !== 25}
              onClick={() => paginate(page + 1)}
            >
              {t("Next", "Suivant")}
            </button>
          </section>
        )}
        {view === "invoice" && invoice.failed && (
          <p role="alert">
            {t("Could not load invoice", "Impossible de charger la facture")}
          </p>
        )}
        {view === "invoice" && invoice.data && (
          <>
            <article className="cm-print">
              <h2>
                {t("Invoice", "Facture")} {invoice.data.number}
              </h2>
              <p>
                {invoice.data.customerName} · {invoice.data.status}
              </p>
              <p>{invoice.data.description}</p>
              <p>
                {t("Due date", "Échéance")} {invoice.data.dueOn}
              </p>
              {(
                JSON.parse(invoice.data.lines) as {
                  description: string;
                  quantity: number;
                  unitCents: number;
                }[]
              ).map((line, i) => (
                <p key={i}>
                  {line.description} · {line.quantity} × {money(line.unitCents)}
                </p>
              ))}
              <p>
                {t("Subtotal", "Sous-total")}{" "}
                {money(invoice.data.subtotalCents)}
              </p>
              <p>
                {invoice.data.taxLabel} {money(invoice.data.taxCents)}
              </p>
              {invoice.data.issuedAt && (
                <p>
                  {t("Issued", "Émise")}{" "}
                  {new Date(invoice.data.issuedAt).toLocaleDateString()}
                </p>
              )}
              {invoice.data.gstRegistration && (
                <p>
                  GST / TPS {invoice.data.gstRegistration} ·{" "}
                  {money(invoice.data.gstCents)}
                </p>
              )}
              {invoice.data.qstRegistration && (
                <p>
                  QST / TVQ {invoice.data.qstRegistration} ·{" "}
                  {money(invoice.data.qstCents)}
                </p>
              )}
              {["ISSUED", "PARTIALLY_PAID"].includes(invoice.data.status) &&
                invoice.data.dueOn < new Date().toLocaleDateString("en-CA") && (
                  <strong>{t("Overdue", "En retard")}</strong>
                )}
              <strong>Total CAD {money(invoice.data.totalCents)}</strong>
            </article>
            <button onClick={() => window.print()}>
              {t("Print", "Imprimer")}
            </button>
            {invoice.data.status === "DRAFT" && (
              <form
                onSubmit={event => {
                  event.preventDefault();
                  const data = Object.fromEntries(
                    new FormData(event.currentTarget)
                  );
                  void save(() =>
                    api.patch("/invoices/" + id + "/draft", {
                      description: data.description,
                      dueOn: data.dueOn,
                      gstRegistration: data.gstRegistration,
                      qstRegistration: data.qstRegistration,
                      gstCents: cents(String(data.gstAmount)),
                      qstCents: cents(String(data.qstAmount)),
                    })
                  );
                }}
              >
                <Field
                  label={t("Invoice description", "Description de la facture")}
                >
                  <input
                    required
                    name="description"
                    defaultValue={invoice.data.description}
                  />
                </Field>
                <Field label={t("Due date", "Échéance")}>
                  <input
                    required
                    type="date"
                    name="dueOn"
                    defaultValue={invoice.data.dueOn}
                  />
                </Field>
                <Field label="GST / TPS registration">
                  <input
                    name="gstRegistration"
                    defaultValue={invoice.data.gstRegistration}
                  />
                </Field>
                <Field label="GST / TPS (CAD)">
                  <input
                    name="gstAmount"
                    defaultValue={(invoice.data.gstCents / 100).toFixed(2)}
                  />
                </Field>
                <Field label="QST / TVQ registration">
                  <input
                    name="qstRegistration"
                    defaultValue={invoice.data.qstRegistration}
                  />
                </Field>
                <Field label="QST / TVQ (CAD)">
                  <input
                    name="qstAmount"
                    defaultValue={(invoice.data.qstCents / 100).toFixed(2)}
                  />
                </Field>
                <button>{t("Update draft", "Modifier le brouillon")}</button>
              </form>
            )}
            {["DRAFT", "ISSUED"].includes(invoice.data.status) && (
              <button
                onClick={() => {
                  if (
                    confirm(t("Void this invoice?", "Annuler cette facture ?"))
                  )
                    void save(() => api.post("/invoices/" + id + "/void"));
                }}
              >
                {t("Void invoice", "Annuler la facture")}
              </button>
            )}
            {invoice.data.status === "DRAFT" && (
              <button
                onClick={() =>
                  save(async () => {
                    await api.post("/invoices/" + id + "/issue");
                  })
                }
              >
                {t("Issue invoice", "Émettre la facture")}
              </button>
            )}
          </>
        )}
        {view === "invoice" && invoice.data && (
          <section>
            <h3>{t("Payment history", "Historique des paiements")}</h3>
            <p>
              {t("Balance", "Solde")}{" "}
              {money(invoice.data.totalCents - invoice.data.paidCents)}
            </p>
            {invoice.data.payments.map(p => (
              <p key={p.id}>
                {p.method} · {p.reference} · {money(p.cents)}
              </p>
            ))}
            {["ISSUED", "PARTIALLY_PAID"].includes(invoice.data.status) && (
              <form
                onSubmit={event => {
                  event.preventDefault();
                  const f = new FormData(event.currentTarget);
                  void save(() =>
                    api.post("/invoices/" + id + "/offline", {
                      method: f.get("method"),
                      reference: f.get("reference"),
                      cents: cents(String(f.get("amount"))),
                    })
                  );
                }}
              >
                <select name="method" aria-label="Payment method">
                  <option>CASH</option>
                  <option>CHEQUE</option>
                  <option>BANK_TRANSFER</option>
                </select>
                <Field label={t("Receipt reference", "Référence du reçu")}>
                  <input required name="reference" />
                </Field>
                <Field label={t("Amount received (CAD)", "Montant reçu (CAD)")}>
                  <input required name="amount" inputMode="decimal" />
                </Field>
                <button>
                  {t(
                    "Record verified receipt",
                    "Enregistrer le paiement vérifié"
                  )}
                </button>
              </form>
            )}
          </section>
        )}
        {view === "invoice" &&
          invoice.data &&
          ["ISSUED", "PARTIALLY_PAID", "PAID"].includes(
            invoice.data.status
          ) && (
            <>
              <button
                onClick={() =>
                  save(async () => {
                    const r = await api.post("/invoices/" + id + "/link");
                    setSharedInvoice({
                      id,
                      url: new URL(r.data.path, location.origin).href,
                    });
                  })
                }
              >
                {t(
                  "Get seven-day customer link",
                  "Obtenir le lien client de sept jours"
                )}
              </button>
              {sharedInvoice?.id === id && (
                <input
                  aria-label={t(
                    "Customer invoice link",
                    "Lien de facture client"
                  )}
                  readOnly
                  value={sharedInvoice.url}
                  onFocus={event => event.target.select()}
                />
              )}
            </>
          )}
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
        {view === "property" && prop && (
          <section>
            <h2>{t("Maintenance agreements", "Ententes d’entretien")}</h2>
            <form
              onSubmit={event => {
                event.preventDefault();
                const f = Object.fromEntries(new FormData(event.currentTarget));
                void save(() =>
                  api.post("/properties/" + prop.id + "/agreements", {
                    ...f,
                    cents: cents(String(f.cents)),
                    months: Number(f.months),
                  })
                );
              }}
            >
              {[
                ["scope", t("Scope of work", "Travaux convenus"), "text"],
                ["startOn", t("Start date", "Début"), "date"],
                ["endOn", t("End date", "Fin"), "date"],
                [
                  "cents",
                  t("Charge per visit (CAD)", "Prix par visite (CAD)"),
                  "text",
                ],
                [
                  "authorization",
                  t(
                    "Agreement authorization reference",
                    "Référence de l’autorisation"
                  ),
                  "text",
                ],
              ].map(([name, label, type]) => (
                <Field key={name} label={label}>
                  <input required name={name} type={type} />
                </Field>
              ))}
              <Field label={t("Interval in months", "Intervalle en mois")}>
                <select name="months">
                  {[1, 3, 6, 12].map(m => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <button>{t("Create agreement", "Créer l’entente")}</button>
            </form>
            {agreements.data?.map(a => (
              <article key={a.id}>
                <h3>
                  {a.scope} · {a.status}
                </h3>
                <p>
                  {money(a.cents)} · {a.nextOn}
                </p>
                {a.status === "ACTIVE" && a.nextOn <= a.endOn && (
                  <button
                    onClick={() =>
                      save(() =>
                        api.post("/agreements/" + a.id + "/occurrences", {
                          period: a.occurrences.length,
                        })
                      )
                    }
                  >
                    {t("Generate scheduled work", "Générer l’intervention")}
                  </button>
                )}
                {a.status !== "CANCELLED" && (
                  <>
                    <form onSubmit={event=>{event.preventDefault();const endOn=new FormData(event.currentTarget).get("endOn");void save(()=>api.patch("/agreements/"+a.id,{status:a.status,endOn}))}}><Field label={t("Renew through","Renouveler jusqu’au")}><input type="date" name="endOn" min={a.endOn} required/></Field><button>{t("Renew agreement","Renouveler l’entente")}</button></form>
                    <button
                      onClick={() =>
                        save(() =>
                          api.patch("/agreements/" + a.id, {
                            status:
                              a.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                          })
                        )
                      }
                    >
                      {a.status === "ACTIVE"
                        ? t("Suspend", "Suspendre")
                        : t("Resume", "Reprendre")}
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            t("Cancel agreement?", "Annuler l’entente ?")
                          )
                        )
                          void save(() =>
                            api.patch("/agreements/" + a.id, {
                              status: "CANCELLED",
                            })
                          );
                      }}
                    >
                      {t("Cancel agreement", "Annuler l’entente")}
                    </button>
                  </>
                )}
                {a.occurrences.map(o => (
                  <p key={o.id}>
                    <a href={"#quote/" + o.quoteId}>
                      {t("Service period", "Période de service")} {o.dueOn}
                    </a>
                  </p>
                ))}
              </article>
            ))}
          </section>
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
        {view === "booking" && b?.visitMode === "REMOTE" && (
          <section>
            <h2>
              {t("Consultation appointment", "Rendez-vous de consultation")}
            </h2>
            {b.quotations.map(q => (
              <p key={q.id}>
                <a href={"#quote/" + q.id}>
                  {q.description} · {money(q.totalCents)}
                </a>{" "}
                {q.invoice && (
                  <a href={"#invoice/" + q.invoice.id}>{q.invoice.status}</a>
                )}
              </p>
            ))}
            {b.consultation ? (
              <>
                <p>
                  {b.consultation.serviceType} ·{" "}
                  {new Date(b.consultation.scheduledAt).toLocaleString()} ·{" "}
                  {b.consultation.durationMinutes} min
                </p>
                {b.consultation.completedAt ? (
                  <p>{b.consultation.outcome}</p>
                ) : (
                  <form
                    onSubmit={event => {
                      event.preventDefault();
                      const outcome = new FormData(event.currentTarget).get(
                        "outcome"
                      );
                      void save(() =>
                        api.post("/bookings/" + id + "/consultation/complete", {
                          outcome,
                        })
                      );
                    }}
                  >
                    <Field
                      label={t(
                        "Consultation outcome",
                        "Résultat de la consultation"
                      )}
                    >
                      <textarea name="outcome" required />
                    </Field>
                    <button>
                      {t("Complete consultation", "Terminer la consultation")}
                    </button>
                  </form>
                )}
              </>
            ) : (
              b.quotations.length > 0 && (
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    const f = Object.fromEntries(
                      new FormData(event.currentTarget)
                    );
                    void save(() =>
                      api.post("/bookings/" + id + "/consultation", {
                        ...f,
                        durationMinutes: Number(f.durationMinutes),
                        scheduledAt: new Date(
                          String(f.scheduledAt)
                        ).toISOString(),
                        requiresPayment: f.requiresPayment === "on",
                      })
                    );
                  }}
                >
                  <Field label={t("Accepted quotation", "Devis accepté")}>
                    <select name="quoteId">
                      {b.quotations.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.description}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {[
                    [
                      "serviceType",
                      t("Consultation type", "Type de consultation"),
                      "text",
                    ],
                    [
                      "availability",
                      t("Customer availability", "Disponibilité du client"),
                      "text",
                    ],
                    [
                      "durationMinutes",
                      t("Duration in minutes", "Durée en minutes"),
                      "number",
                    ],
                    [
                      "scheduledAt",
                      t(
                        "Appointment (local time)",
                        "Rendez-vous (heure locale)"
                      ),
                      "datetime-local",
                    ],
                  ].map(([name, label, type]) => (
                    <Field key={name} label={label}>
                      <input name={name} type={type} required />
                    </Field>
                  ))}
                  <label>
                    <input type="checkbox" name="requiresPayment" />
                    {t("Require settled invoice", "Exiger le paiement complet")}
                  </label>
                  <button>
                    {t("Confirm consultation", "Confirmer la consultation")}
                  </button>
                </form>
              )
            )}
          </section>
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
              {est.status === "ACCEPTED" && (
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    const dueOn = new FormData(event.currentTarget).get(
                      "dueOn"
                    );
                    void save(async () => {
                      const r = await api.post("/invoices", {
                        quoteId: est.id,
                        dueOn,
                      });
                      go("invoice", r.data.id);
                    });
                  }}
                >
                  <Field
                    label={t("Invoice due date", "Échéance de la facture")}
                  >
                    <Input name="dueOn" type="date" required />
                  </Field>
                  <button>
                    {t("Create or open invoice", "Créer ou ouvrir la facture")}
                  </button>
                </form>
              )}
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
