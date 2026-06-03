"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { requireSession } from "@/lib/integrations/auth";
import {
  assertInspectionStoragePath,
  canManageInspectionRecord,
  canUploadInspectionDocumentRecord,
} from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

export async function createInspectionAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const organizationId = requireOrganizationId(session);
  const carrierId = getString(formData, "carrierId");
  const driverId = getOptionalString(formData, "driverId");
  const equipmentId = getOptionalString(formData, "equipmentId");
  const inspectionDate = getString(formData, "inspectionDate");
  const inspectionType = getString(formData, "inspectionType");
  const location = getOptionalString(formData, "location");
  const violations = getOptionalString(formData, "violations");
  const outOfService = formData.get("outOfService") === "on";
  const notes = getOptionalString(formData, "notes");

  if (!supabase) redirectWithInspectionMessage("Supabase is not configured.", "error");
  if (!carrierId || !inspectionDate || !inspectionType) {
    redirectWithInspectionMessage("Carrier, inspection date, and inspection type are required.", "error");
  }

  const carrier = await assertCarrierInOrganization(supabase, organizationId, carrierId);
  if (!canManageInspectionRecord(session, { organizationId, carrierId: carrier.id })) {
    redirectWithInspectionMessage("Inspection creation requires admin or staff access.", "error");
  }
  if (driverId) await assertDriverInCarrier(supabase, organizationId, carrier.id, driverId);
  if (equipmentId) await assertEquipmentInCarrier(supabase, organizationId, carrier.id, equipmentId);

  const { data, error } = await supabase
    .from("inspection_reports")
    .insert({
      organization_id: organizationId,
      carrier_id: carrier.id,
      driver_id: driverId,
      equipment_id: equipmentId,
      inspection_date: inspectionDate,
      inspection_type: inspectionType,
      location,
      violations,
      out_of_service: outOfService,
      notes,
      status: violations || outOfService ? "needs_review" : "open",
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) redirectWithInspectionMessage(error?.message || "Unable to create inspection report.", "error");

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "inspection.created",
    entityType: "inspection",
    entityId: data.id,
    metadata: {
      carrier_id: carrier.id,
      carrier_name: carrier.companyName,
      driver_id: driverId,
      equipment_id: equipmentId,
      inspection_date: inspectionDate,
      inspection_type: inspectionType,
      out_of_service: outOfService,
      has_violations: Boolean(violations),
    },
  });

  if (violations || outOfService) {
    await upsertInspectionAlert(supabase, {
      organizationId,
      carrierId: carrier.id,
      inspectionId: data.id,
      carrierName: carrier.companyName,
      outOfService,
      violations,
    });
    await writeAuditLog({
      organizationId,
      actorUserId: session.userId,
      action: "inspection.alert_created",
      entityType: "inspection",
      entityId: data.id,
      metadata: { carrier_id: carrier.id, out_of_service: outOfService, has_violations: Boolean(violations) },
    });
  }

  revalidateInspections();
  redirect(`/inspections/${data.id}?success=${encodeURIComponent("Inspection report created.")}`);
}

