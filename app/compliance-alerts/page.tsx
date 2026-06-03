import Link from "next/link";
import { createComplianceTaskAction } from "@/app/actions/compliance-tasks";
import { ArrowLeft, ExternalLink, FileWarning, ShieldAlert } from "lucide-react";
import { documentSlug } from "@/lib/action-center";
import { getCarrierDocuments } from "@/lib/compliance";
import { getAuditReadinessDashboardData } from "@/lib/data/audit-readiness";
import { getCarriers } from "@/lib/data/carriers";
import { getDQFiles } from "@/lib/data/dq-files";
import { getInspectionReports } from "@/lib/data/inspections";
import { getVehicles } from "@/lib/data/vehicles";
import { requireSession } from "@/lib/integrations/auth";
import { canManageComplianceTaskRecord } from "@/lib/security/tenant-rules";
import type { Carrier } from "@/types/carrier";

type AlertScope = "carrier" | "driver" | "vehicle";
type AlertType = "Missing" | "Expired" | "Expiring Soon" | "Needs Review" | "Readiness Risk";
type AlertSeverity = "Critical" | "High" | "Medium" | "Low";
type AlertFilter = "all" | "carrier" | "driver" | "vehicle" | "critical" | "expiring-30";

type ComplianceAlert = {
  id: string;
  scope: AlertScope;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  carrierId: string | null;
  carrierName: string;
  entityId: string;
  dueDate: string | null;
  daysUntilExpiration: number | null;
  openCarrierHref: string | null;
  openEntityHref: string;
  openDocumentHref: string;
};

const filters: Array<{ label: string; value: AlertFilter }> = [
  { label: "All", value: "all" },
  { label: "Carrier", value: "carrier" },
  { label: "Driver", value: "driver" },
  { label: "Vehicle", value: "vehicle" },
  { label: "Critical Only", value: "critical" },
  { label: "Expiring Within 30 Days", value: "expiring-30" },
];

type PageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

