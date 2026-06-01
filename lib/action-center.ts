import { getCarrierDocuments } from "@/lib/compliance";
import type { AuditReadinessDashboardData } from "@/lib/data/audit-readiness";
import type { DQFileRecord } from "@/lib/data/dq-files";
import type { VehicleRecord } from "@/lib/data/vehicles";
import type { Carrier, ComplianceNotification } from "@/types/carrier";
import type { Invoice } from "@/types/invoice";
import type { Load, LoadDocumentType } from "@/types/load";

export type ActionEntityType = "carrier" | "driver" | "vehicle" | "load" | "invoice" | "document" | "alert";
export type ActionPriority = "critical" | "high" | "medium" | "low";
export type ActionStatus = "open" | "blocked" | "ready" | "resolved";
export type ActionCategory = "compliance" | "dq" | "vehicle" | "load" | "billing" | "notification";
export type ActionSource =
  | "audit_readiness"
  | "dq_readiness"
  | "vehicle_readiness"
  | "carrier_documents"
  | "loads"
  | "invoices"
  | "notifications";

export type OperationsActionItem = {
  id: string;
  organizationId: string | null;
  carrierId: string | null;
  entityType: ActionEntityType;
  entityId: string;
  title: string;
  description: string;
  priority: ActionPriority;
  status: ActionStatus;
  category: ActionCategory;
  correctionHref: string;
  dueDate: string | null;
  source: ActionSource;
};

export type ActionCenterInput = {
  carriers: Carrier[];
  auditReadiness: AuditReadinessDashboardData;
  dqFiles: DQFileRecord[];
  vehicles: VehicleRecord[];
  loads: Load[];
  invoices: Invoice[];
  notifications: ComplianceNotification[];
};

export function buildActionCenterItems(input: ActionCenterInput): OperationsActionItem[] {
  return [
    ...auditReadinessActions(input.auditReadiness, input.carriers),
    ...carrierDocumentActions(input.carriers),
    ...dqActions(input.dqFiles),
    ...vehicleActions(input.vehicles),
    ...loadActions(input.loads),
    ...invoiceActions(input.invoices),
    ...notificationActions(input.notifications),
  ].sort(sortActions);
}

export function groupActionItems(items: OperationsActionItem[]) {
  return {
    critical: items.filter((item) => item.priority === "critical"),
    high: items.filter((item) => item.priority === "high"),
    needsAttention: items.filter((item) => item.priority === "medium"),
    upcoming: items.filter((item) => item.priority === "low"),
  };
}

export function documentActionItems(items: OperationsActionItem[]) {
  return items.filter((item) =>
    ["carrier_documents", "dq_readiness", "vehicle_readiness", "loads"].includes(item.source) &&
    item.entityType === "document" &&
    item.status !== "resolved",
  );
}

export function documentSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function auditReadinessActions(data: AuditReadinessDashboardData, carriers: Carrier[]): OperationsActionItem[] {
  const carrierById = new Map(carriers.map((carrier) => [carrier.id, carrier]));

  return data.results.flatMap((result) => {
    const carrier = carrierById.get(result.carrierId);
    if (!carrier) return [];

    return result.criticalBlockers.slice(0, 3).map((blocker, index) => ({
      id: `audit:${result.carrierId}:${index}:${documentSlug(blocker)}`,
      organizationId: carrier.organizationId,
      carrierId: result.carrierId,
      entityType: "carrier" as const,
      entityId: result.carrierId,
      title: `${result.carrierName} audit blocker`,
      description: blocker,
      priority: "critical" as const,
      status: "blocked" as const,
      category: "compliance" as const,
      correctionHref: `/carriers/${result.carrierId}`,
      dueDate: result.nextExpiringDocument?.expirationDate ?? null,
      source: "audit_readiness" as const,
    }));
  });
}

