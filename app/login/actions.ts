"use server";

import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentSession } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = sanitizeRedirect(String(formData.get("redirectTo") ?? "/"));
  const supabase = await createClient();

  if (!supabase) {
    redirect(redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Invalid email or password")}`);
  }

  if (data.user) {
    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", data.user.id)
      .maybeSingle();

    await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);

    await writeAuditLog({
      organizationId: profile?.organization_id ?? null,
      actorUserId: data.user.id,
      action: "user.login",
      entityType: "user",
      entityId: data.user.id,
      metadata: { email },
    });
  }

  redirect(redirectTo);
}

export async function logoutAction() {
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (supabase) {
    if (session) {
      await writeAuditLog({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "user.logout",
        entityType: "user",
        entityId: session.userId,
        metadata: { email: session.email },
      });
    }

    await supabase.auth.signOut();
  }

  redirect("/login");
}

function sanitizeRedirect(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
