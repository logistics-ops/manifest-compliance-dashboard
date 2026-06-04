import Link from "next/link";
import { ArrowLeft, ClipboardCheck, ExternalLink, Search, ShieldAlert } from "lucide-react";
import { performSaferLookupAction, saveSaferSnapshotAction } from "@/app/actions/safer-lookup";
import { getCarriers } from "@/lib/data/carriers";
import { getSaferSnapshots, isSaferSnapshotOutdated, summarizeSaferSnapshots, type SaferSnapshotRecord } from "@/lib/data/safer-snapshots";
import { requireSession } from "@/lib/integrations/auth";
import { canRoleManageCompliance } from "@/lib/security/tenant-rules";
import type { Carrier } from "@/types/carrier";

type PageProps = {
  searchParams?: Promise<{ dotNumber?: string; mcNumber?: string; lookup?: string; success?: string; error?: string }>;
};

export default async function SaferLookupPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [carriers, snapshots] = await Promise.all([getCarriers(), getSaferSnapshots()]);
  const summary = summarizeSaferSnapshots(carriers.map((carrier) => carrier.id), snapshots);
  const canManage = session.platformSuperAdmin || canRoleManageCompliance(session.role);
  const dotNumber = params?.dotNumber ?? "";
  const mcNumber = params?.mcNumber ?? "";
  const lookupStarted = params?.lookup === "1";

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              SAFER Lookup
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Manual SAFER review by DOT or MC number. Manifest staff copy reviewed public data into a saved tenant-scoped snapshot.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ShieldAlert className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{snapshots.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">snapshots</span>
          </div>
        </header>

        {params?.success ? <Notice tone="success" message={params.success} /> : null}
        {params?.error ? <Notice tone="error" message={params.error} /> : null}

        <section className="mb-5 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <Metric label="Missing SAFER snapshots" value={summary.missing} tone={summary.missing ? "danger" : "good"} />
          <Metric label="Outdated snapshots" value={summary.outdated} tone={summary.outdated ? "warn" : "good"} />
          <Metric label="Snapshot history" value={snapshots.length} />
        </section>

        <section className="section-panel mb-5 p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <p className="eyebrow">Manual Lookup</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Search SAFER by DOT or MC</h2>
              <p className="mt-2 text-sm text-manifest-muted">This records a manual lookup intent only. It does not scrape or call external APIs.</p>
            </div>
            <Search className="h-5 w-5 text-manifest-red" />
          </div>
          {canManage ? (
            <form action={performSaferLookupAction} className="grid gap-4">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 max-lg:grid-cols-1">
                <Field label="DOT Number" name="dotNumber" defaultValue={dotNumber} />
                <Field label="MC Number" name="mcNumber" defaultValue={mcNumber} />
                <button className="form-button min-h-11 self-end px-4 text-sm">Start lookup</button>
              </div>
            </form>
          ) : (
            <div className="empty-state">SAFER lookup is available to Manifest admin and staff users.</div>
          )}
        </section>

        {lookupStarted && canManage ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <div className="mb-5 flex items-start justify-between gap-3 max-md:flex-col">
              <div>
                <p className="eyebrow">Snapshot Review</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Save SAFER snapshot</h2>
                <p className="mt-2 text-sm text-manifest-muted">Open SAFER manually, review the public record, then save the values below.</p>
              </div>
              <a
                href="https://safer.fmcsa.dot.gov/CompanySnapshot.aspx"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Open SAFER
              </a>
            </div>
            <SaferSnapshotForm carriers={carriers} dotNumber={dotNumber} mcNumber={mcNumber} />
          </section>
        ) : null}

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Snapshot History</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Saved SAFER reviews</h2>
            </div>
            <ClipboardCheck className="h-5 w-5 text-manifest-red" />
          </div>
          {snapshots.length ? (
            <div className="grid gap-3">
              {snapshots.map((snapshot) => <SnapshotCard key={snapshot.id} snapshot={snapshot} />)}
            </div>
          ) : (
            <div className="empty-state">No SAFER snapshots saved yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function SaferSnapshotForm({ carriers, dotNumber, mcNumber }: { carriers: Carrier[]; dotNumber: string; mcNumber: string }) {
  return (
    <form action={saveSaferSnapshotAction} className="grid gap-4">
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Attach to Carrier
          <select name="carrierId" className="form-control">
            <option value="">Do not attach</option>
            {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.companyName} · DOT {carrier.dotNumber}</option>)}
          </select>
        </label>
        <Field label="DOT Number" name="dotNumber" required defaultValue={dotNumber} />
        <Field label="MC Number" name="mcNumber" defaultValue={mcNumber} />
        <Field label="Legal Name" name="legalName" />
        <Field label="DBA Name" name="dbaName" />
        <Field label="Operating Status" name="operatingStatus" />
        <Field label="Power Units" name="powerUnits" type="number" min="0" />
        <Field label="Drivers" name="drivers" type="number" min="0" />
        <Field label="Safety Rating" name="safetyRating" />
        <Field label="Snapshot Date" name="snapshotDate" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
      </div>
      <Textarea label="Inspection Summary" name="inspectionSummary" />
      <Textarea label="Out-of-Service Summary" name="outOfServiceSummary" />
      <Textarea label="Crash Summary" name="crashSummary" />
      <Textarea label="Notes" name="notes" />
      <button className="form-button min-h-11 w-fit px-4 text-sm">Save snapshot</button>
    </form>
  );
}

