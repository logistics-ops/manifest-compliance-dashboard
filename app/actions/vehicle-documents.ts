"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/integrations/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  assertEquipmentDocumentStoragePath,
  canManageEquipmentDocumentRecord,
} from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

export async function createVehicleDocumentUploadTargetAction(input: {
  equipmentId: string;
  documentName: string;
  fileName: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const equipmentId = input.equipmentId.trim();
  const documentName = input.documentName.trim();
  const fileName = sanitizeFileName(input.fileName);

  if (!supabase || !equipmentId || !documentName || !fileName) {
    throw new Error("Supabase Storage is not configured for uploads.");
  }

  const equipment = await assertCanManageVehicleDocument(supabase, session, equipmentId);
  const { data: currentDocument } = await supabase
    .from("equipment_documents")
    .select("storage_path")
    .eq("organization_id", equipment.organizationId)
    .eq("equipment_id", equipment.id)
    .eq("document_name", documentName)
    .maybeSingle();

  const versionNumber = parseStorageVersion(currentDocument?.storage_path ?? null) + 1;
  const storagePath = `organizations/${equipment.organizationId}/equipment/${equipment.id}/${slugify(documentName)}/v${versionNumber}/${Date.now()}-${fileName}`;

  return {
    bucket: STORAGE_BUCKET,
    path: storagePath,
    versionNumber,
  };
}

export async function finalizeVehicleDocumentUploadAction(input: {
  equipmentId: string;
  documentName: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  versionNumber: number;
  expirationDate: string | null;
  notes?: string | null;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const equipment = await assertCanManageVehicleDocument(supabase, session, input.equipmentId);
  assertEquipmentDocumentStoragePath(input.storagePath, equipment.organizationId, equipment.id);

  const uploadedAt = new Date().toISOString();
  const { data: existingDocument } = await supabase
    .from("equipment_documents")
    .select("id, expiration_date, storage_path")
    .eq("organization_id", equipment.organizationId)
    .eq("equipment_id", equipment.id)
    .eq("document_name", input.documentName)
    .maybeSingle();
  const status = getDocumentDatabaseStatus(true, input.expirationDate);

  const { data, error } = await supabase
    .from("equipment_documents")
    .upsert(
      {
        organization_id: equipment.organizationId,
        equipment_id: equipment.id,
        document_name: input.documentName,
        storage_path: input.storagePath,
        uploaded: true,
        expiration_date: input.expirationDate,
        notes: input.notes || null,
        uploaded_by: session.userId,
        uploaded_at: uploadedAt,
        status,
      },
      { onConflict: "equipment_id,document_name" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save uploaded vehicle document metadata.");
  }

  await writeAuditLog({
    organizationId: equipment.organizationId,
    actorUserId: session.userId,
    action: existingDocument?.storage_path ? "vehicle_document.replaced" : "vehicle_document.uploaded",
    entityType: "vehicle_document",
    entityId: data.id,
    metadata: {
      equipment_id: equipment.id,
      carrier_id: equipment.carrierId,
      document_name: input.documentName,
      file_name: input.fileName,
      file_size: input.fileSize,
      mime_type: input.mimeType,
      version_number: input.versionNumber,
      storage_path: input.storagePath,
    },
  });

  if ((existingDocument?.expiration_date ?? null) !== input.expirationDate) {
    await writeAuditLog({
      organizationId: equipment.organizationId,
      actorUserId: session.userId,
      action: "vehicle_document.expiration_changed",
      entityType: "vehicle_document",
      entityId: data.id,
      metadata: {
        equipment_id: equipment.id,
        carrier_id: equipment.carrierId,
        document_name: input.documentName,
        previous_expiration_date: existingDocument?.expiration_date ?? null,
        expiration_date: input.expirationDate,
        file_name: input.fileName,
        storage_path: input.storagePath,
      },
    });
  }

  revalidateVehicles(equipment.id);
  return {
    id: data.id,
    uploadedAt,
  };
}

async function assertCanManageVehicleDocument(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  equipmentId: string,
) {
  const { data, error } = await supabase
    .from("equipment")
    .select("id, organization_id, carrier_id")
    .eq("id", equipmentId)
    .maybeSingle();

  if (
    error ||
    !data ||
    !canManageEquipmentDocumentRecord(session, {
      organizationId: data.organization_id,
      carrierId: data.carrier_id,
      equipmentId: data.id,
    })
  ) {
    throw new Error("Vehicle document uploads are only available for authorized equipment.");
  }

  return {
    id: data.id as string,
    organizationId: data.organization_id as string,
    carrierId: data.carrier_id as string,
  };
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

function parseStorageVersion(storagePath: string | null) {
  const match = storagePath?.match(/\/v(\d+)\//);
  return match ? Number(match[1]) || 0 : 0;
}

function revalidateVehicles(equipmentId: string) {
  revalidatePath("/");
  revalidatePath("/actions");
  revalidatePath("/documents-to-fix");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${equipmentId}`);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/(^-|-$)/g, "");
}