function carrierDocumentActions(carriers: Carrier[]): OperationsActionItem[] {
  return carriers.flatMap((carrier) =>
    getCarrierDocuments(carrier)
      .filter((document) => ["Missing", "Expired", "Expiring Soon"].includes(document.status))
      .map((document) => {
        const slug = documentSlug(document.name);
        const priority = document.status === "Expired" ? "critical" : document.status === "Missing" ? "high" : "low";
        return {
          id: `carrier-document:${carrier.id}:${slug}`,
          organizationId: carrier.organizationId,
          carrierId: carrier.id,
          entityType: "document" as const,
          entityId: carrier.id,
          title: `${document.name} ${document.status.toLowerCase()}`,
          description: `${carrier.companyName} needs ${document.name} corrected.`,
          priority,
          status: document.status === "Expired" ? "blocked" as const : "open" as const,
          category: "compliance" as const,
          correctionHref: `/carriers/${carrier.id}#document-${slug}`,
          dueDate: document.expirationDate,
          source: "carrier_documents" as const,
        };
      }),
  );
}

function dqActions(files: DQFileRecord[]): OperationsActionItem[] {
  return files.flatMap((file) =>
    file.checklist
      .filter((item) => item.missing || item.expired || item.expiringSoon)
      .map((item) => {
        const slug = documentSlug(item.name);
        return {
          id: `dq:${file.id}:${slug}`,
          organizationId: file.organizationId,
          carrierId: file.carrierId,
          entityType: "document" as const,
          entityId: file.id,
          title: `${item.name} ${formatChecklistStatus(item.status)}`,
          description: `${file.driverName || "Unnamed driver"} DQ file needs ${item.name}.`,
          priority: item.expired ? "critical" as const : item.missing ? "high" as const : "low" as const,
          status: item.expired ? "blocked" as const : "open" as const,
          category: "dq" as const,
          correctionHref: `/dq-files/${file.id}?document=${slug}`,
          dueDate: item.expirationDate,
          source: "dq_readiness" as const,
        };
      }),
  );
}

function vehicleActions(vehicles: VehicleRecord[]): OperationsActionItem[] {
  return vehicles.flatMap((vehicle) =>
    vehicle.checklist
      .filter((item) => item.missing || item.expired || item.expiringSoon)
      .map((item) => {
        const slug = documentSlug(item.name);
        const critical = item.expired || vehicle.criticalBlockers.some((blocker) => blocker.includes(item.name));
        return {
          id: `vehicle:${vehicle.id}:${slug}`,
          organizationId: vehicle.organizationId,
          carrierId: vehicle.carrierId,
          entityType: "document" as const,
          entityId: vehicle.id,
          title: `Unit ${vehicle.unitNumber}: ${item.name} ${formatChecklistStatus(item.status)}`,
          description: `${vehicle.carrierName} vehicle record needs correction.`,
          priority: critical ? "critical" as const : item.missing ? "high" as const : "low" as const,
          status: critical ? "blocked" as const : "open" as const,
          category: "vehicle" as const,
          correctionHref: `/vehicles/${vehicle.id}?document=${slug}`,
          dueDate: item.expirationDate,
          source: "vehicle_readiness" as const,
        };
      }),
  );
}

function loadActions(loads: Load[]): OperationsActionItem[] {
  return loads.flatMap((load) => {
    const actions: OperationsActionItem[] = [];
    const hasRateConfirmation = hasLoadDocument(load, "rate_confirmation");
    const hasPod = hasLoadDocument(load, "pod");

    if (!hasRateConfirmation) {
      actions.push(loadDocumentAction(load, "rate_confirmation", "Rate confirmation missing", "high"));
    }

    if (["delivered", "pod_uploaded", "pod_sent", "invoiced"].includes(load.status) && !hasPod) {
      actions.push(loadDocumentAction(load, "pod", "POD missing", load.status === "delivered" ? "critical" : "high"));
    }

    if (load.status === "delivered" && hasPod && !load.podSentAt) {
      actions.push({
        id: `load:${load.id}:pod-send`,
        organizationId: load.organizationId,
        carrierId: load.carrierId,
        entityType: "load",
        entityId: load.id,
        title: `Send POD for load ${load.loadNumber}`,
        description: `${load.brokerName || "Broker"} has not been sent the POD yet.`,
        priority: "high",
        status: "open",
        category: "load",
        correctionHref: `/loads/${load.id}#pod-workflow`,
        dueDate: load.deliveryDate,
        source: "loads",
      });
    }

    return actions;
  });
}

