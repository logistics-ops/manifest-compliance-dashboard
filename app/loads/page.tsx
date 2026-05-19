import Link from "next/link";
import { ArrowLeft, Plus, Search, Truck } from "lucide-react";
import { getLoads } from "@/lib/data/loads";
import { requireSession } from "@/lib/integrations/auth";
import { canManageCompliance } from "@/lib/auth/permissions";
import { LoadDocumentUploader } from "@/components/load-document-uploader";
import { StatusChip } from "@/components/status-chip";
import { canUploadLoadDocumentType } from "@/lib/security/tenant-rules";
import type { LoadDocument, LoadDocumentType, LoadStatus } from "@/types/load";

const statuses: Array<LoadStatus | "all"> = ["all", "booked", "in_transit", "delivered", "pod_uploaded", "pod_sent", "invoiced", "cancelled"];

type LoadsPageProps = {
  searchParams?: Promise<{ query?: string; status?: string }>;
};

export default async function LoadsPage({ searchParams }: LoadsPageProps) {
  const session = await requireSession();
  const loads = await getLoads();
  const params = await searchParams;
  const query = params?.query?.trim().toLowerCase() ?? "";
  const status = statuses.includes(params?.status as LoadStatus | "all") ? params?.status ?? "all" : "all";
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

    return haystack.includes(query) && (status === "all" || load.status === status);
  });

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
          {canManageCompliance(session) ? (
            <Link href="/loads/new" className="form-button min-h-11 px-4 text-sm">
              <Plus className="h-4 w-4" />
              New load
            </Link>
          ) : null}
        </header>

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
              <button className="form-button mb-0.5 self-end">Filter</button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse">
              <thead>
                <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                  <th className="border-b border-white/10 px-4 py-4">Load</th>
                  <th className="border-b border-white/10 px-4 py-4">Carrier</th>
                  <th className="border-b border-white/10 px-4 py-4">Broker</th>
                  <th className="border-b border-white/10 px-4 py-4">Lane</th>
                  <th className="border-b border-white/10 px-4 py-4">Dates</th>
                  <th className="border-b border-white/10 px-4 py-4">Rate</th>
                  <th className="border-b border-white/10 px-4 py-4">Rate Confirmation</th>
                  <th className="border-b border-white/10 px-4 py-4">Status</th>
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
                    <td className="border-b border-white/10 px-4 py-4 text-sm font-bold text-white">{load.carrierName}</td>
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
                    <td className="border-b border-white/10 px-4 py-4">
                      <div className="w-80">
                        <LoadDocumentUploader
                          loadId={load.id}
                          documentType="rate_confirmation"
                          label="Rate Confirmation"
                          document={rateConfirmation}
                          canUpload={canUploadRateConfirmation}
                        />
                      </div>
                    </td>
                    <td className="border-b border-white/10 px-4 py-4"><StatusChip value={formatStatus(load.status)} /></td>
                  </tr>
                );
                }) : (
                  <tr>
                    <td colSpan={8} className="border-b border-white/10 px-4 py-8">
                      <div className="empty-state">No loads match the current filters.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function formatStatus(value: string) {
  if (value === "all") return "All statuses";
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function latestDocument(documents: LoadDocument[], documentType: LoadDocumentType) {
  return documents.filter((document) => document.documentType === documentType).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}
