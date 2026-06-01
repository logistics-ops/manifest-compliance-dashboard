"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";

const equipmentStatuses = new Set(["active", "maintenance", "inactive"]);

export async function createDriverAction(formData: FormData) {
  const session = await requireAdmin();
  const organizationId = requireOrganizationId(session, "/dq-files");
  const supabase = await createClient();
  const carrierId = getString(formData, "carrierId");
  const firstName = getString(formData, "firstName");
  const lastName = getString(formData, "lastName");

  if (!supabase) redirectWithMessage("/dq-files", "Supabase is not configured.", "error");
  if (!carrierId || !firstName || !lastName) redirectWithMessage("/dq-files", "Carrier, first name, and last name are required.", "error");
  await assertCarrierInOrganization(supabase, organizationId, carrierId, "/dq-files");

  const { data, error } = await supabase
    .from("drivers")
    .insert({
      organization_id: organizationId,
      carrier_id: carrierId,
      first_name: firstName,
      last_name: lastName,
      phone: getOptionalString(formData, "phone"),
      email: getOptionalString(formData, "email"),
      cdl_number: getOptionalString(formData, "cdlNumber"),
      cdl_state: getOptionalString(formData, "cdlState"),
      status: getOptionalString(formData, "status") || "active",
      notes: getOptionalString(formData, "notes"),
    })
    .select("id")
    .single();

  if (error || !data) redirectWithMessage("/dq-files", error?.message || "Unable to create driver record.", "error");

  revalidatePath("/");
  revalidatePath("/dq-files");
  redirect(`/dq-files/${data.id}?success=${encodeURIComponent("Driver record created. Upload DQ documents below.")}`);
}

export async function createVehicleAction(formData: FormData) {
  const session = await requireAdmin();
  const organizationId = requireOrganizationId(session, "/vehicles");
  const supabase = await createClient();
  const carrierId = getString(formData, "carrierId");
  const unitNumber = getString(formData, "unitNumber");
  const equipmentType = getString(formData, "equipmentType");
  const status = normalizeEquipmentStatus(getOptionalString(formData, "status"));

  if (!supabase) redirectWithMessage("/vehicles", "Supabase is not configured.", "error");
  if (!carrierId || !unitNumber || !equipmentType) redirectWithMessage("/vehicles", "Carrier, unit number, and equipment type are required.", "error");
  await assertCarrierInOrganization(supabase, organizationId, carrierId, "/vehicles");

  const { data, error } = await supabase
    .from("equipment")
    .insert({
      organization_id: organizationId,
      carrier_id: carrierId,
      unit_number: unitNumber,
      equipment_type: equipmentType,
      vin: getOptionalString(formData, "vin"),
      plate_number: getOptionalString(formData, "plateNumber"),
      plate_state: getOptionalString(formData, "plateState"),
      status,
      notes: getOptionalString(formData, "notes"),
    })
    .select("id")
    .single();

  if (error || !data) redirectWithMessage("/vehicles", error?.message || "Unable to create vehicle record.", "error");

  revalidatePath("/");
  revalidatePath("/vehicles");
  redirect(`/vehicles/${data.id}?success=${encodeURIComponent("Vehicle record created. Upload compliance documents below.")}`);
}

async function assertCarrierInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
  fallbackPath: string,
) {
  const { data } = await supabase
    .from("carriers")
    .select("id")
    .eq("id", carrierId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) redirectWithMessage(fallbackPath, "Selected carrier is not available in this organization.", "error");
}

function requireOrganizationId(session: Awaited<ReturnType<typeof requireAdmin>>, fallbackPath: string) {
  if (!session.organizationId) redirectWithMessage(fallbackPath, "Select an organization before creating compliance records.", "error");
  return session.organizationId;
}

function normalizeEquipmentStatus(value: string | null) {
  return value && equipmentStatuses.has(value) ? value : "active";
}

function redirectWithMessage(path: string, message: string, type: "success" | "error"): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}
