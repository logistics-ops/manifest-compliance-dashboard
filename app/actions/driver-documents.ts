"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/integrations/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  assertDriverDocumentStoragePath,
  canManageDriverDocumentRecord,
} from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

export async function createDriverDocumentUploadTargetAction(input: {
  driverId: string;
  documentName: string;
  fileName: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const driverId = input.driverId.trim();
  const documentName = input.documentName.trim();
  const fileName = sanitizeFileName(input.fileName);

  if (!supabase || !driverId || !documentName || !fileName) {
    throw new Error("Supabase Storage is not configured for uploads.");
  }

  const driver = await assertCanManageDriverDocument(supabase, session, driverId);
  const { data: currentDocument } = await supabase
    .from("driver_documents")
    .select("storage_path")
    .eq("organization_id", driver.organizationId)
    .eq("driver_id", driver.id)
    .eq("document_name", documentName)
    .maybeSingle();

  const versionNumber = parseStorageVersion(currentDocument?.storage_path ?? null) + 1;
  const storagePath = `organizations/${driver.organizationId}/drivers/${driver.id}/${slugify(documentName)}/v${versionNumber}/${Date.now()}-${fileName}`;

  return {
    bucket: STORAGE_BUCKET,
    path: storagePath,
    versionNumber,
  };
}

export async function finalizeDriverDocumentUploadAction(input: {
  driverId: string;
  documentName: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  versionNumber: number;
  expirationDate: string | null;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const driver = await assertCanManageDriverDocument(supabase, session, input.driverId);
  assertDriverDocumentStoragePath(input.storagePath, driver.organizationId, driver.id);

  const uploadedAt = new Date().toISOString();
  const { data: existingDocument } = await supabase
    .from("driver_documents")
    .select("id, expiration_date, storage_path")
    .eq("organization_id", driver.organizationId)
    .eq("driver_id", driver.id)
    .eq("document_name", input.documentName)
    .maybeSingle();
  const status = getDocumentDatabaseStatus(true, input.expirationDate);

  const { data, error } = await supabase
    .from("driver_documents")
    .upsert(
      {
        organization_id: driver.organizationId,
        driver_id: driver.id,
        document_name: input.documentName,
        storage_path: input.storagePath,
        uploaded: true,
        expiration_date: input.expirationDate,
        uploaded_by: session.userId,
        uploaded_at: uploadedAt,
        status,
      },
      { onConflict: "driver_id,document_name" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save uploaded DQ document metadata.");
  }

  await writeAuditLog({
    organizationId: driver.organizationId,
    actorUserId: session.userId,
    action: existingDocument?.storage_path ? "driver_document.replaced" : "driver_document.uploaded",
    entityType: "driver_document",
    entityId: data.id,
    metadata: {
      driver_id: driver.id,
      carrier_id: driver.carrierId,
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
      organizationId: driver.organizationId,
      actorUserId: session.userId,
      action: "driver_document.expiration_changed",
      entityType: "driver_document",
      entityId: data.id,
      metadata: {
        driver_id: driver.id,
        carrier_id: driver.carrierId,
        document_name: input.documentName,
        previous_expiration_date: existingDocument?.expiration_date ?? null,
        expiration_date: input.expirationDate,
        file_name: input.fileName,
        storage_path: input.storagePath,
      },
    });
  }

  revalidateDQ(driver.id);
  return {
    id: data.id,
    uploadedAt,
  };
}

async function assertCanManageDriverDocument(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  driverId: string,
) {
  const { data, error } = await supabase
    .from("drivers")
    .select("id, organization_id, carrier_id")
    .eq("id", driverId)
    .maybeSingle();

  if (
    error ||
    !data ||
    !canManageDriverDocumentRecord(session, {
      organizationId: data.organization_id,
      carrierId: data.carrier_id,
      driverId: data.id,
    })
  ) {
    throw new Error("DQ document uploads are only available for authorized drivers.");
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

function revalidateDQ(driverId: string) {
  revalidatePath("/");
  revalidatePath("/actions");
  revalidatePath("/documents-to-fix");
  revalidatePath("/dq-files");
  revalidatePath(`/dq-files/${driverId}`);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/(^-|-$)/g, "");
}
