"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { requireSession } from "@/lib/integrations/auth";
import { canManageSaferSnapshotRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";

export async function performSaferLookupAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const dotNumber = getString(formData, "dotNumber");
  const mcNumber = getOptionalString(formData, "mcNumber");

  if (!canManageSaferSnapshotRecord(session, organizationId)) redirectWithSaferMessage("SAFER lookup requires admin or staff access.", "error");
  if (!dotNumber && !mcNumber) redirectWithSaferMessage("Enter a DOT number or MC number before starting a manual SAFER lookup.", "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "safer_lookup.performed",
    entityType: "safer_lookup",
    metadata: { dot_number: dotNumber, mc_number: mcNumber, mode: "manual" },
  });

  const params = new URLSearchParams();
  if (dotNumber) params.set("dotNumber", dotNumber);
  if (mcNumber) params.set("mcNumber", mcNumber);
  params.set("lookup", "1");
  redirect(`/safer-lookup?${params.toString()}`);
}

export async function saveSaferSnapshotAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const supabase = await createClient();
  const carrierId = getOptionalString(formData, "carrierId");
  const dotNumber = getString(formData, "dotNumber");
  const mcNumber = getOptionalString(formData, "mcNumber");
  const legalName = getOptionalString(formData, "legalName");
  const dbaName = getOptionalString(formData, "dbaName");
  const operatingStatus = getOptionalString(formData, "operatingStatus");
  const powerUnits = getOptionalInteger(formData, "powerUnits");
  const drivers = getOptionalInteger(formData, "drivers");
  const safetyRating = getOptionalString(formData, "safetyRating");
  const inspectionSummary = getOptionalString(formData, "inspectionSummary");
  const outOfServiceSummary = getOptionalString(formData, "outOfServiceSummary");
  const crashSummary = getOptionalString(formData, "crashSummary");
  const snapshotDate = getString(formData, "snapshotDate") || new Date().toISOString();
  const notes = getOptionalString(formData, "notes");

  if (!supabase) redirectWithSaferMessage("Supabase is not configured.", "error");
  if (!canManageSaferSnapshotRecord(session, organizationId)) redirectWithSaferMessage("Saving SAFER snapshots requires admin or staff access.", "error");
  if (!dotNumber) redirectWithSaferMessage("DOT number is required before saving a SAFER snapshot.", "error");
  if (carrierId) await assertCarrierInOrganization(supabase, organizationId, carrierId);

  const { data, error } = await supabase
    .from("safer_snapshots")
    .insert({
      organization_id: organizationId,
      carrier_id: carrierId,
      legal_name: legalName,
      dba_name: dbaName,
      dot_number: dotNumber,
      mc_number: mcNumber,
      operating_status: operatingStatus,
      power_units: powerUnits,
      drivers,
      safety_rating: safetyRating,
      inspection_summary: inspectionSummary,
      out_of_service_summary: outOfServiceSummary,
      crash_summary: crashSummary,
      snapshot_date: snapshotDate,
      source_label: "Manual SAFER review",
      notes,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) redirectWithSaferMessage(error?.message || "Unable to save SAFER snapshot.", "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "safer_snapshot.saved",
    entityType: "safer_snapshot",
    entityId: data.id,
    metadata: {
      carrier_id: carrierId,
      dot_number: dotNumber,
      mc_number: mcNumber,
      legal_name: legalName,
      operating_status: operatingStatus,
      safety_rating: safetyRating,
      snapshot_date: snapshotDate,
      mode: "manual",
    },
  });

  revalidateSafer(carrierId);
  redirectWithSaferMessage("SAFER snapshot saved.", "success");
}

async function assertCarrierInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
) {
  const { data } = await supabase.from("carriers").select("id").eq("id", carrierId).eq("organization_id", organizationId).maybeSingle();
  if (!data) redirectWithSaferMessage("Selected carrier is not available in this organization.", "error");
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) redirectWithSaferMessage("An organization is required before SAFER lookup.", "error");
  return session.organizationId;
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getOptionalInteger(formData: FormData, key: string) {
  const value = Number.parseInt(getString(formData, key), 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function revalidateSafer(carrierId: string | null) {
  revalidatePath("/");
  revalidatePath("/safer-lookup");
  if (carrierId) revalidatePath(`/carriers/${carrierId}`);
}

function redirectWithSaferMessage(message: string, type: "success" | "error"): never {
  redirect(`/safer-lookup?${type}=${encodeURIComponent(message)}`);
}
