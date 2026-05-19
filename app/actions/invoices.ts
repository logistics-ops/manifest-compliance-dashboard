"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { getInvoice, getInvoicesForLoad } from "@/lib/data/invoices";
import { upsertInvoiceNotification } from "@/lib/data/invoice-notifications";
import { getLoad } from "@/lib/data/loads";
import { createInvoiceDeliveryEmail, createEmailDispatch } from "@/lib/integrations/email-alerts";
import { requireSession } from "@/lib/integrations/auth";
import { createInvoicePdf } from "@/lib/invoices/pdf";
import {
  assertInvoiceStoragePath,
  canAccessInvoiceRecord,
  canGenerateInvoiceRecord,
  canSendInvoiceRecord,
  canUpdateInvoiceStatusRecord,
} from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";
import type { Invoice } from "@/types/invoice";
import type { Load } from "@/types/load";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

export async function generateInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const loadId = getString(formData, "loadId");
  const notes = getString(formData, "notes");
  if (!supabase || !loadId) redirectWithLoadMessage(loadId, "Supabase is not configured.", "error");

  const load = await requireLoadAccess(loadId, session, "generate");
  const hasPod = load.documents.some((document) => document.documentType === "pod");
  if (!hasPod && load.status !== "pod_sent") redirectWithLoadMessage(loadId, "Upload a POD before generating an invoice.", "error");

  const existing = await getInvoicesForLoad(loadId);
  const versionNumber = existing.length + 1;
  const invoiceNumber = `INV-${load.loadNumber}-${String(versionNumber).padStart(2, "0")}`.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const dueDate = load.deliveryDate ? addDays(load.deliveryDate, 30) : addDays(invoiceDate, 30);
  const pdf = createInvoicePdf({ organizationName: session.organizationName, invoiceNumber, invoiceDate, dueDate, load, notes });
  const fileName = `${invoiceNumber}.pdf`;
  const storagePath = `organizations/${load.organizationId}/loads/${load.id}/invoices/v${versionNumber}/${Date.now()}-${fileName}`;
  assertInvoiceStoragePath(storagePath, load.organizationId, load.id);

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) redirectWithLoadMessage(loadId, uploadError.message, "error");

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: load.organizationId,
      carrier_id: load.carrierId,
      load_id: load.id,
      invoice_number: invoiceNumber,
      broker_name: load.brokerName,
      broker_email: load.brokerEmail,
      invoice_date: invoiceDate,
      due_date: dueDate,
      subtotal: load.rateAmount,
      total_amount: load.rateAmount,
      notes,
      storage_path: storagePath,
      file_name: fileName,
      version_number: versionNumber,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) redirectWithLoadMessage(loadId, error?.message || "Unable to generate invoice.", "error");

  const invoice = { id: data.id, organizationId: load.organizationId, carrierId: load.carrierId, loadId: load.id, invoiceNumber, loadNumber: load.loadNumber, carrierName: load.carrierName };
  await writeAuditLog({
    organizationId: load.organizationId,
    actorUserId: session.userId,
    action: "invoice.generated",
    entityType: "invoice",
    entityId: data.id,
    metadata: { invoice_number: invoiceNumber, load_id: load.id, load_number: load.loadNumber, carrier_id: load.carrierId, carrier_name: load.carrierName },
  });
  await writeAuditLog({
    organizationId: load.organizationId,
    actorUserId: session.userId,
    action: "invoice.generated",
    entityType: "load",
    entityId: load.id,
    metadata: { invoice_id: data.id, invoice_number: invoiceNumber, load_number: load.loadNumber, carrier_id: load.carrierId, carrier_name: load.carrierName },
  });
  await upsertInvoiceNotification({ session, invoice, kind: "invoice_generated", priority: "medium" });

  revalidateInvoicePaths(load.id, data.id);
  redirect(`/invoices/${data.id}?success=${encodeURIComponent("Invoice generated.")}`);
}

