import type { CarrierStatus, ComplianceTier, DocumentStatus } from "@/types/carrier";

const carrierStyles: Record<CarrierStatus, string> = {
  Active: "border-manifest-green/45 text-manifest-green",
  Pending: "border-manifest-amber/55 text-manifest-amber",
  Suspended: "border-manifest-danger/60 text-manifest-danger",
  Inactive: "border-manifest-line text-manifest-muted",
};

const documentStyles: Record<DocumentStatus, string> = {
  Valid: "border-manifest-green/35 text-manifest-green",
  "Expiring Soon": "border-manifest-amber/55 text-manifest-amber",
  Expired: "border-manifest-danger/60 text-manifest-danger",
  Missing: "border-manifest-danger/60 text-manifest-danger",
};

const riskStyles: Record<ComplianceTier, string> = {
  "Audit Ready": "border-manifest-green/55 bg-manifest-green/10 text-manifest-green",
  "Strong Compliance": "border-manifest-green/45 bg-manifest-green/10 text-manifest-green",
  "Mostly Compliant": "border-manifest-green/35 bg-manifest-green/10 text-manifest-green",
  "Needs Attention": "border-manifest-amber/60 bg-manifest-amber/10 text-manifest-amber",
  "Moderate Risk": "border-manifest-orange/65 bg-manifest-orange/10 text-manifest-orange",
  "High Risk": "border-manifest-danger/65 bg-manifest-danger/10 text-manifest-danger",
};

type StatusChipProps = {
  value: CarrierStatus | DocumentStatus | ComplianceTier | string;
  type?: "carrier" | "document" | "risk" | "plain";
};

export function StatusChip({ value, type = "plain" }: StatusChipProps) {
  const tone =
    type === "carrier"
      ? carrierStyles[value as CarrierStatus]
      : type === "document"
        ? documentStyles[value as DocumentStatus]
        : type === "risk"
          ? riskStyles[value as ComplianceTier]
          : "border-manifest-line text-manifest-muted";

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border bg-white/[0.04] px-2.5 text-xs font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${tone}`}
    >
      {value}
    </span>
  );
}
