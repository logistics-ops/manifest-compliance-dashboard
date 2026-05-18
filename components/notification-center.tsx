"use client";

import Link from "next/link";
import { Bell, CheckCheck, Filter, Mail, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  assignNotificationToMeAction,
  dismissNotificationAction,
  markNotificationReadAction,
  sendWeeklyComplianceSummaryAction,
  syncComplianceNotificationsAction,
} from "@/app/actions/notifications";
import { getNotificationStats, getPriorityClass } from "@/lib/notifications";
import type { ComplianceNotification } from "@/types/carrier";

export function NotificationCenter({
  notifications,
}: {
  notifications: ComplianceNotification[];
}) {
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | ComplianceNotification["priority"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ComplianceNotification["status"]>("all");
  const [toast, setToast] = useState<string | null>(null);
  const stats = getNotificationStats(notifications);
  const visibleNotifications = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return notifications
      .filter((notification) => priorityFilter === "all" || notification.priority === priorityFilter)
      .filter((notification) => statusFilter === "all" || notification.status === statusFilter)
      .filter((notification) => {
        if (!needle) return true;

        return [
          notification.title,
          notification.message,
          notification.carrierName,
          notification.documentName ?? "",
          notification.category,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .slice(0, 12);
  }, [notifications, priorityFilter, query, statusFilter]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  return (
    <section id="notifications" className="section-panel mb-5 p-6 max-md:p-4">
      <div className="mb-5 flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <p className="eyebrow">Notification Center</p>
          <h2 className="text-2xl font-extrabold tracking-normal">Operational alert queue</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-manifest-muted">
            Automated document, insurance, and carrier-risk alerts with read status, priority, assignment, and dismissal.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={syncComplianceNotificationsAction} onSubmit={() => showToast("Sync requested. The queue will refresh when complete.")}>
            <button className="form-button min-h-10">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Sync rules
            </button>
          </form>
          <form action={sendWeeklyComplianceSummaryAction} onSubmit={() => showToast("Weekly summary dispatch requested.")}>
            <button className="form-button min-h-10">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Send weekly summary
            </button>
          </form>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        <NotificationStat label="Total alerts" value={stats.total} />
        <NotificationStat label="Unread" value={stats.unread} tone="text-manifest-amber" />
        <NotificationStat label="Critical" value={stats.critical} tone="text-manifest-danger" />
        <NotificationStat label="Assigned" value={stats.assigned} tone="text-manifest-green" />
      </div>

      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_180px_180px] gap-3 max-lg:grid-cols-1">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Search alerts
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="form-control w-full pl-9"
              placeholder="Carrier, document, message..."
              type="search"
            />
          </span>
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Priority
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)} className="form-control">
            <option value="all">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="form-control">
            <option value="all">All statuses</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3">
        {visibleNotifications.length ? (
          visibleNotifications.map((notification) => (
            <article
              key={notification.id}
              className={`surface-hover rounded-md border bg-black/30 p-4 ${notification.status === "unread" ? "border-manifest-red/35" : "border-white/10"}`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 max-md:grid-cols-1">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] ${getPriorityClass(notification.priority)}`}>
                      {notification.priority}
                    </span>
                    <span className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-manifest-muted">
                      {formatCategory(notification.category)}
                    </span>
                    {notification.status === "unread" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-manifest-red">
                        <Bell className="h-3.5 w-3.5" />
                        Unread
                      </span>
                    ) : null}
                  </div>

                  <h3 className="text-base font-extrabold text-white">{notification.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-manifest-muted">{notification.message}</p>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-manifest-muted">
                    <span>{notification.carrierName}</span>
                    {notification.documentName ? <span>{notification.documentName}</span> : null}
                    {notification.dueDate ? <span>Due {notification.dueDate}</span> : null}
                    <span>{formatDateTime(notification.createdAt)}</span>
                    <span>{notification.assignedTo ? "Assigned" : "Unassigned"}</span>
                  </div>
                </div>

                <div className="flex flex-wrap content-start justify-end gap-2 max-md:justify-start">
                  {notification.carrierId ? (
                    <Link href={`/carriers/${notification.carrierId}`} className="form-button">
                      Open carrier
                    </Link>
                  ) : null}
                  {notification.status === "unread" ? (
                    <form action={markNotificationReadAction} onSubmit={() => showToast("Notification marked as read.")}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button className="form-button" title="Mark as read">
                        <CheckCheck className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : null}
                  {!notification.assignedTo ? (
                    <form action={assignNotificationToMeAction} onSubmit={() => showToast("Notification assigned to you.")}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button className="form-button">Assign to me</button>
                    </form>
                  ) : null}
                  <form action={dismissNotificationAction} onSubmit={() => showToast("Notification dismissed.")}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button className="form-button" title="Dismiss alert">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state flex items-start gap-3">
            <Filter className="mt-0.5 h-4 w-4 shrink-0 text-manifest-red" />
            <span>
              No notifications match the current filters. Adjust search, priority, or status, or sync rules to refresh the queue.
            </span>
          </div>
        )}
      </div>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </section>
  );
}

function NotificationStat({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-black/30 p-4">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-manifest-quiet">{label}</span>
      <strong className={`mt-3 block text-4xl leading-none ${tone}`}>{value}</strong>
    </article>
  );
}

function formatCategory(category: string) {
  return category.replace(/_/g, " ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
