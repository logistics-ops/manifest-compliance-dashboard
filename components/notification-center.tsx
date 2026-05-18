"use client";

import Link from "next/link";
import { Bell, CheckCheck, Mail, RefreshCw, X } from "lucide-react";
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
  const stats = getNotificationStats(notifications);
  const visibleNotifications = notifications.slice(0, 8);

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
          <form action={syncComplianceNotificationsAction}>
            <button className="form-button min-h-10">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Sync rules
            </button>
          </form>
          <form action={sendWeeklyComplianceSummaryAction}>
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

      <div className="grid gap-3">
        {visibleNotifications.length ? (
          visibleNotifications.map((notification) => (
            <article
              key={notification.id}
              className={`rounded-md border bg-black/30 p-4 ${notification.status === "unread" ? "border-manifest-red/35" : "border-white/10"}`}
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
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button className="form-button" title="Mark as read">
                        <CheckCheck className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : null}
                  {!notification.assignedTo ? (
                    <form action={assignNotificationToMeAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button className="form-button">Assign to me</button>
                    </form>
                  ) : null}
                  <form action={dismissNotificationAction}>
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
          <div className="rounded-md border border-white/10 bg-black/30 p-4 text-sm text-manifest-muted">
            No active notifications. Sync rules to generate the latest compliance alert queue.
          </div>
        )}
      </div>
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
