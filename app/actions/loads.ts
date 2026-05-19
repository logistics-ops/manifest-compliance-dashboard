"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { getLoads } from "@/lib/data/loads";
import { createEmailDispatch, createPodDeliveryEmail } from "@/lib/integrations/email-alerts";
import { requireSession, requireStaffAccess } from "@/lib/integrations/auth";
import {
  assertLoadDocumentStoragePath,
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
    .select("id")
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
    metadata: { loadNumber: payload.load_number, carrierId },
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
    metadata: { status },
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
    metadata: { loadNumber: payload.load_number },
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
    metadata: { loadId: input.loadId, loadNumber: load.loadNumber, documentType, versionNumber: input.versionNumber },
  });

  revalidateLoad(input.loadId);

  return { uploadedAt: new Date().toISOString(), uploadedBy: session.fullName || session.email };
}

export async function sendPodToBrokerAction(formData: FormData) {
  const session = await requireStaffAccess();
  const supabase = await createClient();
  const loadId = getString(formData, "loadId");

  if (!supabase || !loadId) return;

  const load = await assertCanManageLoad(supabase, session, loadId);
  if (!load.brokerEmail) throw new Error("Broker email is required before sending POD.");

  const loads = await getLoads();
  const fullLoad = loads.find((item) => item.id === loadId);
  const pod = fullLoad?.documents.find((document) => document.documentType === "pod");
  if (!fullLoad || !pod) throw new Error("Upload a POD before sending it to the broker.");

  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(pod.storagePath, 60 * 60 * 24 * 7);
  if (!data?.signedUrl) throw new Error("Unable to create POD link.");

  const email = createPodDeliveryEmail({
    brokerName: fullLoad.brokerName,
    loadNumber: fullLoad.loadNumber,
    carrierName: fullLoad.carrierName,
    origin: `${fullLoad.originCity}, ${fullLoad.originState}`,
    destination: `${fullLoad.destinationCity}, ${fullLoad.destinationState}`,
    deliveryDate: fullLoad.deliveryDate,
    podUrl: data.signedUrl,
  });

  await createEmailDispatch({
    to: load.brokerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    category: "pod_delivery",
  });

  await supabase
    .from("loads")
    .update({ status: "pod_sent", pod_sent_at: new Date().toISOString(), pod_sent_by: session.userId })
    .eq("id", loadId)
    .eq("organization_id", load.organizationId);

  await writeAuditLog({
    organizationId: load.organizationId,
    actorUserId: session.userId,
    action: "load.pod_sent",
    entityType: "load",
    entityId: loadId,
    metadata: { loadNumber: fullLoad.loadNumber, brokerEmail: load.brokerEmail },
  });

  revalidateLoad(loadId);
}

type LoadAuthTarget = {
  id: string;
  organizationId: string;
  carrierId: string;
  loadNumber: string;
  brokerEmail: string;
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
    .select("id, organization_id, carrier_id, load_number, broker_email")
    .eq("id", loadId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    organizationId: data.organization_id,
    carrierId: data.carrier_id,
    loadNumber: data.load_number,
    brokerEmail: data.broker_email ?? "",
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
