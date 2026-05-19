"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession, requireStaffAccess } from "@/lib/integrations/auth";
import { writeAuditLog } from "@/lib/audit";
import { assertTenantStoragePath as assertTenantUploadPath, canUploadCarrierDocument } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession, CarrierStatus, RequiredDocumentName } from "@/types/carrier";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

const statusToDatabase: Record<CarrierStatus, string> = {
  Active: "active",
  Pending: "pending",
  Suspended: "suspended",
  Inactive: "inactive",
};

export async function createCarrierAction(formData: FormData) {
  const session = await requireAdmin();
  const organizationId = getWritableOrganizationId(session);

  const payload = {
    organization_id: organizationId,
    company_name: getString(formData, "companyName"),
    mc_number: getString(formData, "mcNumber"),
    dot_number: getString(formData, "dotNumber"),
    contact_name: getString(formData, "contactName"),
    phone: getString(formData, "phone"),
    email: getString(formData, "email"),
    status: statusToDatabase[(getString(formData, "status") as CarrierStatus) || "Pending"],
    notes: getString(formData, "notes"),
  };

  const supabase = await createClient();

  if (!supabase) {
    redirect("/");
  }

  const { data, error } = await supabase
    .from("carriers")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    redirect("/");
  }

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: "carrier.created",
    entityType: "carrier",
    entityId: data.id,
    metadata: { companyName: payload.company_name, status: payload.status },
  });

  revalidatePath("/");
  redirect(`/carriers/${data.id}`);
}

export async function updateCarrierAction(formData: FormData) {
  const session = await requireAdmin();

  const carrierId = getString(formData, "carrierId");
  const payload = {
    company_name: getString(formData, "companyName"),
    mc_number: getString(formData, "mcNumber"),
    dot_number: getString(formData, "dotNumber"),
    contact_name: getString(formData, "contactName"),
    phone: getString(formData, "phone"),
    email: getString(formData, "email"),
    notes: getString(formData, "notes"),
  };

  const supabase = await createClient();

  if (supabase && carrierId) {
    await assertCarrierIsInSessionOrganization(supabase, session, carrierId);
    let query = supabase.from("carriers").update(payload).eq("id", carrierId);
    if (!session.platformSuperAdmin && session.organizationId) {
      query = query.eq("organization_id", session.organizationId);
    }
    await query;

    await writeAuditLog({
      organizationId: getWritableOrganizationId(session),
      actorUserId: session.userId,
      action: "carrier.updated",
      entityType: "carrier",
      entityId: carrierId,
      metadata: { companyName: payload.company_name },
    });
  }

  revalidateCarrier(carrierId);
}

export async function updateCarrierStatusAction(formData: FormData) {
  const session = await requireAdmin();

  const carrierId = getString(formData, "carrierId");
  const status = getString(formData, "status") as CarrierStatus;
  const supabase = await createClient();

  if (supabase && carrierId && statusToDatabase[status]) {
    await assertCarrierIsInSessionOrganization(supabase, session, carrierId);
    let query = supabase.from("carriers").update({ status: statusToDatabase[status] }).eq("id", carrierId);
    if (!session.platformSuperAdmin && session.organizationId) {
      query = query.eq("organization_id", session.organizationId);
    }
    await query;

    await writeAuditLog({
      organizationId: getWritableOrganizationId(session),
      actorUserId: session.userId,
      action: "carrier.status_changed",
      entityType: "carrier",
      entityId: carrierId,
      metadata: { status: statusToDatabase[status] },
    });
  }

  revalidateCarrier(carrierId);
}

