import Link from "next/link";
import { ArrowLeft, ClipboardCheck, FileWarning, ShieldAlert } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import { getAuditReadinessDashboardData } from "@/lib/data/audit-readiness";
import { requireStaffAccess } from "@/lib/integrations/auth";

export default async function AuditReadinessPage() {
  await requireStaffAccess();
  const data = await getAuditReadinessDashboardData();
  const auditReady = data.results.filter((result) => result.band === "Audit Ready");
  const highRisk = data.results.filter((result) => result.band === "High Risk" || result.band === "Audit Blocked");
  const upcoming = data.results
    .map((result) => result.nextExpiringDocument ? { carrierName: result.carrierName, ...result.nextExpiringDocument } : null)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.daysUntilExpiration <= 45)
    .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Audit Readiness Dashboard
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Weighted readiness from carrier documents, driver/DQ files, vehicle documents, compliance alerts, and critical blockers.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ShieldAlert className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{data.organizationScore}%</strong>
            <span className="text-xs font-bold text-manifest-muted">readiness</span>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-1">
          <Metric label="Audit-ready carriers" value={auditReady.length} tone="good" />
          <Metric label="High-risk carriers" value={highRisk.length} tone="danger" />
          <Metric label="Critical compliance issues" value={data.totalCriticalBlockers} tone="danger" />
          <Metric label="Missing documents" value={data.missingDocuments} tone="warn" />
          <Metric label="Expiring / expired" value={data.expiringDocuments + data.expiredDocuments} tone="warn" />
        </section>

        <section className="grid grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] gap-5 max-xl:grid-cols-1">
          <div className="section-panel p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Carrier Audit Queue</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Readiness by carrier</h2>
              </div>
              <ClipboardCheck className="h-5 w-5 text-manifest-red" />
            </div>
            {data.results.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse">
                  <thead>
                    <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                      <th className="border-b border-white/10 px-4 py-4">Carrier</th>
                      <th className="border-b border-white/10 px-4 py-4">Score</th>
                      <th className="border-b border-white/10 px-4 py-4">Band</th>
                      <th className="border-b border-white/10 px-4 py-4">Breakdown</th>
                      <th className="border-b border-white/10 px-4 py-4">Critical Compliance Issues</th>
                      <th className="border-b border-white/10 px-4 py-4">Next Expiration</th>
                      <th className="border-b border-white/10 px-4 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((result) => (
                      <tr key={result.carrierId} className="transition hover:bg-manifest-red/10">
                        <td className="border-b border-white/10 px-4 py-4">
                          <strong className="block text-sm text-white">{result.carrierName}</strong>
                          <span className="text-xs text-manifest-muted">{result.deductions.length} scoring event{result.deductions.length === 1 ? "" : "s"}</span>
                        </td>
                        <td className="border-b border-white/10 px-4 py-4 text-sm font-extrabold text-white">{result.score}/100</td>
                        <td className="border-b border-white/10 px-4 py-4"><StatusChip value={result.band} type="risk" /></td>
                        <td className="border-b border-white/10 px-4 py-4 text-xs font-bold text-manifest-muted">
                          Carrier {result.categoryBreakdown.carrierDocuments} · DQ {result.categoryBreakdown.driverDocuments} · Vehicle {result.categoryBreakdown.equipmentDocuments} · Alerts {result.categoryBreakdown.complianceAlerts}
                        </td>
                        <td className="border-b border-white/10 px-4 py-4 text-xs font-bold text-manifest-muted">
                          {result.criticalBlockers.length ? result.criticalBlockers.slice(0, 2).join(", ") : "None"}
                        </td>
                        <td className="border-b border-white/10 px-4 py-4 text-xs font-bold text-manifest-muted">
                          {result.nextExpiringDocument
                            ? `${result.nextExpiringDocument.name} in ${result.nextExpiringDocument.daysUntilExpiration} days`
                            : "No dated documents"}
                        </td>
                        <td className="border-b border-white/10 px-4 py-4">
                          <Link href={`/carriers/${result.carrierId}`} className="form-button min-h-9 px-3 text-xs">Open profile</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No carriers are available for audit readiness review.</div>
            )}
          </div>

          <div className="section-panel p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Renewal Watch</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Next 45 days</h2>
              </div>
              <FileWarning className="h-5 w-5 text-manifest-red" />
            </div>
            {upcoming.length ? (
              <div className="grid gap-3">
                {upcoming.slice(0, 10).map((event) => (
                  <div key={`${event.carrierName}-${event.scope}-${event.name}-${event.expirationDate}`} className="rounded-md border border-white/10 bg-black/25 p-3">
                    <strong className="block text-sm text-white">{event.name}</strong>
                    <p className="mt-1 text-xs text-manifest-muted">{event.carrierName} · {event.ownerName} · {event.daysUntilExpiration} days</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No document renewals are due in the next 45 days.</div>
            )}
          </div>
        </section>
      </div>
    </main>
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

function Metric({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "danger" }) {
  const text = tone === "good" ? "text-manifest-green" : tone === "danger" ? "text-manifest-danger" : "text-manifest-amber";
  return (
    <article className="rounded-md border border-white/10 bg-black/30 p-4">
      <span className="panel-label">{label}</span>
      <strong className={`mt-3 block text-3xl ${text}`}>{value}</strong>
    </article>
  );
}