export default async function ComplianceAlertsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const activeFilter = normalizeFilter(params?.filter);
  const [allCarriers, auditReadiness, dqFiles, vehicles, inspections] = await Promise.all([
    getCarriers(),
    getAuditReadinessDashboardData(),
    getDQFiles(),
    getVehicles(),
    getInspectionReports(),
  ]);
  const canCreateTasks = canManageComplianceTaskRecord(session, session.organizationId);
  const carriers = scopeCarriers(allCarriers, session);
  const carrierIds = new Set(carriers.map((carrier) => carrier.id));
  const alerts = buildComplianceAlerts({
    carriers,
    carrierReadiness: auditReadiness.results.filter((result) => carrierIds.has(result.carrierId)),
    dqFiles,
    vehicles,
    inspections,
  });
  const filteredAlerts = filterAlerts(alerts, activeFilter);
  const summary = {
    total: alerts.length,
    critical: alerts.filter((alert) => alert.severity === "Critical").length,
    expired: alerts.filter((alert) => alert.type === "Expired").length,
    expiringSoon: alerts.filter((alert) => alert.type === "Expiring Soon").length,
    missing: alerts.filter((alert) => alert.type === "Missing").length,
  };

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Compliance Alerts Center
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              A prioritized queue of carrier, driver, and vehicle compliance issues using existing readiness and document status data.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ShieldAlert className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{filteredAlerts.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">shown</span>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-1">
          <Metric label="Total Alerts" value={summary.total} />
          <Metric label="Critical" value={summary.critical} tone="danger" />
          <Metric label="Expired" value={summary.expired} tone="danger" />
          <Metric label="Expiring Soon" value={summary.expiringSoon} tone="warn" />
          <Metric label="Missing" value={summary.missing} tone="warn" />
        </section>

        <nav className="mb-5 overflow-x-auto rounded-md border border-white/10 bg-black/35 p-1.5" aria-label="Compliance alert filters">
          <div className="flex min-w-max gap-1">
            {filters.map((filter) => (
              <Link
                key={filter.value}
                href={`/compliance-alerts?filter=${filter.value}`}
                className={`inline-flex min-h-10 items-center rounded-md px-4 text-sm font-extrabold transition ${
                  activeFilter === filter.value
                    ? "border border-manifest-red/50 bg-manifest-red/15 text-white"
                    : "border border-transparent text-manifest-muted hover:border-white/10 hover:bg-white/[0.035] hover:text-white"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        </nav>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
            <div>
              <p className="eyebrow">Prioritized Queue</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">
                {filteredAlerts.length} alert{filteredAlerts.length === 1 ? "" : "s"}
              </h2>
            </div>
            <FileWarning className="h-5 w-5 text-manifest-red" />
          </div>

          {filteredAlerts.length ? (
            <div className="grid gap-3">
              {filteredAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} canCreateTasks={canCreateTasks} />)}
            </div>
          ) : (
            <div className="empty-state">No compliance alerts match this filter.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function buildComplianceAlerts({
  carriers,
  carrierReadiness,
  dqFiles,
  vehicles,
  inspections,
}: {
  carriers: Carrier[];
  carrierReadiness: Awaited<ReturnType<typeof getAuditReadinessDashboardData>>["results"];
  dqFiles: Awaited<ReturnType<typeof getDQFiles>>;
  vehicles: Awaited<ReturnType<typeof getVehicles>>;
  inspections: Awaited<ReturnType<typeof getInspectionReports>>;
}): ComplianceAlert[] {
  const carrierById = new Map(carriers.map((carrier) => [carrier.id, carrier]));
  const carrierDocumentAlerts = carriers.flatMap((carrier) =>
    getCarrierDocuments(carrier)
      .filter((document) => ["Missing", "Expired", "Expiring Soon", "Needs Review"].includes(document.status))
      .map((document) => {
        const slug = documentSlug(document.name);
        return {
          id: `carrier-document:${carrier.id}:${slug}`,
          scope: "carrier" as const,
          type: normalizeType(document.status),
          severity: severityForDocumentStatus(document.status),
          title: `${document.name} ${document.status.toLowerCase()}`,
          description: `${carrier.companyName} needs ${document.name} corrected.`,
          carrierId: carrier.id,
          carrierName: carrier.companyName,
          entityId: carrier.id,
          dueDate: document.expirationDate,
          daysUntilExpiration: document.daysUntilExpiration,
          openCarrierHref: `/carriers/${carrier.id}`,
          openEntityHref: `/carriers/${carrier.id}`,
          openDocumentHref: `/carriers/${carrier.id}#document-${slug}`,
        };
      }),
  );

  const carrierRiskAlerts = carrierReadiness
    .filter((result) => result.score < 80 || result.criticalBlockers.length)
    .map((result) => {
      const carrier = carrierById.get(result.carrierId);
      return {
        id: `carrier-risk:${result.carrierId}`,
        scope: "carrier" as const,
        type: "Readiness Risk" as const,
        severity: result.criticalBlockers.length || result.score < 50 ? "Critical" as const : result.score < 70 ? "High" as const : "Medium" as const,
        title: `${result.carrierName} readiness risk`,
        description: `${result.band} at ${result.score}%. ${result.criticalBlockers[0] ?? "Review readiness deductions."}`,
        carrierId: result.carrierId,
        carrierName: result.carrierName,
        entityId: result.carrierId,
        dueDate: result.nextExpiringDocument?.expirationDate ?? null,
        daysUntilExpiration: null,
        openCarrierHref: `/carriers/${result.carrierId}`,
        openEntityHref: `/carriers/${result.carrierId}`,
        openDocumentHref: carrier ? `/carriers/${carrier.id}` : `/audit-readiness`,
      };
    });

  const driverAlerts = dqFiles.flatMap((file) => [
    ...file.checklist
      .filter((item) => item.missing || item.expired || item.expiringSoon)
      .map((item) => {
        const slug = documentSlug(item.name);
        return {
          id: `driver-document:${file.id}:${slug}`,
          scope: "driver" as const,
          type: item.expired ? "Expired" as const : item.missing ? "Missing" as const : "Expiring Soon" as const,
          severity: item.expired ? "Critical" as const : item.missing ? "High" as const : "Low" as const,
          title: `${file.driverName || "Unnamed driver"}: ${item.name}`,
          description: `DQ document is ${item.status.replace(/_/g, " ")}.`,
          carrierId: file.carrierId,
          carrierName: file.carrierName,
          entityId: file.id,
          dueDate: item.expirationDate,
          daysUntilExpiration: null,
          openCarrierHref: file.carrierId ? `/carriers/${file.carrierId}` : null,
          openEntityHref: `/dq-files/${file.id}`,
          openDocumentHref: `/dq-files/${file.id}?document=${slug}`,
        };
      }),
    ...(file.readinessPercentage < 80 ? [{
      id: `driver-risk:${file.id}`,
      scope: "driver" as const,
      type: "Readiness Risk" as const,
      severity: file.readinessPercentage < 50 || file.expiredCount ? "Critical" as const : file.readinessPercentage < 70 ? "High" as const : "Medium" as const,
      title: `${file.driverName || "Unnamed driver"} readiness risk`,
      description: `${file.readinessBand} at ${file.readinessPercentage}%. ${file.missingCount} missing, ${file.expiredCount} expired.`,
      carrierId: file.carrierId,
      carrierName: file.carrierName,
      entityId: file.id,
      dueDate: null,
      daysUntilExpiration: null,
      openCarrierHref: file.carrierId ? `/carriers/${file.carrierId}` : null,
      openEntityHref: `/dq-files/${file.id}`,
      openDocumentHref: `/dq-files/${file.id}`,
    }] : []),
  ]);

  const vehicleAlerts = vehicles.flatMap((vehicle) => [
    ...vehicle.checklist
      .filter((item) => item.missing || item.expired || item.expiringSoon)
      .map((item) => {
        const slug = documentSlug(item.name);
        const critical = item.expired || vehicle.criticalBlockers.some((blocker) => blocker.includes(item.name));
        return {
          id: `vehicle-document:${vehicle.id}:${slug}`,
          scope: "vehicle" as const,
          type: item.expired ? "Expired" as const : item.missing ? "Missing" as const : "Expiring Soon" as const,
          severity: critical ? "Critical" as const : item.missing ? "High" as const : "Low" as const,
          title: `Unit ${vehicle.unitNumber}: ${item.name}`,
          description: `${vehicle.carrierName} vehicle document is ${item.status.replace(/_/g, " ")}.`,
          carrierId: vehicle.carrierId,
          carrierName: vehicle.carrierName,
          entityId: vehicle.id,
          dueDate: item.expirationDate,
          daysUntilExpiration: null,
          openCarrierHref: `/carriers/${vehicle.carrierId}`,
          openEntityHref: `/vehicles/${vehicle.id}`,
          openDocumentHref: `/vehicles/${vehicle.id}?document=${slug}`,
        };
      }),
    ...(vehicle.readinessPercentage < 80 || vehicle.criticalBlockers.length ? [{
      id: `vehicle-risk:${vehicle.id}`,
      scope: "vehicle" as const,
      type: "Readiness Risk" as const,
      severity: vehicle.criticalBlockers.length || vehicle.readinessPercentage < 50 ? "Critical" as const : vehicle.readinessPercentage < 70 ? "High" as const : "Medium" as const,
      title: `Unit ${vehicle.unitNumber} readiness risk`,
      description: `${vehicle.readinessBand} at ${vehicle.readinessPercentage}%. ${vehicle.criticalBlockers[0] ?? `${vehicle.missingCount} missing, ${vehicle.expiredCount} expired.`}`,
      carrierId: vehicle.carrierId,
      carrierName: vehicle.carrierName,
      entityId: vehicle.id,
      dueDate: vehicle.nextExpiration,
      daysUntilExpiration: null,
      openCarrierHref: `/carriers/${vehicle.carrierId}`,
      openEntityHref: `/vehicles/${vehicle.id}`,
      openDocumentHref: `/vehicles/${vehicle.id}`,
    }] : []),
  ]);

  const inspectionAlerts = inspections
    .filter((inspection) => inspection.outOfService || inspection.violations.trim())
    .map((inspection) => ({
      id: `inspection:${inspection.id}:review`,
      scope: "carrier" as const,
      type: "Needs Review" as const,
      severity: inspection.outOfService ? "Critical" as const : "High" as const,
      title: `${inspection.carrierName}: inspection finding`,
      description: inspection.outOfService
        ? "Out-of-service inspection requires compliance follow-up."
        : "Inspection violations require compliance follow-up.",
      carrierId: inspection.carrierId,
      carrierName: inspection.carrierName,
      entityId: inspection.id,
      dueDate: inspection.inspectionDate,
      daysUntilExpiration: null,
      openCarrierHref: `/carriers/${inspection.carrierId}`,
      openEntityHref: `/inspections/${inspection.id}`,
      openDocumentHref: `/inspections/${inspection.id}`,
    }));

  return [...carrierDocumentAlerts, ...carrierRiskAlerts, ...driverAlerts, ...vehicleAlerts, ...inspectionAlerts].sort(sortAlerts);
}

