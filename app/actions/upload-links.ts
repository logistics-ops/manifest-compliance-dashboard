"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDocumentMimeType, validateDocumentFile } from "@/lib/integrations/uploads";
import { requireStaffAccess } from "@/lib/integrations/auth";
import { getPublicUploadLink, type UploadDocumentCategory } from "@/lib/data/upload-links";
import { hashUploadToken } from "@/lib/security/upload-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";
const MAX_PUBLIC_UPLOAD_BYTES = 10 * 1024 * 1024;
const uploadCategories = new Set<UploadDocumentCategory>(["carrier", "driver", "vehicle"]);

export async function createUploadLinkAction(formData: FormData) {
  const session = await requireStaffAccess();
  const organizationId = requireOrganizationId(session);
  const carrierId = getString(formData, "carrierId");
  const driverId = getOptionalString(formData, "driverId");
  const equipmentId = getOptionalString(formData, "equipmentId");
  const categories = getCategories(formData);
  const expiresInDays = Math.max(1, Math.min(Number(getString(formData, "expiresInDays") || 14), 60));
  const supabase = await createClient();

  if (!supabase || !carrierId) redirectToCarrier(carrierId, "Unable to create upload link. Supabase is not configured.", "error");
  await assertCarrierInOrganization(supabase, organizationId, carrierId);

  if (categories.includes("driver")) {
    if (!driverId) redirectToCarrier(carrierId, "Select a driver before allowing DQ uploads.", "error");
    await assertDriverInScope(supabase, organizationId, carrierId, driverId);
  }

  if (categories.includes("vehicle")) {
    if (!equipmentId) redirectToCarrier(carrierId, "Select a vehicle before allowing vehicle uploads.", "error");
    await assertEquipmentInScope(supabase, organizationId, carrierId, equipmentId);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
  const { data, error } = await supabase
    .from("upload_links")
    .insert({
      organization_id: organizationId,
      carrier_id: carrierId,
      driver_id: categories.includes("driver") ? driverId : null,
      equipment_id: categories.includes("vehicle") ? equipmentId : null,
      token_hash: hashUploadToken(token),
      allowed_document_categories: categories,
      expires_at: expiresAt,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) redirectToCarrier(carrierId, error?.message || "Unable to create upload link.", "error");

  await appendAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "upload_link.created",
    entityType: "upload_link",
    entityId: data.id,
    metadata: { carrier_id: carrierId, driver_id: driverId, equipment_id: equipmentId, categories, expires_at: expiresAt },
  });

  revalidateCarrier(carrierId);
  const link = await buildUploadUrl(token);
  redirect(`/carriers/${carrierId}?uploadLink=${encodeURIComponent(link)}`);
}

export async function revokeUploadLinkAction(formData: FormData) {
  const session = await requireStaffAccess();
  const organizationId = requireOrganizationId(session);
  const carrierId = getString(formData, "carrierId");
  const uploadLinkId = getString(formData, "uploadLinkId");
  const supabase = await createClient();

  if (!supabase || !uploadLinkId || !carrierId) redirectToCarrier(carrierId, "Unable to revoke upload link.", "error");

  const { data: existing } = await supabase
    .from("upload_links")
    .select("id, organization_id, carrier_id")
    .eq("id", uploadLinkId)
    .eq("organization_id", organizationId)
    .eq("carrier_id", carrierId)
    .maybeSingle();

  if (!existing) redirectToCarrier(carrierId, "Upload link is not available in this organization.", "error");

  const { error } = await supabase
    .from("upload_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", uploadLinkId)
    .eq("organization_id", organizationId);

  if (error) redirectToCarrier(carrierId, error.message, "error");

  await appendAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "upload_link.revoked",
    entityType: "upload_link",
    entityId: uploadLinkId,
    metadata: { carrier_id: carrierId },
  });

  revalidateCarrier(carrierId);
  redirectToCarrier(carrierId, "Upload link revoked.", "success");
}

