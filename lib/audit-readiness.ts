import type { Carrier } from "../types/carrier";

export type AuditReadinessBand = "Audit Ready" | "Strong" | "Needs Review" | "High Risk" | "Audit Blocked";

export type AuditDocumentInput = {
  name: string;
  uploaded: boolean;
  status: string;
  expirationDate: string | null;
  scope: "carrier" | "driver" | "equipment";
  ownerName?: string;
};

export type AuditAlertInput = {
  title: string;
  severity: string;
  status: string;
};

export type AuditReadinessDeduction = {
  category: "carrierDocuments" | "driverDocuments" | "equipmentDocuments" | "complianceAlerts" | "criticalBlocker";
  label: string;
  points: number;
  severity: "low" | "medium" | "high" | "critical";
};

export type AuditReadinessBreakdown = {
  carrierDocuments: number;
  driverDocuments: number;
  equipmentDocuments: number;
  complianceAlerts: number;
  criticalBlocker: number;
};

export type AuditReadinessResult = {
  carrierId: string;
  carrierName: string;
  score: number;
  band: AuditReadinessBand;
  criticalBlockers: string[];
  deductions: AuditReadinessDeduction[];
  nextExpiringDocument: {
    name: string;
    scope: AuditDocumentInput["scope"];
    ownerName: string;
    expirationDate: string;
    daysUntilExpiration: number;
  } | null;
  categoryBreakdown: AuditReadinessBreakdown;
};

export type AuditReadinessInput = {
  carrier: Carrier;
  driverDocuments?: AuditDocumentInput[];
  equipmentDocuments?: AuditDocumentInput[];
  complianceAlerts?: AuditAlertInput[];
};

const CATEGORY_LIMITS: AuditReadinessBreakdown = {
  carrierDocuments: 35,
  driverDocuments: 25,
  equipmentDocuments: 20,
  complianceAlerts: 15,
  criticalBlocker: 5,
};

const CRITICAL_CARRIER_DOCUMENTS = new Set([
  "certificate of insurance",
  "operating authority",
  "drug & alcohol consortium",
]);

const CRITICAL_DRIVER_DOCUMENTS = new Set([
  "cdl",
  "medical card",
  "medical examiner certificate",
  "driver qualification file",
]);

const CRITICAL_EQUIPMENT_DOCUMENTS = new Set([
  "annual inspection",
  "vehicle registration",
]);

export function calculateCarrierAuditReadiness(input: AuditReadinessInput): AuditReadinessResult {
  const carrierDocuments = Object.entries(input.carrier.documents).map(([name, document]) => ({
    name,
    uploaded: document.uploaded,
    status: documentStatus(document.uploaded, document.expirationDate),
    expirationDate: document.expirationDate,
    scope: "carrier" as const,
  }));
  const driverDocuments = input.driverDocuments ?? [];
  const equipmentDocuments = input.equipmentDocuments ?? [];
  const complianceAlerts = input.complianceAlerts ?? [];

  const carrierDeductions = documentDeductions(carrierDocuments, "carrierDocuments");
  const driverDeductions = documentDeductions(driverDocuments, "driverDocuments");
  const equipmentDeductions = documentDeductions(equipmentDocuments, "equipmentDocuments");
  const alertDeductions = complianceAlertDeductions(complianceAlerts);
  const criticalBlockers = findCriticalBlockers(carrierDocuments, driverDocuments, equipmentDocuments, input.carrier.status);
  const criticalDeductions: AuditReadinessDeduction[] = criticalBlockers.length
    ? [{
      category: "criticalBlocker",
      label: "Critical audit blocker present",
      points: CATEGORY_LIMITS.criticalBlocker,
      severity: "critical",
    }]
    : [];

  const categoryBreakdown = {
    carrierDocuments: cappedPoints(carrierDeductions, CATEGORY_LIMITS.carrierDocuments),
    driverDocuments: cappedPoints(driverDeductions, CATEGORY_LIMITS.driverDocuments),
    equipmentDocuments: cappedPoints(equipmentDeductions, CATEGORY_LIMITS.equipmentDocuments),
    complianceAlerts: cappedPoints(alertDeductions, CATEGORY_LIMITS.complianceAlerts),
    criticalBlocker: cappedPoints(criticalDeductions, CATEGORY_LIMITS.criticalBlocker),
  };
  const totalDeductions = Object.values(categoryBreakdown).reduce((total, value) => total + value, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeductions));

  return {
    carrierId: input.carrier.id,
    carrierName: input.carrier.companyName,
    score,
    band: readinessBand(score),
    criticalBlockers,
    deductions: [
      ...carrierDeductions,
      ...driverDeductions,
      ...equipmentDeductions,
      ...alertDeductions,
      ...criticalDeductions,
    ],
    nextExpiringDocument: nextExpiringDocument([...carrierDocuments, ...driverDocuments, ...equipmentDocuments]),
    categoryBreakdown,
  };
}

export function readinessBand(score: number): AuditReadinessBand {
  if (score >= 90) return "Audit Ready";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Needs Review";
  if (score >= 50) return "High Risk";
  return "Audit Blocked";
}

