"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformSuperAdmin } from "@/lib/integrations/auth";
import { writeAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const defaultBranding = {
  primary_color: "#e31937",
  secondary_color: "#8d1022",
  accent_color: "#ff4d5d",
  logo_url: null,
};

export async function createOrganizationAction(formData: FormData) {
  const session = await requirePlatformSuperAdmin();
  const supabase = await createClient();

  if (!supabase) return;

  const { data } = await supabase.from("organizations").insert({
    name: getString(formData, "name"),
    slug: slugify(getString(formData, "slug")),
    subdomain: slugify(getString(formData, "subdomain")),
    logo_url: getOptionalString(formData, "logoUrl"),
    primary_color: normalizeHexColor(getString(formData, "primaryColor"), defaultBranding.primary_color),
    secondary_color: normalizeHexColor(getString(formData, "secondaryColor"), defaultBranding.secondary_color),
    accent_color: normalizeHexColor(getString(formData, "accentColor"), defaultBranding.accent_color),
    is_active: true,
  }).select("id, name, subdomain").single();

  if (data) {
    await writeAuditLog({
      organizationId: data.id,
      actorUserId: session.userId,
      action: "organization.created",
      entityType: "organization",
      entityId: data.id,
      metadata: { name: data.name, subdomain: data.subdomain },
    });
  }

  revalidatePlatform();
}

export async function updateOrganizationBrandingAction(formData: FormData) {
  const session = await requirePlatformSuperAdmin();
  const supabase = await createClient();
  const organizationId = getString(formData, "organizationId");

  if (!supabase || !organizationId) return;

  await supabase
    .from("organizations")
    .update({
      name: getString(formData, "name"),
      slug: slugify(getString(formData, "slug")),
      subdomain: slugify(getString(formData, "subdomain")),
      logo_url: getOptionalString(formData, "logoUrl"),
      primary_color: normalizeHexColor(getString(formData, "primaryColor"), defaultBranding.primary_color),
      secondary_color: normalizeHexColor(getString(formData, "secondaryColor"), defaultBranding.secondary_color),
      accent_color: normalizeHexColor(getString(formData, "accentColor"), defaultBranding.accent_color),
    })
    .eq("id", organizationId);

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "organization.updated",
    entityType: "organization",
    entityId: organizationId,
    metadata: {
      name: getString(formData, "name"),
      subdomain: slugify(getString(formData, "subdomain")),
      branding: true,
    },
  });

  revalidatePlatform(organizationId);
}

export async function updateOrganizationStatusAction(formData: FormData) {
  const session = await requirePlatformSuperAdmin();
  const supabase = await createClient();
  const organizationId = getString(formData, "organizationId");
  const status = getString(formData, "status");

  if (!supabase || !organizationId) return;

  await supabase
    .from("organizations")
    .update({ is_active: status === "active" })
    .eq("id", organizationId);

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: status === "active" ? "organization.reactivated" : "organization.suspended",
    entityType: "organization",
    entityId: organizationId,
    metadata: { status },
  });

  revalidatePlatform(organizationId);
}

export async function resetOrganizationBrandingAction(formData: FormData) {
  const session = await requirePlatformSuperAdmin();
  const supabase = await createClient();
  const organizationId = getString(formData, "organizationId");

  if (!supabase || !organizationId) return;

  await supabase
    .from("organizations")
    .update(defaultBranding)
    .eq("id", organizationId);

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "organization.branding_reset",
    entityType: "organization",
    entityId: organizationId,
    metadata: { resetToDefault: true },
  });

  revalidatePlatform(organizationId);
}

export async function updatePlatformUserAction(formData: FormData) {
  const session = await requirePlatformSuperAdmin();
  const supabase = await createClient();
  const userId = getString(formData, "userId");
  const organizationId = getOptionalString(formData, "organizationId");
  const role = getString(formData, "role");

  if (!supabase || !userId || !["admin", "staff", "carrier"].includes(role)) return;

  await supabase
    .from("users")
    .update({
      organization_id: organizationId,
      role,
      carrier_id: role === "carrier" ? getOptionalString(formData, "carrierId") : null,
      is_active: getString(formData, "status") === "active",
      platform_super_admin: formData.get("platformSuperAdmin") === "on",
    })
    .eq("id", userId);

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    metadata: {
      role,
      isActive: getString(formData, "status") === "active",
      platformSuperAdmin: formData.get("platformSuperAdmin") === "on",
    },
  });

  revalidatePlatform();
}

export async function inviteOrganizationAdminAction(formData: FormData) {
  const session = await requirePlatformSuperAdmin();
  const organizationId = getString(formData, "organizationId");
  const email = getString(formData, "email").toLowerCase();
  const fullName = getString(formData, "fullName");
  const redirectTo = getOptionalString(formData, "redirectTo") ?? undefined;
  const adminSupabase = createAdminClient();

  if (!adminSupabase || !organizationId || !email) {
    return;
  }

  const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role: "admin",
      organization_id: organizationId,
      platform_super_admin: false,
    },
    redirectTo,
  });

  if (!error && data.user) {
    await adminSupabase.from("users").upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: "admin",
      organization_id: organizationId,
      platform_super_admin: false,
      is_active: true,
    });

    await writeAuditLog({
      organizationId,
      actorUserId: session.userId,
      action: "user.invited",
      entityType: "user",
      entityId: data.user.id,
      metadata: { email, role: "admin" },
    });
  }

  revalidatePlatform(organizationId);
}

function revalidatePlatform(organizationId?: string) {
  revalidatePath("/platform");
  if (organizationId) {
    revalidatePath(`/platform/organizations/${organizationId}/dashboard`);
  }
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
