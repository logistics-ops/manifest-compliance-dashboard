import { unstable_noStore as noStore } from "next/cache";
import { getCarrierDocuments, getComplianceScore, isHighRisk } from "@/lib/compliance";
import { getCarriersForOrganization } from "@/lib/data/carriers";
import { requirePlatformSuperAdmin } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";

export type PlatformOrganization = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  isActive: boolean;
  createdAt: string;
  carrierCount: number;
  userCount: number;
  documentCount: number;
  notificationCount: number;
  storageBytes: number;
};

export type PlatformUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string | null;
  organizationName: string;
  carrierId: string | null;
  platformSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  is_active: boolean;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  carrier_id: string | null;
  platform_super_admin: boolean;
  is_active: boolean;
  created_at: string;
  organizations?: { name: string | null } | Array<{ name: string | null }> | null;
};

export async function getPlatformDashboardData() {
  noStore();
  await requirePlatformSuperAdmin();
  const supabase = await createClient();

  if (!supabase) {
    return {
      organizations: [] as PlatformOrganization[],
      users: [] as PlatformUser[],
      metrics: emptyMetrics(),
    };
  }

  const [
    organizationsResult,
    usersResult,
    carriersResult,
    documentsResult,
    notificationsResult,
  ] = await Promise.all([
    supabase.from("organizations").select("*").order("created_at", { ascending: false }),
    supabase
      .from("users")
      .select("id, email, full_name, role, organization_id, carrier_id, platform_super_admin, is_active, created_at, organizations(name)")
      .order("created_at", { ascending: false }),
    supabase.from("carriers").select("id, organization_id, status"),
    supabase.from("carrier_documents").select("id, organization_id, uploaded, file_size"),
    supabase.from("notifications").select("id, organization_id, status"),
  ]);

  const carrierRows = carriersResult.data ?? [];
  const documentRows = documentsResult.data ?? [];
  const notificationRows = notificationsResult.data ?? [];
  const userRows = (usersResult.data ?? []) as UserRow[];

  const organizations = ((organizationsResult.data ?? []) as OrganizationRow[]).map((organization) => {
    const orgCarriers = carrierRows.filter((carrier) => carrier.organization_id === organization.id);
    const orgDocuments = documentRows.filter((document) => document.organization_id === organization.id);
    const orgNotifications = notificationRows.filter((notification) => notification.organization_id === organization.id);
    const orgUsers = userRows.filter((user) => user.organization_id === organization.id);

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      subdomain: organization.subdomain,
      logoUrl: organization.logo_url,
      primaryColor: organization.primary_color,
      secondaryColor: organization.secondary_color,
      accentColor: organization.accent_color,
      isActive: organization.is_active,
      createdAt: organization.created_at,
      carrierCount: orgCarriers.length,
      userCount: orgUsers.length,
      documentCount: orgDocuments.length,
      notificationCount: orgNotifications.length,
      storageBytes: orgDocuments.reduce((total, document) => total + Number(document.file_size ?? 0), 0),
    };
  });

  const users = userRows.map((user) => {
    const organization = Array.isArray(user.organizations) ? user.organizations[0] : user.organizations;

    return {
    id: user.id,
    email: user.email,
    fullName: user.full_name ?? "",
    role: user.role,
    organizationId: user.organization_id,
    organizationName: organization?.name ?? "Platform",
    carrierId: user.carrier_id,
    platformSuperAdmin: user.platform_super_admin,
    isActive: user.is_active,
    createdAt: user.created_at,
    };
  });

  return {
    organizations,
    users,
    metrics: {
      totalOrganizations: organizations.length,
      activeOrganizations: organizations.filter((organization) => organization.isActive).length,
      suspendedOrganizations: organizations.filter((organization) => !organization.isActive).length,
      totalUsers: users.length,
      totalCarriers: carrierRows.length,
      totalDocuments: documentRows.length,
      totalNotifications: notificationRows.length,
      totalStorageBytes: documentRows.reduce((total, document) => total + Number(document.file_size ?? 0), 0),
    },
  };
}

export async function getPlatformOrganizationDashboard(organizationId: string) {
  noStore();
  await requirePlatformSuperAdmin();
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  if (!organization) {
    return null;
  }

  const carriers = await getCarriersForOrganization(organizationId);
  const documents = carriers.flatMap(getCarrierDocuments);
  const averageScore = carriers.length
    ? Math.round(carriers.reduce((total, carrier) => total + getComplianceScore(carrier), 0) / carriers.length)
    : 0;

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      subdomain: organization.subdomain,
      logoUrl: organization.logo_url,
      primaryColor: organization.primary_color,
      secondaryColor: organization.secondary_color,
      accentColor: organization.accent_color,
      isActive: organization.is_active,
      createdAt: organization.created_at,
    } as PlatformOrganization,
    carriers,
    metrics: {
      totalCarriers: carriers.length,
      activeCarriers: carriers.filter((carrier) => carrier.status === "Active").length,
      highRiskCarriers: carriers.filter(isHighRisk).length,
      uploadedDocuments: documents.filter((document) => document.uploaded).length,
      missingDocuments: documents.filter((document) => !document.uploaded).length,
      averageScore,
    },
  };
}

function emptyMetrics() {
  return {
    totalOrganizations: 0,
    activeOrganizations: 0,
    suspendedOrganizations: 0,
    totalUsers: 0,
    totalCarriers: 0,
    totalDocuments: 0,
    totalNotifications: 0,
    totalStorageBytes: 0,
  };
}
