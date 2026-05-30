import { getCurrentSession } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";
import { daysUntilExpiration } from "@/lib/compliance";

export type VehicleReadinessBand = "Ready" | "Good" | "Needs Review" | "High Risk" | "Out Of Service Risk";

export type VehicleChecklistStatus = {
  present: boolean;
  missing: boolean;
  expired: boolean;
  expiringSoon: boolean;
  notApplicable: boolean;
};

export type VehicleChecklistItem = VehicleChecklistStatus & {
  name: string;
  conditional: boolean;
  status: "present" | "missing" | "expired" | "expiring_soon" | "not_applicable";
  documentId: string | null;
  documentName: string | null;
  equipmentId: string;
  carrierId: string;
  expirationDate: string | null;
};

export type VehicleRecord = {
  id: string;
  organizationId: string;
  carrierId: string;
  carrierName: string;
  unitNumber: string;
  equipmentType: string;
  vin: string;
  plateNumber: string;
  plateState: string;
  status: string;
  checklist: VehicleChecklistItem[];
  totalChecklistItems: number;
  presentCount: number;
  missingCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  readinessPercentage: number;
  readinessBand: VehicleReadinessBand;
  nextExpiration: string | null;
  criticalBlockers: string[];
};

type EquipmentDocumentRow = {
  id: string;
  equipment_id: string;
  document_name: string;
  uploaded: boolean;
  status: string;
  expiration_date: string | null;
};

type EquipmentRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  unit_number: string;
  equipment_type: string;
  vin: string | null;
  plate_number: string | null;
  plate_state: string | null;
  status: string;
  carriers?: { company_name: string | null } | Array<{ company_name: string | null }> | null;
  equipment_documents?: EquipmentDocumentRow[];
};

const VEHICLE_READINESS_CHECKLIST = [
  { name: "Registration", conditional: false },
  { name: "Annual Inspection", conditional: false },
  { name: "Insurance", conditional: false },
  { name: "IRP / IFTA Records", conditional: true },
  { name: "Lease Agreement, if applicable", conditional: true },
  { name: "Maintenance Records, if stored", conditional: true },
  { name: "Trailer Records, if applicable", conditional: true },
] as const;

export async function getVehicles(): Promise<VehicleRecord[]> {
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session) return [];

  let query = supabase
    .from("equipment")
    .select("id, organization_id, carrier_id, unit_number, equipment_type, vin, plate_number, plate_state, status, carriers(company_name), equipment_documents(id, equipment_id, document_name, uploaded, status, expiration_date)")
    .order("unit_number");

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    query = query.eq("carrier_id", session.carrierId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Unable to load vehicles", error?.message);
    return [];
  }

  return (data as EquipmentRow[]).map(mapEquipmentRow);
}

function mapEquipmentRow(row: EquipmentRow): VehicleRecord {
  const documents = row.equipment_documents ?? [];
  const carrier = Array.isArray(row.carriers) ? row.carriers[0] : row.carriers;
  const checklist = buildVehicleChecklist(documents, row.id, row.carrier_id, row.equipment_type);
  const applicable = checklist.filter((item) => !item.notApplicable);
  const presentCount = applicable.filter((item) => item.present).length;
  const missingCount = applicable.filter((item) => item.missing).length;
  const expiredCount = applicable.filter((item) => item.expired).length;
  const expiringSoonCount = applicable.filter((item) => item.expiringSoon).length;
  const validCount = applicable.filter((item) => item.present && !item.expired).length;
  const readinessPercentage = applicable.length ? Math.round((validCount / applicable.length) * 100) : 100;
  const datedExpirations = applicable
    .map((item) => item.expirationDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const criticalBlockers = getCriticalBlockers(checklist, row.status);

  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    carrierName: carrier?.company_name ?? "Carrier",
    unitNumber: row.unit_number,
    equipmentType: row.equipment_type,
    vin: row.vin ?? "",
    plateNumber: row.plate_number ?? "",
    plateState: row.plate_state ?? "",
    status: row.status,
    checklist,
    totalChecklistItems: applicable.length,
    presentCount,
    missingCount,
    expiredCount,
    expiringSoonCount,
    readinessPercentage,
    readinessBand: readinessBand(readinessPercentage),
    nextExpiration: datedExpirations[0] ?? null,
    criticalBlockers,
  };
}

