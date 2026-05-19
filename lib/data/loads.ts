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

type CarrierNameRow = {
  id: string;
  organization_id: string;
  company_name: string | null;
};

export async function getLoads(): Promise<Load[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session) return [];

  const { data, error } = await buildLoadsQuery(supabase, session);

  if (error || !data) {
    console.error("Unable to load tenant loads", error?.message);
    return [];
  }

  const carrierNames = await getCarrierNamesByTenant(supabase, session, data as LoadRow[]);
  return (data as LoadRow[]).map((row) => mapLoadRow(row, carrierNames));
}

export async function getLoadsResult(): Promise<{ loads: Load[]; error: string | null }> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();

  if (!supabase || !session) return { loads: [], error: null };

  const { data, error } = await buildLoadsQuery(supabase, session);

  if (error || !data) {
    console.error("Unable to load tenant loads", error?.message);
    return { loads: [], error: error?.message || "Unable to load loads." };
  }

  const carrierNames = await getCarrierNamesByTenant(supabase, session, data as LoadRow[]);
  return { loads: (data as LoadRow[]).map((row) => mapLoadRow(row, carrierNames)), error: null };
}

export async function getLoad(loadId: string): Promise<Load | null> {
  const loads = await getLoads();
  return loads.find((load) => load.id === loadId) ?? null;
}

function buildLoadsQuery(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>,
) {
  let query = supabase
    .from("loads")
    .select("*, load_documents(id, document_type, storage_path, file_name, file_size, mime_type, version_number, uploaded_at, uploaded_by_user:users!load_documents_uploaded_by_fkey(full_name, email))")
    .order("pickup_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    query = query.eq("carrier_id", session.carrierId);
  }

  return query;
}

async function getCarrierNamesByTenant(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>,
  loads: LoadRow[],
) {
  const carrierIds = Array.from(new Set(loads.map((load) => load.carrier_id).filter(Boolean)));
  if (!carrierIds.length) return new Map<string, string>();

  let query = supabase
    .from("carriers")
    .select("id, organization_id, company_name")
    .in("id", carrierIds);

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Unable to load carrier names for loads", error?.message);
    return new Map<string, string>();
  }

  return new Map(
    (data as CarrierNameRow[]).map((carrier) => [
      `${carrier.organization_id}:${carrier.id}`,
      carrier.company_name ?? "Carrier",
    ]),
  );
}

function mapLoadRow(row: LoadRow, carrierNames: Map<string, string>): Load {
  return {
    id: row.id,
    organizationId: row.organization_id,
    loadNumber: row.load_number,
    carrierId: row.carrier_id,
    carrierName: carrierNames.get(`${row.organization_id}:${row.carrier_id}`) ?? "Carrier",
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
