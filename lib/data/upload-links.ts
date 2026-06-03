import { createHash } from "crypto";
import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UploadDocumentCategory = "carrier" | "driver" | "vehicle";

export type UploadLinkRecord = {
  id: string;
  organizationId: string;
  carrierId: string;
  driverId: string | null;
  equipmentId: string | null;
  allowedDocumentCategories: UploadDocumentCategory[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
  createdAt: string;
};

export type PublicUploadLink = UploadLinkRecord & {
  organizationName: string;
  carrierName: string;
  driverName: string | null;
  equipmentName: string | null;
  isExpired: boolean;
  isRevoked: boolean;
  isUsable: boolean;
};

type UploadLinkRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  driver_id: string | null;
  equipment_id: string | null;
  allowed_document_categories: UploadDocumentCategory[];
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
  organizations?: { name: string | null } | Array<{ name: string | null }> | null;
  carriers?: { company_name: string | null } | Array<{ company_name: string | null }> | null;
  drivers?: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null;
  equipment?: { unit_number: string | null; equipment_type: string | null } | Array<{ unit_number: string | null; equipment_type: string | null }> | null;
};

export async function getUploadLinksForCarrier(carrierId: string): Promise<UploadLinkRecord[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!supabase || !session || !carrierId) return [];

  let query = supabase
    .from("upload_links")
    .select("id, organization_id, carrier_id, driver_id, equipment_id, allowed_document_categories, expires_at, revoked_at, last_used_at, use_count, created_at")
    .eq("carrier_id", carrierId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as UploadLinkRow[]).map(mapUploadLinkRow);
}

export async function getPublicUploadLink(token: string): Promise<PublicUploadLink | null> {
  noStore();
  const adminSupabase = createAdminClient();
  if (!adminSupabase || !token) return null;

  const { data, error } = await adminSupabase
    .from("upload_links")
    .select("id, organization_id, carrier_id, driver_id, equipment_id, allowed_document_categories, expires_at, revoked_at, last_used_at, use_count, created_at, organizations(name), carriers(company_name), drivers(first_name, last_name), equipment(unit_number, equipment_type)")
    .eq("token_hash", hashUploadToken(token))
    .maybeSingle();

  if (error || !data) return null;
  const row = data as UploadLinkRow;
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  const carrier = Array.isArray(row.carriers) ? row.carriers[0] : row.carriers;
  const driver = Array.isArray(row.drivers) ? row.drivers[0] : row.drivers;
  const equipment = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
  const isExpired = new Date(row.expires_at).getTime() <= Date.now();
  const isRevoked = Boolean(row.revoked_at);

  return {
    ...mapUploadLinkRow(row),
    organizationName: organization?.name ?? "Manifest Operations Center",
    carrierName: carrier?.company_name ?? "Carrier",
    driverName: driver ? `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() || "Driver" : null,
    equipmentName: equipment ? `Unit ${equipment.unit_number ?? "Vehicle"}${equipment.equipment_type ? ` - ${equipment.equipment_type}` : ""}` : null,
    isExpired,
    isRevoked,
    isUsable: !isExpired && !isRevoked,
  };
}

export function hashUploadToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function mapUploadLinkRow(row: UploadLinkRow): UploadLinkRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    driverId: row.driver_id,
    equipmentId: row.equipment_id,
    allowedDocumentCategories: row.allowed_document_categories ?? [],
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    useCount: row.use_count,
    createdAt: row.created_at,
  };
}
