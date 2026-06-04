import { unstable_noStore as noStore } from "next/cache";
import { getCarriers } from "@/lib/data/carriers";
import { getCurrentSession } from "@/lib/integrations/auth";
import { calculateSafetyTrend, type SafetyStatus, type SafetyTrend } from "@/lib/safety-score-trends";
import { createClient } from "@/lib/supabase/server";

export { calculateSafetyTrend };
export type { SafetyStatus, SafetyTrend };

export type SafetyScoreRecord = {
  id: string;
  organizationId: string;
  carrierId: string;
  carrierName: string;
  dotNumber: string;
  mcNumber: string;
  scoreLabel: string;
  safetyStatus: SafetyStatus;
  inspectionCount: number;
  violationCount: number;
  outOfServiceCount: number;
  notes: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SafetyScoreSummary = {
  good: number;
  needsReview: number;
  missingData: number;
};

export type SafetyTrendRecord = {
  carrierId: string;
  carrierName: string;
  latest: SafetyScoreRecord | null;
  previous: SafetyScoreRecord | null;
  trend: SafetyTrend;
};

export type SafetyTrendSummary = {
  improving: number;
  declining: number;
  stable: number;
  missingHistory: number;
};

type SafetyScoreRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  dot_number: string | null;
  mc_number: string | null;
  score_label: string;
  safety_status: SafetyStatus;
  inspection_count: number;
  violation_count: number;
  out_of_service_count: number;
  notes: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export async function getSafetyScores(): Promise<SafetyScoreRecord[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session) return [];

  let query = supabase
    .from("safety_scores")
    .select("id, organization_id, carrier_id, dot_number, mc_number, score_label, safety_status, inspection_count, violation_count, out_of_service_count, notes, recorded_at, created_at, updated_at")
    .order("recorded_at", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    query = query.eq("carrier_id", session.carrierId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Unable to load safety scores", error?.message);
    return [];
  }

  const carrierNames = new Map((await getCarriers()).map((carrier) => [carrier.id, carrier.companyName]));
  return (data as SafetyScoreRow[]).map((row) => mapSafetyScoreRow(row, carrierNames));
}

export function latestSafetyScoresByCarrier(scores: SafetyScoreRecord[]) {
  return scores.reduce((map, score) => {
    if (!map.has(score.carrierId)) map.set(score.carrierId, score);
    return map;
  }, new Map<string, SafetyScoreRecord>());
}

export function safetyScoreHistoryByCarrier(scores: SafetyScoreRecord[]) {
  return scores.reduce((map, score) => {
    const history = map.get(score.carrierId) ?? [];
    history.push(score);
    map.set(score.carrierId, history);
    return map;
  }, new Map<string, SafetyScoreRecord[]>());
}

export function buildSafetyTrendRecords(carrierIds: string[], scores: SafetyScoreRecord[]): SafetyTrendRecord[] {
  const historyByCarrier = safetyScoreHistoryByCarrier(scores);
  return carrierIds.map((carrierId) => {
    const history = historyByCarrier.get(carrierId) ?? [];
    const latest = history[0] ?? null;
    const previous = history[1] ?? null;

    return {
      carrierId,
      carrierName: latest?.carrierName ?? "Carrier",
      latest,
      previous,
      trend: calculateSafetyTrend(latest, previous),
    };
  });
}

export function summarizeSafetyTrends(records: SafetyTrendRecord[]): SafetyTrendSummary {
  return records.reduce(
    (summary, record) => {
      if (record.trend === "Improving") summary.improving += 1;
      else if (record.trend === "Declining") summary.declining += 1;
      else if (record.trend === "Stable") summary.stable += 1;
      else summary.missingHistory += 1;
      return summary;
    },
    { improving: 0, declining: 0, stable: 0, missingHistory: 0 },
  );
}

export function summarizeSafetyScores(carrierIds: string[], scores: SafetyScoreRecord[]): SafetyScoreSummary {
  const latestByCarrier = latestSafetyScoresByCarrier(scores);
  return carrierIds.reduce(
    (summary, carrierId) => {
      const score = latestByCarrier.get(carrierId);
      if (!score || score.safetyStatus === "missing_data") {
        summary.missingData += 1;
      } else if (score.safetyStatus === "good") {
        summary.good += 1;
      } else {
        summary.needsReview += 1;
      }
      return summary;
    },
    { good: 0, needsReview: 0, missingData: 0 },
  );
}

export function statusLabel(status: SafetyStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapSafetyScoreRow(row: SafetyScoreRow, carrierNames: Map<string, string>): SafetyScoreRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    carrierName: carrierNames.get(row.carrier_id) ?? "Carrier",
    dotNumber: row.dot_number ?? "",
    mcNumber: row.mc_number ?? "",
    scoreLabel: row.score_label,
    safetyStatus: row.safety_status,
    inspectionCount: row.inspection_count,
    violationCount: row.violation_count,
    outOfServiceCount: row.out_of_service_count,
    notes: row.notes ?? "",
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