export async function sendInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const invoiceId = getString(formData, "invoiceId");
  if (!supabase || !invoiceId) redirectWithInvoiceMessage(invoiceId, "Supabase is not configured.", "error");

  const invoice = await requireInvoiceAccess(invoiceId, session, "send");
  const load = await getLoad(invoice.loadId);
  if (!load) redirectWithInvoiceMessage(invoiceId, "Load not found.", "error");
  if (!invoice.brokerEmail) redirectWithInvoiceMessage(invoiceId, "Broker email is required before sending invoice.", "error");
  if (!invoice.storagePath) redirectWithInvoiceMessage(invoiceId, "Generate the invoice PDF before sending.", "error");

  const invoiceUrl = await signedUrl(supabase, invoice.storagePath, 60 * 60 * 24 * 7);
  const pod = load.documents.find((document) => document.documentType === "pod");
  const podUrl = pod ? await signedUrl(supabase, pod.storagePath, 60 * 60 * 24 * 7) : null;
  const email = createInvoiceDeliveryEmail({
    invoiceNumber: invoice.invoiceNumber,
    loadNumber: load.loadNumber,
    brokerName: invoice.brokerName,
    carrierName: invoice.carrierName,
    origin: `${load.originCity}, ${load.originState}`,
    destination: `${load.destinationCity}, ${load.destinationState}`,
    deliveryDate: load.deliveryDate,
    totalAmount: invoice.totalAmount,
    invoiceUrl,
    podUrl,
  });

  try {
    await createEmailDispatch({
      to: invoice.brokerEmail,
      from: "pod@manifestgl.com",
      subject: email.subject,
      html: email.html,
      text: email.text,
      category: "invoice_delivery",
    });
  } catch (error) {
    redirectWithInvoiceMessage(invoiceId, error instanceof Error ? error.message : "Unable to send invoice.", "error");
  }

  const sentAt = new Date().toISOString();
  const action = invoice.sentAt ? "invoice.resent" : "invoice.sent";
  const { error: updateError } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: sentAt })
    .eq("id", invoice.id)
    .eq("organization_id", invoice.organizationId);
  if (updateError) redirectWithInvoiceMessage(invoiceId, updateError.message, "error");

  await writeAuditLog({
    organizationId: invoice.organizationId,
    actorUserId: session.userId,
    action,
    entityType: "invoice",
    entityId: invoice.id,
    metadata: invoiceMetadata(invoice),
  });
  await writeAuditLog({
    organizationId: invoice.organizationId,
    actorUserId: session.userId,
    action,
    entityType: "load",
    entityId: invoice.loadId,
    metadata: invoiceMetadata(invoice),
  });
  await upsertInvoiceNotification({ session, invoice, kind: "invoice_sent", priority: "medium" });

  revalidateInvoicePaths(invoice.loadId, invoice.id);
  redirectWithInvoiceMessage(invoiceId, invoice.sentAt ? "Invoice resent." : "Invoice sent.", "success");
}

export async function markInvoicePaidAction(formData: FormData) {
  await updateInvoiceStatus(formData, "paid", "invoice.paid", "Invoice marked paid.");
}

export async function voidInvoiceAction(formData: FormData) {
  await updateInvoiceStatus(formData, "void", "invoice.voided", "Invoice voided.");
}

async function updateInvoiceStatus(formData: FormData, status: "paid" | "void", action: "invoice.paid" | "invoice.voided", message: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const invoiceId = getString(formData, "invoiceId");
  if (!supabase || !invoiceId) redirectWithInvoiceMessage(invoiceId, "Supabase is not configured.", "error");

  const invoice = await requireInvoiceAccess(invoiceId, session, "status");
  const payload = status === "paid" ? { status, paid_at: new Date().toISOString() } : { status };
  const { error } = await supabase.from("invoices").update(payload).eq("id", invoice.id).eq("organization_id", invoice.organizationId);
  if (error) redirectWithInvoiceMessage(invoiceId, error.message, "error");

  await writeAuditLog({ organizationId: invoice.organizationId, actorUserId: session.userId, action, entityType: "invoice", entityId: invoice.id, metadata: invoiceMetadata(invoice) });
  await writeAuditLog({ organizationId: invoice.organizationId, actorUserId: session.userId, action, entityType: "load", entityId: invoice.loadId, metadata: invoiceMetadata(invoice) });
  if (status === "paid") await upsertInvoiceNotification({ session, invoice, kind: "invoice_paid", priority: "low" });

  revalidateInvoicePaths(invoice.loadId, invoice.id);
  redirectWithInvoiceMessage(invoiceId, message, "success");
}

async function requireLoadAccess(loadId: string, session: AuthSession, mode: "generate") {
  const load = await getLoad(loadId);
  if (!load || (mode === "generate" && !canGenerateInvoiceRecord(session, { organizationId: load.organizationId, carrierId: load.carrierId }))) {
    redirectWithLoadMessage(loadId, "Invoice generation is only available for authorized loads.", "error");
  }
  return load;
}

async function requireInvoiceAccess(invoiceId: string, session: AuthSession, mode: "access" | "send" | "status") {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) redirect("/unauthorized");
  const access = { organizationId: invoice.organizationId, carrierId: invoice.carrierId };
  const allowed = mode === "send"
    ? canSendInvoiceRecord(session, access)
    : mode === "status"
      ? canUpdateInvoiceStatusRecord(session, access)
      : canAccessInvoiceRecord(session, access);
  if (!allowed) redirect("/unauthorized");
  return invoice;
}

async function signedUrl(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, path: string, expiresIn: number) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Unable to create signed invoice link.");
  return data.signedUrl;
}

function invoiceMetadata(invoice: Pick<Invoice, "invoiceNumber" | "loadId" | "loadNumber" | "carrierId" | "carrierName" | "brokerEmail">) {
  return {
    invoice_number: invoice.invoiceNumber,
    load_id: invoice.loadId,
    load_number: invoice.loadNumber,
    carrier_id: invoice.carrierId,
    carrier_name: invoice.carrierName,
    broker_email: invoice.brokerEmail,
  };
}

function revalidateInvoicePaths(loadId: string, invoiceId: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithLoadMessage(loadId: string, message: string, type: "success" | "error"): never {
  redirect(`/loads/${loadId}?${type}=${encodeURIComponent(message)}`);
}

function redirectWithInvoiceMessage(invoiceId: string, message: string, type: "success" | "error"): never {
  redirect(`/invoices/${invoiceId}?${type}=${encodeURIComponent(message)}`);
}
