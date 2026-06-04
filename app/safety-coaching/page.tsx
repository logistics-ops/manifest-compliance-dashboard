import Link from "next/link";
import { ArrowLeft, ClipboardCheck, Plus, ShieldAlert } from "lucide-react";
import { createSafetyCoachingAction, updateSafetyCoachingAction } from "@/app/actions/safety-coaching";
import { getCarriers } from "@/lib/data/carriers";
import type { ComplianceTaskPriority } from "@/lib/data/compliance-tasks";
import { getInspectionReports, type InspectionReport } from "@/lib/data/inspections";
import { getSafetyCoachingRecords, summarizeSafetyCoaching, type SafetyCoachingRecord, type SafetyCoachingStatus } from "@/lib/data/safety-coaching";
import { buildSafetyTrendRecords, getSafetyScores, statusLabel, type SafetyScoreRecord } from "@/lib/data/safety-scores";
import { requireSession } from "@/lib/integrations/auth";
import { canRoleManageCompliance } from "@/lib/security/tenant-rules";
import type { Carrier } from "@/types/carrier";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

const priorities: Array<{ value: ComplianceTaskPriority; label: string }> = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statuses: Array<{ value: SafetyCoachingStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export default async function SafetyCoachingPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [carriers, scores, inspections, coaching] = await Promise.all([
    getCarriers(),
    getSafetyScores(),
    getInspectionReports(),
    getSafetyCoachingRecords(),
  ]);
  const canManage = session.platformSuperAdmin || canRoleManageCompliance(session.role);
  const summary = summarizeSafetyCoaching(coaching);
  const trends = buildSafetyTrendRecords(carriers.map((carrier) => carrier.id), scores);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Safety Coaching
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Turn manual safety scores and inspection findings into corrective action plans. No FMCSA, SAFER, or external lookup runs here.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ShieldAlert className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{summary.open}</strong>
            <span className="text-xs font-bold text-manifest-muted">open items</span>
          </div>
        </header>

        {params?.success ? <Notice tone="success" message={params.success} /> : null}
        {params?.error ? <Notice tone="error" message={params.error} /> : null}

        <section className="mb-5 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <Metric label="Open Coaching Items" value={summary.open} tone={summary.open ? "warn" : "good"} />
          <Metric label="Overdue Coaching Items" value={summary.overdue} tone={summary.overdue ? "danger" : "good"} />
          <Metric label="Completed Coaching Items" value={summary.completed} tone="good" />
        </section>

        {canManage ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <p className="eyebrow">Create Corrective Action</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Safety coaching item</h2>
                <p className="mt-2 text-sm text-manifest-muted">Link the item to a carrier, optional safety score, optional inspection report, and optionally create a Compliance Task.</p>
              </div>
              <Plus className="h-5 w-5 text-manifest-red" />
            </div>
            {carriers.length ? (
              <CreateCoachingForm carriers={carriers} scores={scores} inspections={inspections} />
            ) : (
              <div className="empty-state">Create a carrier before adding safety coaching items.</div>
            )}
          </section>
        ) : null}

        <section className="section-panel mb-5 p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Safety Trend Context</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Coaching opportunities</h2>
          </div>
          {trends.length ? (
            <div className="grid gap-3">
              {trends.map((trend) => (
                <article key={trend.carrierId} className="grid grid-cols-[minmax(220px,1fr)_160px_minmax(260px,1fr)_auto] items-center gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-xl:grid-cols-2 max-md:grid-cols-1">
                  <div>
                    <strong className="text-sm text-white">{carriers.find((carrier) => carrier.id === trend.carrierId)?.companyName ?? trend.carrierName}</strong>
                    <span className="mt-1 block text-xs text-manifest-muted">Latest vs previous safety score</span>
                  </div>
                  <TrendBadge trend={trend.trend} />
                  <p className="text-sm leading-6 text-manifest-muted">
                    {trend.latest
                      ? `${statusLabel(trend.latest.safetyStatus)} · ${trend.latest.violationCount} violations · ${trend.latest.outOfServiceCount} OOS`
                      : "No safety score history yet."}
                  </p>
                  <Link href={`/carriers/${trend.carrierId}`} className="form-button justify-self-end max-xl:justify-self-start">Open carrier</Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">No safety trend context available yet.</div>
          )}
        </section>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Corrective Actions</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Coaching queue</h2>
            </div>
            <ClipboardCheck className="h-5 w-5 text-manifest-red" />
          </div>
          {coaching.length ? (
            <div className="grid gap-3">
              {coaching.map((item) => <CoachingCard key={item.id} item={item} canManage={canManage} />)}
            </div>
          ) : (
            <div className="empty-state">No safety coaching items yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function CreateCoachingForm({ carriers, scores, inspections }: { carriers: Carrier[]; scores: SafetyScoreRecord[]; inspections: InspectionReport[] }) {
  return (
    <form action={createSafetyCoachingAction} className="grid gap-4">
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        <CarrierSelect carriers={carriers} />
        <SafetyScoreSelect scores={scores} />
        <InspectionSelect inspections={inspections} />
        <PrioritySelect defaultValue="medium" />
        <Field label="Target Completion Date" name="targetCompletionDate" type="date" />
      </div>
      <Field label="Issue" name="issue" required placeholder="Violations increased, OOS event, audit pattern, coaching need." />
      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
        Recommendation
        <textarea name="recommendation" required className="form-control min-h-24 resize-y" placeholder="Describe the corrective action plan." />
      </label>
      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
        Notes
        <textarea name="notes" className="form-control min-h-20 resize-y" placeholder="Optional coaching notes, trend context, or inspection references." />
      </label>
      <label className="flex min-h-11 items-center gap-3 rounded-md border border-white/10 bg-black/25 px-3 text-sm font-bold text-manifest-muted">
        <input name="createTask" type="checkbox" className="h-4 w-4 accent-manifest-red" />
        Create linked Compliance Task
      </label>
      <button className="form-button min-h-11 w-fit px-4 text-sm">Create coaching item</button>
    </form>
  );
}

function CoachingCard({ item, canManage }: { item: SafetyCoachingRecord; canManage: boolean }) {
  return (
    <article className="rounded-md border border-white/10 bg-black/25 p-4">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-4 max-md:grid-cols-1">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />
            {item.complianceTaskId ? <Badge label="Task Linked" /> : null}
          </div>
          <strong className="text-base text-white">{item.issue}</strong>
          <p className="mt-1 text-sm text-manifest-muted">{item.carrierName}</p>
        </div>
        <div className="text-sm font-bold text-manifest-muted">
          <span className="panel-label">Target</span>
          <span className="mt-1 block text-white">{item.targetCompletionDate ?? "No target"}</span>
        </div>
      </div>
      <p className="text-sm leading-6 text-manifest-muted">{item.recommendation}</p>
      {item.notes ? <p className="mt-3 text-sm leading-6 text-manifest-muted">{item.notes}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-manifest-muted">
        {item.safetyScoreLabel ? <Badge label={`Safety score: ${item.safetyScoreLabel}`} /> : null}
        {item.inspectionLabel ? <Badge label={`Inspection: ${item.inspectionLabel}`} /> : null}
      </div>
      {canManage ? <CoachingEditDetails item={item} /> : null}
    </article>
  );
}

function CoachingEditDetails({ item }: { item: SafetyCoachingRecord }) {
  return (
    <details className="mt-4 rounded-md border border-white/10 bg-black/20 p-4">
      <summary className="cursor-pointer text-sm font-extrabold uppercase tracking-[0.14em] text-manifest-muted">Update coaching item</summary>
      <form action={updateSafetyCoachingAction} className="mt-4 grid gap-4">
        <input type="hidden" name="coachingId" value={item.id} />
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
          <PrioritySelect defaultValue={item.priority} />
          <StatusSelect defaultValue={item.status} />
          <Field label="Target Completion Date" name="targetCompletionDate" type="date" defaultValue={item.targetCompletionDate ?? ""} />
        </div>
        <Field label="Issue" name="issue" required defaultValue={item.issue} />
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Recommendation
          <textarea name="recommendation" required defaultValue={item.recommendation} className="form-control min-h-20 resize-y" />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Notes
          <textarea name="notes" defaultValue={item.notes} className="form-control min-h-20 resize-y" />
        </label>
        <button className="form-button min-h-11 w-fit px-4 text-sm">Save coaching item</button>
      </form>
    </details>
  );
}

function CarrierSelect({ carriers }: { carriers: Carrier[] }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      Carrier
      <select name="carrierId" required className="form-control">
        <option value="">Select carrier</option>
        {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>)}
      </select>
    </label>
  );
}

function SafetyScoreSelect({ scores }: { scores: SafetyScoreRecord[] }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      Safety Score
      <select name="safetyScoreId" className="form-control">
        <option value="">Optional score</option>
        {scores.map((score) => <option key={score.id} value={score.id}>{score.carrierName} · {score.scoreLabel} · {statusLabel(score.safetyStatus)}</option>)}
      </select>
    </label>
  );
}

function InspectionSelect({ inspections }: { inspections: InspectionReport[] }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      Inspection Report
      <select name="inspectionReportId" className="form-control">
        <option value="">Optional inspection</option>
        {inspections.map((inspection) => <option key={inspection.id} value={inspection.id}>{inspection.carrierName} · {inspection.inspectionType} · {inspection.inspectionDate}</option>)}
      </select>
    </label>
  );
}

function PrioritySelect({ defaultValue }: { defaultValue: ComplianceTaskPriority }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      Priority
      <select name="priority" defaultValue={defaultValue} className="form-control">
        {priorities.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
      </select>
    </label>
  );
}

function StatusSelect({ defaultValue }: { defaultValue: SafetyCoachingStatus }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      Status
      <select name="status" defaultValue={defaultValue} className="form-control">
        {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
      </select>
    </label>
  );
}

function Field({ label, name, type = "text", required = false, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} className="form-control" />
    </label>
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

function PriorityBadge({ priority }: { priority: ComplianceTaskPriority }) {
  const classes = priority === "critical" ? "border-manifest-danger/45 bg-manifest-danger/10 text-manifest-danger" : priority === "high" ? "border-manifest-amber/45 bg-manifest-amber/10 text-manifest-amber" : "border-white/10 bg-white/[0.035] text-manifest-muted";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${classes}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: SafetyCoachingStatus }) {
  const classes = status === "completed" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : status === "in_progress" ? "border-manifest-amber/45 bg-manifest-amber/10 text-manifest-amber" : "border-manifest-red/45 bg-manifest-red/10 text-white";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${classes}`}>{status.replace(/_/g, " ")}</span>;
}

function TrendBadge({ trend }: { trend: string }) {
  const classes = trend === "Improving" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : trend === "Declining" ? "border-manifest-danger/45 bg-manifest-danger/10 text-manifest-danger" : "border-white/10 bg-white/[0.035] text-manifest-muted";
  return <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${classes}`}>{trend}</span>;
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">{label}</span>;
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
