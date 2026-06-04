import Link from "next/link";
import { ArrowLeft, ClipboardCheck, Plus, ShieldAlert } from "lucide-react";
import { createSafetyScoreAction, updateSafetyScoreAction } from "@/app/actions/safety-scores";
import { getCarriers } from "@/lib/data/carriers";
import {
  getSafetyScores,
  buildSafetyTrendRecords,
  latestSafetyScoresByCarrier,
  safetyScoreHistoryByCarrier,
  statusLabel,
  summarizeSafetyScores,
  summarizeSafetyTrends,
  type SafetyScoreRecord,
  type SafetyStatus,
  type SafetyTrend,
  type SafetyTrendRecord,
} from "@/lib/data/safety-scores";
import { requireSession } from "@/lib/integrations/auth";
import { canRoleManageCompliance } from "@/lib/security/tenant-rules";
import type { Carrier } from "@/types/carrier";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

const safetyStatusOptions: Array<{ value: SafetyStatus; label: string }> = [
  { value: "good", label: "Good" },
  { value: "needs_review", label: "Needs Review" },
  { value: "high_risk", label: "High Risk" },
  { value: "missing_data", label: "Missing Data" },
];

export default async function SafetyScoresPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [carriers, scores] = await Promise.all([getCarriers(), getSafetyScores()]);
  const canManage = session.platformSuperAdmin || canRoleManageCompliance(session.role);
  const latestByCarrier = latestSafetyScoresByCarrier(scores);
  const historyByCarrier = safetyScoreHistoryByCarrier(scores);
  const trendRecords = buildSafetyTrendRecords(carriers.map((carrier) => carrier.id), scores);
  const trends = summarizeSafetyTrends(trendRecords);
  const summary = summarizeSafetyScores(carriers.map((carrier) => carrier.id), scores);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Safety Scores
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Manually track carrier safety posture, inspection counts, violations, and out-of-service events before FMCSA/SAFER automation is enabled.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ShieldAlert className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{scores.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">records</span>
          </div>
        </header>

        {params?.success ? <Notice tone="success" message={params.success} /> : null}
        {params?.error ? <Notice tone="error" message={params.error} /> : null}

        <section className="mb-5 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <Metric label="Good safety posture" value={summary.good} tone="good" />
          <Metric label="Needs review" value={summary.needsReview} tone={summary.needsReview ? "warn" : "good"} />
          <Metric label="Missing safety data" value={summary.missingData} tone={summary.missingData ? "danger" : "good"} />
        </section>

        <section className="mb-5 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          <Metric label="Improving carriers" value={trends.improving} tone={trends.improving ? "good" : "neutral"} />
          <Metric label="Declining carriers" value={trends.declining} tone={trends.declining ? "danger" : "good"} />
          <Metric label="Stable carriers" value={trends.stable} />
          <Metric label="Missing history" value={trends.missingHistory} tone={trends.missingHistory ? "warn" : "good"} />
        </section>

        {canManage ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <p className="eyebrow">Manual Safety Entry</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Record carrier safety posture</h2>
                <p className="mt-2 text-sm text-manifest-muted">This is manual tracking only. No FMCSA, SAFER, or external lookup runs from this form.</p>
              </div>
              <Plus className="h-5 w-5 text-manifest-red" />
            </div>
            {carriers.length ? <SafetyScoreForm carriers={carriers} /> : <div className="empty-state">Create a carrier before recording safety scores.</div>}
          </section>
        ) : null}

        <section className="section-panel mb-5 p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Latest Carrier Posture</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Carrier safety overview</h2>
            </div>
            <ClipboardCheck className="h-5 w-5 text-manifest-red" />
          </div>
          {carriers.length ? (
            <div className="grid gap-3">
              {carriers.map((carrier) => <CarrierSafetyRow key={carrier.id} carrier={carrier} score={latestByCarrier.get(carrier.id) ?? null} />)}
            </div>
          ) : (
            <div className="empty-state">No carriers available for safety tracking.</div>
          )}
        </section>

        <section className="section-panel mb-5 p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Safety Trend View</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Latest vs previous score</h2>
              <p className="mt-2 text-sm text-manifest-muted">Trend is calculated from manually entered history only.</p>
            </div>
            <ShieldAlert className="h-5 w-5 text-manifest-red" />
          </div>
          {carriers.length ? (
            <div className="grid gap-3">
              {trendRecords.map((record) => {
                const carrier = carriers.find((item) => item.id === record.carrierId);
                return <SafetyTrendRow key={record.carrierId} record={record} carrierName={carrier?.companyName ?? record.carrierName} />;
              })}
            </div>
          ) : (
            <div className="empty-state">No carriers available for safety trend tracking.</div>
          )}
        </section>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Safety Score History</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Manual records</h2>
          </div>
          {scores.length ? (
            <div className="grid gap-5">
              {carriers.map((carrier) => (
                <CarrierSafetyHistory
                  key={carrier.id}
                  carrier={carrier}
                  history={historyByCarrier.get(carrier.id) ?? []}
                  canManage={canManage}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">No manual safety score records yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function SafetyTrendRow({ record, carrierName }: { record: SafetyTrendRecord; carrierName: string }) {
  return (
    <article className="grid grid-cols-[minmax(220px,1fr)_160px_minmax(220px,0.8fr)_minmax(220px,0.8fr)_auto] items-center gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-xl:grid-cols-2 max-md:grid-cols-1">
      <div>
        <strong className="block text-sm text-white">{carrierName}</strong>
        <span className="mt-1 block text-xs text-manifest-muted">Manual trend from latest two records</span>
      </div>
      <TrendBadge trend={record.trend} />
      <ScoreSnapshot label="Latest" score={record.latest} />
      <ScoreSnapshot label="Previous" score={record.previous} />
      <Link href={`/carriers/${record.carrierId}`} className="form-button justify-self-end max-xl:justify-self-start">
        Open carrier
      </Link>
    </article>
  );
}

function ScoreSnapshot({ label, score }: { label: string; score: SafetyScoreRecord | null }) {
  return (
    <div className="text-sm text-manifest-muted">
      <span className="panel-label">{label}</span>
      {score ? (
        <>
          <span className="mt-1 block text-white">{statusLabel(score.safetyStatus)}</span>
          <span className="mt-1 block text-xs text-manifest-quiet">
            {score.violationCount} violations · {score.outOfServiceCount} OOS · {formatDateTime(score.recordedAt)}
          </span>
        </>
      ) : (
        <span className="mt-1 block">No record</span>
      )}
    </div>
  );
}

function CarrierSafetyHistory({ carrier, history, canManage }: { carrier: Carrier; history: SafetyScoreRecord[]; canManage: boolean }) {
  return (
    <article className="rounded-md border border-white/10 bg-black/25 p-4">
      <div className="mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
        <div>
          <strong className="text-base text-white">{carrier.companyName}</strong>
          <p className="mt-1 text-xs text-manifest-muted">DOT {carrier.dotNumber} · MC {carrier.mcNumber}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
          {history.length} record{history.length === 1 ? "" : "s"}
        </span>
      </div>
      {history.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                <th className="border-b border-white/10 px-3 py-3">Recorded</th>
                <th className="border-b border-white/10 px-3 py-3">Safety Status</th>
                <th className="border-b border-white/10 px-3 py-3">Inspections</th>
                <th className="border-b border-white/10 px-3 py-3">Violations</th>
                <th className="border-b border-white/10 px-3 py-3">OOS</th>
                <th className="border-b border-white/10 px-3 py-3">Notes</th>
                <th className="border-b border-white/10 px-3 py-3">Edit</th>
              </tr>
            </thead>
            <tbody>
              {history.map((score) => (
                <tr key={score.id}>
                  <td className="border-b border-white/10 px-3 py-3 text-sm text-manifest-muted">{formatDateTime(score.recordedAt)}</td>
                  <td className="border-b border-white/10 px-3 py-3"><SafetyBadge status={score.safetyStatus} /></td>
                  <td className="border-b border-white/10 px-3 py-3 text-sm text-white">{score.inspectionCount}</td>
                  <td className="border-b border-white/10 px-3 py-3 text-sm text-white">{score.violationCount}</td>
                  <td className="border-b border-white/10 px-3 py-3 text-sm text-white">{score.outOfServiceCount}</td>
                  <td className="border-b border-white/10 px-3 py-3 text-sm text-manifest-muted">{score.notes || "None"}</td>
                  <td className="border-b border-white/10 px-3 py-3">
                    {canManage ? <SafetyScoreEditDetails score={score} /> : <span className="text-xs text-manifest-muted">Read only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No safety score history for this carrier yet.</div>
      )}
    </article>
  );
}

function SafetyScoreForm({ carriers }: { carriers: Carrier[] }) {
  return (
    <form action={createSafetyScoreAction} className="grid gap-4">
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Carrier
          <select name="carrierId" required className="form-control">
            <option value="">Select carrier</option>
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.companyName} · DOT {carrier.dotNumber}
              </option>
            ))}
          </select>
        </label>
        <Field label="Score / Source Label" name="scoreLabel" placeholder="Manual safety review" required />
        <StatusSelect defaultValue="missing_data" />
        <Field label="Inspection Count" name="inspectionCount" type="number" min="0" defaultValue="0" />
        <Field label="Violation Count" name="violationCount" type="number" min="0" defaultValue="0" />
        <Field label="Out-of-Service Count" name="outOfServiceCount" type="number" min="0" defaultValue="0" />
        <Field label="Recorded At" name="recordedAt" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
      </div>
      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
        Notes
        <textarea name="notes" className="form-control min-h-24 resize-y" placeholder="Manual observations, source notes, or coaching context." />
      </label>
      <button className="form-button min-h-11 w-fit px-4 text-sm">Record safety score</button>
    </form>
  );
}

function CarrierSafetyRow({ carrier, score }: { carrier: Carrier; score: SafetyScoreRecord | null }) {
  return (
    <article className="grid grid-cols-[minmax(220px,1fr)_160px_1fr_auto] items-center gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-xl:grid-cols-2 max-md:grid-cols-1">
      <div>
        <strong className="block text-sm text-white">{carrier.companyName}</strong>
        <span className="mt-1 block text-xs text-manifest-muted">DOT {carrier.dotNumber} · MC {carrier.mcNumber}</span>
      </div>
      <SafetyBadge status={score?.safetyStatus ?? "missing_data"} />
      <div className="text-sm text-manifest-muted">
        {score ? (
          <>
            <span className="block text-white">{score.scoreLabel}</span>
            <span className="mt-1 block text-xs text-manifest-quiet">
              {score.inspectionCount} inspections · {score.violationCount} violations · {score.outOfServiceCount} OOS
            </span>
          </>
        ) : (
          <span>No manual safety data recorded.</span>
        )}
      </div>
      <Link href={`/carriers/${carrier.id}`} className="form-button justify-self-end max-xl:justify-self-start">
        Open carrier
      </Link>
    </article>
  );
}

function SafetyScoreRecordCard({ score, canManage }: { score: SafetyScoreRecord; canManage: boolean }) {
  return (
    <article className="rounded-md border border-white/10 bg-black/25 p-4">
      <div className="mb-4 flex items-start justify-between gap-3 max-md:flex-col">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <SafetyBadge status={score.safetyStatus} />
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
              Manual
            </span>
          </div>
          <strong className="block text-base text-white">{score.carrierName}</strong>
          <p className="mt-1 text-sm text-manifest-muted">{score.scoreLabel}</p>
        </div>
        <span className="text-sm font-bold text-manifest-muted">{formatDateTime(score.recordedAt)}</span>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-md:grid-cols-1">
        <MiniStat label="DOT" value={score.dotNumber || "Missing"} />
        <MiniStat label="MC" value={score.mcNumber || "Missing"} />
        <MiniStat label="Inspections" value={score.inspectionCount} />
        <MiniStat label="Violations" value={score.violationCount} />
        <MiniStat label="OOS Events" value={score.outOfServiceCount} />
      </div>

      {score.notes ? <p className="mb-4 text-sm leading-6 text-manifest-muted">{score.notes}</p> : null}

      {canManage ? (
        <SafetyScoreEditDetails score={score} />
      ) : null}
    </article>
  );
}

function SafetyScoreEditDetails({ score }: { score: SafetyScoreRecord }) {
  return (
    <details className="rounded-md border border-white/10 bg-black/20 p-4">
      <summary className="cursor-pointer text-sm font-extrabold uppercase tracking-[0.14em] text-manifest-muted">Edit record</summary>
      <form action={updateSafetyScoreAction} className="mt-4 grid gap-4">
        <input type="hidden" name="safetyScoreId" value={score.id} />
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
          <Field label="Score / Source Label" name="scoreLabel" defaultValue={score.scoreLabel} required />
          <StatusSelect defaultValue={score.safetyStatus} />
          <Field label="Inspection Count" name="inspectionCount" type="number" min="0" defaultValue={String(score.inspectionCount)} />
          <Field label="Violation Count" name="violationCount" type="number" min="0" defaultValue={String(score.violationCount)} />
          <Field label="Out-of-Service Count" name="outOfServiceCount" type="number" min="0" defaultValue={String(score.outOfServiceCount)} />
          <Field label="Recorded At" name="recordedAt" type="datetime-local" required defaultValue={score.recordedAt.slice(0, 16)} />
        </div>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Notes
          <textarea name="notes" defaultValue={score.notes} className="form-control min-h-20 resize-y" />
        </label>
        <button className="form-button min-h-11 w-fit px-4 text-sm">Save safety score</button>
      </form>
    </details>
  );
}

function StatusSelect({ defaultValue }: { defaultValue: SafetyStatus }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      Safety Status
      <select name="safetyStatus" defaultValue={defaultValue} className="form-control">
        {safetyStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function SafetyBadge({ status }: { status: SafetyStatus }) {
  const classes = {
    good: "border-manifest-green/35 bg-manifest-green/10 text-manifest-green",
    needs_review: "border-manifest-amber/45 bg-manifest-amber/10 text-manifest-amber",
    high_risk: "border-manifest-danger/45 bg-manifest-danger/10 text-manifest-danger",
    missing_data: "border-white/10 bg-white/[0.035] text-manifest-muted",
  }[status];

  return <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${classes}`}>{statusLabel(status)}</span>;
}

function TrendBadge({ trend }: { trend: SafetyTrend }) {
  const classes = {
    Improving: "border-manifest-green/35 bg-manifest-green/10 text-manifest-green",
    Declining: "border-manifest-danger/45 bg-manifest-danger/10 text-manifest-danger",
    Stable: "border-white/10 bg-white/[0.035] text-white",
    "Missing history": "border-manifest-amber/45 bg-manifest-amber/10 text-manifest-amber",
  }[trend];

  return <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${classes}`}>{trend}</span>;
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

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border p-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  min,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  min?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} min={min} placeholder={placeholder} className="form-control" />
    </label>
  );
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
