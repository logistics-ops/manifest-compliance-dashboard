import { unstable_noStore as noStore } from "next/cache";
import { requireStaffAccess } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";

export type DocumentReviewStatus = "pending_review" | "approved" | "rejected" | "replacement_requested";
export type DocumentReviewCategory = "carrier" | "driver" | "vehicle";

export type DocumentReviewItem = {
  id: string;
  organizationId: string;
  carrierId: string;
  carrierName: string;
  category: DocumentReviewCategory;
  documentName: string;
  ownerName: string;
  ownerHref: string;
  uploadedAt: string | null;
  uploadedBy: string | null;
  reviewStatus: DocumentReviewStatus;
  reviewNote: string | null;
  internalReviewNote: string | null;
  reviewedAt: string | null;
  fileCount: number;
  storagePath: string | null;
  status: string;
};

export type DocumentReviewSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  replacementRequested: number;
};

type BaseDocumentRow = {
  id: string;
  organization_id: string;
  document_name: string;
  uploaded: boolean;
  uploaded_at: string | null;
  uploaded_by: string | null;
  storage_path: string | null;
  status: string;
  review_status: DocumentReviewStatus | null;
  review_note: string | null;
  internal_review_note: string | null;
  reviewed_at: string | null;
};

type CarrierDocumentRow = BaseDocumentRow & {
  carrier_id: string;
};

type DriverDocumentRow = BaseDocumentRow & {
  driver_id: string;
};

type EquipmentDocumentRow = BaseDocumentRow & {
  equipment_id: string;
};

type CarrierRow = {
  id: string;
  company_name: string | null;
};

type DriverRow = {
  id: string;
  carrier_id: string;
  first_name: string | null;
  last_name: string | null;
};

type EquipmentRow = {
  id: string;
  carrier_id: string;
  unit_number: string | null;
  equipment_type: string | null;
};

type VersionCountRow = {
  carrier_document_id: string | null;
};

export async function getDocumentReviewItems(): Promise<DocumentReviewItem[]> {
  noStore();
  const session = await requireStaffAccess();
  const supabase = await createClient();

  if (!supabase) return [];

  const [carrierDocs, driverDocs, equipmentDocs] = await Promise.all([
    loadCarrierDocuments(supabase, session),
    loadDriverDocuments(supabase, session),
    loadEquipmentDocuments(supabase, session),
  ]);

  return [...carrierDocs, ...driverDocs, ...equipmentDocs]
    .filter((item) => item.storagePath || item.uploadedAt)
    .sort((left, right) => String(right.uploadedAt ?? "").localeCompare(String(left.uploadedAt ?? "")));
}

export function summarizeDocumentReviews(items: DocumentReviewItem[]): DocumentReviewSummary {
  return {
    total: items.length,
    pending: items.filter((item) => item.reviewStatus === "pending_review").length,
    approved: items.filter((item) => item.reviewStatus === "approved").length,
    rejected: items.filter((item) => item.reviewStatus === "rejected").length,
    replacementRequested: items.filter((item) => item.reviewStatus === "replacement_requested").length,
  };
}

async function loadCarrierDocuments(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: Awaited<ReturnType<typeof requireStaffAccess>>,
) {
  let query = supabase
    .from("carrier_documents")
    .select("id, organization_id, carrier_id, document_name, uploaded, uploaded_at, uploaded_by, storage_path, status, review_status, review_note, internal_review_note, reviewed_at")
    .eq("uploaded", true)
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data?.length) return [];

  const rows = data as CarrierDocumentRow[];
  const carrierIds = unique(rows.map((row) => row.carrier_id));
  const carriers = await loadCarriersById(supabase, carrierIds);
  const versionCounts = await loadCarrierDocumentVersionCounts(supabase, rows.map((row) => row.id));

  return rows.map((row) => {
    const carrier = carriers.get(row.carrier_id);
    return mapDocumentRow(row, {
      category: "carrier",
      carrierId: row.carrier_id,
      carrierName: carrier?.company_name ?? "Carrier",
      ownerName: carrier?.company_name ?? "Carrier",
      ownerHref: `/carriers/${row.carrier_id}`,
      fileCount: versionCounts.get(row.id) ?? (row.storage_path ? 1 : 0),
    });
  });
}