function SnapshotCard({ snapshot }: { snapshot: SaferSnapshotRecord }) {
  return (
    <article className="rounded-md border border-white/10 bg-black/25 p-4">
      <div className="mb-4 flex items-start justify-between gap-3 max-md:flex-col">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge label={snapshot.sourceLabel} />
            {isSaferSnapshotOutdated(snapshot) ? <Badge label="Outdated" tone="warn" /> : <Badge label="Current" tone="good" />}
          </div>
          <strong className="text-base text-white">{snapshot.legalName || snapshot.carrierName || `DOT ${snapshot.dotNumber}`}</strong>
          <p className="mt-1 text-sm text-manifest-muted">{snapshot.dbaName ? `DBA ${snapshot.dbaName}` : snapshot.carrierName ?? "Unattached snapshot"}</p>
        </div>
        <span className="text-sm font-bold text-manifest-muted">{formatDateTime(snapshot.snapshotDate)}</span>
      </div>
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        <MiniStat label="DOT" value={snapshot.dotNumber} />
        <MiniStat label="MC" value={snapshot.mcNumber || "Missing"} />
        <MiniStat label="Operating Status" value={snapshot.operatingStatus || "Missing"} />
        <MiniStat label="Safety Rating" value={snapshot.safetyRating || "Missing"} />
        <MiniStat label="Power Units" value={snapshot.powerUnits ?? "Missing"} />
        <MiniStat label="Drivers" value={snapshot.drivers ?? "Missing"} />
      </div>
      <div className="mt-4 grid gap-3">
        <SummaryBlock label="Inspection Summary" value={snapshot.inspectionSummary} />
        <SummaryBlock label="Out-of-Service Summary" value={snapshot.outOfServiceSummary} />
        <SummaryBlock label="Crash Summary" value={snapshot.crashSummary} />
      </div>
      {snapshot.carrierId ? <Link href={`/carriers/${snapshot.carrierId}`} className="mt-4 inline-flex min-h-10 items-center rounded-md border border-manifest-red/50 bg-manifest-red/10 px-3 text-sm font-extrabold text-white transition hover:bg-manifest-red/20">Open carrier</Link> : null}
    </article>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <span className="panel-label">{label}</span>
      <p className="mt-2 text-sm leading-6 text-manifest-muted">{value || "Not recorded."}</p>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const toneClass = tone === "danger" ? "text-manifest-danger" : tone === "warn" ? "text-manifest-gold" : tone === "good" ? "text-manifest-green" : "text-white";
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-4">
      <span className="panel-label">{label}</span>
      <strong className={`mt-2 block text-3xl ${toneClass}`}>{value}</strong>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <span className="panel-label">{label}</span>
      <strong className="mt-1 block text-sm text-white">{value}</strong>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, defaultValue, min }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; min?: string }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} min={min} className="form-control" />
    </label>
  );
}

function Textarea({ label, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <textarea name={name} className="form-control min-h-20 resize-y" />
    </label>
  );
}

function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" }) {
  const classes = tone === "good" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : tone === "warn" ? "border-manifest-amber/45 bg-manifest-amber/10 text-manifest-amber" : "border-white/10 bg-white/[0.035] text-manifest-muted";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${classes}`}>{label}</span>;
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border p-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function BackLink() {
  return (
    <Link href="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
      <ArrowLeft className="h-4 w-4" />
      Operations Center
    </Link>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
