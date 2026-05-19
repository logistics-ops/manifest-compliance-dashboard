"use client";

import { Activity } from "lucide-react";
import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const entityTypes = useMemo(() => Array.from(new Set(logs.map((log) => log.entityType).filter(Boolean))).sort(), [logs]);
  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesEntity = entityFilter === "all" || log.entityType === entityFilter;
      const haystack = [
        log.action,
        log.organizationName,
        log.actorName,
        log.actorEmail,
        log.entityType,
        log.entityId,
        formatMetadata(log.metadata),
      ].join(" ").toLowerCase();
      return matchesEntity && haystack.includes(needle);
    });
  }, [entityFilter, logs, query]);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid min-w-64 flex-1 gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Search activity
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="form-control"
            placeholder="Action, actor, entity, metadata..."
            type="search"
          />
        </label>
        <label className="grid min-w-48 gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Entity
          <select
            value={entityFilter}
            onChange={(event) => {
              setEntityFilter(event.target.value);
              setPage(1);
            }}
            className="form-control"
          >
            <option value="all">All entities</option>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredLogs.length ? (
        <div className="overflow-x-auto rounded-md border border-white/10">
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
              {pagedLogs.map((log) => (
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
        <div className="empty-state">No audit events match the current filters.</div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-manifest-muted">
        <span>
          Showing {pagedLogs.length} of {filteredLogs.length} events
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            className="form-button min-h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="inline-flex min-h-9 items-center rounded-md border border-white/10 bg-black/30 px-3 text-xs font-bold text-white">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            disabled={currentPage === pageCount}
            className="form-button min-h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
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
