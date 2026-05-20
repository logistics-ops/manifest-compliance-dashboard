"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { getLoads } from "@/lib/data/loads";
import { upsertLoadNotification } from "@/lib/data/load-notifications";
import { createEmailDispatch, createPodDeliveryEmail } from "@/lib/integrations/email-alerts";
import { requireSession, requireStaffAccess } from "@/lib/integrations/auth";
import {
  assertLoadDocumentStoragePath,
  canDeleteArchivedLoadFiles,
  canCreateLoadRecord,
  canManageLoadRecord,
  canUploadLoadDocumentType,
  getLoadDocumentStorageFolder,
} from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";
import type { LoadDocumentType, LoadStatus } from "@/types/load";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";
const loadStatuses: LoadStatus[] = ["booked", "in_transit", "delivered", "pod_uploaded", "pod_sent", "invoiced", "cancelled"];
const documentTypes: LoadDocumentType[] = ["rate_confirmation", "pod"];

export async function createLoadAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const organizationId = requireOrganizationId(session);
  const carrierId = session.role === "carrier" && !session.platformSuperAdmin
    ? session.carrierId ?? ""
    : getString(formData, "carrierId");
  const loadNumber = getString(formData, "loadNumber");
  const originCity = getString(formData, "originCity");
  const originState = getString(formData, "originState").toUpperCase();
  const destinationCity = getString(formData, "destinationCity");
  const destinationState = getString(formData, "destinationState").toUpperCase();
  const rateAmount = Number(getString(formData, "rateAmount") || 0);

  if (!supabase) {
    redirectWithCreateError("Supabase is not configured. Check the project environment variables.");
  }

  if (!carrierId || !loadNumber || !originCity || !originState || !destinationCity || !destinationState) {
    redirectWithCreateError("Load number, carrier, origin, and destination are required.");
  }

  if (!canCreateLoadRecord(session, { organizationId, carrierId })) {
    redirectWithCreateError("You can only create loads for your authorized carrier profile.");
  }

  if (!Number.isFinite(rateAmount) || rateAmount < 0) {
    redirectWithCreateError("Rate amount must be a valid non-negative number.");
  }

  const { data: carrier, error: carrierError } = await supabase
    .from("carriers")
    .select("id, company_name")
    .eq("id", carrierId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (carrierError || !carrier) {
    redirectWithCreateError("Selected carrier is not available in your organization.");
  }

  const payload = {
    organization_id: organizationId,
    load_number: loadNumber,
    carrier_id: carrierId,
    driver_name: getOptionalString(formData, "driverName"),
    broker_name: getOptionalString(formData, "brokerName"),
    broker_email: getOptionalString(formData, "brokerEmail"),
    origin_city: originCity,
    origin_state: originState,
    destination_city: destinationCity,
    destination_state: destinationState,
    pickup_date: getOptionalString(formData, "pickupDate"),
    delivery_date: getOptionalString(formData, "deliveryDate"),
    rate_amount: rateAmount,
    status: normalizeStatus(getString(formData, "status")),
    notes: getOptionalString(formData, "notes"),
    created_by: session.userId,
  };

  const { data, error } = await supabase.from("loads").insert(payload).select("id").single();

  if (error || !data) {
    console.error("Unable to create load", error?.message);
    redirectWithCreateError(error?.message || "Unable to create load. Check the load details and try again.");
  }

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "load.created",
    entityType: "load",
    entityId: data.id,
    metadata: {
      load_number: payload.load_number,
      carrier_id: carrierId,
      carrier_name: carrier.company_name,
      new_status: payload.status,
    },
  });

  revalidatePath("/loads");
  revalidatePath(`/loads/${data.id}`);
  redirect(`/loads/${data.id}`);
}

