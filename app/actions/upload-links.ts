"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDocumentMimeType, validateDocumentFile } from "@/lib/integrations/uploads";
import { requireStaffAccess } from "@/lib/integrations/auth";
import { getPublicUploadDocumentStatuses, getPublicUploadLink, type PublicUploadLink, type UploadDocumentCategory } from "@/lib/data/upload-links";
import { hashUploadToken } from "@/lib/security/upload-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUploadPacketSections, isCompletedUploadStatus, uploadPacketStatusKey } from "@/lib/upload-packet";
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
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const link = await getPublicUploadLink(token);
  const adminSupabase = createAdminClient();

  if (!link?.isUsable) redirectToUpload(token, "This upload link is expired, revoked, or invalid.", "error");
  if (!adminSupabase) redirectToUpload(token, "Uploads are temporarily unavailable.", "error");
  if (STORAGE_BUCKET !== "carrier-documents") {
    console.warn("[upload-link] public upload misconfigured storage bucket", {
      expectedBucket: "carrier-documents",
      configuredBucket: STORAGE_BUCKET,
      linkId: link.id,
      category,
    });
    redirectToUpload(token, "Uploads are temporarily unavailable. Ask Manifest to verify storage settings.", "error");
  }
  if (!uploadCategories.has(category) || !link.allowedDocumentCategories.includes(category)) {
    redirectToUpload(token, "This upload link does not allow that document category.", "error");
  }
  if (!documentName) redirectToUpload(token, "Document name is required.", "error");
  if (!files.length) redirectToUpload(token, "Choose one or more files before uploading.", "error");

  for (const file of files) {
    if (file.size > MAX_PUBLIC_UPLOAD_BYTES) redirectToUpload(token, `${file.name} must be 10 MB or smaller.`, "error", documentName);
    try {
      validateDocumentFile(file);
    } catch (error) {
      redirectToUpload(token, error instanceof Error ? error.message : "Unsupported file type.", "error", documentName);
    }
  }

  const ownerId = getOwnerIdForCategory(link, category);
  if (!ownerId) redirectToUpload(token, "This upload link is missing the required owner record for that category.", "error");

  let storagePath: string | null = null;
  const documentSlug = slugify(documentName);
  const targetTable = documentTableForCategory(category);
  const uploadedFileNames: string[] = [];
  let latestDocumentId: string | null = null;

  try {
    let versionNumber = await nextVersionNumber(category, link, documentName);

    for (const file of files) {
      const fileName = sanitizeFileName(file.name);
      storagePath = buildStoragePath(category, link.organizationId, ownerId, documentName, versionNumber, fileName);
      const uploadData = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await adminSupabase.storage.from(STORAGE_BUCKET).upload(storagePath, uploadData, {
        contentType: getDocumentMimeType(file),
        upsert: false,
      });

      if (uploadError) {
        throw new PublicUploadError(uploadError.message, "storage_upload", {
          supabaseErrorCode: getSupabaseErrorCode(uploadError),
          supabaseErrorMessage: uploadError.message,
          table: "storage.objects",
        });
      }

      latestDocumentId = await finalizePublicDocument({
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

      uploadedFileNames.push(fileName);

      await appendAuditLog({
        organizationId: link.organizationId,
        actorUserId: null,
        action: "public_document.uploaded",
        entityType: `${category}_document`,
        entityId: latestDocumentId,
        metadata: { upload_link_id: link.id, carrier_id: link.carrierId, owner_id: ownerId, category, document_name: documentName, storage_path: storagePath, file_name: fileName },
      });

      versionNumber += 1;
    }

    const { error: usageError } = await adminSupabase
      .from("upload_links")
      .update({ last_used_at: new Date().toISOString(), use_count: link.useCount + files.length })
      .eq("id", link.id);
    if (usageError) {
      throw new PublicUploadError(usageError.message, "usage_update", {
        supabaseErrorCode: usageError.code,
        supabaseErrorMessage: usageError.message,
        table: "upload_links",
      });
    }

    await appendAuditLog({
      organizationId: link.organizationId,
      actorUserId: null,
      action: "upload_link.used",
      entityType: "upload_link",
      entityId: link.id,
      metadata: { carrier_id: link.carrierId, category, document_name: documentName, file_count: files.length, file_names: uploadedFileNames },
    });

    await maybeNotifyCompletedUploadPacket(adminSupabase, link);
  } catch (error) {
    const failure = normalizePublicUploadError(error);
    console.warn("[upload-link] public upload failed", {
      stage: failure.stage,
      category,
      linkId: link.id,
      carrierId: link.carrierId,
      ownerId,
      documentName,
      documentSlug,
      targetTable,
      failedTable: failure.table ?? targetTable,
      storageBucket: STORAGE_BUCKET,
      storagePathPrefix: storagePath ? storagePathPrefix(storagePath) : null,
      supabaseErrorCode: failure.supabaseErrorCode,
      supabaseErrorMessage: failure.supabaseErrorMessage,
      message: failure.logMessage,
    });
    redirectToUpload(token, failure.userMessage, "error", documentName);
  }

  revalidatePath(`/carriers/${link.carrierId}`);
  revalidatePath("/audit-readiness");
  revalidatePath("/documents-to-fix");
  redirectToUpload(token, `${files.length} file${files.length === 1 ? "" : "s"} submitted for ${documentName}. You can continue uploading the remaining requested documents.`, "success", documentName);
}

async function maybeNotifyCompletedUploadPacket(
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>,
  link: PublicUploadLink,
) {
  const categories = link.allowedDocumentCategories.filter((category) => category === "carrier" || (category === "driver" && link.driverId) || (category === "vehicle" && link.equipmentId));
  const sections = getUploadPacketSections(categories, link.driverName, link.equipmentName);
  const requestedKeys = sections.flatMap((section) => section.documents.map((documentName) => uploadPacketStatusKey(section.category, documentName)));
  if (!requestedKeys.length) return;

  const statuses = await getPublicUploadDocumentStatuses(link);
  const statusByKey = new Map(statuses.map((status) => [uploadPacketStatusKey(status.category, status.documentName), status]));
  const completed = requestedKeys.filter((key) => {
    const status = statusByKey.get(key);
    return status ? isCompletedUploadStatus(status) : false;
  });
  if (completed.length !== requestedKeys.length) return;

  await adminSupabase.from("notifications").upsert({
    organization_id: link.organizationId,
    carrier_id: link.carrierId,
    document_name: "Carrier intake packet",
    type: "upload_packet.completed",
    title: "Carrier upload packet completed",
    message: `${link.carrierName} completed the requested document upload packet. Review the submitted files before approving compliance records.`,
    category: "user_operation",
    priority: "medium",
    severity: "medium",
    status: "unread",
    related_entity_type: "upload_link",
    related_entity_id: link.id,
    related_url: "/document-review",
    rule_key: `upload_packet:${link.id}:completed`,
    metadata: {
      carrier_id: link.carrierId,
      upload_link_id: link.id,
      completed_count: completed.length,
      requested_count: requestedKeys.length,
    },
  }, { onConflict: "organization_id,rule_key" });
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
  if (!adminSupabase) {
    throw new PublicUploadError("Supabase service role is required.", "configuration", {
      table: documentTableForCategory(input.category),
    });
  }
  const uploadedAt = new Date().toISOString();
  const status = getDocumentDatabaseStatus(true, input.expirationDate);

  if (input.category === "carrier") {
    const { data: existing, error: existingError } = await adminSupabase
      .from("carrier_documents")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("carrier_id", input.carrierId)
      .eq("document_name", input.documentName)
      .maybeSingle();

    if (existingError) {
      throw new PublicUploadError(existingError.message, "document_lookup", {
        supabaseErrorCode: existingError.code,
        supabaseErrorMessage: existingError.message,
        table: "carrier_documents",
      });
    }

    const payload = {
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
      review_status: "pending_review",
      review_note: null,
      internal_review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      replacement_requested_at: null,
    };

    const { data, error } = existing
      ? await adminSupabase
        .from("carrier_documents")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single()
      : await adminSupabase
      .from("carrier_documents")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) {
      throw new PublicUploadError(error?.message || "Unable to save carrier document.", "document_upsert", {
        supabaseErrorCode: error?.code,
        supabaseErrorMessage: error?.message,
        table: "carrier_documents",
      });
    }

    const { error: versionError } = await adminSupabase.from("carrier_document_versions").insert({
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

    if (versionError) {
      throw new PublicUploadError(versionError.message, "document_version_insert", {
        supabaseErrorCode: versionError.code,
        supabaseErrorMessage: versionError.message,
        table: "carrier_document_versions",
      });
    }

    return data.id;
  }

  const table = input.category === "driver" ? "driver_documents" : "equipment_documents";
  const idColumn = input.category === "driver" ? "driver_id" : "equipment_id";
  const { data: existing, error: existingError } = await adminSupabase
    .from(table)
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq(idColumn, input.ownerId)
    .eq("document_name", input.documentName)
    .maybeSingle();

  if (existingError) {
    throw new PublicUploadError(existingError.message, "document_lookup", {
      supabaseErrorCode: existingError.code,
      supabaseErrorMessage: existingError.message,
      table,
    });
  }

  const payload = {
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
    review_status: "pending_review",
    review_note: null,
    internal_review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    replacement_requested_at: null,
  };

  const { data, error } = existing
    ? await adminSupabase
      .from(table)
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single()
    : await adminSupabase
    .from(table)
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw new PublicUploadError(error?.message || "Unable to save document.", "document_upsert", {
      supabaseErrorCode: error?.code,
      supabaseErrorMessage: error?.message,
      table,
    });
  }
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
  const { error } = await adminSupabase.from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata,
  });

  if (error) {
    console.warn("[upload-link] audit log insert failed", {
      stage: "audit_log_insert",
      table: "audit_logs",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      supabaseErrorCode: error.code,
      supabaseErrorMessage: error.message,
    });
  }
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

