import { unstable_noStore as noStore } from "next/cache";
import { requirePlatformSuperAdmin, requireStaffAccess } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";

type JsonMetadata = Record<string, unknown>;

export type AuditLog = {
  id: string;
  organizationId: string | null;
  organizationName: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: JsonMetadata;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: JsonMetadata | null;
  created_at: string;
  organizations?: { name: string | null } | Array<{ name: string | null }> | null;
  users?: { email: string | null; full_name: string | null } | Array<{ email: string | null; full_name: string | null }> | null;
};

export async function writeAuditLog(input: {
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: JsonMetadata;
}) {
  const supabase = await createClient();

  if (!supabase || !input.actorUserId) return;

  const { error } = await supabase.from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Unable to write audit log", error.message);
  }
}

export async function getPlatformAuditLogs(limit = 80) {
  noStore();
  await requirePlatformSuperAdmin();
  return getAuditLogs(limit);
}

export async function getPlatformOrganizationAuditLogs(organizationId: string, limit = 50) {
  noStore();
  await requirePlatformSuperAdmin();
  return getAuditLogs(limit, organizationId);
}

export async function getOrganizationAuditLogs(limit = 50) {
  noStore();
  await requireStaffAccess();
  return getAuditLogs(limit);
}

async function getAuditLogs(limit: number, organizationId?: string): Promise<AuditLog[]> {
  const supabase = await createClient();

  if (!supabase) return [];

  let query = supabase
    .from("audit_logs")
    .select("id, organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at, organizations(name), users(email, full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return (data as AuditLogRow[]).map(mapAuditLog);
}

function mapAuditLog(row: AuditLogRow): AuditLog {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  const actor = Array.isArray(row.users) ? row.users[0] : row.users;

  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: organization?.name ?? "Platform",
    actorUserId: row.actor_user_id,
    actorName: actor?.full_name ?? "",
    actorEmail: actor?.email ?? "Unknown user",
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}
