"use server";

import { revalidatePath } from "next/cache";
import { getCarriers } from "@/lib/data/carriers";
import { createEmailDispatch, createWeeklySummaryEmail } from "@/lib/integrations/email-alerts";
import { requireStaffAccess } from "@/lib/integrations/auth";
import { generateComplianceNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationReadAction(formData: FormData) {
  await updateNotificationStatus(String(formData.get("notificationId") ?? ""), "read");
}

export async function dismissNotificationAction(formData: FormData) {
  await updateNotificationStatus(String(formData.get("notificationId") ?? ""), "dismissed");
}

export async function assignNotificationToMeAction(formData: FormData) {
  const session = await requireStaffAccess();
  const supabase = await createClient();
  const notificationId = String(formData.get("notificationId") ?? "");

  if (supabase && isUuid(notificationId)) {
    await supabase
      .from("notifications")
      .update({ assigned_to: session.userId })
      .eq("id", notificationId);
  }

  revalidatePath("/");
}

export async function syncComplianceNotificationsAction() {
  await requireStaffAccess();

  const supabase = await createClient();
  const carriers = await getCarriers();
  const notifications = generateComplianceNotifications(carriers);

  if (!supabase) {
    revalidatePath("/");
    return;
  }

  const payload = notifications.map((notification) => ({
    carrier_id: notification.carrierId,
    document_name: notification.documentName,
    title: notification.title,
    message: notification.message,
    category: notification.category,
    priority: notification.priority,
    status: notification.status,
    due_date: notification.dueDate,
    rule_key: notification.ruleKey,
  }));

  if (payload.length) {
    await supabase
      .from("notifications")
      .upsert(payload, { onConflict: "rule_key", ignoreDuplicates: true });
  }

  revalidatePath("/");
  return;
}

export async function sendWeeklyComplianceSummaryAction() {
  const session = await requireStaffAccess();
  const carriers = await getCarriers();
  const notifications = generateComplianceNotifications(carriers);
  const email = createWeeklySummaryEmail({
    carriers,
    notifications,
    recipientName: session.fullName || "Manifest compliance team",
  });

  await createEmailDispatch({
    to: session.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    category: "weekly_summary",
  });
}

async function updateNotificationStatus(notificationId: string, status: "read" | "dismissed") {
  const session = await requireStaffAccess();
  const supabase = await createClient();
  const timestamp = new Date().toISOString();

  if (supabase && isUuid(notificationId)) {
    await supabase
      .from("notifications")
      .update({
        status,
        read_at: status === "read" ? timestamp : null,
        dismissed_at: status === "dismissed" ? timestamp : null,
        dismissed_by: status === "dismissed" ? session.userId : null,
      })
      .eq("id", notificationId);
  }

  revalidatePath("/");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
