import { unstable_noStore as noStore } from "next/cache";
import { getCarriers } from "@/lib/data/carriers";
import { requireAdmin } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";

export type OrganizationOnboardingData = {
  organization: {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  carriers: Array<{
    id: string;
    companyName: string;
  }>;
  adminCount: number;
  carrierUserCount: number;
  progress: Array<{
    key: string;
    label: string;
    complete: boolean;
  }>;
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
};

export async function getOrganizationOnboardingData(): Promise<OrganizationOnboardingData | null> {
  noStore();
  const session = await requireAdmin();

  if (!session.organizationId || session.platformSuperAdmin) {
    return null;
  }

  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const [{ data: organization }, { count: adminCount }, { count: carrierUserCount }, carriers] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, subdomain, logo_url, primary_color, secondary_color, accent_color")
      .eq("id", session.organizationId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", session.organizationId)
      .eq("role", "admin"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", session.organizationId)
      .eq("role", "carrier"),
    getCarriers(),
  ]);

  if (!organization) {
    return null;
  }

  const row = organization as OrganizationRow;
  const hasCustomColors =
    row.primary_color !== "#e31937" ||
    row.secondary_color !== "#8d1022" ||
    row.accent_color !== "#ff4d5d";
  const mappedCarriers = carriers.map((carrier) => ({
    id: carrier.id,
    companyName: carrier.companyName,
  }));

  return {
    organization: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      subdomain: row.subdomain,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
    },
    carriers: mappedCarriers,
    adminCount: adminCount ?? 0,
    carrierUserCount: carrierUserCount ?? 0,
    progress: [
      { key: "admin", label: "First organization admin active", complete: (adminCount ?? 0) > 0 },
      { key: "logo", label: "Logo uploaded", complete: Boolean(row.logo_url) },
      { key: "colors", label: "Brand colors selected", complete: hasCustomColors },
      { key: "subdomain", label: "Subdomain confirmed", complete: Boolean(row.subdomain) },
      { key: "carrier", label: "First carrier created", complete: mappedCarriers.length > 0 },
      { key: "carrier-user", label: "First carrier user invited", complete: (carrierUserCount ?? 0) > 0 },
    ],
  };
}
