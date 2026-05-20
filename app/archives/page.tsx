import Link from "next/link";
import { Archive, ArrowLeft, CalendarDays, Download } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import { getLoadsResult } from "@/lib/data/loads";
import { requireSession } from "@/lib/integrations/auth";
import type { Load } from "@/types/load";

type ArchivesPageProps = {
  searchParams?: Promise<{ month?: string; from?: string; to?: string; success?: string; error?: string }>;
};

export default async function ArchivesPage({ searchParams }: ArchivesPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const isCarrier = session.role === "carrier" && !session.platformSuperAdmin;

  if (!isCarrier) {
    return (
      <main className="min-h-screen p-8 max-md:p-4">
        <div className="mx-auto max-w-4xl">
          <BackLink />
          <section className="section-panel mt-6 p-7 max-md:p-5">
            <p className="eyebrow">Archives</p>
            <h1 className="text-4xl font-extrabold tracking-normal text-white max-md:text-3xl">Archive exports live on Loads</h1>
            <p className="mt-3 text-sm leading-6 text-manifest-muted">
              Admin and staff archive controls remain available from the Loads module.
            </p>
            <Link href="/loads" className="form-button mt-5 min-h-11 px-4 text-sm">Open Loads</Link>
          </section>
        </div>
      </main>
    );
  }

  const carrierId = session.carrierId ?? "";
  const { loads } = await getLoadsResult();
  const selectedMonth = params?.month ?? currentMonth();
  const filteredLoads = filterCarrierArchiveLoads(loads, {
    month: selectedMonth,
    from: params?.from ?? "",
    to: params?.to ?? "",
  });
  const archiveParams = new URLSearchParams();
  archiveParams.set("carrierId", carrierId);
  if (selectedMonth) archiveParams.set("month", selectedMonth);
  if (params?.from) archiveParams.set("from", params.from);
  if (params?.to) archiveParams.set("to", params.to);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-5xl">
        <BackLink />

        {params?.success ? <Notice tone="success" message={decodeURIComponent(params.success)} /> : null}
        {params?.error ? <Notice tone="error" message={decodeURIComponent(params.error)} /> : null}

        <section className="section-panel mt-6 overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.18),rgba(17,17,20,0.9)_48%,rgba(255,255,255,0.04))] p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-6 max-lg:flex-col">
            <div>
              <p className="eyebrow">Carrier Archives</p>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">Download load archive</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
                Choose a month or date range, review matching assigned loads, then download the archive package.
              </p>
            </div>
            <div className="grid min-h-32 min-w-44 place-items-center rounded-md border border-manifest-red/45 bg-black/45 p-4 text-center">
              <Archive className="h-7 w-7 text-manifest-red" />
              <strong className="mt-3 text-3xl text-white">{filteredLoads.length}</strong>
              <span className="text-xs font-bold text-manifest-muted">loads selected</span>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(280px,0.4fr)] gap-5 max-lg:grid-cols-1">
          <div className="section-panel p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
              <div>
                <p className="eyebrow">Archive Filters</p>
                <h2 className="text-2xl font-extrabold text-white">Select archive period</h2>
              </div>
              <CalendarDays className="h-5 w-5 text-manifest-red" />
            </div>
            <form className="grid grid-cols-[minmax(160px,1fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_auto] gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <Field label="Month" name="month" type="month" defaultValue={selectedMonth} />
              <Field label="From" name="from" type="date" defaultValue={params?.from ?? ""} />
              <Field label="To" name="to" type="date" defaultValue={params?.to ?? ""} />
              <button className="form-button min-h-11 self-end px-4 text-sm">Preview</button>
            </form>

            {filteredLoads.length ? (
              <a href={`/loads/archive?${archiveParams.toString()}`} className="form-button mt-5 min-h-11 w-fit px-4 text-sm max-sm:w-full">
                <Download className="h-4 w-4" />
                Download Archive
              </a>
            ) : (
              <div className="empty-state mt-5">No loads exist for the selected archive period.</div>
            )}
          </div>

          <aside className="section-panel p-6 max-md:p-4">
            <p className="eyebrow">Package Contents</p>
            <h2 className="mb-4 text-2xl font-extrabold text-white">Export includes</h2>
            <div className="grid gap-3 text-sm text-manifest-muted">
              <SummaryItem label="Excel summary" value="loads-summary.xlsx" />
              <SummaryItem label="PODs" value="Uploaded POD files" />
              <SummaryItem label="Rate confirmations" value="Uploaded rate cons" />
            </div>
          </aside>
        </section>

        <section className="section-panel mt-5 p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Preview</p>
            <h2 className="text-2xl font-extrabold text-white">Loads in this archive</h2>
          </div>
          {filteredLoads.length ? (
            <div className="grid gap-3">
              {filteredLoads.map((load) => (
                <article key={load.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border border-white/10 bg-black/25 p-4 max-md:grid-cols-1">
                  <div>
                    <Link href={`/loads/${load.id}`} className="font-extrabold text-white hover:text-manifest-red">Load {load.loadNumber}</Link>
                    <p className="mt-1 text-sm text-manifest-muted">{load.brokerName || "Broker"} · {load.originCity}, {load.originState} to {load.destinationCity}, {load.destinationState}</p>
                    <p className="mt-1 text-xs font-bold text-manifest-quiet">{load.pickupDate ?? "No pickup"} / {load.deliveryDate ?? "No delivery"}</p>
                  </div>
                  <StatusChip value={load.status.replace("_", " ")} />
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">No loads exist for this date selection.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function filterCarrierArchiveLoads(loads: Load[], filters: { month: string; from: string; to: string }) {
  return loads.filter((load) => {
    const loadDate = load.pickupDate || load.deliveryDate || load.createdAt.slice(0, 10);
    if (filters.month && !loadDate.startsWith(filters.month)) return false;
    if (filters.from && loadDate < filters.from) return false;
    if (filters.to && loadDate > filters.to) return false;
    return true;
  });
}

function BackLink() {
  return (
    <Link href="/loads" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
      <ArrowLeft className="h-4 w-4" />
      Loads
    </Link>
  );
}

function Field({ label, name, type, defaultValue }: { label: string; name: string; type: string; defaultValue: string }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} className="form-control" />
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-3">
      <span className="panel-label">{label}</span>
      <strong className="text-sm text-white">{value}</strong>
    </div>
  );
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mt-5 rounded-md border px-4 py-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
