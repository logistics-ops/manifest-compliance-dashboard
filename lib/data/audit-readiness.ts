import { calculateCarrierAuditReadiness, type AuditAlertInput, type AuditDocumentInput, type AuditReadinessResult } from "@/lib/audit-readiness";
import { getCarriers } from "@/lib/data/carriers";
import { getCurrentSession } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";

type DriverDocumentRow = {
  organization_id: string;
  driver_id: string;
  document_name: string;
  uploaded: boolean;
  status: string;
  expiration_date: string | null;
};

type EquipmentDocumentRow = {
  organization_id: string;
  equipment_id: string;
  document_name: string;
  uploaded: boolean;
  status: string;
  expiration_date: string | null;
};

type AuditDriverRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  first_name: string | null;
  last_name: string | null;
};

type AuditEquipmentRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  unit_number: string | null;
};

type ComplianceAlertRow = {
  carrier_id: string | null;
  title: string;
  severity: string;
  status: string;
};

export type AuditReadinessDashboardData = {
  results: AuditReadinessResult[];
  organizationScore: number;
  totalCriticalBlockers: number;
  missingDocuments: number;
  expiredDocuments: number;
  expiringDocuments: number;
};

export async function getAuditReadinessDashboardData(): Promise<AuditReadinessDashboardData> {
  const carriers = await getCarriers();
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session) {
    const results = carriers.map((carrier) => calculateCarrierAuditReadiness({ carrier }));
    return summarize(results);
  }

  const [driverDocuments, equipmentDocuments, complianceAlerts] = await Promise.all([
    getDriverDocumentsByCarrier(supabase, session),
    getEquipmentDocumentsByCarrier(supabase, session),
    getComplianceAlertsByCarrier(supabase, session),
  ]);

  const results = carriers.map((carrier) => calculateCarrierAuditReadiness({
    carrier,
    driverDocuments: driverDocuments.get(carrier.id) ?? [],
    equipmentDocuments: equipmentDocuments.get(carrier.id) ?? [],
    complianceAlerts: complianceAlerts.get(carrier.id) ?? [],
  }));

  return summarize(results);
}

