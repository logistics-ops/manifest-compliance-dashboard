import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { hashUploadToken, normalizeUploadToken } from "@/lib/security/upload-token";
import { createAdminClient, getAdminClientEnvDiagnostics } from "@/lib/supabase/admin";
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

export type PublicUploadLinkLookup = {
  link: PublicUploadLink | null;
  status: "found" | "not_found" | "configuration_error" | "lookup_error";
  safeTokenHashPrefix: string | null;
  hasAdminClient: boolean;
  queryErrorCode: string | null;
  queryErrorMessage: string | null;
  uploadLinkRowFound: boolean;
  isExpired: boolean | null;
  isRevoked: boolean | null;
  effectiveBucketName: string;
  errorMessage?: string;
};

export type PublicUploadDocumentStatus = {
  category: UploadDocumentCategory;
  documentName: string;
  uploaded: boolean;
  status: string | null;
  expirationDate: string | null;
  storagePath: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  fileCount: number;
  files: Array<{
    fileName: string | null;
    storagePath: string | null;
    uploadedAt: string | null;
  }>;
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

type OrganizationRow = { id: string; name: string | null };
type CarrierRow = { id: string; company_name: string | null };
type DriverRow = { id: string; first_name: string | null; last_name: string | null };
type EquipmentRow = { id: string; unit_number: string | null; equipment_type: string | null };
type CarrierDocumentRow = {
  document_name: string;
  uploaded: boolean;
  status: string | null;
  expiration_date: string | null;
  storage_path: string | null;
  file_name: string | null;
  uploaded_at: string | null;
};
type ScopedDocumentRow = {
  document_name: string;
  uploaded: boolean;
  status: string | null;
  expiration_date: string | null;
  storage_path: string | null;
  uploaded_at: string | null;
};
type CarrierDocumentVersionRow = {
  document_name: string;
  storage_path: string | null;
  file_name: string | null;
  uploaded_at: string | null;
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
  const result = await getPublicUploadLinkLookup(token);
  return result.link;
}

export async function getPublicUploadLinkLookup(token: string): Promise<PublicUploadLinkLookup> {
  noStore();
  const adminSupabase = createAdminClient();
  const normalizedToken = normalizeUploadToken(token);
  const tokenHash = normalizedToken ? hashUploadToken(normalizedToken) : "";
  const safeTokenHashPrefix = tokenHash ? tokenHash.slice(0, 12) : null;
  const effectiveBucketName = getEffectiveBucketName();

  if (!adminSupabase) {
    const adminEnv = getAdminClientEnvDiagnostics();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "";
    const failedChecks = [
      adminEnv.isUrlEmptyAfterTrim ? "NEXT_PUBLIC_SUPABASE_URL_EMPTY_AFTER_TRIM" : null,
      adminEnv.isServiceRoleKeyEmptyAfterTrim ? "SUPABASE_SERVICE_ROLE_KEY_EMPTY_AFTER_TRIM" : null,
    ].filter(Boolean);

    console.warn("[upload-link] public lookup unavailable: missing Supabase environment configuration", {
      safeTokenHashPrefix,
      createAdminClientReturnedNull: true,
      failedChecks,
      hasNextPublicSupabaseUrl: adminEnv.hasUrl,
      nextPublicSupabaseUrlLength: adminEnv.urlLength,
      nextPublicSupabaseUrlTrimmedLength: adminEnv.urlTrimmedLength,
      isNextPublicSupabaseUrlEmptyAfterTrim: adminEnv.isUrlEmptyAfterTrim,
      hasSupabaseServiceRoleKey: adminEnv.hasServiceRoleKey,
      supabaseServiceRoleKeyLength: adminEnv.serviceRoleLength,
      supabaseServiceRoleKeyTrimmedLength: adminEnv.serviceRoleTrimmedLength,
      isSupabaseServiceRoleKeyEmptyAfterTrim: adminEnv.isServiceRoleKeyEmptyAfterTrim,
      hasNextPublicSupabaseAnonKey: Boolean(anonKey),
      nextPublicSupabaseAnonKeyLength: anonKey.length,
      nextPublicSupabaseAnonKeyTrimmedLength: anonKey.trim().length,
      hasNextPublicSupabaseStorageBucket: Boolean(storageBucket),
      nextPublicSupabaseStorageBucketLength: storageBucket.length,
      nextPublicSupabaseStorageBucketTrimmedLength: storageBucket.trim().length,
      effectiveBucketName,
    });
    return {
      link: null,
      status: "configuration_error",
      safeTokenHashPrefix,
      hasAdminClient: false,
      queryErrorCode: null,
      queryErrorMessage: null,
      uploadLinkRowFound: false,
      isExpired: null,
      isRevoked: null,
      effectiveBucketName,
    };
  }

  if (!normalizedToken) {
    console.warn("[upload-link] public lookup rejected empty token", { safeTokenHashPrefix });
    return {
      link: null,
      status: "not_found",
      safeTokenHashPrefix,
      hasAdminClient: true,
      queryErrorCode: null,
      queryErrorMessage: null,
      uploadLinkRowFound: false,
      isExpired: null,
      isRevoked: null,
      effectiveBucketName,
    };
  }

  const { data, error } = await adminSupabase
    .from("upload_links")
    .select("id, organization_id, carrier_id, driver_id, equipment_id, allowed_document_categories, expires_at, revoked_at, last_used_at, use_count, created_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.warn("[upload-link] public lookup query failed", {
      safeTokenHashPrefix,
      code: error.code,
      message: error.message,
    });
    return {
      link: null,
      status: "lookup_error",
      safeTokenHashPrefix,
      hasAdminClient: true,
      queryErrorCode: error.code ?? null,
      queryErrorMessage: error.message ?? null,
      uploadLinkRowFound: false,
      isExpired: null,
      isRevoked: null,
      effectiveBucketName,
      errorMessage: error.message,
    };
  }

  if (!data) {
    console.warn("[upload-link] public lookup found no token row", { safeTokenHashPrefix });
    return {
      link: null,
      status: "not_found",
      safeTokenHashPrefix,
      hasAdminClient: true,
      queryErrorCode: null,
      queryErrorMessage: null,
      uploadLinkRowFound: false,
      isExpired: null,
      isRevoked: null,
      effectiveBucketName,
    };
  }

  const row = data as UploadLinkRow;
  const [organization, carrier, driver, equipment] = await Promise.all([
    getOrganizationById(row.organization_id),
    getCarrierById(row.carrier_id),
    row.driver_id ? getDriverById(row.driver_id) : Promise.resolve(null),
    row.equipment_id ? getEquipmentById(row.equipment_id) : Promise.resolve(null),
  ]);
  const isExpired = new Date(row.expires_at).getTime() <= Date.now();
  const isRevoked = Boolean(row.revoked_at);

  if (isExpired || isRevoked) {
    console.warn("[upload-link] public lookup found inactive token", {
      safeTokenHashPrefix,
      isExpired,
      isRevoked,
      linkId: row.id,
    });
  }

  return {
    link: {
      ...mapUploadLinkRow(row),
      organizationName: organization?.name ?? "Manifest Operations Center",
      carrierName: carrier?.company_name ?? "Carrier",
      driverName: driver ? `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() || "Driver" : null,
      equipmentName: equipment ? `Unit ${equipment.unit_number ?? "Vehicle"}${equipment.equipment_type ? ` - ${equipment.equipment_type}` : ""}` : null,
      isExpired,
      isRevoked,
      isUsable: !isExpired && !isRevoked,
    },
    status: "found",
    safeTokenHashPrefix,
    hasAdminClient: true,
    queryErrorCode: null,
    queryErrorMessage: null,
    uploadLinkRowFound: true,
    isExpired,
    isRevoked,
    effectiveBucketName,
  };
}

export async function getPublicUploadDocumentStatuses(link: PublicUploadLink): Promise<PublicUploadDocumentStatus[]> {
  noStore();
  const adminSupabase = createAdminClient();
  if (!adminSupabase) return [];

  const results: PublicUploadDocumentStatus[] = [];

  if (link.allowedDocumentCategories.includes("carrier")) {
    const { data, error } = await adminSupabase
      .from("carrier_documents")
      .select("document_name, uploaded, status, expiration_date, storage_path, file_name, uploaded_at")
      .eq("organization_id", link.organizationId)
      .eq("carrier_id", link.carrierId);

    if (error) {
      console.warn("[upload-link] unable to load carrier intake statuses", { linkId: link.id, code: error.code, message: error.message });
    } else {
      const rows = (data ?? []) as CarrierDocumentRow[];
      const { data: versions } = await adminSupabase
        .from("carrier_document_versions")
        .select("document_name, storage_path, file_name, uploaded_at")
        .eq("organization_id", link.organizationId)
        .eq("carrier_id", link.carrierId)
        .order("uploaded_at", { ascending: false });
      const versionsByDocument = new Map<string, CarrierDocumentVersionRow[]>();
      ((versions ?? []) as CarrierDocumentVersionRow[]).forEach((version) => {
        const key = version.document_name.toLowerCase();
        versionsByDocument.set(key, [...(versionsByDocument.get(key) ?? []), version]);
      });

      results.push(...rows.map((row) => {
        const files = (versionsByDocument.get(row.document_name.toLowerCase()) ?? []).map((version) => ({
          fileName: version.file_name ?? fileNameFromPath(version.storage_path),
          storagePath: version.storage_path,
          uploadedAt: version.uploaded_at,
        }));
        const fallbackFiles = row.storage_path
          ? [{ fileName: row.file_name ?? fileNameFromPath(row.storage_path), storagePath: row.storage_path, uploadedAt: row.uploaded_at }]
          : [];
        const visibleFiles = files.length ? files : fallbackFiles;

        return {
        category: "carrier" as const,
        documentName: row.document_name,
        uploaded: row.uploaded,
        status: row.status,
        expirationDate: row.expiration_date,
        storagePath: row.storage_path,
        fileName: row.file_name ?? fileNameFromPath(row.storage_path),
        uploadedAt: row.uploaded_at,
          fileCount: visibleFiles.length || (row.uploaded ? 1 : 0),
          files: visibleFiles,
        };
      }));
    }
  }

  if (link.allowedDocumentCategories.includes("driver") && link.driverId) {
    const { data, error } = await adminSupabase
      .from("driver_documents")
      .select("document_name, uploaded, status, expiration_date, storage_path, uploaded_at")
      .eq("organization_id", link.organizationId)
      .eq("driver_id", link.driverId);

    if (error) {
      console.warn("[upload-link] unable to load driver intake statuses", { linkId: link.id, code: error.code, message: error.message });
    } else {
      results.push(...((data ?? []) as ScopedDocumentRow[]).map((row) => ({
        category: "driver" as const,
        documentName: row.document_name,
        uploaded: row.uploaded,
        status: row.status,
        expirationDate: row.expiration_date,
        storagePath: row.storage_path,
        fileName: fileNameFromPath(row.storage_path),
        uploadedAt: row.uploaded_at,
        fileCount: row.storage_path ? 1 : 0,
        files: row.storage_path ? [{ fileName: fileNameFromPath(row.storage_path), storagePath: row.storage_path, uploadedAt: row.uploaded_at }] : [],
      })));
    }
  }

  if (link.allowedDocumentCategories.includes("vehicle") && link.equipmentId) {
    const { data, error } = await adminSupabase
      .from("equipment_documents")
      .select("document_name, uploaded, status, expiration_date, storage_path, uploaded_at")
      .eq("organization_id", link.organizationId)
      .eq("equipment_id", link.equipmentId);

    if (error) {
      console.warn("[upload-link] unable to load vehicle intake statuses", { linkId: link.id, code: error.code, message: error.message });
    } else {
      results.push(...((data ?? []) as ScopedDocumentRow[]).map((row) => ({
        category: "vehicle" as const,
        documentName: row.document_name,
        uploaded: row.uploaded,
        status: row.status,
        expirationDate: row.expiration_date,
        storagePath: row.storage_path,
        fileName: fileNameFromPath(row.storage_path),
        uploadedAt: row.uploaded_at,
        fileCount: row.storage_path ? 1 : 0,
        files: row.storage_path ? [{ fileName: fileNameFromPath(row.storage_path), storagePath: row.storage_path, uploadedAt: row.uploaded_at }] : [],
      })));
    }
  }

  return results;
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

async function getOrganizationById(id: string) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) return null;
  const { data } = await adminSupabase.from("organizations").select("id, name").eq("id", id).maybeSingle();
  return data as OrganizationRow | null;
}

async function getCarrierById(id: string) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) return null;
  const { data } = await adminSupabase.from("carriers").select("id, company_name").eq("id", id).maybeSingle();
  return data as CarrierRow | null;
}

async function getDriverById(id: string) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) return null;
  const { data } = await adminSupabase.from("drivers").select("id, first_name, last_name").eq("id", id).maybeSingle();
  return data as DriverRow | null;
}

async function getEquipmentById(id: string) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) return null;
  const { data } = await adminSupabase.from("equipment").select("id, unit_number, equipment_type").eq("id", id).maybeSingle();
  return data as EquipmentRow | null;
}

function fileNameFromPath(storagePath: string | null) {
  if (!storagePath) return null;
  return storagePath.split("/").pop() ?? null;
}

function getEffectiveBucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "carrier-documents";
}
