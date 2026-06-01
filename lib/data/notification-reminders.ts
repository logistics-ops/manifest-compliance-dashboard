import { documentSlug } from "@/lib/action-center";
import { writeAuditLog } from "@/lib/audit";
import { getCarrierDocuments } from "@/lib/compliance";
import { getAuditReadinessDashboardData } from "@/lib/data/audit-readiness";
import type { ComplianceTask } from "@/lib/data/compliance-tasks";
import { getComplianceTasks } from "@/lib/data/compliance-tasks";
import { getDQFiles } from "@/lib/data/dq-files";
import { getVehicles } from "@/lib/data/vehicles";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession, Carrier, ComplianceNotification, NotificationCategory, NotificationPriority } from "@/types/carrier";

export async function generateComplianceReminderNotifications(carriers: Carrier[]): Promise<ComplianceNotification[]> {
  const [dqFiles, vehicles, tasks, auditReadiness] = await Promise.all([
    getDQFiles(),
    getVehicles(),
    getComplianceTasks(),
    getAuditReadinessDashboardData(),
  ]);
  const now = new Date().toISOString();

  return [
    ...carrierDocumentNotifications(carriers, now),
    ...driverDocumentNotifications(dqFiles, now),
    ...vehicleDocumentNotifications(vehicles, now),
    ...overdueTaskNotifications(tasks, now),
    ...criticalReadinessNotifications(auditReadiness.results, now),
  ];
}

export async function syncComplianceReminderNotifications(input: {
  session: AuthSession;
  carriers: Carrier[];
}) {
  const supabase = await createClient();
  if (!supabase) return 0;

  const notifications = await generateComplianceReminderNotifications(input.carriers);
  const organizationId = requireOrganizationId(input.session);
  const payload = notifications
    .filter((notification) => notification.ruleKey)
    .map((notification) => ({
      organization_id: organizationId,
      carrier_id: notification.carrierId,
      user_id: notification.userId ?? null,
      assigned_to: notification.assignedTo,
      document_name: notification.documentName,
      type: notification.type ?? notification.category,
      title: notification.title,
      message: notification.message,
      category: notification.category,
      priority: notification.priority,
      severity: notification.severity ?? notification.priority,
      status: notification.status,
      due_date: notification.dueDate,
      related_entity_type: notification.relatedEntityType ?? null,
      related_entity_id: notification.relatedEntityId ?? null,
      related_url: notification.relatedUrl ?? null,
      rule_key: notification.ruleKey,
      metadata: notification.metadata ?? {},
    }));

  if (!payload.length) return 0;

  await supabase
    .from("notifications")
    .upsert(payload, { onConflict: "organization_id,rule_key", ignoreDuplicates: true });

  await writeAuditLog({
    organizationId,
    actorUserId: input.session.userId,
    action: "notification.synced",
    entityType: "notification",
    entityId: null,
    metadata: { generatedCount: payload.length, source: "compliance_reminders" },
  });

  return payload.length;
}

function carrierDocumentNotifications(carriers: Carrier[], now: string): ComplianceNotification[] {
  return carriers.flatMap((carrier) =>
    getCarrierDocuments(carrier)
      .filter((document) => ["Expired", "Expiring Soon", "Missing"].includes(document.status))
      .map((document) => {
        const expired = document.status === "Expired";
        const missing = document.status === "Missing";
        const priority = expired ? "critical" : missing ? "high" : "medium";
        const category = expired ? (document.name === "Certificate of Insurance" ? "expired_insurance" : "expired_document") : missing ? "missing_document" : "document_expiration";
        const slug = documentSlug(document.name);
        return createNotification({
          id: `carrier-document:${carrier.id}:${slug}:${document.status}`,
          carrierId: carrier.id,
          carrierName: carrier.companyName,
          documentName: document.name,
          title: `${carrier.companyName}: ${document.name} ${document.status.toLowerCase()}`,
          message: missing
            ? `${carrier.companyName} is missing ${document.name}.`
            : `${carrier.companyName} ${document.name} ${expired ? "expired" : `expires in ${document.daysUntilExpiration ?? "a few"} days`}.`,
          category,
          priority,
          dueDate: document.expirationDate,
          relatedEntityType: "carrier_document",
          relatedEntityId: carrier.id,
          relatedUrl: `/carriers/${carrier.id}#document-${slug}`,
          ruleKey: `reminder:carrier-document:${carrier.id}:${slug}:${document.status}`,
          createdAt: now,
        });
      }),
  );
}

