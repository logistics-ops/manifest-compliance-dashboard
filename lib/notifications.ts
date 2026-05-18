import {
  getCarrierDocuments,
  getComplianceScore,
  getComplianceTier,
  isHighRisk,
} from "@/lib/compliance";
import type {
  Carrier,
  ComplianceNotification,
  NotificationCategory,
  NotificationPriority,
} from "@/types/carrier";

const nowIso = new Date("2026-05-18T12:00:00").toISOString();

export function generateComplianceNotifications(carriers: Carrier[]): ComplianceNotification[] {
  return carriers.flatMap((carrier) => {
    const documentAlerts = getCarrierDocuments(carrier).flatMap((document) => {
      if (document.status === "Missing") {
        return [
          createNotification({
            carrier,
            documentName: document.name,
            category: "missing_document",
            priority: "high",
            title: `${document.name} missing`,
            message: `${carrier.companyName} is missing the required ${document.name} document.`,
            dueDate: null,
            ruleKey: `missing:${carrier.id}:${document.name}`,
          }),
        ];
      }

      if (document.status === "Expired") {
        const isInsurance = document.name === "Certificate of Insurance";

        return [
          createNotification({
            carrier,
            documentName: document.name,
            category: isInsurance ? "expired_insurance" : "expired_document",
            priority: "critical",
            title: isInsurance ? "Expired insurance critical alert" : `${document.name} expired`,
            message: isInsurance
              ? `${carrier.companyName} has expired insurance and should remain blocked until a valid certificate is uploaded.`
              : `${carrier.companyName} has an expired ${document.name}.`,
            dueDate: document.expirationDate,
            ruleKey: `${isInsurance ? "expired-insurance" : "expired"}:${carrier.id}:${document.name}`,
          }),
        ];
      }

      const threshold = getExpirationThreshold(document.daysUntilExpiration);

      if (!threshold) {
        return [];
      }

      return [
        createNotification({
          carrier,
          documentName: document.name,
          category: "document_expiration",
          priority: threshold.priority,
          title: `${threshold.days}-day expiration warning`,
          message: `${document.name} for ${carrier.companyName} expires in ${document.daysUntilExpiration} day${document.daysUntilExpiration === 1 ? "" : "s"}.`,
          dueDate: document.expirationDate,
          ruleKey: `expiration-${threshold.days}:${carrier.id}:${document.name}`,
        }),
      ];
    });

    const riskAlerts = isHighRisk(carrier)
      ? [
          createNotification({
            carrier,
            documentName: null,
            category: "high_risk_carrier",
            priority: "critical",
            title: "High-risk carrier alert",
            message: `${carrier.companyName} is ${getComplianceTier(carrier)} with a compliance score of ${getComplianceScore(carrier)}.`,
            dueDate: null,
            ruleKey: `high-risk:${carrier.id}`,
          }),
        ]
      : [];

    return [...documentAlerts, ...riskAlerts];
  });
}

export function getNotificationStats(notifications: ComplianceNotification[]) {
  return {
    total: notifications.length,
    unread: notifications.filter((notification) => notification.status === "unread").length,
    critical: notifications.filter((notification) => notification.priority === "critical").length,
    assigned: notifications.filter((notification) => notification.assignedTo).length,
  };
}

export function getPriorityClass(priority: NotificationPriority) {
  if (priority === "critical") return "text-manifest-danger border-manifest-danger/45 bg-manifest-danger/10";
  if (priority === "high") return "text-manifest-orange border-manifest-orange/45 bg-manifest-orange/10";
  if (priority === "medium") return "text-manifest-amber border-manifest-amber/45 bg-manifest-amber/10";
  return "text-manifest-green border-manifest-green/35 bg-manifest-green/10";
}

function createNotification(input: {
  carrier: Carrier;
  documentName: string | null;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  dueDate: string | null;
  ruleKey: string;
}): ComplianceNotification {
  return {
    id: input.ruleKey,
    carrierId: input.carrier.id,
    carrierName: input.carrier.companyName,
    documentName: input.documentName,
    title: input.title,
    message: input.message,
    category: input.category,
    priority: input.priority,
    status: "unread",
    assignedTo: null,
    createdAt: nowIso,
    readAt: null,
    dismissedAt: null,
    dueDate: input.dueDate,
    ruleKey: input.ruleKey,
  };
}

function getExpirationThreshold(daysUntilExpiration: number | null) {
  if (daysUntilExpiration === null || daysUntilExpiration < 0) return null;
  if (daysUntilExpiration <= 7) return { days: 7, priority: "critical" as const };
  if (daysUntilExpiration <= 14) return { days: 14, priority: "high" as const };
  if (daysUntilExpiration <= 30) return { days: 30, priority: "medium" as const };
  return null;
}
