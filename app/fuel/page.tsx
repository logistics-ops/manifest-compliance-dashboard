import Link from "next/link";
import { ArrowLeft, Download, Fuel, Plus, Search } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import { getCarriers } from "@/lib/data/carriers";
import { getFuelReceiptMetrics, getFuelReceipts } from "@/lib/data/fuel";
import { requireSession } from "@/lib/integrations/auth";
import { canRoleManageCompliance } from "@/lib/security/tenant-rules";
import type { FuelReceipt, FuelReceiptFilters } from "@/types/fuel";

type FuelPageProps = {
  searchParams?: Promise<FuelReceiptFilters & { success?: string; error?: string }>;
};

export default async function FuelPage({ searchParams }: FuelPageProps) {
  const params = await searchParams;
  const session = await requireSession();
  const isCarrier = session.role === "carrier" && !session.platformSuperAdmin;
  const receipts = await getFuelReceipts(params ?? {});
  const carriers = isCarrier ? [] : await getCarriers();
  const metrics = getFuelReceiptMetrics(receipts);
  const exportHref = `/fuel/export?${new URLSearchParams(cleanParams(params)).toString()}`;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex flex-wrap gap-3 max-md:grid max-md:grid-cols-1">
            <Link href={exportHref} className="form-button min-h-10 px-3 text-sm">
              <Download className="h-4 w-4" />
              Export CSV
            </Link>
            <Link href="/fuel/new" className="form-button min-h-10 px-3 text-sm">
              <Plus className="h-4 w-4" />
              New receipt
            </Link>
          </div>
        </div>

        {params?.success ? <Notice tone="success" message={decodeURIComponent(params.success)} /> : null}
        {params?.error ? <Notice tone="error" message={decodeURIComponent(params.error)} /> : null}

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.18),rgba(17,17,20,0.9)_48%,rgba(255,255,255,0.04))] p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-6 max-lg:flex-col">
            <div>
              <p className="eyebrow">Fleet / IFTA</p>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">Fuel Receipts</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
                Upload receipt images or PDFs, review AI-assisted extraction, and keep tenant-scoped fuel spend ready for reporting.
              </p>
            </div>
            <div className="grid min-h-32 min-w-48 place-items-center rounded-md border border-manifest-red/45 bg-black/45 p-4 text-center">
              <Fuel className="h-7 w-7 text-manifest-red" />
              <strong className="mt-3 text-2xl text-white">{receipts.length}</strong>
              <span className="text-xs font-bold text-manifest-muted">visible receipts</span>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <MetricCard label="Total gallons" value={metrics.totalGallons.toLocaleString()} detail="Filtered receipt volume" />
          <MetricCard label="Total spend" value={formatCurrency(metrics.totalSpend)} detail="Fuel purchases in view" />
          <MetricCard label="Needs review" value={metrics.missingReviewCount} detail="Pending approval or missing fields" />
          <MetricCard label="States" value={metrics.countByState.length} detail="IFTA jurisdiction spread" />
        </section>

        <section className="section-panel mb-5 p-5">
          <form className="grid grid-cols-[minmax(220px,1fr)_repeat(6,minmax(120px,170px))_auto] gap-3 max-2xl:grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Search
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
                <input name="q" defaultValue={params?.q ?? ""} className="form-control pl-9" placeholder="Vendor, carrier, state..." />
              </span>
            </label>
            <Field label="From" name="dateFrom" type="date" defaultValue={params?.dateFrom ?? ""} />
            <Field label="To" name="dateTo" type="date" defaultValue={params?.dateTo ?? ""} />
            {!isCarrier ? (
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Carrier
                <select name="carrierId" defaultValue={params?.carrierId ?? ""} className="form-control">
                  <option value="">All carriers</option>
                  {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>)}
                </select>
              </label>
            ) : null}
            <Field label="State" name="state" defaultValue={params?.state ?? ""} />
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Fuel Type
              <select name="fuelType" defaultValue={params?.fuelType ?? ""} className="form-control">
                <option value="">All fuel types</option>
                <option value="Diesel">Diesel</option>
                <option value="Reefer">Reefer</option>
                <option value="DEF">DEF</option>
                <option value="Gasoline">Gasoline</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Status
              <select name="status" defaultValue={params?.status ?? "all"} className="form-control">
                {["all", "pending", "extracted", "needs_review", "failed", "approved"].map((status) => (
                  <option key={status} value={status}>{status.replace("_", " ")}</option>
                ))}
              </select>
            </label>
            <button className="form-button min-h-11 self-end px-4 text-sm">Filter</button>
          </form>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(280px,0.32fr)] gap-5 max-xl:grid-cols-1">
          <div className="section-panel p-5">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
              <div>
                <p className="eyebrow">Receipt Log</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Fuel receipt review queue</h2>
              </div>
              <StatusChip value={isCarrier ? "Carrier scoped" : canRoleManageCompliance(session.role, session.platformSuperAdmin) ? "Organization scoped" : "Read only"} />
            </div>
            {receipts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead>
                    <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                      <th className="border-b border-white/10 px-4 py-4">Receipt</th>
                      <th className="border-b border-white/10 px-4 py-4">Carrier / Load</th>
                      <th className="border-b border-white/10 px-4 py-4">Location</th>
                      <th className="border-b border-white/10 px-4 py-4">Fuel</th>
                      <th className="border-b border-white/10 px-4 py-4">Spend</th>
                      <th className="border-b border-white/10 px-4 py-4">Extraction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((receipt) => <FuelReceiptRow key={receipt.id} receipt={receipt} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No fuel receipts match the current filters.</div>
            )}
          </div>

          <div className="grid gap-5">
            <StateSummary title="Spend by state" items={metrics.spendByState} format={formatCurrency} />
            <StateSummary title="Gallons by state" items={metrics.gallonsByState} format={(value) => value.toLocaleString()} />
            <StateSummary title="Receipt count by state" items={metrics.countByState} format={(value) => String(value)} />
          </div>
        </section>
      </div>
    </main>
  );
}

