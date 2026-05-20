"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { getFuelReceipt } from "@/lib/data/fuel";
import { extractFuelReceipt, getMissingFuelReceiptFields } from "@/lib/integrations/receipt-extraction";
import { requireSession } from "@/lib/integrations/auth";
import {
  assertFuelReceiptStoragePath,
  canApproveFuelReceiptRecord,
  canManageFuelReceiptRecord,
  getFuelReceiptStoragePrefix,
} from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";
import type { FuelExtractionStatus } from "@/types/fuel";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxReceiptBytes = 12 * 1024 * 1024;

export async function createFuelReceiptAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const organizationId = requireOrganizationId(session);
  const carrierId = session.role === "carrier" && !session.platformSuperAdmin
    ? session.carrierId ?? ""
    : getString(formData, "carrierId");
  const file = formData.get("receiptFile");

  if (!supabase) redirectWithNewFuelMessage("Supabase is not configured.", "error");
  if (!carrierId) redirectWithNewFuelMessage("A carrier is required for this fuel receipt.", "error");
  if (!canManageFuelReceiptRecord(session, { organizationId, carrierId })) {
    redirectWithNewFuelMessage("You can only upload fuel receipts for your authorized carrier.", "error");
  }
  if (!(file instanceof File) || file.size === 0) {
    redirectWithNewFuelMessage("Upload a fuel receipt image or PDF.", "error");
  }
  validateReceiptFile(file);

  const carrier = await getAuthorizedCarrier(supabase, organizationId, carrierId);
  if (!carrier) redirectWithNewFuelMessage("Selected carrier is not available in your organization.", "error");

  const loadId = getOptionalString(formData, "loadId");
  if (loadId) {
    const loadAllowed = await isAuthorizedLoad(supabase, organizationId, carrierId, loadId);
    if (!loadAllowed) redirectWithNewFuelMessage("Selected load is not available for this carrier.", "error");
  }

  const receiptId = randomUUID();
  const fileName = sanitizeFileName(file.name || "fuel-receipt");
  const versionNumber = 1;
  const storagePath = `${getFuelReceiptStoragePrefix(organizationId, carrierId, receiptId)}v${versionNumber}/${Date.now()}-${fileName}`;
  assertFuelReceiptStoragePath(storagePath, organizationId, carrierId, receiptId);

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) redirectWithNewFuelMessage(uploadError.message, "error");

  let extraction = await extractFuelReceipt({
    fileName,
    mimeType: file.type,
    fileSize: file.size,
    storagePath,
  });
  const simpleCarrierUpload = session.role === "carrier" && !session.platformSuperAdmin;
  const missingFields = simpleCarrierUpload ? getMissingSimpleFuelFields(extraction) : getMissingFuelReceiptFields(extraction);
  if (missingFields.length) extraction = { ...extraction, status: "needs_review" };

  const { error } = await supabase.from("fuel_receipts").insert({
    id: receiptId,
    organization_id: organizationId,
    carrier_id: carrierId,
    load_id: loadId,
    driver_id: getOptionalString(formData, "driverId"),
    vehicle_id: getOptionalString(formData, "vehicleId"),
    receipt_file_path: storagePath,
    file_name: fileName,
    vendor_name: extraction.vendorName,
    transaction_date: extraction.transactionDate,
    transaction_time: extraction.transactionTime,
    fuel_type: extraction.fuelType,
    gallons: extraction.gallons,
    price_per_gallon: extraction.pricePerGallon,
    total_amount: extraction.totalAmount,
    city: extraction.city,
    state: extraction.state,
    odometer: extraction.odometer,
    card_last4: extraction.cardLast4,
    extraction_status: extraction.status,
    extraction_confidence: extraction.confidence,
    raw_extraction: extraction.raw,
    notes: getOptionalString(formData, "notes"),
    uploaded_by: session.userId,
  });

  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    redirectWithNewFuelMessage(error.message, "error");
  }

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "fuel_receipt.uploaded",
    entityType: "fuel_receipt",
    entityId: receiptId,
    metadata: {
      carrier_id: carrierId,
      carrier_name: carrier.company_name,
      file_name: fileName,
      extraction_status: extraction.status,
      missing_fields: missingFields,
    },
  });

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: extraction.status === "failed" ? "fuel_receipt.extraction_failed" : "fuel_receipt.extraction_completed",
    entityType: "fuel_receipt",
    entityId: receiptId,
    metadata: {
      carrier_id: carrierId,
      carrier_name: carrier.company_name,
      confidence: extraction.confidence,
      missing_fields: missingFields,
    },
  });

  await upsertFuelNotification(supabase, organizationId, carrierId, receiptId, extraction.status, missingFields);
  revalidatePath("/fuel");
  redirect(`/fuel/${receiptId}?success=${encodeURIComponent(simpleCarrierUpload ? "Fuel receipt uploaded. Review the receipt details and save." : "Fuel receipt uploaded. Review the AI extracted fields before approving.")}`);
}

