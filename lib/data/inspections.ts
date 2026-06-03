import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { canAccessInspectionRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";

export type InspectionDocument = {
  id: string;
  organizationId: string;
  inspectionId: string;
  carrierId: string;
  documentName: string;
  storagePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type InspectionReport = {
  id: string;
  organizationId: string;
  carrierId: string;
  carrierName: string;
  driverId: string | null;
  driverName: string | null;
  equipmentId: string | null;
  equipmentLabel: string | null;
  inspectionDate: string;
  inspectionType: string;
  location: string;
  violations: string;
  outOfService: boolean;
  notes: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  documents: InspectionDocument[];
};

type InspectionRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  driver_id: string | null;
  equipment_id: string | null;
  inspection_date: string;
  inspection_type: string;
  location: string | null;
  violations: string | null;
  out_of_service: boolean;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type InspectionDocumentRow = {
  id: string;
  organization_id: string;
  inspection_id: string;
  carrier_id: string;
  document_name: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

type CarrierRow = { id: string; company_name: string };
type DriverRow = { id: string; first_name: string | null; last_name: string | null };
type EquipmentRow = { id: string; unit_number: string; equipment_type: string | null };

export async function getInspectionReports(): Promise<InspectionReport[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!session || !supabase) return [];

  let query = supabase
    .from("inspection_reports")
    .select("id, organization_id, carrier_id, driver_id, equipment_id, inspection_date, inspection_type, location, violations, out_of_service, notes, status, created_by, created_at, updated_at")
    .order("inspection_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) query = query.eq("organization_id", session.organizationId);
  if (session.role === "carrier" && session.carrierId) query = query.eq("carrier_id", session.carrierId);

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load inspection reports", error?.message);
    return [];
  }

  const rows = (data as InspectionRow[]).filter((row) =>
    canAccessInspectionRecord(session, { organizationId: row.organization_id, carrierId: row.carrier_id }),
  );
  if (!rows.length) return [];

  const [documentsByInspection, carriersById, driversById, equipmentById] = await Promise.all([
    getInspectionDocuments(rows),
    getCarriersById(Array.from(new Set(rows.map((row) => row.carrier_id)))),
    getDriversById(Array.from(new Set(rows.map((row) => row.driver_id).filter((id): id is string => Boolean(id))))),
    getEquipmentById(Array.from(new Set(rows.map((row) => row.equipment_id).filter((id): id is string => Boolean(id))))),
  ]);

  return rows.map((row) => mapInspection(row, documentsByInspection, carriersById, driversById, equipmentById));
}

export async function getInspectionReport(inspectionId: string): Promise<InspectionReport | null> {
  const inspections = await getInspectionReports();
  return inspections.find((inspection) => inspection.id === inspectionId) ?? null;
}

export function getInspectionSummary(inspections: InspectionReport[]) {
  const open = inspections.filter((inspection) => inspection.status !== "resolved").length;
  const withViolations = inspections.filter((inspection) => inspection.violations.trim()).length;
  const outOfService = inspections.filter((inspection) => inspection.outOfService).length;
  const documentCount = inspections.reduce((total, inspection) => total + inspection.documents.length, 0);

  return {
    total: inspections.length,
    open,
    withViolations,
    outOfService,
    documentCount,
  };
}

async function getInspectionDocuments(rows: InspectionRow[]) {
  const supabase = await createClient();
  const organizationIds = Array.from(new Set(rows.map((row) => row.organization_id)));
  const inspectionIds = rows.map((row) => row.id);
  if (!supabase || !inspectionIds.length) return new Map<string, InspectionDocument[]>();

  const { data } = await supabase
    .from("inspection_documents")
    .select("id, organization_id, inspection_id, carrier_id, document_name, storage_path, file_name, file_size, mime_type, uploaded_by, uploaded_at")
    .in("inspection_id", inspectionIds)
    .in("organization_id", organizationIds)
    .order("uploaded_at", { ascending: false });

  const grouped = new Map<string, InspectionDocument[]>();
  ((data ?? []) as InspectionDocumentRow[]).forEach((row) => {
    const document = {
      id: row.id,
      organizationId: row.organization_id,
      inspectionId: row.inspection_id,
      carrierId: row.carrier_id,
      documentName: row.document_name,
      storagePath: row.storage_path,
      fileName: row.file_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
    };
    grouped.set(row.inspection_id, [...(grouped.get(row.inspection_id) ?? []), document]);
  });
  return grouped;
}

async function getCarriersById(ids: string[]) {
  const supabase = await createClient();
  if (!supabase || !ids.length) return new Map<string, CarrierRow>();
  const { data } = await supabase.from("carriers").select("id, company_name").in("id", ids);
  return new Map(((data ?? []) as CarrierRow[]).map((carrier) => [carrier.id, carrier]));
}

async function getDriversById(ids: string[]) {
  const supabase = await createClient();
  if (!supabase || !ids.length) return new Map<string, DriverRow>();
  const { data } = await supabase.from("drivers").select("id, first_name, last_name").in("id", ids);
  return new Map(((data ?? []) as DriverRow[]).map((driver) => [driver.id, driver]));
}

async function getEquipmentById(ids: string[]) {
  const supabase = await createClient();
  if (!supabase || !ids.length) return new Map<string, EquipmentRow>();
  const { data } = await supabase.from("equipment").select("id, unit_number, equipment_type").in("id", ids);
  return new Map(((data ?? []) as EquipmentRow[]).map((equipment) => [equipment.id, equipment]));
}

function mapInspection(
  row: InspectionRow,
  documentsByInspection: Map<string, InspectionDocument[]>,
  carriersById: Map<string, CarrierRow>,
  driversById: Map<string, DriverRow>,
  equipmentById: Map<string, EquipmentRow>,
): InspectionReport {
  const driver = row.driver_id ? driversById.get(row.driver_id) : null;
  const equipment = row.equipment_id ? equipmentById.get(row.equipment_id) : null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    carrierName: carriersById.get(row.carrier_id)?.company_name ?? "Unknown carrier",
    driverId: row.driver_id,
    driverName: driver ? [driver.first_name, driver.last_name].filter(Boolean).join(" ") || "Unnamed driver" : null,
    equipmentId: row.equipment_id,
    equipmentLabel: equipment ? `Unit ${equipment.unit_number}${equipment.equipment_type ? ` · ${equipment.equipment_type}` : ""}` : null,
    inspectionDate: row.inspection_date,
    inspectionType: row.inspection_type,
    location: row.location ?? "",
    violations: row.violations ?? "",
    outOfService: row.out_of_service,
    notes: row.notes ?? "",
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documents: documentsByInspection.get(row.id) ?? [],
  };
}