export async function publicUploadDocumentAction(formData: FormData) {
  const token = getString(formData, "token");
  const category = getString(formData, "category") as UploadDocumentCategory;
  const documentName = getString(formData, "documentName");
  const expirationDate = getOptionalString(formData, "expirationDate");
  const notes = getOptionalString(formData, "notes");
  const file = formData.get("file");
  const link = await getPublicUploadLink(token);
  const adminSupabase = createAdminClient();
  const safeTokenHashPrefix = token ? hashUploadToken(token).slice(0, 12) : null;

  if (!link?.isUsable) redirectToUpload(token, "This upload link is expired, revoked, or invalid.", "error");
  if (!adminSupabase) redirectToUpload(token, "Uploads are temporarily unavailable.", "error");
  if (!uploadCategories.has(category) || !link.allowedDocumentCategories.includes(category)) {
    redirectToUpload(token, "This upload link does not allow that document category.", "error");
  }
  if (!documentName) redirectToUpload(token, "Document name is required.", "error");
  if (!(file instanceof File) || file.size === 0) redirectToUpload(token, "Choose a document file before uploading.", "error");
  if (file.size > MAX_PUBLIC_UPLOAD_BYTES) redirectToUpload(token, "File must be 10 MB or smaller.", "error");

  try {
    validateDocumentFile(file);
  } catch (error) {
    redirectToUpload(token, error instanceof Error ? error.message : "Unsupported file type.", "error");
  }

  const ownerId = getOwnerIdForCategory(link, category);
  if (!ownerId) redirectToUpload(token, "This upload link is missing the required owner record for that category.", "error");

  let storagePath: string | null = null;

  try {
    const versionNumber = await nextVersionNumber(category, link, documentName);
    const fileName = sanitizeFileName(file.name);
    storagePath = buildStoragePath(category, link.organizationId, ownerId, documentName, versionNumber, fileName);
    const uploadData = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminSupabase.storage.from(STORAGE_BUCKET).upload(storagePath, uploadData, {
      contentType: getDocumentMimeType(file),
      upsert: false,
    });

    if (uploadError) throw new PublicUploadError(uploadError.message, "storage_upload");

    const documentId = await finalizePublicDocument({
      category,
      organizationId: link.organizationId,
      carrierId: link.carrierId,
      ownerId,
      documentName,
      storagePath,
      fileName,
      fileSize: file.size,
      mimeType: getDocumentMimeType(file),
      expirationDate,
      notes,
      versionNumber,
    });

    const { error: usageError } = await adminSupabase
      .from("upload_links")
      .update({ last_used_at: new Date().toISOString(), use_count: link.useCount + 1 })
      .eq("id", link.id);
    if (usageError) throw new PublicUploadError(usageError.message, "usage_update");

    await appendAuditLog({
      organizationId: link.organizationId,
      actorUserId: null,
      action: "upload_link.used",
      entityType: "upload_link",
      entityId: link.id,
      metadata: { carrier_id: link.carrierId, category, document_name: documentName },
    });

    await appendAuditLog({
      organizationId: link.organizationId,
      actorUserId: null,
      action: "public_document.uploaded",
      entityType: `${category}_document`,
      entityId: documentId,
      metadata: { upload_link_id: link.id, carrier_id: link.carrierId, owner_id: ownerId, category, document_name: documentName, storage_path: storagePath, file_name: fileName },
    });
  } catch (error) {
    const failure = normalizePublicUploadError(error);
    console.warn("[upload-link] public upload failed", {
      safeTokenHashPrefix,
      stage: failure.stage,
      category,
      linkId: link.id,
      carrierId: link.carrierId,
      ownerId,
      storagePath,
      message: failure.logMessage,
    });
    redirectToUpload(token, failure.userMessage, "error");
  }

  revalidatePath(`/carriers/${link.carrierId}`);
  revalidatePath("/audit-readiness");
  revalidatePath("/documents-to-fix");
  redirectToUpload(token, "Document uploaded. Thank you.", "success");
}

async function finalizePublicDocument(input: {
  category: UploadDocumentCategory;
  organizationId: string;
  carrierId: string;
  ownerId: string;
  documentName: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expirationDate: string | null;
  notes: string | null;
  versionNumber: number;
}) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) throw new Error("Supabase service role is required.");
  const uploadedAt = new Date().toISOString();
  const status = getDocumentDatabaseStatus(true, input.expirationDate);

  if (input.category === "carrier") {
    const { data, error } = await adminSupabase
      .from("carrier_documents")
      .upsert({
        organization_id: input.organizationId,
        carrier_id: input.carrierId,
        document_name: input.documentName,
        storage_path: input.storagePath,
        file_name: input.fileName,
        file_size: input.fileSize,
        mime_type: input.mimeType,
        uploaded: true,
        expiration_date: input.expirationDate,
        notes: input.notes,
        uploaded_by: null,
        uploaded_at: uploadedAt,
        version_number: input.versionNumber,
        status,
      }, { onConflict: "organization_id,carrier_id,document_name" })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message || "Unable to save carrier document.");

    await adminSupabase.from("carrier_document_versions").insert({
      organization_id: input.organizationId,
      carrier_document_id: data.id,
      carrier_id: input.carrierId,
      document_name: input.documentName,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_size: input.fileSize,
      mime_type: input.mimeType,
      version_number: input.versionNumber,
      uploaded_by: null,
      uploaded_at: uploadedAt,
    });

    return data.id;
  }

  const table = input.category === "driver" ? "driver_documents" : "equipment_documents";
  const idColumn = input.category === "driver" ? "driver_id" : "equipment_id";
  const { data, error } = await adminSupabase
    .from(table)
    .upsert({
      organization_id: input.organizationId,
      [idColumn]: input.ownerId,
      document_name: input.documentName,
      storage_path: input.storagePath,
      uploaded: true,
      expiration_date: input.expirationDate,
      notes: input.notes,
      uploaded_by: null,
      uploaded_at: uploadedAt,
      status,
    }, { onConflict: `${idColumn},document_name` })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to save document.");
  return data.id;
}

