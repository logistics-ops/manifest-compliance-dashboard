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
  uploaded_by_user?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
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

  const loadRows = data as LoadRow[];
  const carrierNames = await getCarrierNamesByTenant(supabase, session, loadRows);
  const documentsByLoad = await getLoadDocumentsByTenant(supabase, session, loadRows);
  return loadRows.map((row) => mapLoadRow(row, carrierNames, documentsByLoad));
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

  const loadRows = data as LoadRow[];
  const carrierNames = await getCarrierNamesByTenant(supabase, session, loadRows);
  const documentsByLoad = await getLoadDocumentsByTenant(supabase, session, loadRows);
  return { loads: loadRows.map((row) => mapLoadRow(row, carrierNames, documentsByLoad)), error: null };
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
    .select("*")
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

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    query = query.eq("carrier_id", session.carrierId);
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

async function getLoadDocumentsByTenant(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>,
  loads: LoadRow[],
) {
  const loadIds = Array.from(new Set(loads.map((load) => load.id).filter(Boolean)));
  if (!loadIds.length) return new Map<string, LoadDocument[]>();

  let query = supabase
    .from("load_documents")
    .select("id, organization_id, load_id, document_type, storage_path, file_name, file_size, mime_type, version_number, uploaded_at, uploaded_by_user:users!load_documents_uploaded_by_fkey(full_name, email)")
    .in("load_id", loadIds)
    .in("document_type", ["rate_confirmation", "pod"])
    .order("version_number", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Unable to load load documents", error?.message);
    return new Map<string, LoadDocument[]>();
  }

  const documentsByLoad = new Map<string, LoadDocument[]>();
  (data as unknown as Array<LoadDocumentRow & { load_id: string; organization_id: string }>).forEach((document) => {
    const documents = documentsByLoad.get(document.load_id) ?? [];
    documents.push(mapLoadDocumentRow(document));
    documentsByLoad.set(document.load_id, documents);
  });

  return documentsByLoad;
}

function mapLoadRow(
  row: LoadRow,
  carrierNames: Map<string, string>,
  documentsByLoad: Map<string, LoadDocument[]>,
): Load {
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
    documents: (documentsByLoad.get(row.id) ?? []).sort((a, b) => b.versionNumber - a.versionNumber),
    createdAt: row.created_at,
  };
}

function mapLoadDocumentRow(row: LoadDocumentRow): LoadDocument {
  const uploadedByUser = Array.isArray(row.uploaded_by_user) ? row.uploaded_by_user[0] : row.uploaded_by_user;

  return {
    id: row.id,
    documentType: row.document_type,
    storagePath: row.storage_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    versionNumber: row.version_number,
    uploadedBy: uploadedByUser?.full_name || uploadedByUser?.email || null,
    uploadedAt: row.uploaded_at,
  };
}