function documentDeductions(
  documents: AuditDocumentInput[],
  category: "carrierDocuments" | "driverDocuments" | "equipmentDocuments",
): AuditReadinessDeduction[] {
  return documents.flatMap((document) => {
    const deductions: AuditReadinessDeduction[] = [];
    const label = document.ownerName ? `${document.ownerName}: ${document.name}` : document.name;

    if (!document.uploaded || document.status === "missing") {
      deductions.push({ category, label: `${label} missing`, points: missingPoints(category, document.name), severity: "high" });
    }
    if (document.status === "expired" || isExpired(document.expirationDate)) {
      deductions.push({ category, label: `${label} expired`, points: expiredPoints(category, document.name), severity: "critical" });
    }
    if (document.status === "expiring_soon" || isExpiringSoon(document.expirationDate)) {
      deductions.push({ category, label: `${label} expiring soon`, points: expiringPoints(category), severity: "medium" });
    }

    return deductions;
  });
}

function complianceAlertDeductions(alerts: AuditAlertInput[]): AuditReadinessDeduction[] {
  return alerts
    .filter((alert) => alert.status !== "resolved")
    .map((alert) => {
      const basePoints = alertPoints(alert.severity);
      const acknowledgedMultiplier = alert.status === "acknowledged" ? 0.5 : 1;
      const points = Math.ceil(basePoints * acknowledgedMultiplier);

      return {
        category: "complianceAlerts" as const,
        label: alert.title,
        points,
        severity: normalizeSeverity(alert.severity),
      };
    });
}

function findCriticalBlockers(
  carrierDocuments: AuditDocumentInput[],
  driverDocuments: AuditDocumentInput[],
  equipmentDocuments: AuditDocumentInput[],
  carrierStatus: string,
) {
  const blockers = [
    ...criticalDocumentBlockers(carrierDocuments, CRITICAL_CARRIER_DOCUMENTS),
    ...criticalDocumentBlockers(driverDocuments, CRITICAL_DRIVER_DOCUMENTS),
    ...criticalDocumentBlockers(equipmentDocuments, CRITICAL_EQUIPMENT_DOCUMENTS),
  ];

  if (carrierStatus === "Suspended") {
    blockers.push("Carrier is suspended");
  }

  return blockers;
}

function criticalDocumentBlockers(documents: AuditDocumentInput[], criticalNames: Set<string>) {
  return documents
    .filter((document) =>
      criticalNames.has(normalizeName(document.name)) &&
      (!document.uploaded || document.status === "missing" || document.status === "expired" || isExpired(document.expirationDate))
    )
    .map((document) => document.ownerName ? `${document.ownerName}: ${document.name}` : document.name);
}

function nextExpiringDocument(documents: AuditDocumentInput[]): AuditReadinessResult["nextExpiringDocument"] {
  const upcoming = documents
    .map((document) => {
      const days = daysUntilExpiration(document.expirationDate);
      return document.expirationDate && days !== null && days >= 0
        ? {
          name: document.name,
          scope: document.scope,
          ownerName: document.ownerName ?? "Carrier",
          expirationDate: document.expirationDate,
          daysUntilExpiration: days,
        }
        : null;
    })
    .filter((document): document is NonNullable<typeof document> => Boolean(document))
    .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

  return upcoming[0] ?? null;
}

function cappedPoints(deductions: AuditReadinessDeduction[], limit: number) {
  return Math.min(limit, deductions.reduce((total, deduction) => total + deduction.points, 0));
}

function missingPoints(category: AuditReadinessDeduction["category"], documentName: string) {
  if (category === "carrierDocuments") return CRITICAL_CARRIER_DOCUMENTS.has(normalizeName(documentName)) ? 8 : 4;
  if (category === "driverDocuments") return CRITICAL_DRIVER_DOCUMENTS.has(normalizeName(documentName)) ? 8 : 4;
  if (category === "equipmentDocuments") return CRITICAL_EQUIPMENT_DOCUMENTS.has(normalizeName(documentName)) ? 8 : 4;
  return 0;
}

function expiredPoints(category: AuditReadinessDeduction["category"], documentName: string) {
  if (category === "carrierDocuments") return CRITICAL_CARRIER_DOCUMENTS.has(normalizeName(documentName)) ? 10 : 6;
  if (category === "driverDocuments") return CRITICAL_DRIVER_DOCUMENTS.has(normalizeName(documentName)) ? 10 : 6;
  if (category === "equipmentDocuments") return CRITICAL_EQUIPMENT_DOCUMENTS.has(normalizeName(documentName)) ? 10 : 8;
  return 0;
}

function expiringPoints(category: AuditReadinessDeduction["category"]) {
  if (category === "carrierDocuments") return 3;
  if (category === "driverDocuments") return 2;
  if (category === "equipmentDocuments") return 2;
  return 0;
}

function alertPoints(severity: string) {
  if (severity === "critical") return 8;
  if (severity === "high") return 5;
  if (severity === "low") return 1;
  return 3;
}

function normalizeSeverity(severity: string): AuditReadinessDeduction["severity"] {
  if (severity === "critical" || severity === "high" || severity === "low") return severity;
  return "medium";
}

function isExpired(expirationDate: string | null) {
  const days = daysUntilExpiration(expirationDate);
  return days !== null && days < 0;
}

function isExpiringSoon(expirationDate: string | null) {
  const days = daysUntilExpiration(expirationDate);
  return days !== null && days >= 0 && days <= 30;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function daysUntilExpiration(dateString: string | null): number | null {
  if (!dateString) return null;
  const expiration = new Date(`${dateString}T12:00:00`);
  const today = new Date("2026-05-18T12:00:00");
  return Math.ceil((expiration.getTime() - today.getTime()) / 86400000);
}

function documentStatus(uploaded: boolean, expirationDate: string | null) {
  if (!uploaded) return "missing";
  const days = daysUntilExpiration(expirationDate);
  if (days === null) return "valid";
  if (days < 0) return "expired";
  if (days <= 30) return "expiring_soon";
  return "valid";
}
