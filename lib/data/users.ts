import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { canViewOrganizationUsers } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/carrier";
import type { OrganizationUser } from "@/types/user";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
  carrier_id: string | null;
  platform_super_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
  carriers?: { company_name: string | null } | Array<{ company_name: string | null }> | null;
};

export async function getOrganizationUsers(): Promise<OrganizationUser[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!supabase || !session || !canViewOrganizationUsers(session, session.organizationId)) return [];

  let query = supabase
    .from("users")
    .select("id, email, full_name, role, organization_id, carrier_id, platform_super_admin, is_active, created_at, last_login_at, carriers(company_name)")
    .order("created_at", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load organization users", error?.message);
    return [];
  }

  return (data as UserRow[])
    .filter((user) => !user.platform_super_admin || session.platformSuperAdmin)
    .map(mapUserRow);
}

function mapUserRow(row: UserRow): OrganizationUser {
  const carrier = Array.isArray(row.carriers) ? row.carriers[0] : row.carriers;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? "",
    role: row.role,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    carrierName: carrier?.company_name ?? "",
    platformSuperAdmin: row.platform_super_admin,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
  };
}
