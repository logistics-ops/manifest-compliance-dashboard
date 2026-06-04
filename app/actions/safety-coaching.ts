"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import type { ComplianceTaskPriority, ComplianceTaskStatus } from "@/lib/data/compliance-tasks";
import type { SafetyCoachingStatus } from "@/lib/data/safety-coaching";
import { requireSession } from "@/lib/integrations/auth";
import { canManageSafetyCoachingRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";

const priorities: ComplianceTaskPriority[] = ["critical", "high", "medium", "low"];
const statuses: SafetyCoachingStatus[] = ["open", "in_progress", "completed"];

export async function createSafetyCoachingAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const supabase = await createClient();
  const carrierId = getString(formData, "carrierId");
  const safetyScoreId = getOptionalString(formData, "safetyScoreId");
  const inspectionReportId = getOptionalString(formData, "inspectionReportId");
  const issue = getString(formData, "issue");
  const recommendation = getString(formData, "recommendation");
  const priority = normalizePriority(getString(formData, "priority"));
  const targetCompletionDate = getOptionalString(formData, "targetCompletionDate");
  const notes = getOptionalString(formData, "notes");
  const createTask = formData.get("createTask") === "on";

  if (!supabase) redirectWithCoachingMessage("Supabase is not configured.", "error");
  if (!carrierId || !issue || !recommendation) redirectWithCoachingMessage("Carrier, issue, and recommendation are required.", "error");
  const carrier = await assertCarrierInOrganization(supabase, organizationId, carrierId);
  if (!canManageSafetyCoachingRecord(session, { organizationId, carrierId: carrier.id })) {
    redirectWithCoachingMessage("Safety coaching requires admin or staff access.", "error");
  }
  if (safetyScoreId) await assertSafetyScoreInCarrier(supabase, organizationId, carrier.id, safetyScoreId);
  if (inspectionReportId) await assertInspectionInCarrier(supabase, organizationId, carrier.id, inspectionReportId);

  const { data, error } = await supabase
    .from("safety_coaching")
    .insert({
      organization_id: organizationId,
      carrier_id: carrier.id,
      safety_score_id: safetyScoreId,
      inspection_report_id: inspectionReportId,
      issue,
      recommendation,
      priority,
      target_completion_date: targetCompletionDate,
      status: "open",
      notes,
      created_by: session.userId,
      updated_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) redirectWithCoachingMessage(error?.message || "Unable to create safety coaching item.", "error");

  let complianceTaskId: string | null = null;
  if (createTask) {
    complianceTaskId = await createLinkedComplianceTask(supabase, {
      organizationId,
      session,
      coachingId: data.id as string,
      carrierId: carrier.id,
      title: `Safety coaching: ${issue}`,
      description: recommendation,
      priority,
      dueDate: targetCompletionDate,
    });
    await supabase.from("safety_coaching").update({ compliance_task_id: complianceTaskId }).eq("id", data.id).eq("organization_id", organizationId);
  }

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "safety_coaching.created",
    entityType: "safety_coaching",
    entityId: data.id,
    metadata: coachingMetadata({ carrier, issue, recommendation, priority, targetCompletionDate, status: "open", safetyScoreId, inspectionReportId, complianceTaskId }),
  });

  revalidateSafetyCoaching(carrier.id);
  redirectWithCoachingMessage("Safety coaching item created.", "success");
}

export async function updateSafetyCoachingAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const supabase = await createClient();
  const coachingId = getString(formData, "coachingId");
  const issue = getString(formData, "issue");
  const recommendation = getString(formData, "recommendation");
  const priority = normalizePriority(getString(formData, "priority"));
  const status = normalizeStatus(getString(formData, "status"));
  const targetCompletionDate = getOptionalString(formData, "targetCompletionDate");
  const notes = getOptionalString(formData, "notes");

  if (!supabase || !coachingId) redirectWithCoachingMessage("Supabase is not configured.", "error");
  if (!issue || !recommendation) redirectWithCoachingMessage("Issue and recommendation are required.", "error");

  const existing = await assertCoachingInOrganization(supabase, organizationId, coachingId);
  if (!canManageSafetyCoachingRecord(session, { organizationId, carrierId: existing.carrierId })) {
    redirectWithCoachingMessage("Safety coaching updates require admin or staff access.", "error");
  }

  const completedAt = status === "completed" && existing.status !== "completed" ? new Date().toISOString() : existing.completedAt;
  const { error } = await supabase
    .from("safety_coaching")
    .update({
      issue,
      recommendation,
      priority,
      target_completion_date: targetCompletionDate,
      status,
      notes,
      completed_at: completedAt,
      updated_by: session.userId,
    })
    .eq("id", coachingId)
    .eq("organization_id", organizationId);

  if (error) redirectWithCoachingMessage(error.message, "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: status === "completed" && existing.status !== "completed" ? "safety_coaching.completed" : "safety_coaching.updated",
    entityType: "safety_coaching",
    entityId: coachingId,
    metadata: {
      carrier_id: existing.carrierId,
      previous_status: existing.status,
      new_status: status,
      issue,
      recommendation,
      priority,
      target_completion_date: targetCompletionDate,
      compliance_task_id: existing.complianceTaskId,
    },
  });

  revalidateSafetyCoaching(existing.carrierId);
  redirectWithCoachingMessage(status === "completed" ? "Safety coaching item completed." : "Safety coaching item updated.", "success");
}

