import { unstable_noStore as noStore } from "next/cache";
import { getCarriers } from "@/lib/data/carriers";
import { getCurrentSession } from "@/lib/integrations/auth";
import { canAccessSaferSnapshotRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";

export const SAFER_SNAPSHOT_OUTDATED_DAYS = 90;

export type SaferSnapshotRecord = {
  id: string;
  organizationId: string;
  carrierId: string | null;
  carrierName: string | null;
  legalName: string;
  dbaName: string;
  dotNumber: string;
  mcNumber: string;
  operatingStatus: string;
  powerUnits: number | null;
  drivers: number | null;
  safetyRating: string;
  inspectionSummary: string;
  outOfServiceSummary: string;
  crashSummary: string;
  snapshotDate: string;
  sourceLabel: string;
  notes: string;
  createdBy: string | null;
  createdAt: string;
};

export type SaferSnapshotSummary = {
  missing: number;
  outdated: number;
};

type SaferSnapshotRow = {
  id: string;
  organization_id: string;
  carrier_id: string | null;
  legal_name: string | null;
  dba_name: string | null;
  dot_number: string;
  mc_number: string | null;
  operating_status: string | null;
  power_units: number | null;
  drivers: number | null;
  safety_rating: string | null;
  inspection_summary: string | null;
  out_of_service_summary: string | null;
  crash_summary: string | null;
  snapshot_date: string;
  source_label: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export async function getSaferSnapshots(): Promise<SaferSnapshotRecord[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!session || !supabase) return [];

  let query = supabase
    .from("safer_snapshots")
    .select("id, organization_id, carrier_id, legal_name, dba_name, dot_number, mc_number, operating_status, power_units, drivers, safety_rating, inspection_summary, out_of_service_summary, crash_summary, snapshot_date, source_label, notes, created_by, created_at")
    .order("snapshot_date", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) query = query.eq("organization_id", session.organizationId);
  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) query = query.eq("carrier_id", session.carrierId);

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load SAFER snapshots", error?.message);
    return [];
  }

  const rows = (data as SaferSnapshotRow[]).filter((row) =>
    canAccessSaferSnapshotRecord(session, { organizationId: row.organization_id, carrierId: row.carrier_id }),
  );
  const carrierNames = new Map((await getCarriers()).map((carrier) => [carrier.id, carrier.companyName]));
  return rows.map((row) => mapSaferSnapshot(row, carrierNames));
}

export function latestSaferSnapshotsByCarrier(snapshots: SaferSnapshotRecord[]) {
  return snapshots.reduce((map, snapshot) => {
    if (snapshot.carrierId && !map.has(snapshot.carrierId)) map.set(snapshot.carrierId, snapshot);
    return map;
  }, new Map<string, SaferSnapshotRecord>());
}

export function summarizeSaferSnapshots(carrierIds: string[], snapshots: SaferSnapshotRecord[]): SaferSnapshotSummary {
  const latest = latestSaferSnapshotsByCarrier(snapshots);
  return carrierIds.reduce(
    (summary, carrierId) => {
      const snapshot = latest.get(carrierId);
      if (!snapshot) summary.missing += 1;
      else if (isSaferSnapshotOutdated(snapshot)) summary.outdated += 1;
      return summary;
    },
    { missing: 0, outdated: 0 },
  );
}

export function isSaferSnapshotOutdated(snapshot: SaferSnapshotRecord) {
  const snapshotDate = new Date(snapshot.snapshotDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SAFER_SNAPSHOT_OUTDATED_DAYS);
  return snapshotDate < cutoff;
}

function mapSaferSnapshot(row: SaferSnapshotRow, carrierNames: Map<string, string>): SaferSnapshotRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    carrierName: row.carrier_id ? carrierNames.get(row.carrier_id) ?? null : null,
    legalName: row.legal_name ?? "",
    dbaName: row.dba_name ?? "",
    dotNumber: row.dot_number,
    mcNumber: row.mc_number ?? "",
    operatingStatus: row.operating_status ?? "",
    powerUnits: row.power_units,
    drivers: row.drivers,
    safetyRating: row.safety_rating ?? "",
    inspectionSummary: row.inspection_summary ?? "",
    outOfServiceSummary: row.out_of_service_summary ?? "",
    crashSummary: row.crash_summary ?? "",
    snapshotDate: row.snapshot_date,
    sourceLabel: row.source_label,
    notes: row.notes ?? "",
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