async function nextVersionNumber(category: UploadDocumentCategory, link: Awaited<ReturnType<typeof getPublicUploadLink>> & {}, documentName: string) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase || !link) return 1;

  if (category === "carrier") {
    const { data } = await adminSupabase
      .from("carrier_documents")
      .select("version_number")
      .eq("organization_id", link.organizationId)
      .eq("carrier_id", link.carrierId)
      .eq("document_name", documentName)
      .maybeSingle();
    return Number(data?.version_number ?? 0) + 1;
  }

  const table = category === "driver" ? "driver_documents" : "equipment_documents";
  const idColumn = category === "driver" ? "driver_id" : "equipment_id";
  const ownerId = getOwnerIdForCategory(link, category);
  const { data } = await adminSupabase
    .from(table)
    .select("uploaded_at")
    .eq("organization_id", link.organizationId)
    .eq(idColumn, ownerId)
    .eq("document_name", documentName)
    .maybeSingle();
  return data ? 2 : 1;
}

async function appendAuditLog(input: {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
}) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) return;
  await adminSupabase.from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata,
  });
}

function getCategories(formData: FormData): UploadDocumentCategory[] {
  const categories = formData.getAll("allowedCategories").map(String).filter((value): value is UploadDocumentCategory => uploadCategories.has(value as UploadDocumentCategory));
  return categories.length ? categories : ["carrier"];
}

function getOwnerIdForCategory(link: NonNullable<Awaited<ReturnType<typeof getPublicUploadLink>>>, category: UploadDocumentCategory) {
  if (category === "carrier") return link.carrierId;
  if (category === "driver") return link.driverId;
  return link.equipmentId;
}

function buildStoragePath(category: UploadDocumentCategory, organizationId: string, ownerId: string, documentName: string, versionNumber: number, fileName: string) {
  const folder = category === "carrier" ? "carriers" : category === "driver" ? "drivers" : "equipment";
  return `organizations/${organizationId}/${folder}/${ownerId}/${slugify(documentName)}/v${versionNumber}/${Date.now()}-${fileName}`;
}

async function buildUploadUrl(token: string) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  return host ? `${protocol}://${host}/upload/${token}` : `/upload/${token}`;
}

async function assertCarrierInOrganization(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, organizationId: string, carrierId: string) {
  const { data } = await supabase.from("carriers").select("id").eq("organization_id", organizationId).eq("id", carrierId).maybeSingle();
  if (!data) redirectToCarrier(carrierId, "Carrier is not available in this organization.", "error");
}

async function assertDriverInScope(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, organizationId: string, carrierId: string, driverId: string) {
  const { data } = await supabase.from("drivers").select("id").eq("organization_id", organizationId).eq("carrier_id", carrierId).eq("id", driverId).maybeSingle();
  if (!data) redirectToCarrier(carrierId, "Selected driver does not belong to this carrier.", "error");
}

async function assertEquipmentInScope(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, organizationId: string, carrierId: string, equipmentId: string) {
  const { data } = await supabase.from("equipment").select("id").eq("organization_id", organizationId).eq("carrier_id", carrierId).eq("id", equipmentId).maybeSingle();
  if (!data) redirectToCarrier(carrierId, "Selected vehicle does not belong to this carrier.", "error");
}

function revalidateCarrier(carrierId: string) {
  revalidatePath("/");
  revalidatePath(`/carriers/${carrierId}`);
}

function redirectToCarrier(carrierId: string, message: string, type: "success" | "error"): never {
  redirect(`/carriers/${carrierId || ""}?${type}=${encodeURIComponent(message)}`);
}

function redirectToUpload(token: string, message: string, type: "success" | "error"): never {
  redirect(`/upload/${token}?${type}=${encodeURIComponent(message)}`);
}

class PublicUploadError extends Error {
  constructor(message: string, public stage: string) {
    super(message);
    this.name = "PublicUploadError";
  }
}

function normalizePublicUploadError(error: unknown) {
  const stage = error instanceof PublicUploadError ? error.stage : "finalization";
  const logMessage = error instanceof Error ? error.message : "Unknown public upload error.";
  const userMessage = publicUploadUserMessage(stage);

  return { stage, logMessage, userMessage };
}

function publicUploadUserMessage(stage: string) {
  if (stage === "storage_upload") {
    return "We could not store this file. Check the file type and size, then try again.";
  }

  if (stage === "usage_update") {
    return "The document was saved, but the upload link could not be marked used. Ask Manifest to review this upload.";
  }

  return "We could not finish saving this document. Ask Manifest to review the upload link and try again.";
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) {
    throw new Error("An organization is required before creating upload links.");
  }
  return session.organizationId;
}

function getDocumentDatabaseStatus(uploaded: boolean, expirationDate: string | null) {
  if (!uploaded) return "missing";
  if (!expirationDate) return "valid";
  const today = new Date();
  const expiration = new Date(`${expirationDate}T12:00:00`);
  const days = Math.ceil((expiration.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring_soon";
  return "valid";
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

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/(^-|-$)/g, "") || "document";
}
