"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { requireSession } from "@/lib/integrations/auth";
import {
  canAssignCarrierToUser,
  canInviteOrganizationUsers,
  canManageOrganizationUsers,
} from "@/lib/security/tenant-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession, UserRole } from "@/types/carrier";

const roles: UserRole[] = ["admin", "staff", "carrier"];

export async function inviteUserAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const role = normalizeRole(getString(formData, "role"));
  const carrierId = getOptionalString(formData, "carrierId");
  const email = getString(formData, "email").toLowerCase();
  const fullName = getString(formData, "fullName");
  const message = getOptionalString(formData, "message");
  const adminSupabase = createAdminClient();
  const supabase = await createClient();

  if (!supabase || !adminSupabase) redirectWithUsersMessage("Supabase service role is required before inviting users.", "error");
  if (!canInviteOrganizationUsers(session, organizationId)) redirectWithUsersMessage("You do not have permission to invite users.", "error");
  if (!email) redirectWithUsersMessage("Email is required.", "error");
  if (role === "carrier" && !carrierId) redirectWithUsersMessage("Carrier users must be linked to a carrier profile.", "error");
  if (role === "admin" && !canManageOrganizationUsers(session, organizationId)) redirectWithUsersMessage("Only admins can invite admin users.", "error");
  if (carrierId) await assertCarrierInOrganization(supabase, session, organizationId, carrierId);

  const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role,
      organization_id: organizationId,
      carrier_id: role === "carrier" ? carrierId : null,
      invite_message: message,
      platform_super_admin: false,
    },
  });

  if (error || !data.user) redirectWithUsersMessage(error?.message || "Unable to invite user.", "error");

  await adminSupabase.from("users").upsert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    organization_id: organizationId,
    carrier_id: role === "carrier" ? carrierId : null,
    platform_super_admin: false,
    is_active: true,
  });

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "user.invited",
    entityType: "user",
    entityId: data.user.id,
    metadata: { email, role, carrier_id: role === "carrier" ? carrierId : null },
  });
  if (role === "carrier" && carrierId) {
    await writeAuditLog({
      organizationId,
      actorUserId: session.userId,
      action: "user.carrier_linked",
      entityType: "user",
      entityId: data.user.id,
      metadata: { email, carrier_id: carrierId },
    });
  }
  await createUserNotification(supabase, organizationId, data.user.id, role === "carrier" ? "Carrier user invited" : "New user invited", `${email} was invited as ${role}.`, role === "carrier" ? "medium" : "low");

  revalidatePath("/users");
  redirectWithUsersMessage("User invited.", "success");
}

export async function updateOrganizationUserAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const supabase = await createClient();
  const userId = getString(formData, "userId");
  const role = normalizeRole(getString(formData, "role"));
  const carrierId = getOptionalString(formData, "carrierId");
  const isActive = getString(formData, "status") === "active";

  if (!supabase || !userId) redirectWithUsersMessage("Supabase is not configured.", "error");
  if (!canManageOrganizationUsers(session, organizationId)) redirectWithUsersMessage("Only admins can update user roles and status.", "error");
  if (role === "carrier" && !carrierId) redirectWithUsersMessage("Carrier users must be linked to a carrier profile.", "error");
  if (carrierId) await assertCarrierInOrganization(supabase, session, organizationId, carrierId);

  const { data: existing } = await supabase
    .from("users")
    .select("id, email, role, is_active, carrier_id, organization_id, platform_super_admin")
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!existing || existing.platform_super_admin) redirectWithUsersMessage("User is not available in this organization.", "error");

  const { error } = await supabase
    .from("users")
    .update({
      full_name: getString(formData, "fullName"),
      role,
      carrier_id: role === "carrier" ? carrierId : null,
      is_active: isActive,
    })
    .eq("id", userId)
    .eq("organization_id", organizationId);

  if (error) redirectWithUsersMessage(error.message, "error");

  if (existing.role !== role) {
    await writeAuditLog({ organizationId, actorUserId: session.userId, action: "user.role_changed", entityType: "user", entityId: userId, metadata: { email: existing.email, previous_role: existing.role, new_role: role } });
  }
  if (Boolean(existing.is_active) !== isActive) {
    const action = isActive ? "user.activated" : "user.deactivated";
    await writeAuditLog({ organizationId, actorUserId: session.userId, action, entityType: "user", entityId: userId, metadata: { email: existing.email, is_active: isActive } });
    if (!isActive) await createUserNotification(supabase, organizationId, userId, "User deactivated", `${existing.email} was deactivated.`, "medium");
  }
  if ((existing.carrier_id ?? null) !== (role === "carrier" ? carrierId : null)) {
    await writeAuditLog({
      organizationId,
      actorUserId: session.userId,
      action: carrierId ? "user.carrier_linked" : "user.carrier_unlinked",
      entityType: "user",
      entityId: userId,
      metadata: { email: existing.email, previous_carrier_id: existing.carrier_id, new_carrier_id: role === "carrier" ? carrierId : null },
    });
  }

  revalidatePath("/users");
  redirectWithUsersMessage("User updated.", "success");
}

export async function resendInviteAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = requireOrganizationId(session);
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const userId = getString(formData, "userId");

  if (!supabase || !adminSupabase || !userId) redirectWithUsersMessage("Supabase service role is required before resending invites.", "error");
  if (!canManageOrganizationUsers(session, organizationId)) redirectWithUsersMessage("Only admins can resend invites.", "error");

  const { data: user } = await supabase
    .from("users")
    .select("id, email, full_name, role, carrier_id, organization_id")
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!user?.email) redirectWithUsersMessage("User is not available in this organization.", "error");

  const { error } = await adminSupabase.auth.admin.inviteUserByEmail(user.email, {
    data: { full_name: user.full_name, role: user.role, organization_id: organizationId, carrier_id: user.carrier_id },
  });
  if (error) redirectWithUsersMessage(error.message, "error");

  await writeAuditLog({ organizationId, actorUserId: session.userId, action: "user.invite_resent", entityType: "user", entityId: userId, metadata: { email: user.email, role: user.role } });
  revalidatePath("/users");
  redirectWithUsersMessage("Invite resent.", "success");
}

async function assertCarrierInOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  organizationId: string,
  carrierId: string,
) {
  const { data } = await supabase.from("carriers").select("id, organization_id").eq("id", carrierId).eq("organization_id", organizationId).maybeSingle();
  if (!data || !canAssignCarrierToUser(session, organizationId, data.organization_id)) {
    redirectWithUsersMessage("Carrier assignment must belong to this organization.", "error");
  }
}

async function createUserNotification(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  userId: string,
  title: string,
  message: string,
  priority: "low" | "medium" | "high" | "critical",
) {
  await supabase.from("notifications").upsert({
    organization_id: organizationId,
    title,
    message,
    category: "user_operation",
    priority,
    status: "unread",
    rule_key: `user_operation:${title}:${userId}`,
    metadata: { user_id: userId },
  }, { onConflict: "organization_id,rule_key" });
}

function normalizeRole(value: string): UserRole {
  return roles.includes(value as UserRole) ? (value as UserRole) : "carrier";
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) redirectWithUsersMessage("An organization is required before managing users.", "error");
  return session.organizationId;
}

function redirectWithUsersMessage(message: string, type: "success" | "error"): never {
  redirect(`/users?${type}=${encodeURIComponent(message)}`);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}
