import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { canAccessLoadTimeline } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { Load } from "@/types/load";

type AuditMetadata = Record<string, unknown>;

type LoadActivityRow = {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  metadata: AuditMetadata | null;
  created_at: string;
  users?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
};

export type LoadActivityItem = {
  id: string;
  action: string;
  title: string;
  timestamp: string;
  actor: string;
  metadata: AuditMetadata;
};

export async function getLoadActivityTimeline(load: Load): Promise<LoadActivityItem[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session || !canAccessLoadTimeline(session, { organizationId: load.organizationId, carrierId: load.carrierId })) {
    return [];
  }

  let query = supabase
    .from("audit_logs")
    .select("id, organization_id, actor_user_id, action, metadata, created_at, users(full_name, email)")
    .eq("entity_type", "load")
    .eq("entity_id", load.id)
    .order("created_at", { ascending: true });

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as LoadActivityRow[])
    .filter((row) => canAccessLoadTimeline(session, { organizationId: row.organization_id, carrierId: String(row.metadata?.carrier_id ?? row.metadata?.carrierId ?? load.carrierId) }))
    .map((row) => {
      const actor = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        id: row.id,
        action: row.action,
        title: getTimelineTitle(row.action),
        timestamp: row.created_at,
        actor: actor?.full_name || actor?.email || "System",
        metadata: row.metadata ?? {},
      };
    });
}

export async function getRecentLoadActivity(limit = 6): Promise<LoadActivityItem[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session) return [];

  let query = supabase
    .from("audit_logs")
    .select("id, organization_id, actor_user_id, action, metadata, created_at, users(full_name, email)")
    .eq("entity_type", "load")
    .like("action", "load.%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as LoadActivityRow[])
    .filter((row) => canAccessLoadTimeline(session, { organizationId: row.organization_id, carrierId: String(row.metadata?.carrier_id ?? row.metadata?.carrierId ?? "") }))
    .map((row) => {
      const actor = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        id: row.id,
        action: row.action,
        title: getTimelineTitle(row.action),
        timestamp: row.created_at,
        actor: actor?.full_name || actor?.email || "System",
        metadata: row.metadata ?? {},
      };
    });
}

function getTimelineTitle(action: string) {
  const titles: Record<string, string> = {
    "load.created": "Load created",
    "load.updated": "Load details updated",
    "load.status_changed": "Status changed",
    "load.rate_confirmation_uploaded": "Rate confirmation uploaded",
    "load.pod_uploaded": "POD uploaded",
    "load.pod_sent": "POD sent to broker",
    "load.archive_status_changed": "Load archived",
    "load.archive_downloaded": "Archive downloaded",
    "load.archive_files_deleted": "Archived files deleted",
    "invoice.generated": "Invoice generated",
    "invoice.sent": "Invoice sent",
    "invoice.resent": "Invoice resent",
    "invoice.paid": "Invoice marked paid",
    "invoice.voided": "Invoice voided",
    "invoice.downloaded": "Invoice downloaded",
  };

  return titles[action] ?? action.replace("load.", "").replace(/_/g, " ");
}