async function createLinkedComplianceTask(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  input: {
    organizationId: string;
    session: AuthSession;
    coachingId: string;
    carrierId: string;
    title: string;
    description: string;
    priority: ComplianceTaskPriority;
    dueDate: string | null;
  },
) {
  const { data, error } = await supabase
    .from("compliance_tasks")
    .insert({
      organization_id: input.organizationId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      due_date: input.dueDate,
      status: "open" satisfies ComplianceTaskStatus,
      related_entity_type: "safety_coaching",
      related_entity_id: input.coachingId,
      related_carrier_id: input.carrierId,
      source_alert_id: `safety-coaching:${input.coachingId}`,
      created_by: input.session.userId,
    })
    .select("id")
    .single();

  if (error || !data) redirectWithCoachingMessage(error?.message || "Unable to create linked compliance task.", "error");

  await writeAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.session.userId,
    action: "compliance_task.created",
    entityType: "compliance_task",
    entityId: data.id,
    metadata: {
      title: input.title,
      priority: input.priority,
      due_date: input.dueDate,
      related_entity_type: "safety_coaching",
      related_entity_id: input.coachingId,
      related_carrier_id: input.carrierId,
    },
  });

  return data.id as string;
}

async function assertCarrierInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
) {
  const { data } = await supabase.from("carriers").select("id, company_name").eq("id", carrierId).eq("organization_id", organizationId).maybeSingle();
  if (!data) redirectWithCoachingMessage("Selected carrier is not available in this organization.", "error");
  return { id: data.id as string, companyName: data.company_name as string };
}

async function assertSafetyScoreInCarrier(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
  safetyScoreId: string,
) {
  const { data } = await supabase.from("safety_scores").select("id").eq("id", safetyScoreId).eq("organization_id", organizationId).eq("carrier_id", carrierId).maybeSingle();
  if (!data) redirectWithCoachingMessage("Selected safety score is not available for this carrier.", "error");
}

async function assertInspectionInCarrier(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
  inspectionReportId: string,
) {
  const { data } = await supabase.from("inspection_reports").select("id").eq("id", inspectionReportId).eq("organization_id", organizationId).eq("carrier_id", carrierId).maybeSingle();
  if (!data) redirectWithCoachingMessage("Selected inspection report is not available for this carrier.", "error");
}

async function assertCoachingInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  coachingId: string,
) {
  const { data } = await supabase
    .from("safety_coaching")
    .select("id, carrier_id, status, completed_at, compliance_task_id")
    .eq("id", coachingId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) redirectWithCoachingMessage("Safety coaching item is not available in this organization.", "error");
  return {
    id: data.id as string,
    carrierId: data.carrier_id as string,
    status: data.status as SafetyCoachingStatus,
    completedAt: data.completed_at as string | null,
    complianceTaskId: data.compliance_task_id as string | null,
  };
}

function coachingMetadata(input: {
  carrier: { id: string; companyName: string };
  issue: string;
  recommendation: string;
  priority: ComplianceTaskPriority;
  targetCompletionDate: string | null;
  status: SafetyCoachingStatus;
  safetyScoreId: string | null;
  inspectionReportId: string | null;
  complianceTaskId: string | null;
}) {
  return {
    carrier_id: input.carrier.id,
    carrier_name: input.carrier.companyName,
    issue: input.issue,
    recommendation: input.recommendation,
    priority: input.priority,
    target_completion_date: input.targetCompletionDate,
    status: input.status,
    safety_score_id: input.safetyScoreId,
    inspection_report_id: input.inspectionReportId,
    compliance_task_id: input.complianceTaskId,
  };
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) redirectWithCoachingMessage("An organization is required before managing safety coaching.", "error");
  return session.organizationId;
}

function normalizePriority(value: string): ComplianceTaskPriority {
  return priorities.includes(value as ComplianceTaskPriority) ? (value as ComplianceTaskPriority) : "medium";
}

function normalizeStatus(value: string): SafetyCoachingStatus {
  return statuses.includes(value as SafetyCoachingStatus) ? (value as SafetyCoachingStatus) : "open";
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function revalidateSafetyCoaching(carrierId: string) {
  revalidatePath("/");
  revalidatePath("/safety-coaching");
  revalidatePath("/compliance-tasks");
  revalidatePath(`/carriers/${carrierId}`);
}

function redirectWithCoachingMessage(message: string, type: "success" | "error"): never {
  redirect(`/safety-coaching?${type}=${encodeURIComponent(message)}`);
}