async function loadDriverDocuments(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: Awaited<ReturnType<typeof requireStaffAccess>>,
) {
  let query = supabase
    .from("driver_documents")
    .select("id, organization_id, driver_id, document_name, uploaded, uploaded_at, uploaded_by, storage_path, status, review_status, review_note, internal_review_note, reviewed_at")
    .eq("uploaded", true)
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data?.length) return [];

  const rows = data as DriverDocumentRow[];
  const drivers = await loadDriversById(supabase, unique(rows.map((row) => row.driver_id)));
  const carriers = await loadCarriersById(supabase, unique(Array.from(drivers.values()).map((driver) => driver.carrier_id)));

  return rows.flatMap((row) => {
    const driver = drivers.get(row.driver_id);
    if (!driver) return [];
    const carrier = carriers.get(driver.carrier_id);
    const driverName = `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() || "Driver";
    return mapDocumentRow(row, {
      category: "driver",
      carrierId: driver.carrier_id,
      carrierName: carrier?.company_name ?? "Carrier",
      ownerName: driverName,
      ownerHref: `/dq-files/${row.driver_id}`,
      fileCount: row.storage_path ? 1 : 0,
    });
  });
}

async function loadEquipmentDocuments(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: Awaited<ReturnType<typeof requireStaffAccess>>,
) {
  let query = supabase
    .from("equipment_documents")
    .select("id, organization_id, equipment_id, document_name, uploaded, uploaded_at, uploaded_by, storage_path, status, review_status, review_note, internal_review_note, reviewed_at")
    .eq("uploaded", true)
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data?.length) return [];

  const rows = data as EquipmentDocumentRow[];
  const equipment = await loadEquipmentById(supabase, unique(rows.map((row) => row.equipment_id)));
  const carriers = await loadCarriersById(supabase, unique(Array.from(equipment.values()).map((unit) => unit.carrier_id)));

  return rows.flatMap((row) => {
    const unit = equipment.get(row.equipment_id);
    if (!unit) return [];
    const carrier = carriers.get(unit.carrier_id);
    const ownerName = `Unit ${unit.unit_number ?? "Vehicle"}${unit.equipment_type ? ` - ${unit.equipment_type}` : ""}`;
    return mapDocumentRow(row, {
      category: "vehicle",
      carrierId: unit.carrier_id,
      carrierName: carrier?.company_name ?? "Carrier",
      ownerName,
      ownerHref: `/vehicles/${row.equipment_id}`,
      fileCount: row.storage_path ? 1 : 0,
    });
  });
}

function mapDocumentRow(
  row: BaseDocumentRow,
  owner: {
    category: DocumentReviewCategory;
    carrierId: string;
    carrierName: string;
    ownerName: string;
    ownerHref: string;
    fileCount: number;
  },
): DocumentReviewItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: owner.carrierId,
    carrierName: owner.carrierName,
    category: owner.category,
    documentName: row.document_name,
    ownerName: owner.ownerName,
    ownerHref: owner.ownerHref,
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
    reviewStatus: row.review_status ?? "pending_review",
    reviewNote: row.review_note,
    internalReviewNote: row.internal_review_note,
    reviewedAt: row.reviewed_at,
    fileCount: owner.fileCount,
    storagePath: row.storage_path,
    status: row.status,
  };
}

async function loadCarriersById(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, ids: string[]) {
  if (!ids.length) return new Map<string, CarrierRow>();
  const { data } = await supabase.from("carriers").select("id, company_name").in("id", ids);
  return new Map(((data ?? []) as CarrierRow[]).map((carrier) => [carrier.id, carrier]));
}

async function loadDriversById(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, ids: string[]) {
  if (!ids.length) return new Map<string, DriverRow>();
  const { data } = await supabase.from("drivers").select("id, carrier_id, first_name, last_name").in("id", ids);
  return new Map(((data ?? []) as DriverRow[]).map((driver) => [driver.id, driver]));
}

async function loadEquipmentById(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, ids: string[]) {
  if (!ids.length) return new Map<string, EquipmentRow>();
  const { data } = await supabase.from("equipment").select("id, carrier_id, unit_number, equipment_type").in("id", ids);
  return new Map(((data ?? []) as EquipmentRow[]).map((unit) => [unit.id, unit]));
}

async function loadCarrierDocumentVersionCounts(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, documentIds: string[]) {
  if (!documentIds.length) return new Map<string, number>();
  const { data } = await supabase
    .from("carrier_document_versions")
    .select("carrier_document_id")
    .in("carrier_document_id", documentIds);
  const counts = new Map<string, number>();
  ((data ?? []) as VersionCountRow[]).forEach((row) => {
    if (!row.carrier_document_id) return;
    counts.set(row.carrier_document_id, (counts.get(row.carrier_document_id) ?? 0) + 1);
  });
  return counts;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
