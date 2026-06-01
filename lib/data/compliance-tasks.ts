import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { canAccessComplianceTaskRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";

export type ComplianceTaskStatus = "open" | "in_progress" | "waiting" | "completed";
export type ComplianceTaskPriority = "critical" | "high" | "medium" | "low";

export type ComplianceTask = {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  priority: ComplianceTaskPriority;
  dueDate: string | null;
  status: ComplianceTaskStatus;
  assignedTo: string | null;
  assignedToName: string;
  relatedEntityType: string;
  relatedEntityId: string | null;
  relatedCarrierId: string | null;
  sourceAlertId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type ComplianceTaskRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  priority: ComplianceTaskPriority;
  due_date: string | null;
  status: ComplianceTaskStatus;
  assigned_to: string | null;
  related_entity_type: string;
  related_entity_id: string | null;
  related_carrier_id: string | null;
  source_alert_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export async function getComplianceTasks(): Promise<ComplianceTask[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!supabase || !session) return [];

  let query = supabase
    .from("compliance_tasks")
    .select("id, organization_id, title, description, priority, due_date, status, assigned_to, related_entity_type, related_entity_id, related_carrier_id, source_alert_id, created_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load compliance tasks", error?.message);
    return [];
  }

  const rows = (data as ComplianceTaskRow[]).filter((task) =>
    canAccessComplianceTaskRecord(session, {
      organizationId: task.organization_id,
      relatedCarrierId: task.related_carrier_id,
      assignedTo: task.assigned_to,
    }),
  );
  const assignedUserIds = Array.from(new Set(rows.map((task) => task.assigned_to).filter((value): value is string => Boolean(value))));
  const usersById = await getUsersById(assignedUserIds);

  return rows.map((row) => mapTaskRow(row, usersById));
}

async function getUsersById(userIds: string[]) {
  const supabase = await createClient();
  if (!supabase || !userIds.length) return new Map<string, UserRow>();

  const { data } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", userIds);

  return new Map(((data ?? []) as UserRow[]).map((user) => [user.id, user]));
}

function mapTaskRow(row: ComplianceTaskRow, usersById: Map<string, UserRow>): ComplianceTask {
  const assignedUser = row.assigned_to ? usersById.get(row.assigned_to) : null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description ?? "",
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
    assignedTo: row.assigned_to,
    assignedToName: assignedUser?.full_name || assignedUser?.email || "Unassigned",
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    relatedCarrierId: row.related_carrier_id,
    sourceAlertId: row.source_alert_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
