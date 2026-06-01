"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { requireSession } from "@/lib/integrations/auth";
import { canManageComplianceTaskRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { ComplianceTaskPriority, ComplianceTaskStatus } from "@/lib/data/compliance-tasks";

const statuses: ComplianceTaskStatus[] = ["open", "in_progress", "waiting", "completed"];
const priorities: ComplianceTaskPriority[] = ["critical", "high", "medium", "low"];

export async function createComplianceTaskAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const supabase = await createClient();
  const title = getString(formData, "title");
  const description = getOptionalString(formData, "description");
  const priority = normalizePriority(getString(formData, "priority"));
  const dueDate = getOptionalString(formData, "dueDate");
  const assignedTo = getOptionalString(formData, "assignedTo");
  const relatedEntityType = getOptionalString(formData, "relatedEntityType") || "manual";
  const relatedEntityId = getOptionalString(formData, "relatedEntityId");
  const relatedCarrierId = getOptionalString(formData, "relatedCarrierId");
  const sourceAlertId = getOptionalString(formData, "sourceAlertId");

  if (!supabase) redirectWithTaskMessage("Supabase is not configured.", "error");
  if (!canManageComplianceTaskRecord(session, organizationId)) redirectWithTaskMessage("Compliance task creation requires admin or staff access.", "error");
  if (!title) redirectWithTaskMessage("Task title is required.", "error");
  if (assignedTo) await assertUserInOrganization(supabase, organizationId, assignedTo);
  if (relatedCarrierId) await assertCarrierInOrganization(supabase, organizationId, relatedCarrierId);

  const { data, error } = await supabase
    .from("compliance_tasks")
    .insert({
      organization_id: organizationId,
      title,
      description,
      priority,
      due_date: dueDate,
      status: "open",
      assigned_to: assignedTo,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      related_carrier_id: relatedCarrierId,
      source_alert_id: sourceAlertId,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) redirectWithTaskMessage(error?.message || "Unable to create compliance task.", "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "compliance_task.created",
    entityType: "compliance_task",
    entityId: data.id,
    metadata: { title, priority, due_date: dueDate, assigned_to: assignedTo, related_entity_type: relatedEntityType, related_entity_id: relatedEntityId, related_carrier_id: relatedCarrierId, source_alert_id: sourceAlertId },
  });

  revalidateTasks();
  redirectWithTaskMessage("Compliance task created.", "success");
}

export async function updateComplianceTaskAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const supabase = await createClient();
  const taskId = getString(formData, "taskId");
  const status = normalizeStatus(getString(formData, "status"));
  const priority = normalizePriority(getString(formData, "priority"));
  const assignedTo = getOptionalString(formData, "assignedTo");
  const dueDate = getOptionalString(formData, "dueDate");

  if (!supabase || !taskId) redirectWithTaskMessage("Supabase is not configured.", "error");
  if (!canManageComplianceTaskRecord(session, organizationId)) redirectWithTaskMessage("Compliance task updates require admin or staff access.", "error");
  if (assignedTo) await assertUserInOrganization(supabase, organizationId, assignedTo);

  const { data: existing } = await supabase
    .from("compliance_tasks")
    .select("id, title, status, priority, assigned_to, due_date, organization_id")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!existing) redirectWithTaskMessage("Task is not available in this organization.", "error");

  const { error } = await supabase
    .from("compliance_tasks")
    .update({
      status,
      priority,
      assigned_to: assignedTo,
      due_date: dueDate,
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId);

  if (error) redirectWithTaskMessage(error.message, "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: status === "completed" && existing.status !== "completed" ? "compliance_task.completed" : "compliance_task.updated",
    entityType: "compliance_task",
    entityId: taskId,
    metadata: {
      title: existing.title,
      previous_status: existing.status,
      new_status: status,
      previous_priority: existing.priority,
      new_priority: priority,
      previous_assigned_to: existing.assigned_to,
      assigned_to: assignedTo,
      previous_due_date: existing.due_date,
      due_date: dueDate,
    },
  });

  revalidateTasks();
  redirectWithTaskMessage(status === "completed" ? "Task completed." : "Task updated.", "success");
}

export async function completeComplianceTaskAction(formData: FormData) {
  formData.set("status", "completed");
  formData.set("priority", getString(formData, "priority") || "medium");
  await updateComplianceTaskAction(formData);
}

async function assertUserInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) redirectWithTaskMessage("Assigned user must belong to this organization.", "error");
}

async function assertCarrierInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
) {
  const { data } = await supabase
    .from("carriers")
    .select("id")
    .eq("id", carrierId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) redirectWithTaskMessage("Related carrier must belong to this organization.", "error");
}

function requireOrganizationId(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!session.organizationId) redirectWithTaskMessage("An organization is required before managing compliance tasks.", "error");
  return session.organizationId;
}

function revalidateTasks() {
  revalidatePath("/");
  revalidatePath("/compliance-alerts");
  revalidatePath("/compliance-tasks");
}

function redirectWithTaskMessage(message: string, type: "success" | "error"): never {
  redirect(`/compliance-tasks?${type}=${encodeURIComponent(message)}`);
}

function normalizeStatus(value: string): ComplianceTaskStatus {
  return statuses.includes(value as ComplianceTaskStatus) ? (value as ComplianceTaskStatus) : "open";
}

function normalizePriority(value: string): ComplianceTaskPriority {
  return priorities.includes(value as ComplianceTaskPriority) ? (value as ComplianceTaskPriority) : "medium";
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}