export async function updateLoadStatusAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const loadId = getString(formData, "loadId");
  const status = normalizeStatus(getString(formData, "status"));

  if (!supabase || !loadId) redirectWithLoadMessage(loadId, "Supabase is not configured.", "error");

  const load = await assertCanEditLoad(supabase, session, loadId);
  const { error } = await supabase.from("loads").update({ status }).eq("id", loadId).eq("organization_id", load.organizationId);

  if (error) {
    redirectWithLoadMessage(loadId, error.message, "error");
  }

  await writeAuditLog({
    organizationId: load.organizationId,
    actorUserId: session.userId,
    action: "load.status_changed",
    entityType: "load",
    entityId: loadId,
    metadata: {
      load_number: load.loadNumber,
      carrier_id: load.carrierId,
      carrier_name: load.carrierName,
      previous_status: load.status,
      new_status: status,
    },
  });

  revalidateLoad(loadId);
  redirectWithLoadMessage(loadId, "Load status updated.", "success");
}

export async function updateLoadDetailsAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const loadId = getString(formData, "loadId");
  const rateAmount = Number(getString(formData, "rateAmount") || 0);

  if (!supabase || !loadId) redirectWithLoadMessage(loadId, "Supabase is not configured.", "error");

  const load = await assertCanEditLoad(supabase, session, loadId);
  const payload = {
    load_number: getString(formData, "loadNumber"),
    driver_name: getOptionalString(formData, "driverName"),
    broker_name: getOptionalString(formData, "brokerName"),
    broker_email: getOptionalString(formData, "brokerEmail"),
    origin_city: getString(formData, "originCity"),
    origin_state: getString(formData, "originState").toUpperCase(),
    destination_city: getString(formData, "destinationCity"),
    destination_state: getString(formData, "destinationState").toUpperCase(),
    pickup_date: getOptionalString(formData, "pickupDate"),
    delivery_date: getOptionalString(formData, "deliveryDate"),
    rate_amount: rateAmount,
    notes: getOptionalString(formData, "notes"),
  };

  if (!payload.load_number || !payload.origin_city || !payload.origin_state || !payload.destination_city || !payload.destination_state) {
    redirectWithLoadMessage(loadId, "Load number, origin, and destination are required.", "error");
  }

  if (!Number.isFinite(rateAmount) || rateAmount < 0) {
    redirectWithLoadMessage(loadId, "Rate amount must be a valid non-negative number.", "error");
  }

  const { error } = await supabase
    .from("loads")
    .update(payload)
    .eq("id", loadId)
    .eq("organization_id", load.organizationId);

  if (error) {
    redirectWithLoadMessage(loadId, error.message, "error");
  }

  await writeAuditLog({
    organizationId: load.organizationId,
    actorUserId: session.userId,
    action: "load.updated",
    entityType: "load",
    entityId: loadId,
    metadata: {
      load_number: payload.load_number,
      carrier_id: load.carrierId,
      carrier_name: load.carrierName,
    },
  });

  revalidateLoad(loadId);
  redirectWithLoadMessage(loadId, "Load details updated.", "success");
}

