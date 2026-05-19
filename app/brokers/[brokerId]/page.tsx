import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText, Route } from "lucide-react";
import { updateBrokerAction } from "@/app/actions/brokers";
import { BrokerStatusBadge } from "@/components/broker-status";
import { getBroker, getBrokerLinkedLoads } from "@/lib/data/brokers";
import { getLoads } from "@/lib/data/loads";
import { getLoadActivityTimeline } from "@/lib/data/load-activity";
import { requireSession } from "@/lib/integrations/auth";
import { canManageBrokerRecord } from "@/lib/security/tenant-rules";

type BrokerDetailProps = {
  params: Promise<{ brokerId: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function BrokerDetailPage({ params, searchParams }: BrokerDetailProps) {
  const { brokerId } = await params;
  const messages = await searchParams;
  const session = await requireSession();
  const broker = await getBroker(brokerId);
  if (!broker) notFound();
  const canManage = canManageBrokerRecord(session, broker.organizationId);
  const loads = await getBrokerLinkedLoads(broker, await getLoads());
  const timelineItems = (await Promise.all(loads.slice(0, 8).map((load) => getLoadActivityTimeline(load)))).flat();

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-6xl">
        <Link href="/brokers" className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Broker Check
        </Link>

        {messages?.success ? <Notice tone="success" message={decodeURIComponent(messages.success)} /> : null}
        {messages?.error ? <Notice tone="error" message={decodeURIComponent(messages.error)} /> : null}

        <section className="section-panel mb-5 p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-5 max-lg:flex-col">
            <div>
              <p className="eyebrow">Broker Detail</p>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">{broker.brokerName}</h1>
              <p className="mt-4 text-sm leading-6 text-manifest-muted">MC {broker.mcNumber || "not provided"} · DOT {broker.dotNumber || "not provided"}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <BrokerStatusBadge value={broker.approvedStatus} />
                <BrokerStatusBadge value={broker.riskLevel} />
                <BrokerStatusBadge value={broker.authorityStatus || "Authority unknown"} />
              </div>
            </div>
            <div className="grid min-h-32 min-w-44 place-items-center rounded-md border border-manifest-red/45 bg-black/35 p-4 text-center">
              <Building2 className="h-7 w-7 text-manifest-red" />
              <strong className="mt-3 text-2xl text-white">{loads.length}</strong>
              <span className="text-xs font-bold text-manifest-muted">linked loads</span>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          <Tile label="Contact" value={broker.contactName || "No contact"} detail={broker.contactEmail || broker.contactPhone || "No contact info"} />
          <Tile label="Safety Rating" value={broker.safetyRating || "Unknown"} detail={broker.authorityStatus || "Authority not recorded"} />
          <Tile label="Blocked Reason" value={broker.blockedReason || "None"} detail={broker.notes || "No visible notes"} />
        </section>

        {canManage ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <p className="eyebrow">Admin Broker Controls</p>
            <h2 className="mb-4 text-2xl font-extrabold text-white">Edit broker details</h2>
            <form action={updateBrokerAction} className="grid gap-4">
              <input type="hidden" name="brokerId" value={broker.id} />
              <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
                <Field label="Broker Name" name="brokerName" defaultValue={broker.brokerName} required />
                <Field label="MC Number" name="mcNumber" defaultValue={broker.mcNumber} />
                <Field label="DOT Number" name="dotNumber" defaultValue={broker.dotNumber} />
                <Field label="Contact Name" name="contactName" defaultValue={broker.contactName} />
                <Field label="Contact Email" name="contactEmail" type="email" defaultValue={broker.contactEmail} />
                <Field label="Contact Phone" name="contactPhone" defaultValue={broker.contactPhone} />
                <Field label="Authority Status" name="authorityStatus" defaultValue={broker.authorityStatus} />
                <Field label="Safety Rating" name="safetyRating" defaultValue={broker.safetyRating} />
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Approval
                  <select name="approvedStatus" defaultValue={broker.approvedStatus} className="form-control">
                    <option value="approved">Approved</option>
                    <option value="review_required">Review Required</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </label>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Risk Level
                  <select name="riskLevel" defaultValue={broker.riskLevel} className="form-control">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <Field label="Blocked Reason" name="blockedReason" defaultValue={broker.blockedReason} />
              </div>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Internal Notes
                <textarea name="notes" defaultValue={broker.notes} className="form-control min-h-24 resize-y" />
              </label>
              <label className="flex items-center gap-3 text-sm font-bold text-manifest-muted">
                <input name="notesPrivate" type="checkbox" defaultChecked={broker.notesPrivate} className="h-4 w-4 accent-manifest-red" />
                Hide notes from carrier users
              </label>
              <button className="form-button min-h-10 w-fit px-3 text-sm">Save broker</button>
            </form>
          </section>
        ) : null}

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] gap-5 max-lg:grid-cols-1">
          <div className="section-panel p-6">
            <p className="eyebrow">Linked Loads</p>
            <h2 className="mb-4 text-2xl font-extrabold text-white">Broker load history</h2>
            {loads.length ? (
              <div className="grid gap-3">
                {loads.map((load) => (
                  <Link key={load.id} href={`/loads/${load.id}`} className="rounded-md border border-white/10 bg-black/25 p-4 transition hover:border-manifest-red/50 hover:bg-manifest-red/10">
                    <strong className="block text-white">Load {load.loadNumber}</strong>
                    <span className="text-sm text-manifest-muted">{load.originCity}, {load.originState} to {load.destinationCity}, {load.destinationState}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">No linked loads are visible for your role.</div>
            )}
          </div>

          <div className="grid gap-5">
            <Placeholder icon={<FileText className="h-5 w-5" />} title="Invoice/payment history" />
            <Placeholder icon={<Route className="h-5 w-5" />} title="POD history" />
            <section className="section-panel p-5">
              <p className="eyebrow">Audit Timeline</p>
              <h2 className="mb-4 text-xl font-extrabold text-white">Recent load events</h2>
              {timelineItems.length ? (
                <div className="grid gap-2 text-sm text-manifest-muted">
                  {timelineItems.slice(0, 6).map((event) => (
                    <div key={event.id} className="rounded-md border border-white/10 bg-black/25 p-3">
                      <strong className="block text-white">{event.title}</strong>
                      {event.actor}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-manifest-muted">No broker-linked activity yet.</p>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="section-panel p-4"><span className="panel-label">{label}</span><strong className="mt-2 block text-lg text-white">{value}</strong><p className="mt-2 text-sm text-manifest-muted">{detail}</p></article>;
}

function Field({ label, name, type = "text", defaultValue = "", required = false }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} className="form-control" /></label>;
}

function Placeholder({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <section className="section-panel p-5"><div className="mb-3 text-manifest-red">{icon}</div><p className="eyebrow">Placeholder</p><h2 className="text-xl font-extrabold text-white">{title}</h2><p className="mt-2 text-sm text-manifest-muted">Coming soon for broker operations history.</p></section>;
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${classes}`}>{message}</div>;
}