export async function createInspectionDocumentUploadTargetAction(input: {
  inspectionId: string;
  documentName: string;
  fileName: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const inspectionId = input.inspectionId.trim();
  const documentName = input.documentName.trim();
  const fileName = sanitizeFileName(input.fileName);

  if (!supabase || !inspectionId || !documentName || !fileName) {
    throw new Error("Supabase Storage is not configured for inspection uploads.");
  }

  const inspection = await assertCanUploadInspectionDocument(supabase, session, inspectionId);
  const { count } = await supabase
    .from("inspection_documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", inspection.organizationId)
    .eq("inspection_id", inspection.id)
    .eq("document_name", documentName);
  const versionNumber = Number(count ?? 0) + 1;
  const storagePath = `organizations/${inspection.organizationId}/inspections/${inspection.id}/${slugify(documentName)}/v${versionNumber}/${Date.now()}-${fileName}`;

  return {
    bucket: STORAGE_BUCKET,
    path: storagePath,
    versionNumber,
  };
}

export async function finalizeInspectionDocumentUploadAction(input: {
  inspectionId: string;
  documentName: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  versionNumber: number;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  if (!supabase) throw new Error("Supabase is not configured.");

  const inspection = await assertCanUploadInspectionDocument(supabase, session, input.inspectionId);
  assertInspectionStoragePath(input.storagePath, inspection.organizationId, inspection.id);

  const { data, error } = await supabase
    .from("inspection_documents")
    .insert({
      organization_id: inspection.organizationId,
      inspection_id: inspection.id,
      carrier_id: inspection.carrierId,
      document_name: input.documentName,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_size: input.fileSize,
      mime_type: input.mimeType,
      uploaded_by: session.userId,
    })
    .select("id, uploaded_at")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to save inspection document metadata.");

  await writeAuditLog({
    organizationId: inspection.organizationId,
    actorUserId: session.userId,
    action: "inspection.document_uploaded",
    entityType: "inspection",
    entityId: inspection.id,
    metadata: {
      inspection_id: inspection.id,
      inspection_type: inspection.inspectionType,
      carrier_id: inspection.carrierId,
      document_id: data.id,
      document_name: input.documentName,
      file_name: input.fileName,
      file_size: input.fileSize,
      mime_type: input.mimeType,
      version_number: input.versionNumber,
      storage_path: input.storagePath,
    },
  });

  revalidateInspections(inspection.id);
  return { id: data.id, uploadedAt: data.uploaded_at as string };
}

async function assertCanUploadInspectionDocument(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  inspectionId: string,
) {
  const { data, error } = await supabase
    .from("inspection_reports")
    .select("id, organization_id, carrier_id, inspection_type")
    .eq("id", inspectionId)
    .maybeSingle();

  if (
    error ||
    !data ||
    !canUploadInspectionDocumentRecord(session, {
      organizationId: data.organization_id,
      carrierId: data.carrier_id,
    })
  ) {
    throw new Error("Inspection document uploads are only available for authorized inspection records.");
  }

  return {
    id: data.id as string,
    organizationId: data.organization_id as string,
    carrierId: data.carrier_id as string,
    inspectionType: data.inspection_type as string,
  };
}

async function assertCarrierInOrganization(
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
  if (!data) redirectWithInspectionMessage("Carrier must belong to this organization.", "error");
  return { id: data.id as string, companyName: data.company_name as string };
}

async function assertDriverInCarrier(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
  driverId: string,
) {
  const { data } = await supabase
    .from("drivers")
    .select("id")
    .eq("id", driverId)
    .eq("organization_id", organizationId)
    .eq("carrier_id", carrierId)
    .maybeSingle();
  if (!data) redirectWithInspectionMessage("Driver must belong to the selected carrier.", "error");
}

async function assertEquipmentInCarrier(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  organizationId: string,
  carrierId: string,
  equipmentId: string,
) {
  const { data } = await supabase
    .from("equipment")
    .select("id")
    .eq("id", equipmentId)
    .eq("organization_id", organizationId)
    .eq("carrier_id", carrierId)
    .maybeSingle();
  if (!data) redirectWithInspectionMessage("Vehicle must belong to the selected carrier.", "error");
}

async function upsertInspectionAlert(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  input: {
    organizationId: string;
    carrierId: string;
    inspectionId: string;
    carrierName: string;
    outOfService: boolean;
    violations: string | null;
  },
) {
  await supabase.from("notifications").upsert({
    organization_id: input.organizationId,
    carrier_id: input.carrierId,
    document_name: "Inspection Report",
    type: "inspection_report",
    title: input.outOfService ? "Out-of-service inspection requires review" : "Inspection violations require review",
    message: `${input.carrierName} has an inspection report with ${input.outOfService ? "an out-of-service issue" : "violations"} requiring compliance follow-up.`,
    category: "high_risk_carrier",
    priority: input.outOfService ? "critical" : "high",
    severity: input.outOfService ? "critical" : "high",
    status: "unread",
    related_entity_type: "inspection",
    related_entity_id: input.inspectionId,
    related_url: `/inspections/${input.inspectionId}`,
    rule_key: `inspection:${input.inspectionId}:review`,
    metadata: {
      inspection_id: input.inspectionId,
      carrier_id: input.carrierId,
      out_of_service: input.outOfService,
      violations: input.violations,
    },
  }, { onConflict: "organization_id,rule_key" });
}

function requireOrganizationId(session: AuthSession) {
  if (!session.organizationId) redirectWithInspectionMessage("An organization is required before managing inspections.", "error");
  return session.organizationId;
}

function revalidateInspections(inspectionId?: string) {
  revalidatePath("/");
  revalidatePath("/inspections");
  revalidatePath("/compliance-alerts");
  revalidatePath("/compliance-tasks");
  revalidatePath("/notifications");
  if (inspectionId) revalidatePath(`/inspections/${inspectionId}`);
}

function redirectWithInspectionMessage(message: string, type: "success" | "error"): never {
  redirect(`/inspections?${type}=${encodeURIComponent(message)}`);
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
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/(^-|-$)/g, "");
}