function invoiceActions(invoices: Invoice[]): OperationsActionItem[] {
  return invoices
    .filter((invoice) => !["paid", "void"].includes(invoice.status))
    .map((invoice) => ({
      id: `invoice:${invoice.id}:${invoice.status}`,
      organizationId: invoice.organizationId,
      carrierId: invoice.carrierId,
      entityType: "invoice" as const,
      entityId: invoice.id,
      title: `Invoice ${invoice.invoiceNumber} ${invoice.status}`,
      description: `${invoice.brokerName || "Broker"} owes ${formatMoney(invoice.totalAmount)} for load ${invoice.loadNumber}.`,
      priority: invoice.status === "overdue" ? "critical" as const : invoice.status === "draft" ? "high" as const : "medium" as const,
      status: invoice.status === "overdue" ? "blocked" as const : "open" as const,
      category: "billing" as const,
      correctionHref: `/invoices/${invoice.id}`,
      dueDate: invoice.dueDate,
      source: "invoices" as const,
    }));
}

function notificationActions(notifications: ComplianceNotification[]): OperationsActionItem[] {
  return notifications
    .filter((notification) => notification.status !== "dismissed")
    .map((notification) => ({
      id: `notification:${notification.id}`,
      organizationId: null,
      carrierId: notification.carrierId,
      entityType: "alert" as const,
      entityId: notification.id,
      title: notification.title,
      description: notification.message,
      priority: notification.priority === "critical" ? "critical" as const : notification.priority === "high" ? "high" as const : notification.priority === "medium" ? "medium" as const : "low" as const,
      status: "open" as const,
      category: "notification" as const,
      correctionHref: notificationHref(notification),
      dueDate: notification.dueDate,
      source: "notifications" as const,
    }));
}

function loadDocumentAction(load: Load, documentType: LoadDocumentType, title: string, priority: ActionPriority): OperationsActionItem {
  return {
    id: `load-document:${load.id}:${documentType}`,
    organizationId: load.organizationId,
    carrierId: load.carrierId,
    entityType: "document",
    entityId: load.id,
    title: `${title}: load ${load.loadNumber}`,
    description: `${load.carrierName} needs ${documentType === "pod" ? "a POD" : "a rate confirmation"} uploaded.`,
    priority,
    status: priority === "critical" ? "blocked" : "open",
    category: "load",
    correctionHref: `/loads/${load.id}?document=${documentType}#document-${documentType}`,
    dueDate: documentType === "pod" ? load.deliveryDate : load.pickupDate,
    source: "loads",
  };
}

function hasLoadDocument(load: Load, documentType: LoadDocumentType) {
  return load.documents.some((document) => document.documentType === documentType);
}

function notificationHref(notification: ComplianceNotification) {
  const metadata = notification.metadata ?? {};
  const loadId = typeof metadata.load_id === "string" ? metadata.load_id : typeof metadata.loadId === "string" ? metadata.loadId : null;
  const invoiceId = typeof metadata.invoice_id === "string" ? metadata.invoice_id : typeof metadata.invoiceId === "string" ? metadata.invoiceId : null;

  if (invoiceId) return `/invoices/${invoiceId}`;
  if (loadId) return `/loads/${loadId}`;
  if (notification.carrierId) return `/carriers/${notification.carrierId}`;
  return "/?tab=operations&section=notifications";
}

function sortActions(a: OperationsActionItem, b: OperationsActionItem) {
  return priorityWeight(b.priority) - priorityWeight(a.priority) || dueDateWeight(a.dueDate) - dueDateWeight(b.dueDate) || a.title.localeCompare(b.title);
}

function priorityWeight(priority: ActionPriority) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[priority];
}

function dueDateWeight(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
}

function formatChecklistStatus(value: string) {
  return value.replace(/_/g, " ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
