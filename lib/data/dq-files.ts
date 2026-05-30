import { daysUntilExpiration } from "@/lib/compliance";
import { getCurrentSession } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";

export type DQReadinessBand = "Ready" | "Strong" | "Needs Review" | "High Risk" | "Blocked";

export type DQChecklistStatus = {
  present: boolean;
  missing: boolean;
  expired: boolean;
  expiringSoon: boolean;
  notApplicable: boolean;
};

export type DQChecklistItem = DQChecklistStatus & {
  name: string;
  conditional: boolean;
  status: "present" | "missing" | "expired" | "expiring_soon" | "not_applicable";
  documentId: string | null;
  documentName: string | null;
  driverId: string;
  carrierId: string;
  expirationDate: string | null;
};

export type DQFileRecord = {
  id: string;
  organizationId: string;
  carrierId: string;
  carrierName: string;
  driverName: string;
  status: string;
  cdlNumber: string;
  cdlState: string;
  checklist: DQChecklistItem[];
  totalChecklistItems: number;
  presentCount: number;
  missingCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  readinessPercentage: number;
  readinessBand: DQReadinessBand;
  nextExpiration: string | null;
};

type DriverDocumentRow = {
  id: string;
  driver_id: string;
  document_name: string;
  uploaded: boolean;
  status: string;
  expiration_date: string | null;
};

type DriverRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  first_name: string;
  last_name: string;
  cdl_number: string | null;
  cdl_state: string | null;
  status: string;
  carriers?: { company_name: string | null } | Array<{ company_name: string | null }> | null;
  driver_documents?: DriverDocumentRow[];
};

const REQUIRED_DQ_CHECKLIST = [
  { name: "Employment Application", conditional: false },
  { name: "Initial MVR / 3-Year Driving Record", conditional: false },
  { name: "Annual MVR Inquiry", conditional: false },
  { name: "Annual Driving Record Review Note", conditional: false },
  { name: "Annual Violations Certification", conditional: false },
  { name: "Road Test Certificate or CDL Equivalent", conditional: false },
  { name: "Medical Examiner Certificate / CDLIS Med Cert", conditional: false },
  { name: "National Registry ME Verification Note", conditional: false },
  { name: "Medical Variance / SPE Certificate, if applicable", conditional: true },
  { name: "Previous Employer Safety History Request", conditional: false },
  { name: "Previous Employer Response Documentation", conditional: false },
  { name: "Driver Rebuttal / Correction, if applicable", conditional: true },
  { name: "Pre-Employment Drug/Alcohol Inquiry", conditional: false },
  { name: "Return-To-Duty Documentation, if applicable", conditional: true },
  { name: "ELDT Certificate, if applicable", conditional: true },
  { name: "LCV Certificate, if applicable", conditional: true },
] as const;

export async function getDQFiles(): Promise<DQFileRecord[]> {
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session) return [];

  let query = supabase
    .from("drivers")
    .select("id, organization_id, carrier_id, first_name, last_name, cdl_number, cdl_state, status, carriers(company_name), driver_documents(id, driver_id, document_name, uploaded, status, expiration_date)")
    .order("last_name");

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    query = query.eq("carrier_id", session.carrierId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Unable to load DQ files", error?.message);
    return [];
  }

  return (data as DriverRow[]).map(mapDriverRow);
}

function mapDriverRow(row: DriverRow): DQFileRecord {
  const documents = row.driver_documents ?? [];
  const carrier = Array.isArray(row.carriers) ? row.carriers[0] : row.carriers;
  const checklist = buildChecklist(documents, row.id, row.carrier_id);
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

  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    carrierName: carrier?.company_name ?? "Carrier",
    driverName: `${row.first_name} ${row.last_name}`.trim(),
    status: row.status,
    cdlNumber: row.cdl_number ?? "",
    cdlState: row.cdl_state ?? "",
    checklist,
    totalChecklistItems: applicable.length,
    presentCount,
    missingCount,
    expiredCount,
    expiringSoonCount,
    readinessPercentage,
    readinessBand: readinessBand(readinessPercentage, expiredCount, missingCount),
    nextExpiration: datedExpirations[0] ?? null,
  };
}

function buildChecklist(documents: DriverDocumentRow[], driverId: string, carrierId: string): DQChecklistItem[] {
  const documentsByName = new Map(documents.map((document) => [normalizeDocumentName(document.document_name), document]));

  return REQUIRED_DQ_CHECKLIST.map((required) => {
    const document = findDocumentForChecklistItem(required.name, documentsByName);
    const hasDocumentSignal = Boolean(document);
    const notApplicable = required.conditional && !hasDocumentSignal;
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
      driverId,
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

function getChecklistStatus(status: DQChecklistStatus): DQChecklistItem["status"] {
  if (status.notApplicable) return "not_applicable";
  if (status.missing) return "missing";
  if (status.expired) return "expired";
  if (status.expiringSoon) return "expiring_soon";
  return "present";
}

function findDocumentForChecklistItem(name: string, documentsByName: Map<string, DriverDocumentRow>) {
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
    "Employment Application": ["Employment Application", "Driver Application"],
    "Initial MVR / 3-Year Driving Record": ["Initial MVR", "3-Year Driving Record", "MVR"],
    "Annual MVR Inquiry": ["Annual MVR Inquiry", "Annual MVR"],
    "Annual Driving Record Review Note": ["Annual Driving Record Review Note", "Annual Review"],
    "Annual Violations Certification": ["Annual Violations Certification", "List of Violations", "Violations Certification"],
    "Road Test Certificate or CDL Equivalent": ["Road Test Certificate", "CDL Equivalent", "CDL"],
    "Medical Examiner Certificate / CDLIS Med Cert": ["Medical Examiner Certificate", "CDLIS Med Cert", "Medical Card"],
    "National Registry ME Verification Note": ["National Registry ME Verification Note", "Medical Examiner Registry Verification"],
    "Medical Variance / SPE Certificate, if applicable": ["Medical Variance", "SPE Certificate"],
    "Previous Employer Safety History Request": ["Previous Employer Safety History Request", "Safety Performance History Request"],
    "Previous Employer Response Documentation": ["Previous Employer Response Documentation", "Safety Performance History Response"],
    "Driver Rebuttal / Correction, if applicable": ["Driver Rebuttal", "Driver Correction"],
    "Pre-Employment Drug/Alcohol Inquiry": ["Pre-Employment Drug/Alcohol Inquiry", "Drug Alcohol Inquiry"],
    "Return-To-Duty Documentation, if applicable": ["Return-To-Duty Documentation", "Return To Duty"],
    "ELDT Certificate, if applicable": ["ELDT Certificate", "Entry-Level Driver Training"],
    "LCV Certificate, if applicable": ["LCV Certificate", "Longer Combination Vehicle"],
  };

  return aliases[name] ?? [name];
}

function readinessBand(readinessPercentage: number, expiredCount: number, missingCount: number): DQReadinessBand {
  if (expiredCount > 0 || readinessPercentage < 50) return "Blocked";
  if (readinessPercentage < 70) return "High Risk";
  if (readinessPercentage < 85 || missingCount > 0) return "Needs Review";
  if (readinessPercentage < 95) return "Strong";
  return "Ready";
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