function driverDocumentNotifications(dqFiles: Awaited<ReturnType<typeof getDQFiles>>, now: string): ComplianceNotification[] {
  return dqFiles.flatMap((file) =>
    file.checklist
      .filter((item) => !item.notApplicable && (item.expired || item.expiringSoon || item.missing))
      .map((item) => {
        const priority = item.expired ? "critical" : item.missing ? "high" : "medium";
        const slug = documentSlug(item.name);
        return createNotification({
          id: `driver-document:${file.id}:${slug}:${item.status}`,
          carrierId: file.carrierId,
          carrierName: file.carrierName,
          documentName: item.name,
          title: `${file.driverName || "Driver"}: ${item.name}`,
          message: `DQ document is ${item.status.replace(/_/g, " ")}.`,
          category: item.expired ? "expired_document" : item.missing ? "missing_document" : "document_expiration",
          priority,
          dueDate: item.expirationDate,
          relatedEntityType: "driver_document",
          relatedEntityId: file.id,
          relatedUrl: `/dq-files/${file.id}?document=${slug}`,
          ruleKey: `reminder:driver-document:${file.id}:${slug}:${item.status}`,
          createdAt: now,
        });
      }),
  );
}

function vehicleDocumentNotifications(vehicles: Awaited<ReturnType<typeof getVehicles>>, now: string): ComplianceNotification[] {
  return vehicles.flatMap((vehicle) =>
    vehicle.checklist
      .filter((item) => !item.notApplicable && (item.expired || item.expiringSoon || item.missing))
      .map((item) => {
        const priority = item.expired ? "critical" : item.missing ? "high" : "medium";
        const slug = documentSlug(item.name);
        return createNotification({
          id: `vehicle-document:${vehicle.id}:${slug}:${item.status}`,
          carrierId: vehicle.carrierId,
          carrierName: vehicle.carrierName,
          documentName: item.name,
          title: `Unit ${vehicle.unitNumber}: ${item.name}`,
          message: `Vehicle document is ${item.status.replace(/_/g, " ")}.`,
          category: item.expired ? "expired_document" : item.missing ? "missing_document" : "document_expiration",
          priority,
          dueDate: item.expirationDate,
          relatedEntityType: "vehicle_document",
          relatedEntityId: vehicle.id,
          relatedUrl: `/vehicles/${vehicle.id}?document=${slug}`,
          ruleKey: `reminder:vehicle-document:${vehicle.id}:${slug}:${item.status}`,
          createdAt: now,
        });
      }),
  );
}

function overdueTaskNotifications(tasks: ComplianceTask[], now: string): ComplianceNotification[] {
  const today = new Date().toISOString().slice(0, 10);
  return tasks
    .filter((task) => task.status !== "completed" && task.dueDate !== null && task.dueDate < today)
    .map((task) =>
      createNotification({
        id: `compliance-task:${task.id}:overdue`,
        carrierId: task.relatedCarrierId,
        carrierName: "Compliance Task",
        userId: task.assignedTo,
        documentName: null,
        title: `Overdue task: ${task.title}`,
        message: task.description || "Compliance task is overdue.",
        category: "user_operation",
        priority: task.priority === "low" ? "medium" : task.priority,
        dueDate: task.dueDate,
        relatedEntityType: "compliance_task",
        relatedEntityId: task.id,
        relatedUrl: "/compliance-tasks",
        ruleKey: `reminder:compliance-task-overdue:${task.id}`,
        createdAt: now,
      }),
    );
}

function criticalReadinessNotifications(
  results: Awaited<ReturnType<typeof getAuditReadinessDashboardData>>["results"],
  now: string,
): ComplianceNotification[] {
  return results
    .filter((result) => result.criticalBlockers.length)
    .map((result) =>
      createNotification({
        id: `critical-alert:${result.carrierId}`,
        carrierId: result.carrierId,
        carrierName: result.carrierName,
        documentName: null,
        title: `${result.carrierName}: critical compliance blocker`,
        message: result.criticalBlockers[0] ?? "Critical compliance issue requires review.",
        category: "high_risk_carrier",
        priority: "critical",
        dueDate: result.nextExpiringDocument?.expirationDate ?? null,
        relatedEntityType: "compliance_alert",
        relatedEntityId: result.carrierId,
        relatedUrl: "/compliance-alerts?filter=critical",
        ruleKey: `reminder:critical-compliance:${result.carrierId}`,
        createdAt: now,
      }),
    );
}

function createNotification(input: {
  id: string;
  carrierId: string | null;
  carrierName: string;
  userId?: string | null;
  documentName: string | null;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  dueDate: string | null;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedUrl: string;
  ruleKey: string;
  createdAt: string;
}): ComplianceNotification {
  return {
    id: input.id,
    carrierId: input.carrierId,
    carrierName: input.carrierName,
    userId: input.userId ?? null,
    documentName: input.documentName,
    type: input.relatedEntityType,
    title: input.title,
    message: input.message,
    category: input.category,
    priority: input.priority,
    severity: input.priority,
    status: "unread",
    assignedTo: input.userId ?? null,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedUrl: input.relatedUrl,
    createdAt: input.createdAt,
    readAt: null,
    dismissedAt: null,
    dueDate: input.dueDate,
    ruleKey: input.ruleKey,
    metadata: {
      related_entity_type: input.relatedEntityType,
      related_entity_id: input.relatedEntityId,
      related_url: input.relatedUrl,
    },
  };
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) {
    throw new Error("An organization is required before syncing notifications.");
  }

  return session.organizationId;
}
