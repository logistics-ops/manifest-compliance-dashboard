"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { requireSession } from "@/lib/integrations/auth";
import { canCreateBrokerCheckRequest, canManageBrokerRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { BrokerApprovedStatus, BrokerRiskLevel } from "@/types/broker";

const approvedStatuses: BrokerApprovedStatus[] = ["approved", "review_required", "blocked"];
const riskLevels: BrokerRiskLevel[] = ["low", "medium", "high"];

export async function createBrokerAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const organizationId = requireOrganizationId(session);
  if (!supabase) redirectWithBrokerMessage("", "Supabase is not configured.", "error");
  if (!canManageBrokerRecord(session, organizationId)) redirectWithBrokerMessage("", "Broker management requires admin or staff access.", "error");

  const brokerName = getString(formData, "brokerName");
  const mcNumber = getString(formData, "mcNumber");
  if (!brokerName) redirectWithBrokerMessage("", "Broker name is required.", "error");

  const payload = brokerPayload(formData, organizationId, session.userId);
  const { data, error } = await supabase.from("brokers").insert(payload).select("id").single();
  if (error || !data) redirectWithBrokerMessage("", error?.message || "Unable to create broker.", "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "broker.created",
    entityType: "broker",
    entityId: data.id,
    metadata: { broker_name: brokerName, mc_number: mcNumber, approved_status: payload.approved_status, risk_level: payload.risk_level },
  });

  revalidatePath("/brokers");
  redirect(`/brokers/${data.id}?success=${encodeURIComponent("Broker created.")}`);
}

export async function updateBrokerAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const brokerId = getString(formData, "brokerId");
  const organizationId = requireOrganizationId(session);
  if (!supabase || !brokerId) redirectWithBrokerMessage(brokerId, "Supabase is not configured.", "error");
  if (!canManageBrokerRecord(session, organizationId)) redirectWithBrokerMessage(brokerId, "Broker updates require admin or staff access.", "error");

  const payload = brokerPayload(formData, organizationId, session.userId);
  const { error } = await supabase.from("brokers").update(payload).eq("id", brokerId).eq("organization_id", organizationId);
  if (error) redirectWithBrokerMessage(brokerId, error.message, "error");

  const statusAction = payload.approved_status === "blocked"
    ? "broker.blocked"
    : payload.approved_status === "approved"
      ? "broker.approved"
      : payload.approved_status === "review_required"
        ? "broker.review_required"
        : "broker.updated";

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: statusAction,
    entityType: "broker",
    entityId: brokerId,
    metadata: {
      broker_name: payload.broker_name,
      mc_number: payload.mc_number,
      approved_status: payload.approved_status,
      risk_level: payload.risk_level,
      blocked_reason: payload.blocked_reason,
    },
  });

  await upsertBrokerNotification(supabase, organizationId, brokerId, payload.broker_name, statusAction, payload.approved_status, session.userId);
  revalidateBroker(brokerId);
  redirectWithBrokerMessage(brokerId, "Broker updated.", "success");
}

export async function requestBrokerCheckAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const organizationId = requireOrganizationId(session);
  const carrierId = session.role === "carrier" && !session.platformSuperAdmin ? session.carrierId : getOptionalString(formData, "carrierId");
  if (!supabase) redirect(`/brokers?error=${encodeURIComponent("Supabase is not configured.")}`);
  if (!canCreateBrokerCheckRequest(session, organizationId, carrierId)) {
    redirect(`/brokers?error=${encodeURIComponent("Broker check requests are only available for your organization and linked carrier.")}`);
  }

  const brokerName = getString(formData, "brokerName");
  const mcNumber = getString(formData, "mcNumber");
  if (!brokerName && !mcNumber) redirect(`/brokers?error=${encodeURIComponent("Enter a broker name or MC number before requesting a check.")}`);

  const { data, error } = await supabase.from("broker_check_requests").insert({
    organization_id: organizationId,
    requested_by: session.userId,
    carrier_id: carrierId,
    broker_name: brokerName,
    mc_number: mcNumber,
    notes: getOptionalString(formData, "notes"),
  }).select("id").single();

  if (error || !data) redirect(`/brokers?error=${encodeURIComponent(error?.message || "Unable to submit broker check request.")}`);

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "broker_check.requested",
    entityType: "broker_check_request",
    entityId: data.id,
    metadata: { broker_name: brokerName, mc_number: mcNumber, carrier_id: carrierId },
  });
  await upsertBrokerNotification(supabase, organizationId, data.id, brokerName || mcNumber, "broker_check.requested", "review_required", session.userId);

  revalidatePath("/brokers");
  redirect(`/brokers?success=${encodeURIComponent("Broker check request submitted for admin review.")}`);
}

async function upsertBrokerNotification(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  entityId: string,
  brokerName: string,
  action: string,
  approvedStatus: string,
  _userId: string,
) {
  await supabase.from("notifications").upsert({
    organization_id: organizationId,
    title: action === "broker_check.requested" ? "New broker check request" : "Broker status changed",
    message: action === "broker_check.requested"
      ? `${brokerName || "A broker"} needs review before booking.`
      : `${brokerName} is now ${approvedStatus.replace(/_/g, " ")}.`,
    category: "broker_operation",
    priority: approvedStatus === "blocked" ? "critical" : approvedStatus === "review_required" ? "high" : "medium",
    status: "unread",
    rule_key: `${action}:${entityId}`,
    metadata: { action, broker_name: brokerName, approved_status: approvedStatus },
    assigned_to: null,
    dismissed_by: null,
  }, { onConflict: "organization_id,rule_key" });
}

function brokerPayload(formData: FormData, organizationId: string, userId: string) {
  const approvedStatus = normalizeApprovedStatus(getString(formData, "approvedStatus"));
  const riskLevel = normalizeRiskLevel(getString(formData, "riskLevel"));
  return {
    organization_id: organizationId,
    broker_name: getString(formData, "brokerName"),
    mc_number: getOptionalString(formData, "mcNumber"),
    dot_number: getOptionalString(formData, "dotNumber"),
    contact_name: getOptionalString(formData, "contactName"),
    contact_email: getOptionalString(formData, "contactEmail"),
    contact_phone: getOptionalString(formData, "contactPhone"),
    authority_status: getOptionalString(formData, "authorityStatus"),
    safety_rating: getOptionalString(formData, "safetyRating"),
    approved_status: approvedStatus,
    risk_level: riskLevel,
    notes: getOptionalString(formData, "notes"),
    notes_private: getString(formData, "notesPrivate") === "on",
    blocked_reason: getOptionalString(formData, "blockedReason"),
    created_by: userId,
  };
}

function normalizeApprovedStatus(value: string): BrokerApprovedStatus {
  return approvedStatuses.includes(value as BrokerApprovedStatus) ? (value as BrokerApprovedStatus) : "review_required";
}

function normalizeRiskLevel(value: string): BrokerRiskLevel {
  return riskLevels.includes(value as BrokerRiskLevel) ? (value as BrokerRiskLevel) : "medium";
}

function requireOrganizationId(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!session.organizationId) throw new Error("An organization is required before managing brokers.");
  return session.organizationId;
}

function revalidateBroker(brokerId: string) {
  revalidatePath("/brokers");
  revalidatePath(`/brokers/${brokerId}`);
}

function redirectWithBrokerMessage(brokerId: string, message: string, type: "success" | "error"): never {
  const target = brokerId ? `/brokers/${brokerId}` : "/brokers";
  redirect(`${target}?${type}=${encodeURIComponent(message)}`);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}