export async function addComplianceNoteAction(formData: FormData) {
  const session = await requireStaffAccess();

  const carrierId = getString(formData, "carrierId");
  const note = getString(formData, "note");
  const supabase = await createClient();

  if (supabase && carrierId && note) {
    await assertCarrierIsInSessionOrganization(supabase, session, carrierId);
    const { data } = await supabase.from("compliance_notes").insert({
      organization_id: getWritableOrganizationId(session),
      carrier_id: carrierId,
      note,
      created_by: session.userId,
    }).select("id").single();

    if (data) {
      await writeAuditLog({
        organizationId: getWritableOrganizationId(session),
        actorUserId: session.userId,
        action: "compliance_note.added",
        entityType: "compliance_note",
        entityId: data.id,
        metadata: { carrierId },
      });
    }
  }

  revalidateCarrier(carrierId);
}

export async function updateCarrierDocumentAction(formData: FormData) {
  const session = await requireSession();

  const carrierId = getString(formData, "carrierId");
  const documentName = getString(formData, "documentName");
  const expirationDate = getOptionalString(formData, "expirationDate");
  const notes = getOptionalString(formData, "notes");
  const uploaded = formData.get("uploaded") === "on";
  const supabase = await createClient();

  if (supabase && carrierId && documentName) {
    const organizationId = await assertCanUploadCarrierDocuments(supabase, session, carrierId);
    const { data: existingDocument } = await supabase
      .from("carrier_documents")
      .select("id, expiration_date")
      .eq("organization_id", organizationId)
      .eq("carrier_id", carrierId)
      .eq("document_name", documentName)
      .maybeSingle();

    const { data } = await supabase.from("carrier_documents").upsert(
      {
        organization_id: organizationId,
        carrier_id: carrierId,
        document_name: documentName,
        uploaded,
        expiration_date: expirationDate,
        notes,
        status: getDocumentDatabaseStatus(uploaded, expirationDate),
      },
      { onConflict: "organization_id,carrier_id,document_name" },
    ).select("id").single();

    await writeAuditLog({
      organizationId,
      actorUserId: session.userId,
      action: "document.metadata_updated",
      entityType: "carrier_document",
      entityId: data?.id ?? existingDocument?.id ?? null,
      metadata: { carrierId, documentName, uploaded },
    });

    if ((existingDocument?.expiration_date ?? null) !== expirationDate) {
      await writeAuditLog({
        organizationId,
        actorUserId: session.userId,
        action: "document.expiration_changed",
        entityType: "carrier_document",
        entityId: data?.id ?? existingDocument?.id ?? null,
        metadata: {
          carrierId,
          documentName,
          previousExpirationDate: existingDocument?.expiration_date ?? null,
          expirationDate,
        },
      });
    }
  }

  revalidateCarrier(carrierId);
}

export async function createCarrierDocumentUploadTargetAction(input: {
  carrierId: string;
  documentName: RequiredDocumentName;
  fileName: string;
}) {
  const session = await requireSession();

  const supabase = await createClient();
  const carrierId = input.carrierId.trim();
  const documentName = input.documentName;
  const fileName = sanitizeFileName(input.fileName);

  if (!supabase || !carrierId || !documentName || !fileName) {
    throw new Error("Supabase Storage is not configured for uploads.");
  }

  const organizationId = await assertCanUploadCarrierDocuments(supabase, session, carrierId);

  const { data: latestVersion } = await supabase
    .from("carrier_document_versions")
    .select("version_number")
    .eq("organization_id", organizationId)
    .eq("carrier_id", carrierId)
    .eq("document_name", documentName)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: currentDocument } = await supabase
    .from("carrier_documents")
    .select("version_number")
    .eq("organization_id", organizationId)
    .eq("carrier_id", carrierId)
    .eq("document_name", documentName)
    .maybeSingle();

  const versionNumber = Math.max(
    Number(latestVersion?.version_number ?? 0),
    Number(currentDocument?.version_number ?? 0),
  ) + 1;
  const documentFolder = slugify(documentName);
  const storagePath = `organizations/${organizationId}/carriers/${carrierId}/${documentFolder}/v${versionNumber}/${Date.now()}-${fileName}`;

  return {
    bucket: STORAGE_BUCKET,
    path: storagePath,
    versionNumber,
  };
}

