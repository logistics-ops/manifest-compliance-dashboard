"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { requireSession } from "@/lib/integrations/auth";
import { canRoleManageCompliance } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { SafetyStatus } from "@/lib/data/safety-scores";
import type { AuthSession } from "@/types/carrier";

const safetyStatuses: SafetyStatus[] = ["good", "needs_review", "high_risk", "missing_data"];

export async function createSafetyScoreAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const organizationId = requireOrganizationId(session);
  const carrierId = getString(formData, "carrierId");
  const scoreLabel = getString(formData, "scoreLabel");
  const safetyStatus = getSafetyStatus(formData);
  const inspectionCount = getNonNegativeInteger(formData, "inspectionCount");
  const violationCount = getNonNegativeInteger(formData, "violationCount");
  const outOfServiceCount = getNonNegativeInteger(formData, "outOfServiceCount");
  const notes = getOptionalString(formData, "notes");
  const recordedAt = getString(formData, "recordedAt");

  if (!supabase) redirectWithSafetyMessage("Supabase is not configured.", "error");
  if (!canRoleManageCompliance(session.role, session.platformSuperAdmin)) redirectWithSafetyMessage("Safety score entry requires admin or staff access.", "error");
  if (!carrierId || !scoreLabel || !recordedAt) redirectWithSafetyMessage("Carrier, score label, and recorded date are required.", "error");

  const carrier = await assertCarrierInOrganization(supabase, organizationId, carrierId);
  const { data, error } = await supabase
    .from("safety_scores")
    .insert({
      organization_id: organizationId,
      carrier_id: carrier.id,
      dot_number: carrier.dotNumber,
      mc_number: carrier.mcNumber,
      score_label: scoreLabel,
      safety_status: safetyStatus,
      inspection_count: inspectionCount,
      violation_count: violationCount,
      out_of_service_count: outOfServiceCount,
      notes,
      recorded_at: recordedAt,
      created_by: session.userId,
      updated_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) redirectWithSafetyMessage(error?.message || "Unable to save safety score.", "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "safety_score.created",
    entityType: "safety_score",
    entityId: data.id,
    metadata: safetyMetadata({ carrier, scoreLabel, safetyStatus, inspectionCount, violationCount, outOfServiceCount, recordedAt }),
  });

  revalidateSafety(carrier.id);
  redirectWithSafetyMessage("Safety score recorded.", "success");
}

export async function updateSafetyScoreAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const organizationId = requireOrganizationId(session);
  const safetyScoreId = getString(formData, "safetyScoreId");
  const scoreLabel = getString(formData, "scoreLabel");
  const safetyStatus = getSafetyStatus(formData);
  const inspectionCount = getNonNegativeInteger(formData, "inspectionCount");
  const violationCount = getNonNegativeInteger(formData, "violationCount");
  const outOfServiceCount = getNonNegativeInteger(formData, "outOfServiceCount");
  const notes = getOptionalString(formData, "notes");
  const recordedAt = getString(formData, "recordedAt");

  if (!supabase) redirectWithSafetyMessage("Supabase is not configured.", "error");
  if (!canRoleManageCompliance(session.role, session.platformSuperAdmin)) redirectWithSafetyMessage("Safety score updates require admin or staff access.", "error");
  if (!safetyScoreId || !scoreLabel || !recordedAt) redirectWithSafetyMessage("Score, label, and recorded date are required.", "error");

  const existing = await assertSafetyScoreInOrganization(supabase, organizationId, safetyScoreId);
  const carrier = await assertCarrierInOrganization(supabase, organizationId, existing.carrierId);
  const { error } = await supabase
    .from("safety_scores")
    .update({
      score_label: scoreLabel,
      safety_status: safetyStatus,
      inspection_count: inspectionCount,
      violation_count: violationCount,
      out_of_service_count: outOfServiceCount,
      notes,
      recorded_at: recordedAt,
      updated_by: session.userId,
    })
    .eq("id", safetyScoreId)
    .eq("organization_id", organizationId);

  if (error) redirectWithSafetyMessage(error.message, "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "safety_score.updated",
    entityType: "safety_score",
    entityId: safetyScoreId,
    metadata: {
      ...safetyMetadata({ carrier, scoreLabel, safetyStatus, inspectionCount, violationCount, outOfServiceCount, recordedAt }),
      previous_status: existing.safetyStatus,
    },
  });

  revalidateSafety(carrier.id);
  redirectWithSafetyMessage("Safety score updated.", "success");
}

async function assertCarrierInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
) {
  const { data, error } = await supabase
    .from("carriers")
    .select("id, company_name, dot_number, mc_number")
    .eq("id", carrierId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) redirectWithSafetyMessage("Selected carrier is not available in this organization.", "error");
  return {
    id: data.id as string,
    companyName: data.company_name as string,
    dotNumber: (data.dot_number as string | null) ?? "",
    mcNumber: (data.mc_number as string | null) ?? "",
  };
}

async function assertSafetyScoreInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  safetyScoreId: string,
) {
  const { data, error } = await supabase
    .from("safety_scores")
    .select("id, carrier_id, safety_status")
    .eq("id", safetyScoreId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) redirectWithSafetyMessage("Safety score record is not available in this organization.", "error");
  return {
    id: data.id as string,
    carrierId: data.carrier_id as string,
    safetyStatus: data.safety_status as SafetyStatus,
  };
}

function safetyMetadata(input: {
  carrier: Awaited<ReturnType<typeof assertCarrierInOrganization>>;
  scoreLabel: string;
  safetyStatus: SafetyStatus;
  inspectionCount: number;
  violationCount: number;
  outOfServiceCount: number;
  recordedAt: string;
}) {
  return {
    carrier_id: input.carrier.id,
    carrier_name: input.carrier.companyName,
    dot_number: input.carrier.dotNumber,
    mc_number: input.carrier.mcNumber,
    score_label: input.scoreLabel,
    safety_status: input.safetyStatus,
    inspection_count: input.inspectionCount,
    violation_count: input.violationCount,
    out_of_service_count: input.outOfServiceCount,
    recorded_at: input.recordedAt,
    source: "manual",
  };
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) redirectWithSafetyMessage("An organization is required before managing safety scores.", "error");
  return session.organizationId;
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getSafetyStatus(formData: FormData): SafetyStatus {
  const status = getString(formData, "safetyStatus") as SafetyStatus;
  return safetyStatuses.includes(status) ? status : "missing_data";
}

function getNonNegativeInteger(formData: FormData, key: string) {
  const value = Number.parseInt(getString(formData, key) || "0", 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function redirectWithSafetyMessage(message: string, type: "success" | "error"): never {
  redirect(`/safety-scores?${type}=${encodeURIComponent(message)}`);
}

function revalidateSafety(carrierId: string) {
  revalidatePath("/");
  revalidatePath("/safety-scores");
  revalidatePath(`/carriers/${carrierId}`);
}
