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
  drivers?: {
    carrier_id: string;
    first_name: string | null;
    last_name: string | null;
  } | Array<{
    carrier_id: string;
    first_name: string | null;
    last_name: string | null;
  }> | null;
};

type EquipmentDocumentRow = {
  organization_id: string;
  equipment_id: string;
  document_name: string;
  uploaded: boolean;
  status: string;
  expiration_date: string | null;
  equipment?: {
    carrier_id: string;
    unit_number: string | null;
  } | Array<{
    carrier_id: string;
    unit_number: string | null;
  }> | null;
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
  let query = supabase
    .from("driver_documents")
    .select("organization_id, driver_id, document_name, uploaded, status, expiration_date, drivers!driver_documents_organization_driver_fkey(carrier_id, first_name, last_name)");

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load driver documents for audit readiness", error?.message);
    return new Map<string, AuditDocumentInput[]>();
  }

  const documentsByCarrier = new Map<string, AuditDocumentInput[]>();
  (data as DriverDocumentRow[]).forEach((row) => {
    const driver = Array.isArray(row.drivers) ? row.drivers[0] : row.drivers;
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
  let query = supabase
    .from("equipment_documents")
    .select("organization_id, equipment_id, document_name, uploaded, status, expiration_date, equipment!equipment_documents_organization_equipment_fkey(carrier_id, unit_number)");

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load equipment documents for audit readiness", error?.message);
    return new Map<string, AuditDocumentInput[]>();
  }

  const documentsByCarrier = new Map<string, AuditDocumentInput[]>();
  (data as EquipmentDocumentRow[]).forEach((row) => {
    const equipment = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
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
