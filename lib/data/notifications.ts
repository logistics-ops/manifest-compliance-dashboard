import { generateComplianceNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import type { Carrier, ComplianceNotification, NotificationPriority, NotificationStatus } from "@/types/carrier";

type NotificationRow = {
  id: string;
  carrier_id: string | null;
  carriers?: { company_name: string | null } | null;
  document_name: string | null;
  title: string;
  message: string;
  category: ComplianceNotification["category"];
  priority: NotificationPriority;
  status: NotificationStatus;
  assigned_to: string | null;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  due_date: string | null;
  rule_key: string;
};

export async function getNotifications(carriers: Carrier[]): Promise<ComplianceNotification[]> {
  const generated = generateComplianceNotifications(carriers);
  const supabase = await createClient();

  if (!supabase) {
    return generated;
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*, carriers(company_name)")
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data?.length) {
    return generated;
  }

  return (data as NotificationRow[]).map((row) => ({
    id: row.id,
    carrierId: row.carrier_id,
    carrierName: row.carriers?.company_name ?? "Carrier",
    documentName: row.document_name,
    title: row.title,
    message: row.message,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    readAt: row.read_at,
    dismissedAt: row.dismissed_at,
    dueDate: row.due_date,
    ruleKey: row.rule_key,
  }));
}
