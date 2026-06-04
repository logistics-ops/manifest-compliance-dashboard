import { unstable_noStore as noStore } from "next/cache";
import { getCarriers } from "@/lib/data/carriers";
import type { ComplianceTaskPriority, ComplianceTaskStatus } from "@/lib/data/compliance-tasks";
import { getInspectionReports } from "@/lib/data/inspections";
import { getSafetyScores } from "@/lib/data/safety-scores";
import { getCurrentSession } from "@/lib/integrations/auth";
import { canAccessSafetyCoachingRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";

export type SafetyCoachingStatus = Extract<ComplianceTaskStatus, "open" | "in_progress" | "completed">;

export type SafetyCoachingRecord = {
  id: string;
  organizationId: string;
  carrierId: string;
  carrierName: string;
  safetyScoreId: string | null;
  safetyScoreLabel: string | null;
  inspectionReportId: string | null;
  inspectionLabel: string | null;
  complianceTaskId: string | null;
  issue: string;
  recommendation: string;
  priority: ComplianceTaskPriority;
  targetCompletionDate: string | null;
  status: SafetyCoachingStatus;
  notes: string;
  createdBy: string | null;
  updatedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SafetyCoachingSummary = {
  open: number;
  overdue: number;
  completed: number;
};

type SafetyCoachingRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  safety_score_id: string | null;
  inspection_report_id: string | null;
  compliance_task_id: string | null;
  issue: string;
  recommendation: string;
  priority: ComplianceTaskPriority;
  target_completion_date: string | null;
  status: SafetyCoachingStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getSafetyCoachingRecords(): Promise<SafetyCoachingRecord[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!session || !supabase) return [];

  let query = supabase
    .from("safety_coaching")
    .select("id, organization_id, carrier_id, safety_score_id, inspection_report_id, compliance_task_id, issue, recommendation, priority, target_completion_date, status, notes, created_by, updated_by, completed_at, created_at, updated_at")
    .order("target_completion_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) query = query.eq("organization_id", session.organizationId);
  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) query = query.eq("carrier_id", session.carrierId);

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load safety coaching", error?.message);
    return [];
  }

  const rows = (data as SafetyCoachingRow[]).filter((row) =>
    canAccessSafetyCoachingRecord(session, { organizationId: row.organization_id, carrierId: row.carrier_id }),
  );
  const [carriers, safetyScores, inspections] = await Promise.all([getCarriers(), getSafetyScores(), getInspectionReports()]);
  const carrierNames = new Map(carriers.map((carrier) => [carrier.id, carrier.companyName]));
  const safetyLabels = new Map(safetyScores.map((score) => [score.id, `${score.scoreLabel} · ${score.safetyStatus.replace(/_/g, " ")}`]));
  const inspectionLabels = new Map(inspections.map((inspection) => [inspection.id, `${inspection.inspectionType} · ${inspection.inspectionDate}`]));

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    carrierName: carrierNames.get(row.carrier_id) ?? "Carrier",
    safetyScoreId: row.safety_score_id,
    safetyScoreLabel: row.safety_score_id ? safetyLabels.get(row.safety_score_id) ?? "Safety score" : null,
    inspectionReportId: row.inspection_report_id,
    inspectionLabel: row.inspection_report_id ? inspectionLabels.get(row.inspection_report_id) ?? "Inspection report" : null,
    complianceTaskId: row.compliance_task_id,
    issue: row.issue,
    recommendation: row.recommendation,
    priority: row.priority,
    targetCompletionDate: row.target_completion_date,
    status: row.status,
    notes: row.notes ?? "",
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function summarizeSafetyCoaching(records: SafetyCoachingRecord[]): SafetyCoachingSummary {
  const today = new Date().toISOString().slice(0, 10);
  return {
    open: records.filter((record) => record.status !== "completed").length,
    overdue: records.filter((record) => record.status !== "completed" && record.targetCompletionDate !== null && record.targetCompletionDate < today).length,
    completed: records.filter((record) => record.status === "completed").length,
  };
}
