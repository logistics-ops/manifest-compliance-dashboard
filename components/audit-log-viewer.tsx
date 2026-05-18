import { Activity } from "lucide-react";
import type { AuditLog } from "@/lib/audit";

export function AuditLogViewer({
  logs,
  title = "Audit log",
  description = "Recent security and tenant activity.",
}: {
  logs: AuditLog[];
  title?: string;
  description?: string;
}) {
  return (
    <section className="section-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Security Trail</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-manifest-muted">{description}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 text-manifest-red">
          <Activity className="h-5 w-5" />
        </span>
      </div>

      {logs.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                <th className="border-b border-white/10 px-4 py-4">Event</th>
                <th className="border-b border-white/10 px-4 py-4">Organization</th>
                <th className="border-b border-white/10 px-4 py-4">Actor</th>
                <th className="border-b border-white/10 px-4 py-4">Entity</th>
                <th className="border-b border-white/10 px-4 py-4">Metadata</th>
                <th className="border-b border-white/10 px-4 py-4">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="border-b border-white/10 px-4 py-4">
                    <strong className="block text-sm text-white">{formatAction(log.action)}</strong>
                    <span className="text-xs text-manifest-muted">{log.action}</span>
                  </td>
                  <td className="border-b border-white/10 px-4 py-4 text-sm font-bold text-white">
                    {log.organizationName}
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <strong className="block text-sm text-white">{log.actorName || "User"}</strong>
                    <span className="text-xs text-manifest-muted">{log.actorEmail}</span>
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <span className="block text-sm font-bold text-white">{log.entityType}</span>
                    <span className="text-xs text-manifest-muted">{shortId(log.entityId)}</span>
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <span className="line-clamp-2 max-w-sm text-xs leading-5 text-manifest-muted">
                      {formatMetadata(log.metadata)}
                    </span>
                  </td>
                  <td className="border-b border-white/10 px-4 py-4 text-xs font-bold text-manifest-muted">
                    {formatDate(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No audit events have been recorded yet.</div>
      )}
    </section>
  );
}

function formatAction(action: string) {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, " "))
    .join(" ");
}

function shortId(value: string | null) {
  return value ? `${value.slice(0, 8)}...` : "none";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== "");
  if (!entries.length) return "No details";

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}
