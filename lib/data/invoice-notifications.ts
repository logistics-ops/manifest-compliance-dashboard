import { writeAuditLog } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession, NotificationPriority } from "@/types/carrier";
import type { Invoice } from "@/types/invoice";
import type { Load } from "@/types/load";

export async function upsertInvoiceNotification(input: {
  session: AuthSession;
  invoice: Pick<Invoice, "id" | "organizationId" | "carrierId" | "loadId" | "invoiceNumber" | "loadNumber" | "carrierName">;
  kind: "invoice_generated" | "invoice_sent" | "invoice_paid" | "invoice_overdue";
  priority?: NotificationPriority;
}) {
  const supabase = await createClient();
  if (!supabase) return;

  const labels = {
    invoice_generated: "Invoice generated",
    invoice_sent: "Invoice sent",
    invoice_paid: "Invoice paid",
    invoice_overdue: "Invoice overdue",
  };
  const payload = {
    organization_id: input.invoice.organizationId,
    carrier_id: input.invoice.carrierId,
    document_name: "Invoice",
    title: `${labels[input.kind]}: ${input.invoice.invoiceNumber}`,
    message: `Invoice ${input.invoice.invoiceNumber} for load ${input.invoice.loadNumber} is ${labels[input.kind].toLowerCase()}.`,
    category: "invoice_operation",
    priority: input.priority ?? "medium",
    status: "unread",
    due_date: null,
    rule_key: `${input.kind}:${input.invoice.id}`,
    metadata: {
      invoice_id: input.invoice.id,
      invoice_number: input.invoice.invoiceNumber,
      load_id: input.invoice.loadId,
      load_number: input.invoice.loadNumber,
      carrier_id: input.invoice.carrierId,
      carrier_name: input.invoice.carrierName,
    },
  };

  const { data } = await supabase.from("notifications").upsert(payload, { onConflict: "organization_id,rule_key" }).select("id").maybeSingle();
  await writeAuditLog({
    organizationId: input.invoice.organizationId,
    actorUserId: input.session.userId,
    action: "notification.synced",
    entityType: "notification",
    entityId: data?.id ?? null,
    metadata: payload.metadata,
  });
}

export function generateInvoiceOperationalNotifications(loads: Load[], invoices: Invoice[]) {
  const invoiceLoadIds = new Set(invoices.filter((invoice) => invoice.status !== "void").map((invoice) => invoice.loadId));
  const loadNotifications = loads
    .filter((load) => ["delivered", "pod_uploaded", "pod_sent"].includes(load.status) && !invoiceLoadIds.has(load.id))
    .map((load) => ({
      id: `invoice-missing:${load.id}`,
      carrierId: load.carrierId,
      carrierName: load.carrierName,
      documentName: null,
      title: "Load delivered but invoice not generated",
      message: `Load ${load.loadNumber} is ready for billing but has no invoice.`,
      category: "invoice_operation" as const,
      priority: "high" as const,
      status: "unread" as const,
      assignedTo: null,
      createdAt: load.updatedAt,
      readAt: null,
      dismissedAt: null,
      dueDate: load.deliveryDate,
      ruleKey: `invoice-missing:${load.id}`,
      metadata: { load_id: load.id, load_number: load.loadNumber, carrier_id: load.carrierId },
    }));
  const overdueNotifications = invoices
    .filter((invoice) => invoice.status === "overdue")
    .map((invoice) => ({
      id: `invoice-overdue:${invoice.id}`,
      carrierId: invoice.carrierId,
      carrierName: invoice.carrierName,
      documentName: "Invoice",
      title: "Invoice overdue",
      message: `Invoice ${invoice.invoiceNumber} for load ${invoice.loadNumber} is overdue.`,
      category: "invoice_operation" as const,
      priority: "critical" as const,
      status: "unread" as const,
      assignedTo: null,
      createdAt: invoice.updatedAt,
      readAt: null,
      dismissedAt: null,
      dueDate: invoice.dueDate,
      ruleKey: `invoice-overdue:${invoice.id}`,
      metadata: { invoice_id: invoice.id, load_id: invoice.loadId, carrier_id: invoice.carrierId },
    }));

  return [...loadNotifications, ...overdueNotifications];
}