export async function updateFuelReceiptAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const receiptId = getString(formData, "receiptId");
  const intent = getString(formData, "intent");

  if (!supabase || !receiptId) redirectWithFuelMessage(receiptId, "Supabase is not configured.", "error");

  const current = await getFuelReceipt(receiptId);
  if (!current || !canManageFuelReceiptRecord(session, { organizationId: current.organizationId, carrierId: current.carrierId })) {
    redirect("/unauthorized");
  }

  const approving = intent === "approve";
  const simpleCarrierReview = session.role === "carrier" && !session.platformSuperAdmin;
  if (approving && !canApproveFuelReceiptRecord(session, { organizationId: current.organizationId, carrierId: current.carrierId })) {
    redirectWithFuelMessage(receiptId, "Only admins and staff can approve fuel receipts.", "error");
  }

  const payload = {
    load_id: simpleCarrierReview ? current.loadId : getOptionalString(formData, "loadId"),
    driver_id: simpleCarrierReview ? current.driverId : getOptionalString(formData, "driverId"),
    vehicle_id: simpleCarrierReview ? current.vehicleId : getOptionalString(formData, "vehicleId"),
    vendor_name: simpleCarrierReview ? current.vendorName || null : getOptionalString(formData, "vendorName"),
    transaction_date: getOptionalString(formData, "transactionDate"),
    transaction_time: simpleCarrierReview ? current.transactionTime : getOptionalString(formData, "transactionTime"),
    fuel_type: normalizeFuelType(getOptionalString(formData, "fuelType")),
    gallons: simpleCarrierReview ? current.gallons || null : getOptionalNumber(formData, "gallons"),
    price_per_gallon: simpleCarrierReview ? current.pricePerGallon || null : getOptionalNumber(formData, "pricePerGallon"),
    total_amount: getOptionalNumber(formData, "totalAmount"),
    city: simpleCarrierReview ? current.city || null : getOptionalString(formData, "city"),
    state: simpleCarrierReview ? current.state || null : getOptionalString(formData, "state")?.toUpperCase() ?? null,
    odometer: simpleCarrierReview ? current.odometer : getOptionalNumber(formData, "odometer"),
    payment_method: simpleCarrierReview ? current.paymentMethod || null : getOptionalString(formData, "paymentMethod"),
    card_last4: simpleCarrierReview ? current.cardLast4 || null : getOptionalString(formData, "cardLast4"),
    notes: getOptionalString(formData, "notes"),
    extraction_status: approving ? "approved" : normalizeReviewStatus(getString(formData, "extractionStatus")),
    approved_by: approving ? session.userId : current.approvedBy,
    approved_at: approving ? new Date().toISOString() : current.approvedAt,
    updated_at: new Date().toISOString(),
  };

  if (payload.load_id) {
    const loadAllowed = await isAuthorizedLoad(supabase, current.organizationId, current.carrierId, payload.load_id);
    if (!loadAllowed) redirectWithFuelMessage(receiptId, "Selected load is not available for this carrier.", "error");
  }

  const { error } = await supabase
    .from("fuel_receipts")
    .update(payload)
    .eq("id", receiptId)
    .eq("organization_id", current.organizationId);

  if (error) redirectWithFuelMessage(receiptId, error.message, "error");

  await writeAuditLog({
    organizationId: current.organizationId,
    actorUserId: session.userId,
    action: approving ? "fuel_receipt.approved" : "fuel_receipt.edited",
    entityType: "fuel_receipt",
    entityId: receiptId,
    metadata: {
      carrier_id: current.carrierId,
      carrier_name: current.carrierName,
      previous_status: current.extractionStatus,
      new_status: payload.extraction_status,
      vendor_name: payload.vendor_name,
      total_amount: payload.total_amount,
      state: payload.state,
    },
  });

  if (approving) {
    await upsertFuelNotification(supabase, current.organizationId, current.carrierId, receiptId, "approved", []);
  }

  revalidatePath("/fuel");
  revalidatePath(`/fuel/${receiptId}`);
  redirectWithFuelMessage(receiptId, approving ? "Fuel receipt approved." : "Fuel receipt saved.", "success");
}

