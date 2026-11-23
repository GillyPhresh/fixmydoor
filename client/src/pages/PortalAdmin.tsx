import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import "./portal.css";

type Customer = { id: string; name: string; category: string; email: string };
type Technician = { id: string; name: string; email: string; status: string; membership: { plan: string; status: string; billingPeriod: string; startsOn?: string | null; renewsOn?: string | null; includedBenefits: string } | null };
type Organization = { id: string; customerId: string; name: string; email: string; status: string; memberships: { id: string; role: string; status: string; account: { email: string; name: string } }[] };
type Invite = { id: string; email: string; kind: string; organizationRole?: string | null; expiresAt: string; acceptedAt?: string | null; revokedAt?: string | null; createdAt: string };
type Account = { id: string; email: string; name: string; kind: string; status: string };
type AIRequest = { id: string; repairType: string; status: string; createdAt: string; summary: string };
type Directory = { customers: Customer[]; technicians: Technician[]; organizations: Organization[]; accounts: Account[] };
const api = async <T,>(url: string, method = "GET", data?: unknown) => (await axios.request<T>({ url, method, data, withCredentials: true })).data;

export default function PortalAdmin() {
  const [, setLocation] = useLocation();
  const [authorized, setAuthorized] = useState(false);
  const [directory, setDirectory] = useState<Directory>({ customers: [], technicians: [], organizations: [], accounts: [] });
  const [invitations, setInvitations] = useState<Invite[]>([]);
  const [aiRequests, setAIRequests] = useState<AIRequest[]>([]);
  const [aiSuggestions, setAISuggestions] = useState<Record<string, { id: string; category: string; confidence: string }>>({});
  const [inviteKind, setInviteKind] = useState("CUSTOMER");
  const [inviteLink, setInviteLink] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedTech, setSelectedTech] = useState("");
  const t = (text: string) => text.replaceAll("_", " ");
  const businessCustomers = useMemo(() => directory.customers.filter(customer => customer.category === "Business"), [directory.customers]);

  const load = async () => {
    try {
      const auth = await api<{ authenticated: boolean }>("/api/auth/status");
      if (!auth.authenticated) { setLocation("/admin"); return; }
      setAuthorized(true);
      const [nextDirectory, nextInvitations, nextRequests] = await Promise.all([
        api<Directory>("/api/admin/portal/directory"),
        api<Invite[]>("/api/admin/portal/invitations"),
        api<AIRequest[]>("/api/admin/portal/ai/bookings"),
      ]);
      setDirectory(nextDirectory); setInvitations(nextInvitations); setAIRequests(nextRequests);
      setSelectedTech(current => current || nextDirectory.technicians[0]?.id || "");
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 401) setLocation("/admin");
      else setError("Portal administration data could not be loaded.");
    }
  };
  useEffect(() => { void load(); }, []);

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/portal/organizations", "POST", { customerId: form.get("customerId"), name: form.get("name"), externalId: form.get("externalId") || undefined, email: form.get("email"), phone: form.get("phone"), status: form.get("status") });
      setStatus("Organization saved and linked to its existing Business customer record."); await load();
    } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Organization could not be saved." : "Organization could not be saved."); }
    finally { setBusy(false); }
  };

  const issueInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setInviteLink(""); setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ status: string; invitationUrl?: string }>("/api/admin/portal/invitations", "POST", { kind: inviteKind, entityId: form.get("entityId"), ...(inviteKind === "ORGANIZATION" ? { email: form.get("email"), organizationRole: form.get("organizationRole") } : {}) });
      if (result.invitationUrl) setInviteLink(result.invitationUrl);
      setStatus(result.status === "COPY_LINK" ? "Invitation created. Copy its link and deliver it to the verified recipient through your approved channel. The link expires in 48 hours." : result.status === "ACTIVE" ? "Existing organization account added to this organization." : "Invitation email sent.");
      await load();
    } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Invitation could not be issued." : "Invitation could not be issued."); }
    finally { setBusy(false); }
  };

  const saveMembership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selectedTech) return; setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/admin/portal/technicians/${selectedTech}/membership`, "PUT", { plan: form.get("plan"), status: form.get("status"), billingPeriod: form.get("billingPeriod"), startsOn: form.get("startsOn") || "", renewsOn: form.get("renewsOn") || "", includedBenefits: String(form.get("includedBenefits") || "").split("\n").map(value => value.trim()).filter(Boolean), details: form.get("details") || "" });
      setStatus("Membership record saved. No billing was initiated."); await load();
    } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error || "Membership could not be saved." : "Membership could not be saved."); }
    finally { setBusy(false); }
  };

  if (!authorized) return <main className="portal-page"><div className="portal-loading">Checking staff access…</div></main>;
  return <main className="portal-page">
    <header className="portal-header"><a className="portal-brand" href="/">FIXMYDOOR <span>SERVICES</span></a><div className="portal-header-actions"><a className="portal-quiet" href="/admin/commercial">← Commercial dashboard</a><button className="portal-quiet" onClick={() => void load()}>Refresh</button></div></header>
    <section className="portal-hero"><div><div className="portal-eyebrow">Staff administration</div><h1>Portal access & business accounts</h1><p>Issue verified invitations, scope organization access, maintain technician membership records and review deterministic service triage.</p></div><div className="portal-hero-mark">FM<span>D</span></div></section>
    {status && <div className="portal-notice" role="status">{status}</div>}{error && <div className="portal-error" role="alert">{error}</div>}
    <div className="portal-grid">
      <section className="portal-card"><div className="portal-card-head"><h2>Business organization records</h2></div><p className="portal-help">Organizations link to an existing Business customer. Their properties, requests, quotes and invoices continue using the commercial records already in FixMyDoor.</p>
        <form className="portal-form" onSubmit={createOrganization}>
          <label className="portal-field"><span>Existing Business customer</span><select name="customerId" required defaultValue=""><option value="" disabled>Select customer</option>{businessCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label className="portal-field"><span>Organization name</span><input name="name" required maxLength={160} /></label><label className="portal-field"><span>Organization identifier (optional)</span><input name="externalId" maxLength={100} /></label><label className="portal-field"><span>Contact email</span><input name="email" type="email" /></label><label className="portal-field"><span>Phone</span><input name="phone" maxLength={35} /></label><label className="portal-field"><span>Account status</span><select name="status"><option>ACTIVE</option><option>SUSPENDED</option><option>INACTIVE</option></select></label><button className="portal-primary" disabled={busy}>Save organization</button>
        </form>
        <div className="portal-stack">{directory.organizations.map(org => <article className="portal-job" key={org.id}><div className="portal-card-head"><div><h3>{org.name}</h3><small>{org.email}</small></div><span className="portal-badge">{t(org.status)}</span></div>{org.memberships.map(member => <div className="portal-list-row" key={member.id}><div><strong>{member.account.name}</strong><small>{member.account.email} · {t(member.role)}</small></div>{member.status === "ACTIVE" && <button className="portal-secondary" onClick={async () => { await api(`/api/admin/portal/memberships/${member.id}/revoke`, "POST", {}).then(load).catch(() => setError("Membership could not be revoked.")); }}>Revoke access</button>}</div>)}</article>)}</div>
      </section>
      <section className="portal-card"><div className="portal-card-head"><h2>Issue portal invitation</h2></div><p className="portal-help">Customer invitations go only to the email already on the selected individual record. Technicians must be approved before invitation. Organization roles are checked on every request.</p>
        <form className="portal-form" onSubmit={issueInvitation}>
          <label className="portal-field"><span>Account type</span><select value={inviteKind} onChange={event => setInviteKind(event.target.value)}><option value="CUSTOMER">Individual customer</option><option value="TECHNICIAN">Approved technician</option><option value="ORGANIZATION">Organization user</option></select></label>
          {inviteKind === "CUSTOMER" && <label className="portal-field"><span>Customer record</span><select name="entityId" required defaultValue=""><option value="" disabled>Select customer</option>{directory.customers.filter(c => c.category === "Individual" && c.email.includes("@")).map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>)}</select></label>}
          {inviteKind === "TECHNICIAN" && <label className="portal-field"><span>Approved technician</span><select name="entityId" required defaultValue=""><option value="" disabled>Select technician</option>{directory.technicians.filter(t => t.status === "APPROVED").map(technician => <option key={technician.id} value={technician.id}>{technician.name} · {technician.email}</option>)}</select></label>}
          {inviteKind === "ORGANIZATION" && <><label className="portal-field"><span>Organization</span><select name="entityId" required defaultValue=""><option value="" disabled>Select organization</option>{directory.organizations.filter(org => org.status === "ACTIVE").map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label><label className="portal-field"><span>Invitee email</span><input name="email" type="email" required /></label><label className="portal-field"><span>Organization role</span><select name="organizationRole"><option value="ORG_ADMIN">Organization administrator</option><option value="PROPERTY_MANAGER">Property manager</option><option value="REQUESTER">Authorized requester</option><option value="BILLING">Billing contact</option></select></label></>}
          <button className="portal-primary" disabled={busy}>Issue invitation</button>
        </form>
        {inviteLink && <div className="portal-invite-link"><label className="portal-field"><span>Single-use invitation link · expires in 48 hours</span><input readOnly value={inviteLink} onFocus={event => event.currentTarget.select()} /></label><button className="portal-secondary" onClick={() => void navigator.clipboard.writeText(inviteLink).then(() => setStatus("Invitation link copied."))}>Copy invitation link</button></div>}
        <h3>Recent invitations</h3>{invitations.map(invite => <div className="portal-list-row" key={invite.id}><div><strong>{invite.email}</strong><small>{t(invite.kind)} · {invite.organizationRole ? t(invite.organizationRole) + " · " : ""}expires {new Date(invite.expiresAt).toLocaleString()}</small><small>{invite.acceptedAt ? "Accepted" : invite.revokedAt ? "Revoked" : new Date(invite.expiresAt) < new Date() ? "Expired" : "Pending"}</small></div>{!invite.acceptedAt && !invite.revokedAt && <button className="portal-secondary" onClick={async () => { await api(`/api/admin/portal/invitations/${invite.id}/revoke`, "POST", {}).then(load).catch(() => setError("Invitation could not be revoked.")); }}>Revoke</button>}</div>)}
      </section>
      <section className="portal-card"><div className="portal-card-head"><h2>Technician membership records</h2></div><p className="portal-help">This is a non-billing foundation. Saving membership data does not create a subscription, charge, renewal or provider account.</p>
        <form className="portal-form" key={selectedTech} onSubmit={saveMembership}>
          <label className="portal-field"><span>Technician</span><select value={selectedTech} onChange={event => setSelectedTech(event.target.value)}><option value="">Select technician</option>{directory.technicians.map(tech => <option key={tech.id} value={tech.id}>{tech.name} · {tech.status}</option>)}</select></label>
          <label className="portal-field"><span>Plan name</span><input name="plan" required defaultValue={directory.technicians.find(t => t.id === selectedTech)?.membership?.plan || "Founding Provider"} /></label>
          <label className="portal-field"><span>Status</span><select name="status" defaultValue={directory.technicians.find(t => t.id === selectedTech)?.membership?.status || "INACTIVE"}><option>INACTIVE</option><option>ACTIVE</option><option>SUSPENDED</option><option>CANCELLED</option></select></label>
          <label className="portal-field"><span>Billing period (record only)</span><select name="billingPeriod" defaultValue={directory.technicians.find(t => t.id === selectedTech)?.membership?.billingPeriod || "NONE"}><option>NONE</option><option>MONTHLY</option><option>ANNUAL</option></select></label>
          <label className="portal-field"><span>Start date</span><input name="startsOn" type="date" defaultValue={directory.technicians.find(t => t.id === selectedTech)?.membership?.startsOn || ""} /></label><label className="portal-field"><span>Renewal date</span><input name="renewsOn" type="date" defaultValue={directory.technicians.find(t => t.id === selectedTech)?.membership?.renewsOn || ""} /></label>
          <label className="portal-field"><span>Benefits, one per line</span><textarea name="includedBenefits" defaultValue={safeBenefits(directory.technicians.find(t => t.id === selectedTech)?.membership?.includedBenefits || "[]").join("\n")} /></label><label className="portal-field"><span>Staff note for audit trail</span><input name="details" maxLength={1000} /></label><button className="portal-primary" disabled={busy || !selectedTech}>Save membership record</button>
        </form>
      </section>
      <section className="portal-card"><div className="portal-card-head"><h2>Deterministic service triage</h2></div><p className="portal-help">Rule-based demonstration only. It does not call an external model, approve regulated work, price a job, schedule a technician or message a customer. Staff must review every suggestion.</p>
        <div className="portal-stack">{aiRequests.map(request => <article className="portal-job" key={request.id}><div className="portal-card-head"><div><h3>{request.repairType}</h3><small>{new Date(request.createdAt).toLocaleString()} · {request.status}</small></div><button className="portal-secondary" onClick={async () => { setError(""); try { const result = await api<{ id: string; suggestedCategory: string; confidence: string }>(`/api/admin/portal/ai/bookings/${request.id}/classify`, "POST", {}); setAISuggestions(current => ({ ...current, [request.id]: { id: result.id, category: result.suggestedCategory, confidence: result.confidence } })); setStatus(`Demonstration suggestion: ${result.suggestedCategory} (${result.confidence}). No business action has been taken.`); } catch { setError("Suggestion could not be generated."); } }}>Suggest category</button></div><p>{request.summary || "No customer summary provided."}</p>{aiSuggestions[request.id] && <div className="portal-notice"><strong>{aiSuggestions[request.id].category}</strong> · {aiSuggestions[request.id].confidence}<p>Staff review required. This suggestion has not changed the request.</p><button className="portal-secondary" onClick={async () => { try { await api(`/api/admin/portal/ai/${aiSuggestions[request.id].id}/review`, "POST", { decision: "ACKNOWLEDGED" }); setStatus("Suggestion review recorded. Request data was not changed."); } catch { setError("Suggestion review could not be recorded."); } }}>Record staff review</button></div>}</article>)}</div>
      </section>
      <section className="portal-card"><div className="portal-card-head"><h2>Portal accounts</h2></div>{directory.accounts.map(account => <div className="portal-list-row" key={account.id}><div><strong>{account.name}</strong><small>{account.email} · {t(account.kind)}</small></div><button className="portal-secondary" onClick={async () => { const status = account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"; try { await api(`/api/admin/portal/accounts/${account.id}/suspend`, "POST", { status }); setStatus(`Portal account ${status.toLowerCase()}.`); await load(); } catch { setError("Portal account status could not be changed."); } }}>{account.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button></div>)}</section>
    </div>
    <footer className="portal-footer">Staff-only page · Customer and technician data is scoped by server-side relationships.</footer>
  </main>;
}

function safeBenefits(value: string) {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; }
  catch { return []; }
}
