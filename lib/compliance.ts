import { REQUIRED_DOCUMENTS } from "@/lib/mock-data";
import type {
  AlertLabel,
  Carrier,
  CarrierDocument,
  ComplianceDeduction,
  ComplianceScoreBreakdown,
  ComplianceTimelineEvent,
  ComplianceTier,
  DocumentStatus,
  EnrichedDocument,
  RequiredDocumentName,
} from "@/types/carrier";

export const COMPLIANCE_TODAY = new Date("2026-05-18T12:00:00");

export function daysUntilExpiration(dateString: string | null): number | null {
  if (!dateString) return null;
  const expiration = new Date(`${dateString}T12:00:00`);
  return Math.ceil((expiration.getTime() - COMPLIANCE_TODAY.getTime()) / 86400000);
}

export function getDocumentStatus(documentRecord: CarrierDocument): DocumentStatus {
  if (!documentRecord.uploaded) return "Missing";

  const days = daysUntilExpiration(documentRecord.expirationDate);
  if (days === null) return "Valid";
  if (days < 0) return "Expired";
  if (days <= 30) return "Expiring Soon";
  return "Valid";
}

export function getCarrierDocuments(carrier: Carrier): EnrichedDocument[] {
  return REQUIRED_DOCUMENTS.map((name) => {
    const record = carrier.documents[name] ?? { uploaded: false, expirationDate: null };

    return {
      ...record,
      name,
      daysUntilExpiration: daysUntilExpiration(record.expirationDate),
      status: getDocumentStatus(record),
    };
  });
}

export function getCarrierAlerts(carrier: Carrier): AlertLabel[] {
  const docs = getCarrierDocuments(carrier);
  const score = getComplianceScore(carrier);
  const alerts = new Set<AlertLabel>();

  if (docs.some((doc) => doc.status === "Missing")) alerts.add("Missing Document");
  if (docs.some((doc) => doc.status === "Expiring Soon")) alerts.add("Expiring in 30 Days");
  if (docs.some((doc) => doc.status === "Expired")) alerts.add("Expired");
  if (score < 80 || getComplianceTier(carrier) === "High Risk" || carrier.status === "Suspended") {
    alerts.add("Needs Review");
  }
  if (score === 100 && docs.every((doc) => doc.status === "Valid")) {
    alerts.add("Audit Ready");
  }

  return Array.from(alerts);
}

export function getComplianceScore(carrier: Carrier): number {
  return getComplianceScoreBreakdown(carrier).finalScore;
}

export function getComplianceScoreBreakdown(carrier: Carrier): ComplianceScoreBreakdown {
  const docs = getCarrierDocuments(carrier);
  const deductions = docs.flatMap(getDocumentDeductions);
  const totalDeductions = deductions.reduce((total, deduction) => total + deduction.points, 0);
  const finalScore = Math.max(0, 100 - totalDeductions);
  const automaticHighRisk = hasExpiredInsurance(carrier);

  return {
    startingScore: 100,
    finalScore,
    tier: getComplianceTierFromScore(finalScore, automaticHighRisk),
    automaticHighRisk,
    deductions,
  };
}

export function getComplianceTier(carrier: Carrier): ComplianceTier {
  return getComplianceScoreBreakdown(carrier).tier;
}

function getComplianceTierFromScore(score: number, automaticHighRisk: boolean): ComplianceTier {
  if (automaticHighRisk) return "High Risk";
  if (score === 100) return "Audit Ready";
  if (score >= 90) return "Strong Compliance";
  if (score >= 80) return "Mostly Compliant";
  if (score >= 70) return "Needs Attention";
  if (score >= 60) return "Moderate Risk";
  return "High Risk";
}

export function getDocumentDeduction(doc: EnrichedDocument): number {
  return getDocumentDeductions(doc).reduce((total, deduction) => total + deduction.points, 0);
}