async function getDriverDocumentsByCarrier(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>,
) {
  let driverQuery = supabase
    .from("drivers")
    .select("id, organization_id, carrier_id, first_name, last_name");

  if (session.organizationId && !session.platformSuperAdmin) {
    driverQuery = driverQuery.eq("organization_id", session.organizationId);
  }

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    driverQuery = driverQuery.eq("carrier_id", session.carrierId);
  }

  const { data: drivers, error: driverError } = await driverQuery;
  if (driverError || !drivers) {
    console.error("Unable to load drivers for audit readiness", driverError?.message);
    return new Map<string, AuditDocumentInput[]>();
  }

  const driversById = new Map((drivers as AuditDriverRow[]).map((driver) => [driver.id, driver]));
  const driverIds = Array.from(driversById.keys());
  if (!driverIds.length) {
    return new Map<string, AuditDocumentInput[]>();
  }

  let documentQuery = supabase
    .from("driver_documents")
    .select("organization_id, driver_id, document_name, uploaded, status, expiration_date")
    .in("driver_id", driverIds);

  if (session.organizationId && !session.platformSuperAdmin) {
    documentQuery = documentQuery.eq("organization_id", session.organizationId);
  }

  const { data, error } = await documentQuery;
  if (error || !data) {
    console.error("Unable to load driver documents for audit readiness", error?.message);
    return new Map<string, AuditDocumentInput[]>();
  }

  const documentsByCarrier = new Map<string, AuditDocumentInput[]>();
  (data as DriverDocumentRow[]).forEach((row) => {
    const driver = driversById.get(row.driver_id);
    if (!driver?.carrier_id) return;
    const documents = documentsByCarrier.get(driver.carrier_id) ?? [];
    documents.push({
      name: row.document_name,
      uploaded: row.uploaded,
      status: row.status,
      expirationDate: row.expiration_date,
      scope: "driver",
      ownerName: `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() || "Driver",
    });
    documentsByCarrier.set(driver.carrier_id, documents);
  });

  return documentsByCarrier;
}

async function getEquipmentDocumentsByCarrier(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>,
) {
  let equipmentQuery = supabase
    .from("equipment")
    .select("id, organization_id, carrier_id, unit_number");

  if (session.organizationId && !session.platformSuperAdmin) {
    equipmentQuery = equipmentQuery.eq("organization_id", session.organizationId);
  }

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    equipmentQuery = equipmentQuery.eq("carrier_id", session.carrierId);
  }

  const { data: equipmentRows, error: equipmentError } = await equipmentQuery;
  if (equipmentError || !equipmentRows) {
    console.error("Unable to load equipment for audit readiness", equipmentError?.message);
    return new Map<string, AuditDocumentInput[]>();
  }

  const equipmentById = new Map((equipmentRows as AuditEquipmentRow[]).map((equipment) => [equipment.id, equipment]));
  const equipmentIds = Array.from(equipmentById.keys());
  if (!equipmentIds.length) {
    return new Map<string, AuditDocumentInput[]>();
  }

  let documentQuery = supabase
    .from("equipment_documents")
    .select("organization_id, equipment_id, document_name, uploaded, status, expiration_date")
    .in("equipment_id", equipmentIds);

  if (session.organizationId && !session.platformSuperAdmin) {
    documentQuery = documentQuery.eq("organization_id", session.organizationId);
  }

  const { data, error } = await documentQuery;
  if (error || !data) {
    console.error("Unable to load equipment documents for audit readiness", error?.message);
    return new Map<string, AuditDocumentInput[]>();
  }

  const documentsByCarrier = new Map<string, AuditDocumentInput[]>();
  (data as EquipmentDocumentRow[]).forEach((row) => {
    const equipment = equipmentById.get(row.equipment_id);
    if (!equipment?.carrier_id) return;
    const documents = documentsByCarrier.get(equipment.carrier_id) ?? [];
    documents.push({
      name: row.document_name,
      uploaded: row.uploaded,
      status: row.status,
      expirationDate: row.expiration_date,
      scope: "equipment",
      ownerName: equipment.unit_number ? `Unit ${equipment.unit_number}` : "Vehicle",
    });
    documentsByCarrier.set(equipment.carrier_id, documents);
  });

  return documentsByCarrier;
}

async function getComplianceAlertsByCarrier(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>,
) {
  let query = supabase
    .from("compliance_alerts")
    .select("carrier_id, title, severity, status");

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load compliance alerts for audit readiness", error?.message);
    return new Map<string, AuditAlertInput[]>();
  }

  const alertsByCarrier = new Map<string, AuditAlertInput[]>();
  (data as ComplianceAlertRow[]).forEach((row) => {
    if (!row.carrier_id) return;
    const alerts = alertsByCarrier.get(row.carrier_id) ?? [];
    alerts.push({ title: row.title, severity: row.severity, status: row.status });
    alertsByCarrier.set(row.carrier_id, alerts);
  });

  return alertsByCarrier;
}

function summarize(results: AuditReadinessResult[]): AuditReadinessDashboardData {
  const organizationScore = results.length
    ? Math.round(results.reduce((total, result) => total + result.score, 0) / results.length)
    : 0;

  return {
    results: results.sort((a, b) => a.score - b.score || a.carrierName.localeCompare(b.carrierName)),
    organizationScore,
    totalCriticalBlockers: results.reduce((total, result) => total + result.criticalBlockers.length, 0),
    missingDocuments: countDeductions(results, "missing"),
    expiredDocuments: countDeductions(results, "expired"),
    expiringDocuments: countDeductions(results, "expiring soon"),
  };
}

function countDeductions(results: AuditReadinessResult[], text: string) {
  return results.reduce(
    (total, result) => total + result.deductions.filter((deduction) => deduction.label.toLowerCase().includes(text)).length,
    0,
  );
}
