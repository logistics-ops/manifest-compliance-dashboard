import Link from "next/link";
import { ArrowLeft, ExternalLink, FileWarning } from "lucide-react";
import { buildActionCenterItems, documentActionItems, type OperationsActionItem } from "@/lib/action-center";
import { getAuditReadinessDashboardData } from "@/lib/data/audit-readiness";
import { getCarriers } from "@/lib/data/carriers";
import { getDQFiles } from "@/lib/data/dq-files";
import { getInvoices } from "@/lib/data/invoices";
import { getLoads } from "@/lib/data/loads";
import { getNotifications } from "@/lib/data/notifications";
import { getVehicles } from "@/lib/data/vehicles";
import { requireSession } from "@/lib/integrations/auth";
import type { Carrier } from "@/types/carrier";

export default async function DocumentsToFixPage() {
  const session = await requireSession();
  const [allCarriers, auditReadiness, dqFiles, vehicles, loads, invoices] = await Promise.all([
    getCarriers(),
    getAuditReadinessDashboardData(),
    getDQFiles(),
    getVehicles(),
    getLoads(),
    getInvoices(),
  ]);
  const carriers = scopeCarriers(allCarriers, session);
  const notifications = await getNotifications(carriers);
  const actions = documentActionItems(buildActionCenterItems({
    carriers,
    auditReadiness: {
      ...auditReadiness,
      results: auditReadiness.results.filter((result) => carriers.some((carrier) => carrier.id === result.carrierId)),
    },
    dqFiles,
    vehicles,
    loads,
    invoices,
    notifications,
  }));
  const missing = actions.filter((item) => item.title.toLowerCase().includes("missing")).length;
  const expired = actions.filter((item) => item.title.toLowerCase().includes("expired")).length;
  const expiring = actions.filter((item) => item.title.toLowerCase().includes("expiring")).length;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">Documents To Fix</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Missing, expired, and expiring document work across carrier profiles, DQ files, vehicles, and load documents.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <FileWarning className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{actions.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">document actions</span>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          <Metric label="Documents to fix" value={actions.length} />
          <Metric label="Missing" value={missing} tone="warn" />
          <Metric label="Expired" value={expired} tone="danger" />
          <Metric label="Expiring soon" value={expiring} tone="warn" />
        </section>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Correction Queue</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Fixable document issues</h2>
          </div>

          {actions.length ? (
            <div className="grid gap-3">
              {actions.map((item) => <DocumentActionRow key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="empty-state">No missing, expired, or expiring document actions are open.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function DocumentActionRow({ item }: { item: OperationsActionItem }) {
  const urgent = item.priority === "critical";
  return (
    <article className={`grid grid-cols-[minmax(0,1fr)_150px_auto] items-center gap-4 rounded-md border bg-black/25 p-4 max-lg:grid-cols-1 ${urgent ? "border-manifest-danger/35" : "border-white/10"}`}>
      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${urgent ? "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger" : "border-manifest-amber/40 bg-manifest-amber/10 text-manifest-amber"}`}>
            {item.priority}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
            {item.category}
          </span>
        </div>
        <strong className="block text-base text-white">{item.title}</strong>
        <p className="mt-1 text-sm leading-6 text-manifest-muted">{item.description}</p>
      </div>
      <div>
        <span className="panel-label">Due</span>
        <strong className="mt-1 block text-sm text-white">{item.dueDate ?? "No due date"}</strong>
      </div>
      <Link href={item.correctionHref} className="form-button min-h-10 justify-center px-3 text-sm">
        Fix
        <ExternalLink className="h-4 w-4" />
      </Link>
    </article>
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

function scopeCarriers(carriers: Carrier[], session: Awaited<ReturnType<typeof requireSession>>) {
  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    return carriers.filter((carrier) => carrier.id === session.carrierId);
  }
  return carriers;
}