export async function createLoadDocumentUploadTargetAction(input: {
  loadId: string;
  documentType: LoadDocumentType;
  fileName: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const loadId = input.loadId.trim();
  const documentType = normalizeDocumentType(input.documentType);
  const fileName = sanitizeFileName(input.fileName);

  if (!supabase || !loadId || !fileName) {
    throw new Error("Supabase Storage is not configured for uploads.");
  }

  const load = await assertCanUploadLoadDocument(supabase, session, loadId, documentType);
  const { data: latestVersion } = await supabase
    .from("load_documents")
    .select("version_number")
    .eq("organization_id", load.organizationId)
    .eq("load_id", loadId)
    .eq("document_type", documentType)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = Number(latestVersion?.version_number ?? 0) + 1;
  const storagePath = `organizations/${load.organizationId}/loads/${loadId}/${getLoadDocumentStorageFolder(documentType)}/v${versionNumber}/${Date.now()}-${fileName}`;

  return {
    bucket: STORAGE_BUCKET,
    path: storagePath,
    versionNumber,
  };
}

export async function finalizeLoadDocumentUploadAction(input: {
  loadId: string;
  documentType: LoadDocumentType;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  versionNumber: number;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  if (!supabase) throw new Error("Supabase is not configured.");

  const documentType = normalizeDocumentType(input.documentType);
  const load = await assertCanUploadLoadDocument(supabase, session, input.loadId, documentType);
  assertLoadDocumentStoragePath(input.storagePath, load.organizationId, input.loadId, documentType);

  const { data, error } = await supabase.from("load_documents").insert({
    organization_id: load.organizationId,
    load_id: input.loadId,
    carrier_id: load.carrierId,
    document_type: documentType,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    version_number: input.versionNumber,
    uploaded_by: session.userId,
  }).select("id").single();

  if (error || !data) throw new Error(error?.message || "Unable to save load document.");

  if (documentType === "pod") {
    await supabase
      .from("loads")
      .update({ status: "pod_uploaded" })
      .eq("id", input.loadId)
      .eq("organization_id", load.organizationId)
      .neq("status", "pod_sent");
  }

  await writeAuditLog({
    organizationId: load.organizationId,
    actorUserId: session.userId,
    action: documentType === "pod" ? "load.pod_uploaded" : "load.rate_confirmation_uploaded",
    entityType: "load_document",
    entityId: data.id,
    metadata: {
      load_id: input.loadId,
      load_number: load.loadNumber,
      carrier_id: load.carrierId,
      carrier_name: load.carrierName,
      document_type: documentType,
      file_name: input.fileName,
      version_number: input.versionNumber,
    },
  });

  await upsertLoadNotification({
    session,
    load,
    kind: documentType === "pod" ? "pod_uploaded" : "rate_confirmation_uploaded",
    priority: documentType === "pod" ? "medium" : "low",
    documentType,
    fileName: input.fileName,
  });

  revalidateLoad(input.loadId);

  return { uploadedAt: new Date().toISOString(), uploadedBy: session.fullName || session.email };
}

export async function sendPodToBrokerAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const loadId = getString(formData, "loadId");

  if (!supabase || !loadId) redirectWithLoadMessage(loadId, "Supabase is not configured.", "error");

  const load = await assertCanEditLoad(supabase, session, loadId);
  if (!load.brokerEmail) redirectWithLoadMessage(loadId, "Broker email is required before sending POD.", "error");

  const loads = await getLoads();
  const fullLoad = loads.find((item) => item.id === loadId);
  const pod = fullLoad?.documents.find((document) => document.documentType === "pod");
  if (!fullLoad || !pod) redirectWithLoadMessage(loadId, "Upload a POD before sending it to the broker.", "error");

  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(pod.storagePath, 60 * 60 * 24 * 7);
  if (!data?.signedUrl) redirectWithLoadMessage(loadId, "Unable to create POD link.", "error");
  const carrierEmail = load.carrierEmail || null;

  const email = createPodDeliveryEmail({
    brokerName: fullLoad.brokerName,
    loadNumber: fullLoad.loadNumber,
    carrierName: fullLoad.carrierName,
    origin: `${fullLoad.originCity}, ${fullLoad.originState}`,
    destination: `${fullLoad.destinationCity}, ${fullLoad.destinationState}`,
    deliveryDate: fullLoad.deliveryDate,
    podUrl: data.signedUrl,
  });

  try {
    await createEmailDispatch({
      to: load.brokerEmail,
      cc: carrierEmail,
      from: "pod@manifestgl.com",
      subject: email.subject,
      html: email.html,
      text: email.text,
      category: "pod_delivery",
    });
  } catch (emailError) {
    redirectWithLoadMessage(
      loadId,
      emailError instanceof Error ? emailError.message : "Unable to send POD email with Resend.",
      "error",
    );
  }

  const { error: updateError } = await supabase
    .from("loads")
    .update({ status: "pod_sent", pod_sent_at: new Date().toISOString(), pod_sent_by: session.userId })
    .eq("id", loadId)
    .eq("organization_id", load.organizationId);

  if (updateError) {
    redirectWithLoadMessage(loadId, updateError.message, "error");
  }

  await writeAuditLog({
    organizationId: load.organizationId,
    actorUserId: session.userId,
    action: "load.pod_sent",
    entityType: "load",
    entityId: loadId,
    metadata: {
      load_number: fullLoad.loadNumber,
      carrier_id: load.carrierId,
      carrier_name: fullLoad.carrierName,
      previous_status: fullLoad.status,
      new_status: "pod_sent",
      broker_email: load.brokerEmail,
      cc: carrierEmail ? [carrierEmail] : [],
      carrier_email: carrierEmail,
      carrier_email_missing: !carrierEmail,
    },
  });

  await upsertLoadNotification({
    session,
    load: { ...load, carrierName: fullLoad.carrierName },
    kind: "pod_sent",
    priority: "medium",
  });

  revalidateLoad(loadId);
  redirectWithLoadMessage(
    loadId,
    carrierEmail ? "Sent to broker and CC’d carrier" : "Sent to broker. Carrier email missing.",
    "success",
  );
}

export async function markLoadsArchivedAction(formData: FormData) {
  const session = await requireStaffAccess();
  const supabase = await createClient();
  const ids = getString(formData, "loadIds").split(",").map((id) => id.trim()).filter(Boolean);

  if (!supabase) redirectWithArchiveMessage("Supabase is not configured.", "error");
  if (!ids.length) redirectWithArchiveMessage("No loads matched the archive request.", "error");

  const loads = await getLoads();
  const authorized = loads.filter((load) => ids.includes(load.id) && canManageLoadRecord(session, { organizationId: load.organizationId, carrierId: load.carrierId }));
  if (!authorized.length) redirectWithArchiveMessage("No authorized loads matched the archive request.", "error");

  const archivedAt = new Date().toISOString();
  const { error } = await supabase
    .from("loads")
    .update({ archived_at: archivedAt, archived_by: session.userId })
    .in("id", authorized.map((load) => load.id));

  if (error) redirectWithArchiveMessage(error.message, "error");

  await Promise.all(authorized.map(async (load) => {
    await writeAuditLog({
      organizationId: load.organizationId,
      actorUserId: session.userId,
      action: "load.archive_status_changed",
      entityType: "load",
      entityId: load.id,
      metadata: {
        load_number: load.loadNumber,
        carrier_id: load.carrierId,
        carrier_name: load.carrierName,
        archived_at: archivedAt,
      },
    });
    await upsertLoadNotification({
      session,
      load,
      kind: "load_archived",
      priority: "low",
    });
  }));

  revalidatePath("/loads");
  redirectWithArchiveMessage(`${authorized.length} load${authorized.length === 1 ? "" : "s"} marked archived.`, "success");
}

export async function deleteArchivedLoadFilesAction(formData: FormData) {
  const session = await requireStaffAccess();
  const supabase = await createClient();
  const ids = getString(formData, "loadIds").split(",").map((id) => id.trim()).filter(Boolean);
  const confirmed = getString(formData, "confirmDelete") === "CONFIRM";

  if (!supabase) redirectWithArchiveMessage("Supabase is not configured.", "error");
  if (!confirmed) redirectWithArchiveMessage("Type CONFIRM to confirm storage deletion.", "error");
  if (!ids.length) redirectWithArchiveMessage("No archived loads matched the deletion request.", "error");

  const loads = await getLoads();
  const authorized = loads.filter((load) =>
    ids.includes(load.id) &&
    load.archivedAt &&
    !load.filesDeletedAt &&
    canDeleteArchivedLoadFiles(session, { organizationId: load.organizationId, carrierId: load.carrierId }),
  );
  const paths = authorized.flatMap((load) => load.documents.map((document) => document.storagePath).filter(Boolean));

  if (!paths.length) redirectWithArchiveMessage("No archived document files were available for deletion.", "error");

  const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (removeError) redirectWithArchiveMessage(removeError.message, "error");

  const deletedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("loads")
    .update({ files_deleted_at: deletedAt })
    .in("id", authorized.map((load) => load.id));

  if (updateError) redirectWithArchiveMessage(updateError.message, "error");

  await Promise.all(authorized.map((load) => writeAuditLog({
    organizationId: load.organizationId,
    actorUserId: session.userId,
    action: "load.archive_files_deleted",
    entityType: "load",
    entityId: load.id,
    metadata: {
      load_number: load.loadNumber,
      carrier_id: load.carrierId,
      carrier_name: load.carrierName,
      file_count: load.documents.length,
      files_deleted_at: deletedAt,
    },
  })));

  revalidatePath("/loads");
  redirectWithArchiveMessage(`${paths.length} archived file${paths.length === 1 ? "" : "s"} deleted from storage.`, "success");
}

type LoadAuthTarget = {
  id: string;
  organizationId: string;
  carrierId: string;
  loadNumber: string;
  brokerEmail: string;
  carrierName: string;
  carrierEmail: string;
  status: LoadStatus;
};

async function assertCanUploadLoadDocument(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  loadId: string,
  documentType: LoadDocumentType,
): Promise<LoadAuthTarget> {
  const load = await getLoadAuthTarget(supabase, loadId);
  if (
    !load ||
    !canUploadLoadDocumentType(
      session,
      { organizationId: load.organizationId, carrierId: load.carrierId },
      documentType,
    )
  ) {
    throw new Error("Load documents are only available for authorized load records.");
  }
  return load;
}

async function assertCanManageLoad(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  loadId: string,
): Promise<LoadAuthTarget> {
  const load = await getLoadAuthTarget(supabase, loadId);
  if (!load || !canManageLoadRecord(session, { organizationId: load.organizationId, carrierId: load.carrierId })) {
    throw new Error("Load management is only available inside your organization.");
  }
  return load;
}

async function assertCanEditLoad(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  loadId: string,
): Promise<LoadAuthTarget> {
  const load = await getLoadAuthTarget(supabase, loadId);
  if (!load || !canCreateLoadRecord(session, { organizationId: load.organizationId, carrierId: load.carrierId })) {
    throw new Error("Load editing is only available for authorized load records.");
  }
  return load;
}

async function getLoadAuthTarget(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  loadId: string,
): Promise<LoadAuthTarget | null> {
  const { data } = await supabase
    .from("loads")
    .select("id, organization_id, carrier_id, load_number, broker_email, status, carriers!loads_organization_carrier_fkey(company_name, email)")
    .eq("id", loadId)
    .maybeSingle();

  if (!data) return null;

  const carrier = Array.isArray(data.carriers) ? data.carriers[0] : data.carriers;
  return {
    id: data.id,
    organizationId: data.organization_id,
    carrierId: data.carrier_id,
    loadNumber: data.load_number,
    brokerEmail: data.broker_email ?? "",
    carrierName: carrier?.company_name ?? "Carrier",
    carrierEmail: carrier?.email ?? "",
    status: data.status,
  };
}

function revalidateLoad(loadId: string) {
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) throw new Error("An organization is required before managing loads.");
  return session.organizationId;
}

function normalizeStatus(value: string): LoadStatus {
  return loadStatuses.includes(value as LoadStatus) ? (value as LoadStatus) : "booked";
}

function normalizeDocumentType(value: string): LoadDocumentType {
  return documentTypes.includes(value as LoadDocumentType) ? (value as LoadDocumentType) : "rate_confirmation";
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/(^-|-$)/g, "");
}

function redirectWithCreateError(message: string): never {
  redirect(`/loads/new?error=${encodeURIComponent(message)}`);
}

function redirectWithLoadMessage(loadId: string, message: string, type: "success" | "error"): never {
  const target = loadId ? `/loads/${loadId}` : "/loads";
  redirect(`${target}?${type}=${encodeURIComponent(message)}`);
}

function redirectWithArchiveMessage(message: string, type: "success" | "error"): never {
  redirect(`/loads?${type}=${encodeURIComponent(message)}`);
}
