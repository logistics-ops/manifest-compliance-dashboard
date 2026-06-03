import Link from "next/link";
import { ArrowLeft, ClipboardCheck, ExternalLink, ShieldAlert } from "lucide-react";
import {
  buildActionCenterItems,
  groupActionItems,
  type ActionPriority,
  type OperationsActionItem,
} from "@/lib/action-center";
import { getAuditReadinessDashboardData } from "@/lib/data/audit-readiness";
import { getCarriers } from "@/lib/data/carriers";
import { getDQFiles } from "@/lib/data/dq-files";
import { getInvoices } from "@/lib/data/invoices";
import { getLoads } from "@/lib/data/loads";
import { getNotifications } from "@/lib/data/notifications";
import { getVehicles } from "@/lib/data/vehicles";
import { requireSession } from "@/lib/integrations/auth";
import type { Carrier } from "@/types/carrier";

export default async function ActionCenterPage() {
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
  const scopedAuditReadiness = {
    ...auditReadiness,
    results: auditReadiness.results.filter((result) => carriers.some((carrier) => carrier.id === result.carrierId)),
  };
  const actions = buildActionCenterItems({
    carriers,
    auditReadiness: scopedAuditReadiness,
    dqFiles,
    vehicles,
    loads,
    invoices,
    notifications,
  });
  const grouped = groupActionItems(actions);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Operations Center</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">Action Center</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              A read-only operating queue that turns readiness, documents, loads, invoices, and alerts into fixable actions.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ShieldAlert className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{actions.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">open actions</span>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          <Metric label="Critical" value={grouped.critical.length} tone="danger" />
          <Metric label="High Priority" value={grouped.high.length} tone="warn" />
          <Metric label="Needs Attention" value={grouped.needsAttention.length} />
          <Metric label="Upcoming" value={grouped.upcoming.length} />
        </section>

        <div className="grid gap-5">
          <ActionGroup title="Critical" description="Compliance work that can stop audits, document acceptance, or carrier approval." items={grouped.critical} />
          <ActionGroup title="High Priority" description="Open items that should be fixed before they become blockers." items={grouped.high} />
          <ActionGroup title="Needs Attention" description="Operational items that need review or follow-up." items={grouped.needsAttention} />
          <ActionGroup title="Upcoming" description="Renewals and lower-risk items coming due." items={grouped.upcoming} />
        </div>
      </div>
    </main>
  );
}

function ActionGroup({ title, description, items }: { title: string; description: string; items: OperationsActionItem[] }) {
  return (
    <section className="section-panel p-6 max-md:p-4">
      <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div>
          <p className="eyebrow">{title}</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">{items.length} action{items.length === 1 ? "" : "s"}</h2>
          <p className="mt-2 text-sm leading-6 text-manifest-muted">{description}</p>
        </div>
        <ClipboardCheck className="h-5 w-5 text-manifest-red" />
      </div>

      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => <ActionRow key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="empty-state">No {title.toLowerCase()} actions right now.</div>
      )}
    </section>
  );
}

function ActionRow({ item }: { item: OperationsActionItem }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_160px_auto] items-center gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-lg:grid-cols-1">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge label={item.priority} priority={item.priority} />
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
            {item.category}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
            {item.source.replace(/_/g, " ")}
          </span>
        </div>
        <strong className="block text-base text-white">{item.title}</strong>
        <p className="mt-1 text-sm leading-6 text-manifest-muted">{item.description}</p>
      </div>
      <div className="text-sm font-bold text-manifest-muted">
        <span className="panel-label">Due</span>
        <span className="mt-1 block text-white">{item.dueDate ?? "No due date"}</span>
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

function Badge({ label, priority }: { label: string; priority: ActionPriority }) {
  const tone = priority === "critical"
    ? "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger"
    : priority === "high"
      ? "border-manifest-amber/40 bg-manifest-amber/10 text-manifest-amber"
      : "border-white/10 bg-white/[0.035] text-manifest-muted";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${tone}`}>{label}</span>;
}

function scopeCarriers(carriers: Carrier[], session: Awaited<ReturnType<typeof requireSession>>) {
  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    return carriers.filter((carrier) => carrier.id === session.carrierId);
  }
  return carriers;
}