function buildVehicleChecklist(
  documents: EquipmentDocumentRow[],
  equipmentId: string,
  carrierId: string,
  equipmentType: string,
): VehicleChecklistItem[] {
  const documentsByName = new Map(documents.map((document) => [normalizeDocumentName(document.document_name), document]));

  return VEHICLE_READINESS_CHECKLIST.map((required) => {
    const document = findDocumentForChecklistItem(required.name, documentsByName);
    const trailerItem = required.name === "Trailer Records, if applicable";
    const trailerUnit = normalizeDocumentName(equipmentType).includes("trailer");
    const notApplicable = required.conditional && !document && (!trailerItem || !trailerUnit);
    const expired = Boolean(document && (document.status === "expired" || isExpired(document.expiration_date)));
    const expiringSoon = Boolean(document && !expired && (document.status === "expiring_soon" || isExpiringSoon(document.expiration_date)));
    const present = Boolean(document?.uploaded && !notApplicable);
    const missing = !notApplicable && (!document || !document.uploaded || document.status === "missing");
    const status = getChecklistStatus({ notApplicable, missing, expired, expiringSoon, present });

    return {
      name: required.name,
      conditional: required.conditional,
      status,
      documentId: document?.id ?? null,
      documentName: document?.document_name ?? null,
      equipmentId,
      carrierId,
      expirationDate: document?.expiration_date ?? null,
      present,
      missing,
      expired,
      expiringSoon,
      notApplicable,
    };
  });
}

function getChecklistStatus(status: VehicleChecklistStatus): VehicleChecklistItem["status"] {
  if (status.notApplicable) return "not_applicable";
  if (status.missing) return "missing";
  if (status.expired) return "expired";
  if (status.expiringSoon) return "expiring_soon";
  return "present";
}

function findDocumentForChecklistItem(name: string, documentsByName: Map<string, EquipmentDocumentRow>) {
  const aliases = documentAliases(name);
  for (const alias of aliases) {
    const exact = documentsByName.get(normalizeDocumentName(alias));
    if (exact) return exact;
  }

  return Array.from(documentsByName.entries()).find(([documentName]) =>
    aliases.some((alias) => documentName.includes(normalizeDocumentName(alias))),
  )?.[1] ?? null;
}

function documentAliases(name: string) {
  const aliases: Record<string, string[]> = {
    Registration: ["Registration", "Cab Card", "Vehicle Registration"],
    "Annual Inspection": ["Annual Inspection", "DOT Inspection", "Inspection"],
    Insurance: ["Insurance", "Certificate of Insurance", "Auto Liability"],
    "IRP / IFTA Records": ["IRP", "IFTA", "Apportioned Registration", "Fuel Tax"],
    "Lease Agreement, if applicable": ["Lease Agreement", "Equipment Lease", "Owner Operator Lease"],
    "Maintenance Records, if stored": ["Maintenance Record", "Maintenance Records", "Repair Order", "Service Record"],
    "Trailer Records, if applicable": ["Trailer Record", "Trailer Registration", "Trailer Inspection"],
  };

  return aliases[name] ?? [name];
}

function readinessBand(readinessPercentage: number): VehicleReadinessBand {
  if (readinessPercentage >= 90) return "Ready";
  if (readinessPercentage >= 80) return "Good";
  if (readinessPercentage >= 70) return "Needs Review";
  if (readinessPercentage >= 50) return "High Risk";
  return "Out Of Service Risk";
}

function getCriticalBlockers(checklist: VehicleChecklistItem[], status: string) {
  const blockers = checklist
    .filter((item) => !item.notApplicable && (item.missing || item.expired))
    .filter((item) => ["Registration", "Annual Inspection", "Insurance"].includes(item.name))
    .map((item) => `${item.name} ${item.expired ? "expired" : "missing"}`);

  if (status === "out_of_service" || status === "inactive") {
    blockers.push(`Unit status is ${status.replace(/_/g, " ")}`);
  }

  return blockers;
}

function isExpired(expirationDate: string | null) {
  const days = daysUntilExpiration(expirationDate);
  return days !== null && days < 0;
}

function isExpiringSoon(expirationDate: string | null) {
  const days = daysUntilExpiration(expirationDate);
  return days !== null && days >= 0 && days <= 30;
}

function normalizeDocumentName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
