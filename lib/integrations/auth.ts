import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AuthSession, UserRole } from "@/types/carrier";
export {
  canAccessDashboard,
  canManageCarriers,
  canManageCompliance,
  canViewCarrier,
} from "@/lib/auth/permissions";
import { canAccessDashboard } from "@/lib/auth/permissions";

export async function getCurrentSession(): Promise<AuthSession | null> {
  if (!isSupabaseConfigured()) {
    return {
      userId: "demo-admin",
      email: "demo@manifestgloballogistics.com",
      fullName: "Demo Admin",
      role: "admin",
      organizationId: "demo-organization",
      organizationName: "Manifest Global Logistics",
      organizationSlug: "manifest",
      platformSuperAdmin: true,
      carrierId: null,
    };
  }

  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("users")
    .select("id, email, full_name, role, organization_id, platform_super_admin, carrier_id, organizations(name, slug)")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    return {
      userId: user.id,
      email: user.email ?? "",
      fullName: user.user_metadata?.full_name ?? "",
      role: "carrier",
      organizationId: null,
      organizationName: "Manifest Global Logistics",
      organizationSlug: "manifest",
      platformSuperAdmin: false,
      carrierId: null,
    };
  }
  const organization = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;

  return {
    userId: data.id,
    email: data.email,
    fullName: data.full_name ?? "",
    role: normalizeRole(data.role),
    organizationId: data.organization_id ?? null,
    organizationName: organization?.name ?? "Manifest Global Logistics",
    organizationSlug: organization?.slug ?? "manifest",
    platformSuperAdmin: Boolean(data.platform_super_admin),
    carrierId: data.carrier_id ?? null,
  };
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireSession();

  if (session.role !== "admin" && !session.platformSuperAdmin) {
    redirect("/");
  }

  return session;
}

export async function requireStaffAccess() {
  const session = await requireSession();

  if (!canAccessDashboard(session)) {
    redirect(session.carrierId ? `/carriers/${session.carrierId}` : "/unauthorized");
  }

  return session;
}

export async function requirePlatformSuperAdmin() {
  const session = await requireSession();

  if (!session.platformSuperAdmin) {
    redirect("/");
  }

  return session;
}

function normalizeRole(role: string | null): UserRole {
  if (role === "admin" || role === "staff" || role === "carrier") {
    return role;
  }

  return "carrier";
}
