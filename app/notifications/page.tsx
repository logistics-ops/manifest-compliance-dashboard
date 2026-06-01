import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck, ExternalLink, RefreshCw } from "lucide-react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  syncComplianceNotificationsAction,
} from "@/app/actions/notifications";
import { getCarriers } from "@/lib/data/carriers";
import { getNotifications } from "@/lib/data/notifications";
import { requireSession } from "@/lib/integrations/auth";
import { canRoleManageCompliance } from "@/lib/security/tenant-rules";
import { getNotificationStats, getPriorityClass } from "@/lib/notifications";
import type { ComplianceNotification } from "@/types/carrier";

type PageProps = {
  searchParams?: Promise<{ severity?: string; type?: string }>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const carriers = await getCarriers();
  const notifications = filterNotifications(await getNotifications(carriers), {
    severity: params?.severity,
    type: params?.type,
  });
  const stats = getNotificationStats(notifications);
  const canSync = session.platformSuperAdmin || canRoleManageCompliance(session.role);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <Link href="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Operations Center
            </Link>
            <p className="eyebrow">Notification Center</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Compliance Notifications
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              In-app reminders for expiring carrier, driver, and vehicle documents, overdue compliance tasks, and critical compliance alerts.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <Bell className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{stats.unread}</strong>
            <span className="text-xs font-bold text-manifest-muted">unread</span>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          <Metric label="Total" value={stats.total} />
          <Metric label="Unread" value={stats.unread} tone="warn" />
          <Metric label="Critical" value={stats.critical} tone="danger" />
          <Metric label="Assigned" value={stats.assigned} tone="good" />
        </section>

        <section className="section-panel mb-5 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <form className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Severity
                <select name="severity" defaultValue={params?.severity ?? "all" } className="form-control min-w-44">
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Type
                <select name="type" defaultValue={params?.type ?? "all"} className="form-control min-w-52">
                  <option value="all">All types</option>
                  <option value="carrier_document">Carrier documents</option>
                  <option value="driver_document">DQ documents</option>
                  <option value="vehicle_document">Vehicle documents</option>
                  <option value="compliance_task">Compliance tasks</option>
                  <option value="compliance_alert">Critical alerts</option>
                  <option value="load_operation">Load operations</option>
                  <option value="invoice_operation">Invoices</option>
                </select>
              </label>
              <button className="form-button min-h-11 w-fit px-4 text-sm">Filter</button>
            </form>
            <div className="flex flex-wrap gap-2">
              {canSync ? (
                <form action={syncComplianceNotificationsAction}>
                  <button className="form-button min-h-11 px-4 text-sm">
                    <RefreshCw className="h-4 w-4" />
                    Sync reminders
                  </button>
                </form>
              ) : null}
              <form action={markAllNotificationsReadAction}>
                <button className="form-button min-h-11 px-4 text-sm">
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Recent Notifications</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">{notifications.length} notification{notifications.length === 1 ? "" : "s"}</h2>
          </div>

          {notifications.length ? (
            <div className="grid gap-3">
              {notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} />)}
            </div>
          ) : (
            <div className="empty-state">No notifications match the current filters.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function NotificationRow({ notification }: { notification: ComplianceNotification }) {
  return (
    <article className={`rounded-md border bg-black/25 p-4 ${notification.status === "unread" ? "border-manifest-red/40" : "border-white/10"}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 max-lg:grid-cols-1">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className={`rounded-md border px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] ${getPriorityClass(notification.priority)}`}>
              {notification.severity ?? notification.priority}
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-manifest-muted">
              {formatLabel(notification.type ?? notification.category)}
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-manifest-muted">
              {notification.status}
            </span>
          </div>
          <strong className="block text-base text-white">{notification.title}</strong>
          <p className="mt-1 text-sm leading-6 text-manifest-muted">{notification.message}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-manifest-muted">
            <span>{notification.carrierName}</span>
            {notification.documentName ? <span>{notification.documentName}</span> : null}
            {notification.dueDate ? <span>Due {notification.dueDate}</span> : null}
            <span>{formatDateTime(notification.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap content-start justify-end gap-2 max-lg:justify-start">
          {notification.relatedUrl ? (
            <Link href={notification.relatedUrl} className="form-button min-h-10 px-3 text-sm">
              Open
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : notification.carrierId ? (
            <Link href={`/carriers/${notification.carrierId}`} className="form-button min-h-10 px-3 text-sm">
              Open carrier
            </Link>
          ) : null}
          {notification.status === "unread" ? (
            <form action={markNotificationReadAction}>
              <input type="hidden" name="notificationId" value={notification.id} />
              <button className="form-button min-h-10 px-3 text-sm">
                <CheckCheck className="h-4 w-4" />
                Mark read
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function filterNotifications(notifications: ComplianceNotification[], filters: { severity?: string; type?: string }) {
  return notifications
    .filter((notification) => !filters.severity || filters.severity === "all" || notification.priority === filters.severity || notification.severity === filters.severity)
    .filter((notification) => !filters.type || filters.type === "all" || notification.type === filters.type || notification.category === filters.type)
    .slice(0, 120);
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const text = tone === "good" ? "text-manifest-green" : tone === "danger" ? "text-manifest-danger" : tone === "warn" ? "text-manifest-amber" : "text-white";
  return (
    <article className="rounded-md border border-white/10 bg-black/30 p-4">
      <span className="panel-label">{label}</span>
      <strong className={`mt-3 block text-3xl ${text}`}>{value}</strong>
    </article>
  );
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
