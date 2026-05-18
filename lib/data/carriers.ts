import { mockCarriers, REQUIRED_DOCUMENTS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { Carrier, CarrierDocument, CarrierStatus, RequiredDocumentName } from "@/types/carrier";

type CarrierRow = {
  id: string;
  company_name: string;
  mc_number: string;
  dot_number: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
  carrier_documents?: Array<{
    document_name: string;
    uploaded: boolean;
    expiration_date: string | null;
    notes: string | null;
    storage_path: string | null;
    file_name: string | null;
    file_size: number | null;
    mime_type: string | null;
    uploaded_at: string | null;
    version_number: number | null;
    uploaded_by_user?: {
      full_name: string | null;
      email: string | null;
    } | null;
  }>;
};

export async function getCarriers(): Promise<Carrier[]> {
  const supabase = await createClient();

  if (!supabase) {
    return mockCarriers;
  }

  const { data, error } = await supabase
    .from("carriers")
    .select("*, carrier_documents(document_name, uploaded, expiration_date, notes, storage_path, file_name, file_size, mime_type, uploaded_at, version_number, uploaded_by_user:users!carrier_documents_uploaded_by_fkey(full_name, email))")
    .order("company_name");

  if (error || !data?.length) {
    return mockCarriers;
  }

  return (data as CarrierRow[]).map(mapCarrierRow);
}

function mapCarrierRow(row: CarrierRow): Carrier {
  const documents = REQUIRED_DOCUMENTS.reduce(
    (allDocuments, documentName) => ({
      ...allDocuments,
      [documentName]: { uploaded: false, expirationDate: null },
    }),
    {} as Record<RequiredDocumentName, CarrierDocument>,
  );

  row.carrier_documents?.forEach((document) => {
    documents[document.document_name as RequiredDocumentName] = {
      uploaded: document.uploaded,
      expirationDate: document.expiration_date,
      notes: document.notes ?? undefined,
      storagePath: document.storage_path,
      fileName: document.file_name,
      fileSize: document.file_size,
      mimeType: document.mime_type,
      uploadedAt: document.uploaded_at,
      uploadedBy: document.uploaded_by_user?.full_name || document.uploaded_by_user?.email || null,
      versionNumber: document.version_number,
    };
  });

  return {
    id: row.id,
    companyName: row.company_name,
    mcNumber: row.mc_number,
    dotNumber: row.dot_number,
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    status: toCarrierStatus(row.status),
    notes: row.notes ?? "",
    documents,
  };
}

function toCarrierStatus(status: string): CarrierStatus {
  const normalized = status.toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "pending") return "Pending";
  if (normalized === "suspended") return "Suspended";
  if (normalized === "inactive") return "Inactive";
  return "Pending";
}