async function getAuthorizedCarrier(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
) {
  const { data } = await supabase
    .from("carriers")
    .select("id, company_name")
    .eq("id", carrierId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

async function isAuthorizedLoad(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
  loadId: string,
) {
  const { data } = await supabase
    .from("loads")
    .select("id")
    .eq("id", loadId)
    .eq("organization_id", organizationId)
    .eq("carrier_id", carrierId)
    .maybeSingle();
  return Boolean(data);
}

async function upsertFuelNotification(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
  receiptId: string,
  status: FuelExtractionStatus,
  missingFields: string[],
) {
  const ruleKey = `fuel_receipt:${status}:${receiptId}`;
  const title = status === "failed"
    ? "Fuel receipt extraction failed"
    : status === "approved"
      ? "Fuel receipt approved"
      : missingFields.length
        ? "Fuel receipt needs review"
        : "Fuel receipt extracted";
  const priority = status === "failed" || missingFields.length ? "high" : "low";

  await supabase.from("notifications").upsert({
    organization_id: organizationId,
    carrier_id: carrierId,
    title,
    message: missingFields.length
      ? `Review missing fields: ${missingFields.join(", ")}.`
      : status === "approved"
        ? "Fuel receipt was approved for reporting."
        : "AI extraction completed. Review before approving.",
    category: "fuel_operation",
    priority,
    status: "unread",
    rule_key: ruleKey,
    metadata: { receipt_id: receiptId, extraction_status: status, missing_fields: missingFields },
  }, { onConflict: "organization_id,rule_key" });
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) throw new Error("An organization is required before managing fuel receipts.");
  return session.organizationId;
}

function validateReceiptFile(file: File) {
  if (!allowedMimeTypes.has(file.type)) {
    redirectWithNewFuelMessage("Fuel receipts must be JPG, PNG, WebP, or PDF files.", "error");
  }
  if (file.size > maxReceiptBytes) {
    redirectWithNewFuelMessage("Fuel receipt files must be 12MB or smaller.", "error");
  }
}

function normalizeReviewStatus(value: string): FuelExtractionStatus {
  return value === "approved" || value === "failed" || value === "pending" || value === "extracted" ? value : "needs_review";
}

function normalizeFuelType(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "diesel") return "Diesel";
  if (normalized === "reefer") return "Reefer";
  if (normalized === "def") return "DEF";
  if (normalized === "gasoline" || normalized === "unleaded") return "Gasoline";
  return "Other";
}

function getMissingSimpleFuelFields(extraction: Awaited<ReturnType<typeof extractFuelReceipt>>) {
  const fields = [
    ["transactionDate", extraction.transactionDate],
    ["fuelType", extraction.fuelType],
    ["totalAmount", extraction.totalAmount],
  ] as const;
  return fields.filter(([, value]) => !value).map(([field]) => field);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getOptionalNumber(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/(^-|-$)/g, "");
}

function redirectWithNewFuelMessage(message: string, type: "success" | "error"): never {
  redirect(`/fuel/new?${type}=${encodeURIComponent(message)}`);
}

function redirectWithFuelMessage(receiptId: string, message: string, type: "success" | "error"): never {
  redirect(`/fuel/${receiptId}?${type}=${encodeURIComponent(message)}`);
}