function AlertRow({ alert, canCreateTasks }: { alert: ComplianceAlert; canCreateTasks: boolean }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_160px_auto] items-center gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-xl:grid-cols-1">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge label={alert.severity} severity={alert.severity} />
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
            {alert.scope}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
            {alert.type}
          </span>
        </div>
        <strong className="block text-base text-white">{alert.title}</strong>
        <p className="mt-1 text-sm leading-6 text-manifest-muted">{alert.description}</p>
        <p className="mt-1 text-xs font-bold text-manifest-quiet">{alert.carrierName}</p>
      </div>
      <div className="text-sm font-bold text-manifest-muted">
        <span className="panel-label">Due</span>
        <span className="mt-1 block text-white">{alert.dueDate ?? "No due date"}</span>
      </div>
      <div className="flex flex-wrap justify-end gap-2 max-xl:justify-start">
        {alert.openCarrierHref ? <ActionLink href={alert.openCarrierHref} label="Open Carrier" /> : null}
        <ActionLink href={alert.openEntityHref} label={`Open ${capitalize(alert.scope)}`} />
        <ActionLink href={alert.openDocumentHref} label="Open Document" />
        {canCreateTasks ? (
          <form action={createComplianceTaskAction}>
            <input type="hidden" name="title" value={alert.title} />
            <input type="hidden" name="description" value={alert.description} />
            <input type="hidden" name="priority" value={alert.severity.toLowerCase()} />
            <input type="hidden" name="dueDate" value={alert.dueDate ?? ""} />
            <input type="hidden" name="relatedEntityType" value={alert.scope} />
            <input type="hidden" name="relatedEntityId" value={alert.entityId} />
            <input type="hidden" name="relatedCarrierId" value={alert.carrierId ?? ""} />
            <input type="hidden" name="sourceAlertId" value={alert.id} />
            <button className="form-button min-h-10 justify-center px-3 text-sm" type="submit">
              Create Task
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="form-button min-h-10 justify-center px-3 text-sm">
      {label}
      <ExternalLink className="h-4 w-4" />
    </Link>
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

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warn" | "danger" }) {
  const text = tone === "danger" ? "text-manifest-danger" : tone === "warn" ? "text-manifest-amber" : "text-white";
  return (
    <article className="rounded-md border border-white/10 bg-black/30 p-4">
      <span className="panel-label">{label}</span>
      <strong className={`mt-3 block text-3xl ${text}`}>{value}</strong>
    </article>
  );
}

function Badge({ label, severity }: { label: string; severity: AlertSeverity }) {
  const tone = severity === "Critical"
    ? "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger"
    : severity === "High"
      ? "border-manifest-amber/40 bg-manifest-amber/10 text-manifest-amber"
      : severity === "Medium"
        ? "border-manifest-red/40 bg-manifest-red/10 text-manifest-red"
        : "border-white/10 bg-white/[0.035] text-manifest-muted";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${tone}`}>{label}</span>;
}

function scopeCarriers(carriers: Carrier[], session: Awaited<ReturnType<typeof requireSession>>) {
  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    return carriers.filter((carrier) => carrier.id === session.carrierId);
  }
  return carriers;
}

function normalizeFilter(value: string | undefined): AlertFilter {
  return filters.some((filter) => filter.value === value) ? (value as AlertFilter) : "all";
}

function filterAlerts(alerts: ComplianceAlert[], filter: AlertFilter) {
  if (filter === "all") return alerts;
  if (filter === "critical") return alerts.filter((alert) => alert.severity === "Critical");
  if (filter === "expiring-30") {
    return alerts.filter((alert) => alert.type === "Expiring Soon" || (alert.daysUntilExpiration !== null && alert.daysUntilExpiration >= 0 && alert.daysUntilExpiration <= 30));
  }
  return alerts.filter((alert) => alert.scope === filter);
}

function normalizeType(status: string): AlertType {
  if (status === "Expired") return "Expired";
  if (status === "Expiring Soon") return "Expiring Soon";
  if (status === "Needs Review") return "Needs Review";
  return "Missing";
}

function severityForDocumentStatus(status: string): AlertSeverity {
  if (status === "Expired") return "Critical";
  if (status === "Missing") return "High";
  if (status === "Needs Review") return "Medium";
  return "Low";
}

function sortAlerts(a: ComplianceAlert, b: ComplianceAlert) {
  return severityWeight(b.severity) - severityWeight(a.severity) || dueDateWeight(a.dueDate) - dueDateWeight(b.dueDate) || a.title.localeCompare(b.title);
}

function severityWeight(severity: AlertSeverity) {
  return { Critical: 4, High: 3, Medium: 2, Low: 1 }[severity];
}

function dueDateWeight(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
