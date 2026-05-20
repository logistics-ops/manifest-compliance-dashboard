import Link from "next/link";
import { Archive, ArrowLeft, Download, Plus, Search, Trash2 } from "lucide-react";
import { deleteArchivedLoadFilesAction, markLoadsArchivedAction } from "@/app/actions/loads";
import { getRecentLoadActivity } from "@/lib/data/load-activity";
import { getLoadArchiveMetrics, getLoadsResult } from "@/lib/data/loads";
import { requireSession } from "@/lib/integrations/auth";
import { canManageCompliance } from "@/lib/auth/permissions";
import { LoadDocumentUploader } from "@/components/load-document-uploader";
import { StatusChip } from "@/components/status-chip";
import { canUploadLoadDocumentType } from "@/lib/security/tenant-rules";
import type { LoadDocument, LoadDocumentType, LoadStatus } from "@/types/load";

const statuses: Array<LoadStatus | "all"> = ["all", "booked", "in_transit", "delivered", "pod_uploaded", "pod_sent", "invoiced", "cancelled"];

type LoadsPageProps = {
  searchParams?: Promise<{ query?: string; status?: string; archived?: string; success?: string; error?: string }>;
};

export default async function LoadsPage({ searchParams }: LoadsPageProps) {
  const session = await requireSession();
  const { loads, error: loadError } = await getLoadsResult();
  const archiveMetrics = await getLoadArchiveMetrics(loads);
  const recentActivity = await getRecentLoadActivity(6);
  const params = await searchParams;
  const query = params?.query?.trim().toLowerCase() ?? "";
  const status = statuses.includes(params?.status as LoadStatus | "all") ? params?.status ?? "all" : "all";
  const archivedMode = params?.archived === "all" ? "all" : params?.archived === "archived" ? "archived" : "active";
  const filteredLoads = loads.filter((load) => {
    const haystack = [
      load.loadNumber,
      load.carrierName,
      load.driverName,
      load.brokerName,
      load.brokerEmail,
      load.originCity,
      load.originState,
      load.destinationCity,
      load.destinationState,
    ].join(" ").toLowerCase();

    const archiveMatch =
      archivedMode === "all" ||
      (archivedMode === "active" && !load.archivedAt) ||
      (archivedMode === "archived" && Boolean(load.archivedAt));

    return archiveMatch && haystack.includes(query) && (status === "all" || load.status === status);
  });
  const canManageArchives = canManageCompliance(session);
  const carrierOptions = Array.from(new Map(loads.map((load) => [load.carrierId, load.carrierName])).entries());
  const brokerOptions = Array.from(new Set(loads.map((load) => load.brokerName).filter(Boolean)));
  const filteredLoadIds = filteredLoads.map((load) => load.id).join(",");
  const pendingPodMissing = loads.filter((load) => load.status === "delivered" && !latestDocument(load.documents, "pod")).length;
  const pendingNotInvoiced = loads.filter((load) => ["delivered", "pod_sent"].includes(load.status)).length;
  const pendingRateConMissing = loads.filter((load) => !latestDocument(load.documents, "rate_confirmation")).length;
  const isCarrierPortal = session.role === "carrier" && !session.platformSuperAdmin;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <Link href="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Compliance dashboard
            </Link>
            <p className="eyebrow">Load Management</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              ManifestOS loads
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Tenant-scoped load operations, broker POD workflow, and load document evidence.
            </p>
          </div>
          {canManageCompliance(session) || (session.role === "carrier" && Boolean(session.carrierId)) ? (
            <div className="flex flex-wrap gap-3">
              {isCarrierPortal ? (
                <Link href="/archives" className="form-button min-h-11 px-4 text-sm">
                  <Archive className="h-4 w-4" />
                  Archives
                </Link>
              ) : (
                <a href={archiveUrl()} className="form-button min-h-11 px-4 text-sm">
                  <Download className="h-4 w-4" />
                  Download Monthly Archive
                </a>
              )}
              <Link href="/loads/new" className="form-button min-h-11 px-4 text-sm">
                <Plus className="h-4 w-4" />
                Create Load
              </Link>
            </div>
          ) : null}
        </header>

        {params?.success ? (
          <div className="mb-5 rounded-md border border-manifest-green/35 bg-manifest-green/10 px-4 py-3 text-sm font-bold text-manifest-green">
            {decodeURIComponent(params.success)}
          </div>
        ) : null}
        {params?.error ? (
          <div className="mb-5 rounded-md border border-manifest-danger/40 bg-manifest-danger/10 px-4 py-3 text-sm font-bold text-manifest-danger">
            {decodeURIComponent(params.error)}
          </div>
        ) : null}

        <section className="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)] gap-5 max-xl:grid-cols-1">
          <div className="section-panel p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
              <div>
                <p className="eyebrow">Archive Export</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Monthly load package</h2>
              </div>
              <Archive className="h-5 w-5 text-manifest-red" />
            </div>
            <form action="/loads/archive" method="get" className={isCarrierPortal ? "grid grid-cols-[minmax(180px,280px)_auto] gap-3 max-md:grid-cols-1" : "grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1"}>
              <Field label="Month" name="month" type="month" />
              {isCarrierPortal ? (
                <input type="hidden" name="carrierId" value={session.carrierId ?? ""} />
              ) : (
                <>
                  <Field label="From" name="from" type="date" />
                  <Field label="To" name="to" type="date" />
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Carrier
                  <select name="carrierId" className="form-control">
                    <option value="">All carriers</option>
                    {carrierOptions.map(([carrierId, carrierName]) => <option key={carrierId} value={carrierId}>{carrierName}</option>)}
                  </select>
                </label>
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Broker
                    <input name="broker" list="broker-options" className="form-control" placeholder="Any broker" />
                  </label>
                  <datalist id="broker-options">
                    {brokerOptions.map((broker) => <option key={broker} value={broker} />)}
                  </datalist>
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Status
                    <select name="status" defaultValue="all" className="form-control">
                      {statuses.map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}
                    </select>
                  </label>
                </>
              )}
              <button className="form-button self-end">
                <Download className="h-4 w-4" />
                Export ZIP
              </button>
            </form>
          </div>

          <div className="section-panel p-6 max-md:p-4">
            <p className="eyebrow">Storage</p>
            <h2 className="mb-4 text-2xl font-extrabold tracking-normal text-white">Archive posture</h2>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Active loads" value={archiveMetrics.activeLoads} />
              <Metric label="Archived loads" value={archiveMetrics.archivedLoads} />
              <Metric label="Estimated storage" value={formatBytes(archiveMetrics.estimatedStorageBytes)} />
              <Metric label="Files deleted" value={archiveMetrics.archivedFilesDeletedCount} />
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] gap-5 max-xl:grid-cols-1">
          <div className="section-panel p-6 max-md:p-4">
            <p className="eyebrow">Pending Actions</p>
            <h2 className="mb-4 text-2xl font-extrabold tracking-normal text-white">Operational follow-up</h2>
            <div className="grid gap-3">
              <PendingAction label="POD missing" value={pendingPodMissing} />
              <PendingAction label="Delivered not invoiced" value={pendingNotInvoiced} />
              <PendingAction label="Rate con missing" value={pendingRateConMissing} />
            </div>
          </div>
          <div className="section-panel p-6 max-md:p-4">
            <p className="eyebrow">Recent Load Activity</p>
            <h2 className="mb-4 text-2xl font-extrabold tracking-normal text-white">Latest operational events</h2>
            {recentActivity.length ? (
              <div className="grid gap-2">
                {recentActivity.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3 rounded-md border border-white/10 bg-black/25 p-3 max-md:flex-col">
                    <div>
                      <strong className="block text-sm text-white">{event.title}</strong>
                      <span className="text-xs text-manifest-muted">Load {String(event.metadata.load_number ?? event.metadata.loadNumber ?? "")}</span>
                    </div>
                    <span className="text-xs font-bold text-manifest-muted">{formatDate(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No recent load activity recorded yet.</div>
            )}
          </div>
        </section>

        {canManageArchives ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
              <div>
                <p className="eyebrow">Archive Controls</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Filtered load archive actions</h2>
              </div>
              <StatusChip value={`${filteredLoads.length} filtered`} />
            </div>
            <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <form action={markLoadsArchivedAction} className="rounded-md border border-white/10 bg-black/25 p-4">
                <input type="hidden" name="loadIds" value={filteredLoadIds} />
                <strong className="block text-sm text-white">Mark filtered loads archived</strong>
                <p className="mt-2 text-sm leading-6 text-manifest-muted">Archived loads stay searchable and remain available in history views.</p>
                <button className="form-button mt-4 w-fit" disabled={!filteredLoadIds}>
                  <Archive className="h-4 w-4" />
                  Mark archived
                </button>
              </form>
              <form action={deleteArchivedLoadFilesAction} className="rounded-md border border-manifest-danger/35 bg-manifest-danger/10 p-4">
                <input type="hidden" name="loadIds" value={filteredLoadIds} />
                <strong className="block text-sm text-white">Delete archived files from storage</strong>
                <p className="mt-2 text-sm leading-6 text-manifest-muted">This only removes archived POD/rate confirmation objects. Load metadata remains.</p>
                <input name="confirmDelete" className="form-control mt-4" placeholder="Type CONFIRM" />
                <button className="form-button mt-3 w-fit">
                  <Trash2 className="h-4 w-4" />
                  Delete archived files
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-end justify-between gap-4 max-lg:flex-col max-lg:items-stretch">
            <div>
              <p className="eyebrow">Operations Board</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Loads table</h2>
            </div>
            <form className="flex gap-3 max-md:flex-col">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Search
                <span className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
                  <input name="query" defaultValue={params?.query ?? ""} className="form-control w-72 pl-9 max-md:w-full" placeholder="Load, carrier, broker..." />
                </span>
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Status
                <select name="status" defaultValue={status} className="form-control">
                  {statuses.map((option) => (
                    <option key={option} value={option}>{formatStatus(option)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                View
                <select name="archived" defaultValue={archivedMode} className="form-control">
                  <option value="active">Active loads</option>
                  <option value="archived">Archived loads</option>
                  <option value="all">All history</option>
                </select>
              </label>
              <button className="form-button mb-0.5 self-end">Filter</button>
            </form>
          </div>

          {loadError ? (
            <div className="mb-5 rounded-md border border-manifest-danger/40 bg-manifest-danger/10 px-4 py-3 text-sm font-bold text-manifest-danger">
              {loadError}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className={`w-full border-collapse ${isCarrierPortal ? "min-w-[860px]" : "min-w-[1180px]"}`}>
              <thead>
                <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                  <th className="border-b border-white/10 px-4 py-4">Load</th>
                  {!isCarrierPortal ? <th className="border-b border-white/10 px-4 py-4">Carrier</th> : null}
                  <th className="border-b border-white/10 px-4 py-4">Broker</th>
                  <th className="border-b border-white/10 px-4 py-4">Lane</th>
                  <th className="border-b border-white/10 px-4 py-4">Dates</th>
                  <th className="border-b border-white/10 px-4 py-4">Rate</th>
                  {!isCarrierPortal ? <th className="border-b border-white/10 px-4 py-4">Rate Confirmation</th> : null}
                  <th className="border-b border-white/10 px-4 py-4">Status</th>
                  {!isCarrierPortal ? <th className="border-b border-white/10 px-4 py-4">Archive</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredLoads.length ? filteredLoads.map((load) => {
                  const rateConfirmation = latestDocument(load.documents, "rate_confirmation");
                  const canUploadRateConfirmation = canUploadLoadDocumentType(
                    session,
                    { organizationId: load.organizationId, carrierId: load.carrierId },
                    "rate_confirmation",
                  );

                  return (
                  <tr key={load.id} className="align-top transition hover:bg-manifest-red/10">
                    <td className="border-b border-white/10 px-4 py-4">
                      <Link href={`/loads/${load.id}`} className="font-extrabold text-white hover:text-manifest-red">{load.loadNumber}</Link>
                      <span className="mt-1 block text-xs text-manifest-muted">{load.driverName || "No driver"}</span>
                    </td>
                    {!isCarrierPortal ? <td className="border-b border-white/10 px-4 py-4 text-sm font-bold text-white">{load.carrierName}</td> : null}
                    <td className="border-b border-white/10 px-4 py-4">
                      <strong className="block text-sm text-white">{load.brokerName || "Broker"}</strong>
                      <span className="text-xs text-manifest-muted">{load.brokerEmail || "No email"}</span>
                    </td>
                    <td className="border-b border-white/10 px-4 py-4 text-sm text-manifest-muted">
                      {load.originCity}, {load.originState} → {load.destinationCity}, {load.destinationState}
                    </td>
                    <td className="border-b border-white/10 px-4 py-4 text-xs font-bold text-manifest-muted">
                      {load.pickupDate ?? "No pickup"} / {load.deliveryDate ?? "No delivery"}
                    </td>
                    <td className="border-b border-white/10 px-4 py-4 text-sm font-extrabold text-white">{formatMoney(load.rateAmount)}</td>
                    {!isCarrierPortal ? <td className="border-b border-white/10 px-4 py-4">
                      <div className="w-80">
                        <LoadDocumentUploader
                          loadId={load.id}
                          documentType="rate_confirmation"
                          label="Rate Confirmation"
                          document={rateConfirmation}
                          canUpload={canUploadRateConfirmation}
                          fileDeleted={Boolean(load.filesDeletedAt)}
                        />
                      </div>
                    </td> : null}
                    <td className="border-b border-white/10 px-4 py-4"><StatusChip value={formatStatus(load.status)} /></td>
                    {!isCarrierPortal ? <td className="border-b border-white/10 px-4 py-4 text-xs font-bold text-manifest-muted">
                      {load.archivedAt ? `Archived ${formatDate(load.archivedAt)}` : "Active"}
                    </td> : null}
                  </tr>
                );
                }) : (
                  <tr>
                    <td colSpan={isCarrierPortal ? 6 : 9} className="border-b border-white/10 px-4 py-8">
                      <div className="empty-state">No loads match the current filters.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-panel mt-5 p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Export History</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Recent archive events</h2>
          </div>
          {archiveMetrics.exportHistory.length ? (
            <div className="grid gap-2">
              {archiveMetrics.exportHistory.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 p-3 text-sm max-md:flex-col max-md:items-start">
                  <strong className="text-white">{event.action.replace("load.", "").replace(/_/g, " ")}</strong>
                  <span className="text-manifest-muted">{formatDate(event.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No archive exports recorded yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, name, type }: { label: string; name: string; type: string }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} className="form-control" />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-3">
      <span className="panel-label">{label}</span>
      <strong className="mt-2 block text-xl text-white">{value}</strong>
    </div>
  );
}

function PendingAction({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 p-3">
      <span className="text-sm font-bold text-manifest-muted">{label}</span>
      <strong className={value ? "text-xl text-manifest-amber" : "text-xl text-manifest-green"}>{value}</strong>
    </div>
  );
}

function formatStatus(value: string) {
  if (value === "all") return "All statuses";
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function archiveUrl(extra: { carrierId?: string } = {}) {
  const params = new URLSearchParams();
  const now = new Date();
  params.set("month", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  if (extra.carrierId) params.set("carrierId", extra.carrierId);
  return `/loads/archive?${params.toString()}`;
}

function latestDocument(documents: LoadDocument[], documentType: LoadDocumentType) {
  return documents.filter((document) => document.documentType === documentType).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}
