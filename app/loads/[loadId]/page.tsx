import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Archive, ArrowLeft, CheckCircle2, FileUp, Mail, Route, Send, Truck } from "lucide-react";
import { generateInvoiceAction, markInvoicePaidAction, sendInvoiceAction } from "@/app/actions/invoices";
import { sendPodToBrokerAction, updateLoadDetailsAction, updateLoadStatusAction } from "@/app/actions/loads";
import { LoadDocumentUploader } from "@/components/load-document-uploader";
import { StatusChip } from "@/components/status-chip";
import { getLoadActivityTimeline, type LoadActivityItem } from "@/lib/data/load-activity";
import { getInvoicesForLoad } from "@/lib/data/invoices";
import { getLoad } from "@/lib/data/loads";
import { requireSession } from "@/lib/integrations/auth";
import { canAccessLoadRecord, canUploadLoadDocumentType } from "@/lib/security/tenant-rules";
import type { LoadDocument, LoadDocumentType, LoadStatus } from "@/types/load";

type LoadPageProps = {
  params: Promise<{ loadId: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
};

const statuses: LoadStatus[] = ["booked", "in_transit", "delivered", "pod_uploaded", "pod_sent", "invoiced", "cancelled"];

export default async function LoadDetailPage({ params, searchParams }: LoadPageProps) {
  const { loadId } = await params;
  const messages = await searchParams;
  const session = await requireSession();
  const load = await getLoad(loadId);

  if (!load) {
    redirect(`/loads?error=${encodeURIComponent("Load not found or you do not have access to this load.")}`);
  }

  if (!canAccessLoadRecord(session, { organizationId: load.organizationId, carrierId: load.carrierId })) {
    redirect(`/loads?error=${encodeURIComponent("You do not have access to this load.")}`);
  }

  const rateConfirmation = latestDocument(load.documents, "rate_confirmation");
  const pod = latestDocument(load.documents, "pod");
  const canEdit = canAccessLoadRecord(session, { organizationId: load.organizationId, carrierId: load.carrierId });
  const canUploadRateConfirmation = canUploadLoadDocumentType(session, { organizationId: load.organizationId, carrierId: load.carrierId }, "rate_confirmation");
  const canUploadPod = canUploadLoadDocumentType(session, { organizationId: load.organizationId, carrierId: load.carrierId }, "pod");
  const timeline = await getLoadActivityTimeline(load);
  const invoices = await getInvoicesForLoad(load.id);
  const latestInvoice = invoices[0] ?? null;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Link href="/loads" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Loads
          </Link>
          <StatusChip value={formatStatus(load.status)} />
        </div>

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.22),rgba(17,17,20,0.88)_42%,rgba(255,255,255,0.045))] p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-8 max-lg:flex-col">
            <div>
              <p className="eyebrow">Load Detail</p>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
                Load {load.loadNumber}
              </h1>
              <p className="mt-4 text-sm leading-6 text-manifest-muted">
                {load.originCity}, {load.originState} to {load.destinationCity}, {load.destinationState}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <StatusChip value={load.carrierName} />
                <StatusChip value={formatMoney(load.rateAmount)} />
                {pod ? <StatusChip value="POD uploaded" /> : null}
              </div>
            </div>
            <div className="grid min-h-36 min-w-52 place-items-center rounded-md border border-manifest-red/55 bg-black/45 p-4 text-center">
              <Route className="h-8 w-8 text-manifest-red" />
              <strong className="mt-3 text-2xl text-white">{formatStatus(load.status)}</strong>
              <span className="text-xs font-bold text-manifest-muted">{load.deliveryDate ?? "No delivery date"}</span>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          <InfoPanel icon={<Truck className="h-4 w-4" />} label="Carrier" title={load.carrierName} detail={load.driverName || "No driver assigned"} />
          <InfoPanel icon={<Mail className="h-4 w-4" />} label="Broker" title={load.brokerName || "Broker"} detail={load.brokerEmail || "No broker email"} />
          <InfoPanel icon={<Route className="h-4 w-4" />} label="Dates" title={`${load.pickupDate ?? "No pickup"} → ${load.deliveryDate ?? "No delivery"}`} detail={formatMoney(load.rateAmount)} />
        </section>

        {messages?.success ? (
          <div className="mb-5 rounded-md border border-manifest-green/35 bg-manifest-green/10 px-4 py-3 text-sm font-bold text-manifest-green">
            {decodeURIComponent(messages.success)}
          </div>
        ) : null}
        {messages?.error ? (
          <div className="mb-5 rounded-md border border-manifest-danger/40 bg-manifest-danger/10 px-4 py-3 text-sm font-bold text-manifest-danger">
            {decodeURIComponent(messages.error)}
          </div>
        ) : null}

        <section className="mb-5 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
          <LoadDocumentUploader
            loadId={load.id}
            documentType="rate_confirmation"
            label="Rate Confirmation"
            document={rateConfirmation}
            canUpload={canUploadRateConfirmation}
            fileDeleted={Boolean(load.filesDeletedAt)}
          />
          <LoadDocumentUploader
            loadId={load.id}
            documentType="pod"
            label="Proof of Delivery"
            document={pod}
            canUpload={canUploadPod}
            fileDeleted={Boolean(load.filesDeletedAt)}
          />
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] gap-5 max-lg:grid-cols-1">
          <div className="section-panel p-6">
            <p className="eyebrow">Notes</p>
            <p className="mt-3 min-h-20 text-sm leading-6 text-manifest-muted">{load.notes || "No notes recorded for this load."}</p>
          </div>

          <div className="section-panel p-6">
            <p className="eyebrow">Workflow</p>
            {canEdit ? (
              <form action={updateLoadStatusAction} className="mt-4 grid gap-3">
                <input type="hidden" name="loadId" value={load.id} />
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Status
                  <select name="status" defaultValue={load.status} className="form-control">
                    {statuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                  </select>
                </label>
                <button className="form-button min-h-10 w-fit px-3 text-sm">Save status</button>
              </form>
            ) : (
              <p className="mt-4 rounded-md border border-white/10 bg-black/25 p-3 text-sm text-manifest-muted">
                You can view this load, but status changes are not available for your role.
              </p>
            )}

            {canEdit ? (
              <form action={sendPodToBrokerAction} className="mt-4 border-t border-white/10 pt-4">
                <input type="hidden" name="loadId" value={load.id} />
                <button className="form-button min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={!pod || !load.brokerEmail}>
                  <Send className="h-4 w-4" />
                  Send POD to Broker
                </button>
                <p className="mt-2 text-xs leading-5 text-manifest-muted">
                  {pod && load.brokerEmail
                    ? "Sends through Resend from pod@manifestgl.com and records a load audit event."
                    : !pod
                      ? "Upload a POD before sending it to the broker."
                      : "Add a broker email before sending the POD."}
                </p>
              </form>
            ) : null}
          </div>
        </section>

        <section className="section-panel mt-5 p-6 max-md:p-4">
          <div className="mb-5 flex items-start justify-between gap-4 max-md:flex-col">
            <div>
              <p className="eyebrow">Broker Billing</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Invoice workflow</h2>
              <p className="mt-2 text-sm leading-6 text-manifest-muted">
                Generate and deliver broker invoices after POD evidence is available.
              </p>
            </div>
            {latestInvoice ? <StatusChip value={`Invoice ${formatStatus(latestInvoice.status)}`} /> : <StatusChip value="No invoice" />}
          </div>

          {latestInvoice ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-lg:grid-cols-1">
              <div>
                <Link href={`/invoices/${latestInvoice.id}`} className="text-lg font-extrabold text-white hover:text-manifest-red">{latestInvoice.invoiceNumber}</Link>
                <p className="mt-1 text-sm text-manifest-muted">{formatMoney(latestInvoice.totalAmount)} · {latestInvoice.brokerEmail || "No broker email"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {latestInvoice.storagePath ? <a href={`/invoices/${latestInvoice.id}/download`} className="form-button">Download</a> : null}
                <form action={sendInvoiceAction}>
                  <input type="hidden" name="invoiceId" value={latestInvoice.id} />
                  <button className="form-button" disabled={!latestInvoice.storagePath || !latestInvoice.brokerEmail}>{latestInvoice.sentAt ? "Resend invoice" : "Send invoice"}</button>
                </form>
                <form action={markInvoicePaidAction}>
                  <input type="hidden" name="invoiceId" value={latestInvoice.id} />
                  <button className="form-button" disabled={latestInvoice.status === "paid" || latestInvoice.status === "void"}>Mark paid</button>
                </form>
              </div>
            </div>
          ) : (
            <form action={generateInvoiceAction} className="rounded-md border border-white/10 bg-black/25 p-4">
              <input type="hidden" name="loadId" value={load.id} />
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Invoice notes
                <textarea name="notes" className="form-control min-h-20 resize-y" placeholder="Optional broker billing notes." />
              </label>
              <button className="form-button mt-4" disabled={!pod && load.status !== "pod_sent"}>
                Generate Invoice
              </button>
              {!pod && load.status !== "pod_sent" ? (
                <p className="mt-2 text-xs text-manifest-muted">Upload or send a POD before generating an invoice.</p>
              ) : null}
            </form>
          )}
        </section>

        {canEdit ? (
          <section className="section-panel mt-5 p-6 max-md:p-4">
            <div className="mb-5">
              <p className="eyebrow">Edit Load Details</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Operational fields</h2>
            </div>
            <form action={updateLoadDetailsAction} className="grid gap-4">
              <input type="hidden" name="loadId" value={load.id} />
              <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                <Field label="Load Number" name="loadNumber" defaultValue={load.loadNumber} required />
                <Field label="Driver Name" name="driverName" defaultValue={load.driverName} />
                <Field label="Broker Name" name="brokerName" defaultValue={load.brokerName} />
                <Field label="Broker Email" name="brokerEmail" type="email" defaultValue={load.brokerEmail} />
                <Field label="Origin City" name="originCity" defaultValue={load.originCity} required />
                <Field label="Origin State" name="originState" defaultValue={load.originState} required />
                <Field label="Destination City" name="destinationCity" defaultValue={load.destinationCity} required />
                <Field label="Destination State" name="destinationState" defaultValue={load.destinationState} required />
                <Field label="Pickup Date" name="pickupDate" type="date" defaultValue={load.pickupDate ?? ""} />
                <Field label="Delivery Date" name="deliveryDate" type="date" defaultValue={load.deliveryDate ?? ""} />
                <Field label="Rate Amount" name="rateAmount" type="number" defaultValue={String(load.rateAmount)} />
              </div>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Notes
                <textarea name="notes" defaultValue={load.notes} className="form-control min-h-28 resize-y" />
              </label>
              <button className="form-button min-h-10 w-fit px-3 text-sm">Save load details</button>
            </form>
          </section>
        ) : null}

        <section className="section-panel mt-5 p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Activity Timeline</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Operational history</h2>
          </div>
          {timeline.length ? (
            <div className="relative grid gap-4 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-white/10">
              {timeline.map((event) => (
                <TimelineItem key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="empty-state">No activity recorded yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function TimelineItem({ event }: { event: LoadActivityItem }) {
  return (
    <article className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full border border-manifest-red/45 bg-[#111114] text-manifest-red">
        {timelineIcon(event.action)}
      </span>
      <div className="rounded-md border border-white/10 bg-black/25 p-4">
        <div className="flex items-start justify-between gap-3 max-md:flex-col">
          <div>
            <h3 className="text-base font-extrabold text-white">{event.title}</h3>
            <p className="mt-1 text-xs font-bold text-manifest-muted">By {event.actor}</p>
          </div>
          <span className="text-xs font-bold text-manifest-muted">{formatDateTime(event.timestamp)}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(event.metadata)
            .filter(([key, value]) => !key.includes("note") && value !== null && value !== undefined && value !== "")
            .slice(0, 8)
            .map(([key, value]) => (
              <span key={key} className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[11px] font-bold text-manifest-muted">
                {formatMetadataKey(key)}: {String(value)}
              </span>
            ))}
        </div>
      </div>
    </article>
  );
}

function timelineIcon(action: string) {
  if (action.includes("archive")) return <Archive className="h-4 w-4" />;
  if (action.includes("uploaded")) return <FileUp className="h-4 w-4" />;
  if (action.includes("pod_sent")) return <Send className="h-4 w-4" />;
  return <CheckCircle2 className="h-4 w-4" />;
}

function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="form-control" />
    </label>
  );
}

function latestDocument(documents: LoadDocument[], documentType: LoadDocumentType) {
  return documents.filter((document) => document.documentType === documentType).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}

function InfoPanel({ icon, label, title, detail }: { icon: ReactNode; label: string; title: string; detail: string }) {
  return (
    <article className="section-panel min-h-32 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-manifest-quiet">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 text-manifest-red">{icon}</span>
      </div>
      <strong className="block text-lg text-white">{title}</strong>
      <span className="mt-2 block text-sm text-manifest-muted">{detail}</span>
    </article>
  );
}

function formatStatus(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMetadataKey(value: string) {
  return value.replace(/_/g, " ");
}