export async function finalizeCarrierDocumentUploadAction(input: {
  carrierId: string;
  documentName: RequiredDocumentName;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  versionNumber: number;
  expirationDate: string | null;
  notes: string | null;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const uploadedAt = new Date().toISOString();
  const organizationId = await assertCanUploadCarrierDocuments(supabase, session, input.carrierId);
  assertTenantUploadPath(input.storagePath, organizationId, input.carrierId);

  const status = getDocumentDatabaseStatus(true, input.expirationDate);
  const { data: existingDocument } = await supabase
    .from("carrier_documents")
    .select("id, expiration_date, version_number")
    .eq("organization_id", organizationId)
    .eq("carrier_id", input.carrierId)
    .eq("document_name", input.documentName)
    .maybeSingle();
  const payload = {
    organization_id: organizationId,
    carrier_id: input.carrierId,
    document_name: input.documentName,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    uploaded: true,
    expiration_date: input.expirationDate,
    notes: input.notes,
    uploaded_by: session.userId,
    uploaded_at: uploadedAt,
    version_number: input.versionNumber,
    status,
  };

  const { data, error } = await supabase
    .from("carrier_documents")
    .upsert(payload, { onConflict: "organization_id,carrier_id,document_name" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save uploaded document metadata.");
  }

  await supabase.from("carrier_document_versions").insert({
    organization_id: organizationId,
    carrier_document_id: data.id,
    carrier_id: input.carrierId,
    document_name: input.documentName,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    version_number: input.versionNumber,
    uploaded_by: session.userId,
    uploaded_at: uploadedAt,
  });

  await writeAuditLog({
    organizationId,
    actorUserId: session.userId,
    action: existingDocument ? "document.replaced" : "document.uploaded",
    entityType: "carrier_document",
    entityId: data.id,
    metadata: {
      carrierId: input.carrierId,
      documentName: input.documentName,
      fileName: input.fileName,
      versionNumber: input.versionNumber,
      storagePath: input.storagePath,
    },
  });

  if ((existingDocument?.expiration_date ?? null) !== input.expirationDate) {
    await writeAuditLog({
      organizationId,
      actorUserId: session.userId,
      action: "document.expiration_changed",
      entityType: "carrier_document",
      entityId: data.id,
      metadata: {
        carrierId: input.carrierId,
        documentName: input.documentName,
        previousExpirationDate: existingDocument?.expiration_date ?? null,
        expirationDate: input.expirationDate,
      },
    });
  }

  revalidateCarrier(input.carrierId);

  return {
    uploadedAt,
    uploadedBy: session.fullName || session.email,
  };
}

function revalidateCarrier(carrierId: string) {
  revalidatePath("/");
  if (carrierId) {
    revalidatePath(`/carriers/${carrierId}`);
  }
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/(^-|-$)/g, "");
}

function getWritableOrganizationId(session: Awaited<ReturnType<typeof requireStaffAccess>>) {
  if (!session.organizationId) {
    throw new Error("An organization is required before managing tenant data.");
  }

  return session.organizationId;
}

async function assertCanUploadCarrierDocuments(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  carrierId: string,
) {
  const { data, error } = await supabase
    .from("carriers")
    .select("id, organization_id")
    .eq("id", carrierId)
    .maybeSingle();

  if (
    error ||
    !data ||
    !canUploadCarrierDocument(session, {
      organizationId: data.organization_id,
      carrierId: data.id,
    })
  ) {
    throw new Error("Document uploads are only available for authorized carrier profiles.");
  }

  if (!data.organization_id) {
    throw new Error("Carrier document uploads require an organization.");
  }

  return data.organization_id;
}

async function assertCarrierIsInSessionOrganization(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: Awaited<ReturnType<typeof requireStaffAccess>>,
  carrierId: string,
) {
  const organizationId = getWritableOrganizationId(session);
  const { data, error } = await supabase
    .from("carriers")
    .select("id")
    .eq("id", carrierId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Carrier is not available in the current organization.");
  }
}