function FuelReceiptRow({ receipt }: { receipt: FuelReceipt }) {
  return (
    <tr className="transition hover:bg-manifest-red/10">
      <td className="border-b border-white/10 px-4 py-4">
        <Link href={`/fuel/${receipt.id}`} className="font-extrabold text-white hover:text-manifest-red">{receipt.vendorName || "Review receipt"}</Link>
        <span className="mt-1 block text-xs text-manifest-muted">{formatDate(receipt.transactionDate)} · {receipt.fileName}</span>
      </td>
      <td className="border-b border-white/10 px-4 py-4 text-sm text-manifest-muted">
        <strong className="block text-white">{receipt.carrierName}</strong>
        {receipt.loadNumber ? `Load ${receipt.loadNumber}` : "No load assigned"}
      </td>
      <td className="border-b border-white/10 px-4 py-4 text-sm text-manifest-muted">{[receipt.city, receipt.state].filter(Boolean).join(", ") || "Missing"}</td>
      <td className="border-b border-white/10 px-4 py-4 text-sm text-manifest-muted">
        <strong className="block text-white">{receipt.fuelType || "Fuel"}</strong>
        {receipt.gallons.toLocaleString()} gal @ {formatCurrency(receipt.pricePerGallon)}
      </td>
      <td className="border-b border-white/10 px-4 py-4 text-sm font-extrabold text-white">{formatCurrency(receipt.totalAmount)}</td>
      <td className="border-b border-white/10 px-4 py-4">
        <StatusChip value={`${receipt.extractionStatus.replace("_", " ")} · ${Math.round(receipt.extractionConfidence * 100)}%`} />
      </td>
    </tr>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="section-panel p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-manifest-quiet">{label}</p>
      <strong className="mt-2 block text-3xl text-white">{value}</strong>
      <span className="mt-1 block text-xs font-bold text-manifest-muted">{detail}</span>
    </article>
  );
}

function StateSummary({ title, items, format }: { title: string; items: Array<{ state: string; value: number }>; format: (value: number) => string }) {
  return (
    <section className="section-panel p-5">
      <p className="eyebrow">IFTA</p>
      <h2 className="mb-4 text-xl font-extrabold text-white">{title}</h2>
      {items.length ? (
        <div className="grid gap-2">
          {items.slice(0, 8).map((item) => (
            <div key={item.state} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 p-3 text-sm">
              <span className="font-bold text-manifest-muted">{item.state}</span>
              <strong className="text-white">{format(item.value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-manifest-muted">No state data yet.</p>
      )}
    </section>
  );
}

function Field({ label, name, type = "text", defaultValue = "" }: { label: string; name: string; type?: string; defaultValue?: string }) {
  return <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">{label}<input name={name} type={type} defaultValue={defaultValue} className="form-control" /></label>;
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function formatDate(value: string | null) {
  if (!value) return "Date missing";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function cleanParams(params: (FuelReceiptFilters & { success?: string; error?: string }) | undefined): Record<string, string> {
  const clean: Record<string, string> = {};
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (key !== "success" && key !== "error" && typeof value === "string" && value) {
      clean[key] = value;
    }
  });
  return clean;
}
