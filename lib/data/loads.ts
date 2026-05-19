import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";
import type { Load, LoadDocument, LoadDocumentType, LoadStatus } from "@/types/load";

type LoadRow = {
  id: string;
  organization_id: string;
  load_number: string;
  carrier_id: string;
  driver_name: string | null;
  broker_name: string | null;
  broker_email: string | null;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  pickup_date: string | null;
  delivery_date: string | null;
  rate_amount: number | string | null;
  status: LoadStatus;
  notes: string | null;
  pod_sent_at: string | null;
  created_at: string;
  carriers?: { company_name: string | null } | Array<{ company_name: string | null }> | null;
  load_documents?: LoadDocumentRow[];
};

type LoadDocumentRow = {
  id: string;
  document_type: LoadDocumentType;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  version_number: number;
  uploaded_at: string;
  uploaded_by_user?: { full_name: string | null; email: string | null } | null;
};

export async function getLoads(): Promise<Load[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session) return [];

  let query = supabase
    .from("loads")
    .select("*, carriers(company_name), load_documents(id, document_type, storage_path, file_name, file_size, mime_type, version_number, uploaded_at, uploaded_by_user:users!load_documents_uploaded_by_fkey(full_name, email))")
    .order("pickup_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    query = query.eq("carrier_id", session.carrierId);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return (data as LoadRow[]).map(mapLoadRow);
}

export async function getLoad(loadId: string): Promise<Load | null> {
  const loads = await getLoads();
  return loads.find((load) => load.id === loadId) ?? null;
}

function mapLoadRow(row: LoadRow): Load {
  const carrier = Array.isArray(row.carriers) ? row.carriers[0] : row.carriers;

  return {
    id: row.id,
    organizationId: row.organization_id,
    loadNumber: row.load_number,
    carrierId: row.carrier_id,
    carrierName: carrier?.company_name ?? "Carrier",
    driverName: row.driver_name ?? "",
    brokerName: row.broker_name ?? "",
    brokerEmail: row.broker_email ?? "",
    originCity: row.origin_city,
    originState: row.origin_state,
    destinationCity: row.destination_city,
    destinationState: row.destination_state,
    pickupDate: row.pickup_date,
    deliveryDate: row.delivery_date,
    rateAmount: Number(row.rate_amount ?? 0),
    status: row.status,
    notes: row.notes ?? "",
    podSentAt: row.pod_sent_at,
    documents: (row.load_documents ?? []).map(mapLoadDocumentRow).sort((a, b) => b.versionNumber - a.versionNumber),
    createdAt: row.created_at,
  };
}

function mapLoadDocumentRow(row: LoadDocumentRow): LoadDocument {
  return {
    id: row.id,
    documentType: row.document_type,
    storagePath: row.storage_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    versionNumber: row.version_number,
    uploadedBy: row.uploaded_by_user?.full_name || row.uploaded_by_user?.email || null,
    uploadedAt: row.uploaded_at,
  };
}
