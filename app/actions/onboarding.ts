"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/integrations/auth";
import { writeAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CarrierStatus } from "@/types/carrier";

const statusToDatabase: Record<CarrierStatus, string> = {
  Active: "active",
  Pending: "pending",
  Suspended: "suspended",
  Inactive: "inactive",
};

export async function updateOnboardingBrandingAction(formData: FormData) {
  const session = await requireOrganizationAdmin();
  const supabase = await createClient();

  if (!supabase) return;

  await supabase
    .from("organizations")
    .update({
      name: getString(formData, "name"),
      slug: slugify(getString(formData, "slug")),
      subdomain: slugify(getString(formData, "subdomain")),
      logo_url: getOptionalString(formData, "logoUrl"),
      primary_color: normalizeHexColor(getString(formData, "primaryColor"), "#e31937"),
      secondary_color: normalizeHexColor(getString(formData, "secondaryColor"), "#8d1022"),
      accent_color: normalizeHexColor(getString(formData, "accentColor"), "#ff4d5d"),
    })
    .eq("id", session.organizationId);

  await writeAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    action: "onboarding.branding_completed",
    entityType: "organization",
    entityId: session.organizationId,
    metadata: {
      name: getString(formData, "name"),
      subdomain: slugify(getString(formData, "subdomain")),
      logoUploaded: Boolean(getOptionalString(formData, "logoUrl")),
    },
  });

  revalidateOnboarding();
}

export async function createOnboardingCarrierAction(formData: FormData) {
  const session = await requireOrganizationAdmin();
  const supabase = await createClient();

  if (!supabase || !session.organizationId) return;

  const { data } = await supabase.from("carriers").insert({
    organization_id: session.organizationId,
    company_name: getString(formData, "companyName"),
    mc_number: getString(formData, "mcNumber"),
    dot_number: getString(formData, "dotNumber"),
    contact_name: getString(formData, "contactName"),
    phone: getString(formData, "phone"),
    email: getString(formData, "email"),
    status: statusToDatabase[(getString(formData, "status") as CarrierStatus) || "Pending"],
    notes: getString(formData, "notes"),
    created_by: session.userId,
  }).select("id, company_name").single();

  if (data) {
    await writeAuditLog({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      action: "onboarding.carrier_created",
      entityType: "carrier",
      entityId: data.id,
      metadata: { companyName: data.company_name },
    });
  }

  revalidateOnboarding();
}

export async function inviteCarrierUserAction(formData: FormData) {
  const session = await requireOrganizationAdmin();
  const organizationId = session.organizationId;
  const carrierId = getString(formData, "carrierId");
  const email = getString(formData, "email").toLowerCase();
  const fullName = getString(formData, "fullName");
  const redirectTo = getOptionalString(formData, "redirectTo") ?? undefined;
  const adminSupabase = createAdminClient();

  if (!adminSupabase || !organizationId || !carrierId || !email) {
    return;
  }

  const { data: carrier } = await adminSupabase
    .from("carriers")
    .select("id")
    .eq("id", carrierId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!carrier) {
    return;
  }

  const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role: "carrier",
      organization_id: organizationId,
      carrier_id: carrierId,
      platform_super_admin: false,
    },
    redirectTo,
  });

  if (!error && data.user) {
    await adminSupabase.from("users").upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: "carrier",
      organization_id: organizationId,
      carrier_id: carrierId,
      platform_super_admin: false,
      is_active: true,
    });

    await writeAuditLog({
      organizationId,
      actorUserId: session.userId,
      action: "onboarding.carrier_user_invited",
      entityType: "user",
      entityId: data.user.id,
      metadata: { email, carrierId, role: "carrier" },
    });
  }

  revalidateOnboarding();
}

async function requireOrganizationAdmin() {
  const session = await requireAdmin();

  if (!session.organizationId || session.platformSuperAdmin) {
    throw new Error("Organization onboarding requires an organization admin.");
  }

  return session;
}

function revalidateOnboarding() {
  revalidatePath("/onboarding");
  revalidatePath("/");
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeHexColor(value: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
