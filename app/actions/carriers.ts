"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaffAccess } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";
import type { CarrierStatus, RequiredDocumentName } from "@/types/carrier";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

const statusToDatabase: Record<CarrierStatus, string> = {
  Active: "active",
  Pending: "pending",
  Suspended: "suspended",
  Inactive: "inactive",
};

export async function createCarrierAction(formData: FormData) {
  await requireAdmin();

  const payload = {
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

  revalidatePath("/");
  redirect(`/carriers/${data.id}`);
}

export async function updateCarrierAction(formData: FormData) {
  await requireAdmin();

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
    await supabase.from("carriers").update(payload).eq("id", carrierId);
  }

  revalidateCarrier(carrierId);
}

export async function updateCarrierStatusAction(formData: FormData) {
  await requireAdmin();

  const carrierId = getString(formData, "carrierId");
  const status = getString(formData, "status") as CarrierStatus;
  const supabase = await createClient();

  if (supabase && carrierId && statusToDatabase[status]) {
    await supabase.from("carriers").update({ status: statusToDatabase[status] }).eq("id", carrierId);
  }

  revalidateCarrier(carrierId);
}

export async function addComplianceNoteAction(formData: FormData) {
  await requireStaffAccess();

  const carrierId = getString(formData, "carrierId");
  const note = getString(formData, "note");
  const supabase = await createClient();

  if (supabase && carrierId && note) {
    await supabase.from("compliance_notes").insert({
      carrier_id: carrierId,
      note,
    });
  }

  revalidateCarrier(carrierId);
}

export async function updateCarrierDocumentAction(formData: FormData) {
  await requireStaffAccess();

  const carrierId = getString(formData, "carrierId");
  const documentName = getString(formData, "documentName");
  const expirationDate = getOptionalString(formData, "expirationDate");
  const notes = getOptionalString(formData, "notes");
  const uploaded = formData.get("uploaded") === "on";
  const supabase = await createClient();

  if (supabase && carrierId && documentName) {
    await supabase.from("carrier_documents").upsert(
      {
        carrier_id: carrierId,
        document_name: documentName,
        uploaded,
        expiration_date: expirationDate,
        notes,
        status: getDocumentDatabaseStatus(uploaded, expirationDate),
      },
      { onConflict: "carrier_id,document_name" },
    );
  }

  revalidateCarrier(carrierId);
}

export async function createCarrierDocumentUploadTargetAction(input: {
  carrierId: string;
  documentName: RequiredDocumentName;
  fileName: string;
}) {
  await requireStaffAccess();

  const supabase = await createClient();
  const carrierId = input.carrierId.trim();
  const documentName = input.documentName;
  const fileName = sanitizeFileName(input.fileName);

  if (!supabase || !carrierId || !documentName || !fileName) {
    throw new Error("Supabase Storage is not configured for uploads.");
  }

  const { data: latestVersion } = await supabase
    .from("carrier_document_versions")
    .select("version_number")
    .eq("carrier_id", carrierId)
    .eq("document_name", documentName)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: currentDocument } = await supabase
    .from("carrier_documents")
    .select("version_number")
    .eq("carrier_id", carrierId)
    .eq("document_name", documentName)
    .maybeSingle();

  const versionNumber = Math.max(
    Number(latestVersion?.version_number ?? 0),
    Number(currentDocument?.version_number ?? 0),
  ) + 1;
  const documentFolder = slugify(documentName);
  const storagePath = `carriers/${carrierId}/${documentFolder}/v${versionNumber}/${Date.now()}-${fileName}`;

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
  const session = await requireStaffAccess();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const uploadedAt = new Date().toISOString();
  const status = getDocumentDatabaseStatus(true, input.expirationDate);
  const payload = {
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
    .upsert(payload, { onConflict: "carrier_id,document_name" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save uploaded document metadata.");
  }

  await supabase.from("carrier_document_versions").insert({
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
