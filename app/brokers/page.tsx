import Link from "next/link";
import { ArrowLeft, Building2, Search, ShieldAlert } from "lucide-react";
import { createBrokerAction, requestBrokerCheckAction } from "@/app/actions/brokers";
import { BrokerStatusBadge } from "@/components/broker-status";
import { getBrokerCheckRequests, getBrokers } from "@/lib/data/brokers";
import { requireSession } from "@/lib/integrations/auth";
import { canManageBrokerRecord } from "@/lib/security/tenant-rules";
import type { Broker } from "@/types/broker";

type BrokersPageProps = {
  searchParams?: Promise<{ q?: string; success?: string; error?: string }>;
};

export default async function BrokersPage({ searchParams }: BrokersPageProps) {
  const params = await searchParams;
  const query = params?.q ?? "";
  const session = await requireSession();
  const canManage = canManageBrokerRecord(session, session.organizationId);
  const brokers = await getBrokers(query);
  const requests = canManage ? await getBrokerCheckRequests() : [];

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        {params?.success ? <Notice tone="success" message={decodeURIComponent(params.success)} /> : null}
        {params?.error ? <Notice tone="error" message={decodeURIComponent(params.error)} /> : null}

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.18),rgba(17,17,20,0.9)_48%,rgba(255,255,255,0.04))] p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-6 max-lg:flex-col">
            <div>
              <p className="eyebrow">Broker Check</p>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">Broker Registry</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
                Search brokers by name or MC number before booking or accepting loads.
              </p>
            </div>
            <div className="grid min-h-32 min-w-48 place-items-center rounded-md border border-manifest-red/45 bg-black/45 p-4 text-center">
              <ShieldAlert className="h-7 w-7 text-manifest-red" />
              <strong className="mt-3 text-2xl text-white">{brokers.length}</strong>
              <span className="text-xs font-bold text-manifest-muted">matching brokers</span>
            </div>
          </div>
        </section>

        <section className="section-panel mb-5 p-5">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-72 flex-1 gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Broker name or MC number
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
                <input name="q" defaultValue={query} className="form-control pl-9" placeholder="Acme Brokerage or MC123456" />
              </span>
            </label>
            <button className="form-button min-h-11 px-4 text-sm">Search brokers</button>
          </form>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)] gap-5 max-xl:grid-cols-1">
          <div className="section-panel p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Registry</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Broker results</h2>
              </div>
            </div>
            {brokers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                      <th className="border-b border-white/10 px-4 py-4">Broker</th>
                      <th className="border-b border-white/10 px-4 py-4">MC / DOT</th>
                      <th className="border-b border-white/10 px-4 py-4">Authority</th>
                      <th className="border-b border-white/10 px-4 py-4">Status</th>
                      <th className="border-b border-white/10 px-4 py-4">Risk</th>
                      <th className="border-b border-white/10 px-4 py-4">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokers.map((broker) => <BrokerRow key={broker.id} broker={broker} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <BrokerNotFound query={query} canManage={canManage} />
            )}
          </div>

          <div className="grid gap-5">
            <BrokerRequestForm query={query} />
            {canManage ? <BrokerCreateForm /> : null}
            {canManage ? <BrokerRequestQueue requests={requests} /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function BrokerRow({ broker }: { broker: Broker }) {
  return (
    <tr className="transition hover:bg-manifest-red/10">
      <td className="border-b border-white/10 px-4 py-4">
        <Link href={`/brokers/${broker.id}`} className="font-extrabold text-white hover:text-manifest-red">{broker.brokerName}</Link>
        <span className="mt-1 block text-xs text-manifest-muted">{broker.notes || "No public notes"}</span>
      </td>
      <td className="border-b border-white/10 px-4 py-4 text-sm text-manifest-muted">
        <strong className="block text-white">{broker.mcNumber || "No MC"}</strong>
        {broker.dotNumber || "No DOT"}
      </td>
      <td className="border-b border-white/10 px-4 py-4 text-sm text-manifest-muted">{broker.authorityStatus || "Unknown"}</td>
      <td className="border-b border-white/10 px-4 py-4"><BrokerStatusBadge value={broker.approvedStatus} /></td>
      <td className="border-b border-white/10 px-4 py-4"><BrokerStatusBadge value={broker.riskLevel} /></td>
      <td className="border-b border-white/10 px-4 py-4 text-sm text-manifest-muted">
        <strong className="block text-white">{broker.contactEmail || "No email"}</strong>
        {broker.contactPhone || "No phone"}
      </td>
    </tr>
  );
}

function BrokerNotFound({ query, canManage }: { query: string; canManage: boolean }) {
  return (
    <div className="empty-state">
      <Building2 className="mx-auto mb-3 h-8 w-8 text-manifest-red" />
      <strong className="block text-white">Broker not found</strong>
      <p className="mt-2">
        {query ? `No registry match for "${query}".` : "Search by broker name or MC number to check broker status."}{" "}
        {canManage ? "Create a broker record or submit a check request." : "Submit a broker check request for admin review."}
      </p>
    </div>
  );
}

function BrokerRequestForm({ query }: { query: string }) {
  return (
    <form action={requestBrokerCheckAction} className="section-panel p-5">
      <p className="eyebrow">Broker Not Found</p>
      <h2 className="mb-4 text-xl font-extrabold text-white">Request broker check</h2>
      <div className="grid gap-3">
        <Field label="Broker Name" name="brokerName" defaultValue={query} />
        <Field label="MC Number" name="mcNumber" />
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Notes
          <textarea name="notes" className="form-control min-h-20 resize-y" placeholder="Add lane, contact, or booking context." />
        </label>
        <button className="form-button min-h-10 px-3 text-sm">Submit request</button>
      </div>
    </form>
  );
}

function BrokerCreateForm() {
  return (
    <form action={createBrokerAction} className="section-panel p-5">
      <p className="eyebrow">Admin</p>
      <h2 className="mb-4 text-xl font-extrabold text-white">Create broker</h2>
      <div className="grid gap-3">
        <Field label="Broker Name" name="brokerName" required />
        <Field label="MC Number" name="mcNumber" />
        <Field label="Contact Email" name="contactEmail" type="email" />
        <StatusFields />
        <button className="form-button min-h-10 px-3 text-sm">Create broker</button>
      </div>
    </form>
  );
}

function BrokerRequestQueue({ requests }: { requests: Awaited<ReturnType<typeof getBrokerCheckRequests>> }) {
  return (
    <section className="section-panel p-5">
      <p className="eyebrow">Review Queue</p>
      <h2 className="mb-4 text-xl font-extrabold text-white">Broker check requests</h2>
      {requests.length ? (
        <div className="grid gap-2">
          {requests.slice(0, 6).map((request) => (
            <div key={request.id} className="rounded-md border border-white/10 bg-black/25 p-3 text-sm text-manifest-muted">
              <strong className="block text-white">{request.brokerName || "Unnamed broker"}</strong>
              MC {request.mcNumber || "not provided"} · {request.status}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-manifest-muted">No open broker check requests.</p>
      )}
    </section>
  );
}

function StatusFields() {
  return (
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
        Approval
        <select name="approvedStatus" className="form-control">
          <option value="approved">Approved</option>
          <option value="review_required">Review Required</option>
          <option value="blocked">Blocked</option>
        </select>
      </label>
      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
        Risk
        <select name="riskLevel" className="form-control">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
    </div>
  );
}

function Field({ label, name, type = "text", defaultValue = "", required = false }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="form-control" />
    </label>
  );
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${classes}`}>{message}</div>;
}
