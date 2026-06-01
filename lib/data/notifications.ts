import { getLoads } from "@/lib/data/loads";
import { getInvoices } from "@/lib/data/invoices";
import { generateInvoiceOperationalNotifications } from "@/lib/data/invoice-notifications";
import { generateLoadOperationalNotifications } from "@/lib/data/load-notifications";
import { generateComplianceReminderNotifications } from "@/lib/data/notification-reminders";
import { getCurrentSession } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";
import type { Carrier, ComplianceNotification, NotificationPriority, NotificationStatus } from "@/types/carrier";

type NotificationRow = {
  id: string;
  carrier_id: string | null;
  user_id: string | null;
  carriers?: { company_name: string | null } | null;
  document_name: string | null;
  type: string | null;
  title: string;
  message: string;
  category: ComplianceNotification["category"];
  priority: NotificationPriority;
  severity: string | null;
  status: NotificationStatus;
  assigned_to: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  related_url: string | null;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  due_date: string | null;
  rule_key: string;
  metadata: Record<string, unknown> | null;
};

export async function getNotifications(carriers: Carrier[]): Promise<ComplianceNotification[]> {
  const generatedReminderNotifications = await generateComplianceReminderNotifications(carriers);
  const loads = await getLoads();
  const invoices = await getInvoices();
  const generatedLoadNotifications = generateLoadOperationalNotifications(loads);
  const generatedInvoiceNotifications = generateInvoiceOperationalNotifications(loads, invoices);
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase) {
    return dedupeNotifications([...generatedInvoiceNotifications, ...generatedLoadNotifications, ...generatedReminderNotifications]);
  }

  let query = supabase
    .from("notifications")
    .select("*, carriers(company_name)")
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(80);

  if (session?.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  if (session?.role === "carrier" && !session.platformSuperAdmin) {
    const filters = [`assigned_to.eq.${session.userId}`, `user_id.eq.${session.userId}`];
    if (session.carrierId) filters.push(`carrier_id.eq.${session.carrierId}`);
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return dedupeNotifications([...generatedInvoiceNotifications, ...generatedLoadNotifications, ...generatedReminderNotifications]);
  }

  return dedupeNotifications([
    ...(data as NotificationRow[]).map((row) => ({
    id: row.id,
    carrierId: row.carrier_id,
    carrierName: row.carriers?.company_name ?? "Carrier",
    userId: row.user_id,
    documentName: row.document_name,
    type: row.type,
    title: row.title,
    message: row.message,
    category: row.category,
    priority: row.priority,
    severity: row.severity,
    status: row.status,
    assignedTo: row.assigned_to,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    relatedUrl: row.related_url,
    createdAt: row.created_at,
    readAt: row.read_at,
    dismissedAt: row.dismissed_at,
    dueDate: row.due_date,
    ruleKey: row.rule_key,
    metadata: row.metadata ?? {},
  })),
    ...generatedInvoiceNotifications,
    ...generatedLoadNotifications,
    ...generatedReminderNotifications,
  ]);
}

function dedupeNotifications(notifications: ComplianceNotification[]) {
  const byRuleKey = new Map<string, ComplianceNotification>();
  for (const notification of notifications) {
    if (!byRuleKey.has(notification.ruleKey)) {
      byRuleKey.set(notification.ruleKey, notification);
    }
  }

  return Array.from(byRuleKey.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
