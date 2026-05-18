import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ORGANIZATION_BRANDING, getRequestSubdomain } from "@/lib/tenancy";
import type { OrganizationBranding } from "@/types/carrier";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
};

export const getCurrentOrganizationBranding = cache(async (): Promise<OrganizationBranding> => {
  const subdomain = await getRequestSubdomain();
  const supabase = await createClient();

  if (!supabase || !subdomain) {
    return DEFAULT_ORGANIZATION_BRANDING;
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, primary_color, secondary_color, accent_color")
    .eq("subdomain", subdomain)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_ORGANIZATION_BRANDING;
  }

  return mapOrganizationBranding(data as OrganizationRow);
});

export function mapOrganizationBranding(row: OrganizationRow): OrganizationBranding {
  return {
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color || DEFAULT_ORGANIZATION_BRANDING.primaryColor,
    secondaryColor: row.secondary_color || DEFAULT_ORGANIZATION_BRANDING.secondaryColor,
    accentColor: row.accent_color || DEFAULT_ORGANIZATION_BRANDING.accentColor,
  };
}