export function getDocumentDeductions(doc: EnrichedDocument): ComplianceDeduction[] {
  const deductions: ComplianceDeduction[] = [];

  if (doc.status === "Missing") {
    deductions.push({ documentName: doc.name, points: 10, reason: "Missing required document" });
  }
  if (doc.status === "Expired") {
    deductions.push({ documentName: doc.name, points: 15, reason: "Expired document" });
  }
  if (doc.status === "Expiring Soon") {
    deductions.push({ documentName: doc.name, points: 5, reason: "Expiring within 30 days" });
  }
  if (isDriverFileItem(doc.name) && doc.status === "Missing") {
    deductions.push({ documentName: doc.name, points: 10, reason: "Missing driver file item" });
  }
  if (doc.name === "Annual Inspection" && doc.status === "Expired") {
    deductions.push({ documentName: doc.name, points: 10, reason: "Outdated annual inspection" });
  }
  if (doc.name === "Drug & Alcohol Consortium" && doc.status === "Missing") {
    deductions.push({ documentName: doc.name, points: 15, reason: "Missing drug consortium enrollment" });
  }

  return deductions;
}

function hasExpiredInsurance(carrier: Carrier): boolean {
  const insurance = getCarrierDocuments(carrier).find((doc) => doc.name === "Certificate of Insurance");
  return insurance?.status === "Expired";
}

function isDriverFileItem(name: RequiredDocumentName): boolean {
  return ["Driver Qualification File", "MVR", "Medical Card", "CDL"].includes(name);
}

export function isAuditReady(carrier: Carrier): boolean {
  return getCarrierAlerts(carrier).includes("Audit Ready");
}

export function isHighRisk(carrier: Carrier): boolean {
  return getComplianceTier(carrier) === "High Risk";
}

export function getOverviewMetrics(carriers: Carrier[]) {
  const documents = carriers.flatMap(getCarrierDocuments);

  return [
    { label: "Total carriers", value: carriers.length, tone: "neutral" },
    { label: "Active carriers", value: carriers.filter((carrier) => carrier.status === "Active").length, tone: "good" },
    {
      label: "Carriers missing documents",
      value: carriers.filter((carrier) =>
        getCarrierDocuments(carrier).some((doc) => doc.status === "Missing"),
      ).length,
      tone: "warn",
    },
    {
      label: "Documents expiring within 30 days",
      value: documents.filter((doc) => doc.status === "Expiring Soon").length,
      tone: "warn",
    },
    { label: "High-risk carriers", value: carriers.filter(isHighRisk).length, tone: "danger" },
    { label: "Audit-ready carriers", value: carriers.filter(isAuditReady).length, tone: "good" },
  ] as const;
}

export function getComplianceTimeline(carriers: Carrier[], windowDays = 90): ComplianceTimelineEvent[] {
  return carriers
    .flatMap((carrier) =>
      getCarrierDocuments(carrier)
        .filter(
          (doc) =>
            doc.expirationDate !== null &&
            doc.daysUntilExpiration !== null &&
            doc.daysUntilExpiration >= 0 &&
            doc.daysUntilExpiration <= windowDays,
        )
        .map((doc) => ({
          id: `${carrier.id}-${doc.name}`,
          carrierId: carrier.id,
          carrierName: carrier.companyName,
          documentName: doc.name,
          expirationDate: doc.expirationDate as string,
          daysUntilExpiration: doc.daysUntilExpiration as number,
          status: doc.status,
        })),
    )
    .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
}

export function getActionItems(carrier: Carrier): string[] {
  const docs = getCarrierDocuments(carrier);
  const actions = [
    ...docs.filter((doc) => doc.status === "Missing").map((doc) => `Collect ${doc.name}.`),
    ...docs.filter((doc) => doc.status === "Expired").map((doc) => `Replace expired ${doc.name}.`),
    ...docs
      .filter((doc) => doc.status === "Expiring Soon")
      .map((doc) => `Renew ${doc.name} by ${doc.expirationDate}.`),
  ];

  if (carrier.status === "Suspended") {
    actions.push("Management approval required before dispatch.");
  }

  return actions.length ? actions : ["No action items. Carrier is ready for audit review."];
}

export function getScoreSummary(carrier: Carrier): string {
  const tier = getComplianceTier(carrier);
  const blocking = getCarrierDocuments(carrier).filter((doc) =>
    ["Missing", "Expired"].includes(doc.status),
  ).length;

  if (tier === "High Risk" && hasExpiredInsurance(carrier)) {
    return "Insurance is expired, which automatically places this carrier in High Risk.";
  }
  if (isAuditReady(carrier)) return "All required carrier documents are present and valid.";
  if (blocking > 0) return `${blocking} blocking item${blocking === 1 ? "" : "s"} require attention.`;
  return `${tier}. Carrier is usable, with upcoming renewals to monitor.`;
}
