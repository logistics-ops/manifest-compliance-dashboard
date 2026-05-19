import type { BrokerApprovedStatus, BrokerRiskLevel } from "@/types/broker";

export function BrokerStatusBadge({ value }: { value: BrokerApprovedStatus | BrokerRiskLevel | string }) {
  const className = badgeClass(value);
  return (
    <span className={`inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-extrabold uppercase tracking-[0.12em] ${className}`}>
      {String(value).replace(/_/g, " ")}
    </span>
  );
}

function badgeClass(value: string) {
  if (value === "approved" || value === "low") return "border-manifest-green/45 bg-manifest-green/10 text-manifest-green";
  if (value === "review_required" || value === "medium") return "border-manifest-amber/45 bg-manifest-amber/10 text-manifest-amber";
  if (value === "blocked" || value === "high") return "border-manifest-danger/45 bg-manifest-danger/10 text-manifest-danger";
  return "border-white/10 bg-white/[0.035] text-manifest-muted";
}