function documentTableForCategory(category: UploadDocumentCategory) {
  if (category === "carrier") return "carrier_documents";
  if (category === "driver") return "driver_documents";
  return "equipment_documents";
}

function storagePathPrefix(storagePath: string) {
  return storagePath.split("/").slice(0, -1).join("/");
}

function getSupabaseErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "string" || typeof statusCode === "number" ? String(statusCode) : null;
  }

  return null;
}

async function buildUploadUrl(token: string) {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredAppUrl) {
    return `${configuredAppUrl.replace(/\/+$/, "")}/upload/${token}`;
  }

  console.warn("[upload-link] NEXT_PUBLIC_APP_URL is not configured. Falling back to request host for generated upload link.");
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

function redirectToUpload(token: string, message: string, type: "success" | "error", documentName?: string | null): never {
  const params = new URLSearchParams({ [type]: message });
  if (documentName) params.set("document", slugify(documentName));
  redirect(`/upload/${token}?${params.toString()}`);
}

class PublicUploadError extends Error {
  constructor(
    message: string,
    public stage: string,
    public details: {
      table?: string;
      supabaseErrorCode?: string | null;
      supabaseErrorMessage?: string | null;
    } = {},
  ) {
    super(message);
    this.name = "PublicUploadError";
  }
}

function normalizePublicUploadError(error: unknown) {
  const stage = error instanceof PublicUploadError ? error.stage : "finalization";
  const logMessage = error instanceof Error ? error.message : "Unknown public upload error.";
  const userMessage = publicUploadUserMessage(stage);
  const details = error instanceof PublicUploadError ? error.details : {};

  return {
    stage,
    logMessage,
    userMessage,
    table: details.table,
    supabaseErrorCode: details.supabaseErrorCode,
    supabaseErrorMessage: details.supabaseErrorMessage,
  };
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
