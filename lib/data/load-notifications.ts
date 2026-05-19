import { writeAuditLog } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession, NotificationPriority } from "@/types/carrier";
import type { Load, LoadDocumentType } from "@/types/load";

export async function upsertLoadNotification(input: {
  session: AuthSession;
  load: {
    id: string;
    organizationId: string;
    carrierId: string;
    loadNumber: string;
    carrierName?: string;
  };
  kind:
    | "pod_uploaded"
    | "pod_sent"
    | "rate_confirmation_uploaded"
    | "load_archived"
    | "archive_export_completed";
  priority?: NotificationPriority;
  documentType?: LoadDocumentType;
  fileName?: string;
}) {
  const supabase = await createClient();
  if (!supabase) return;

  const notification = buildLoadNotification(input);
  const { data } = await supabase
    .from("notifications")
    .upsert(notification, { onConflict: "organization_id,rule_key" })
    .select("id")
    .maybeSingle();

  await writeAuditLog({
    organizationId: input.load.organizationId,
    actorUserId: input.session.userId,
    action: "notification.synced",
    entityType: "notification",
    entityId: data?.id ?? null,
    metadata: {
      load_id: input.load.id,
      load_number: input.load.loadNumber,
      carrier_id: input.load.carrierId,
      notification_kind: input.kind,
    },
  });
}

export function generateLoadOperationalNotifications(loads: Load[]) {
  return loads.flatMap((load) => {
    const pod = load.documents.some((document) => document.documentType === "pod");
    const rateConfirmation = load.documents.some((document) => document.documentType === "rate_confirmation");
    const notifications = [];

    if (!rateConfirmation) {
      notifications.push(createVirtualNotification(load, {
        title: "Rate confirmation missing",
        message: `Load ${load.loadNumber} is missing a rate confirmation.`,
        priority: "high",
        ruleKey: `load-ratecon-missing:${load.id}`,
      }));
    }

    if (load.status === "delivered" && !pod) {
      notifications.push(createVirtualNotification(load, {
        title: "Delivered load missing POD",
        message: `Load ${load.loadNumber} is delivered but has no POD uploaded.`,
        priority: "critical",
        ruleKey: `load-pod-missing:${load.id}`,
      }));
    }

    if (load.status === "delivered" || load.status === "pod_sent") {
      notifications.push(createVirtualNotification(load, {
        title: "Delivered load not invoiced",
        message: `Load ${load.loadNumber} is delivered but has not been marked invoiced.`,
        priority: "medium",
        ruleKey: `load-not-invoiced:${load.id}`,
      }));
    }

    return notifications;
  });
}

function buildLoadNotification(input: Parameters<typeof upsertLoadNotification>[0]) {
  const archive = input.kind === "load_archived" || input.kind === "archive_export_completed";
  const titles = {
    pod_uploaded: "POD uploaded",
    pod_sent: "POD sent to broker",
    rate_confirmation_uploaded: "Carrier uploaded a load document",
    load_archived: "Load archived",
    archive_export_completed: "Archive export completed",
  };

  return {
    organization_id: input.load.organizationId,
    carrier_id: input.load.carrierId,
    document_name: input.documentType ?? null,
    title: `${titles[input.kind]}: Load ${input.load.loadNumber}`,
    message: `Load ${input.load.loadNumber}${input.fileName ? ` file ${input.fileName}` : ""} requires operational visibility.`,
    category: archive ? "archive_operation" : "load_operation",
    priority: input.priority ?? "medium",
    status: "unread",
    due_date: null,
    rule_key: `${input.kind}:${input.load.id}:${input.fileName ?? "event"}`,
    metadata: {
      load_id: input.load.id,
      load_number: input.load.loadNumber,
      carrier_id: input.load.carrierId,
      carrier_name: input.load.carrierName ?? null,
      document_type: input.documentType ?? null,
      file_name: input.fileName ?? null,
    },
  };
}

function createVirtualNotification(load: Load, input: { title: string; message: string; priority: NotificationPriority; ruleKey: string }) {
  return {
    id: input.ruleKey,
    carrierId: load.carrierId,
    carrierName: load.carrierName,
    documentName: null,
    title: input.title,
    message: input.message,
    category: "load_operation" as const,
    priority: input.priority,
    status: "unread" as const,
    assignedTo: null,
    createdAt: load.updatedAt,
    readAt: null,
    dismissedAt: null,
    dueDate: load.deliveryDate,
    ruleKey: input.ruleKey,
    metadata: {
      load_id: load.id,
      load_number: load.loadNumber,
      carrier_id: load.carrierId,
      carrier_name: load.carrierName,
    },
  };
}
