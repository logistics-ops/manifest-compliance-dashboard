import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { canAccessBrokerRecord, canManageBrokerRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { Broker, BrokerApprovedStatus, BrokerCheckRequest, BrokerCheckRequestStatus, BrokerRiskLevel } from "@/types/broker";
import type { Load } from "@/types/load";

type BrokerRow = {
  id: string;
  organization_id: string;
  broker_name: string;
  mc_number: string | null;
  dot_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  authority_status: string | null;
  safety_rating: string | null;
  approved_status: BrokerApprovedStatus;
  risk_level: BrokerRiskLevel;
  notes: string | null;
  notes_private: boolean | null;
  blocked_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type BrokerRequestRow = {
  id: string;
  organization_id: string;
  requested_by: string | null;
  carrier_id: string | null;
  broker_name: string | null;
  mc_number: string | null;
  notes: string | null;
  status: BrokerCheckRequestStatus;
  created_at: string;
  updated_at: string;
};

export async function getBrokers(query = ""): Promise<Broker[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!supabase || !session) return [];

  let request = supabase
    .from("brokers")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(80);

  if (session.organizationId && !session.platformSuperAdmin) {
    request = request.eq("organization_id", session.organizationId);
  }

  const needle = query.trim();
  if (needle) {
    request = request.or(`broker_name.ilike.%${escapeLike(needle)}%,mc_number.ilike.%${escapeLike(needle)}%`);
  }

  const { data, error } = await request;
  if (error || !data) {
    console.error("Unable to load brokers", error?.message);
    return [];
  }

  return (data as BrokerRow[])
    .filter((row) => canAccessBrokerRecord(session, { organizationId: row.organization_id }))
    .map((row) => mapBrokerRow(row, session.role === "carrier" && !session.platformSuperAdmin));
}

export async function getBroker(brokerId: string): Promise<Broker | null> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!supabase || !session) return null;

  const { data, error } = await supabase.from("brokers").select("*").eq("id", brokerId).maybeSingle();
  if (error || !data) return null;
  const row = data as BrokerRow;
  if (!canAccessBrokerRecord(session, { organizationId: row.organization_id })) return null;
  return mapBrokerRow(row, session.role === "carrier" && !session.platformSuperAdmin);
}

export async function getBrokerCheckRequests(): Promise<BrokerCheckRequest[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!supabase || !session || !canManageBrokerRecord(session, session.organizationId)) return [];

  let request = supabase.from("broker_check_requests").select("*").order("created_at", { ascending: false }).limit(40);
  if (session.organizationId && !session.platformSuperAdmin) request = request.eq("organization_id", session.organizationId);
  const { data, error } = await request;
  if (error || !data) return [];
  return (data as BrokerRequestRow[]).map(mapBrokerRequestRow);
}

export async function getBrokerLinkedLoads(broker: Broker, loads: Load[]) {
  const session = await getCurrentSession();
  if (!session) return [];
  return loads.filter((load) => {
    const matchesBroker =
      (broker.mcNumber && load.brokerMcNumber === broker.mcNumber) ||
      load.brokerId === broker.id ||
      load.brokerName.toLowerCase() === broker.brokerName.toLowerCase();
    if (!matchesBroker) return false;
    if (session.platformSuperAdmin || canManageBrokerRecord(session, load.organizationId)) return true;
    return session.role === "carrier" && session.carrierId === load.carrierId;
  });
}

function mapBrokerRow(row: BrokerRow, hidePrivateNotes: boolean): Broker {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brokerName: row.broker_name,
    mcNumber: row.mc_number ?? "",
    dotNumber: row.dot_number ?? "",
    contactName: row.contact_name ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    authorityStatus: row.authority_status ?? "",
    safetyRating: row.safety_rating ?? "",
    approvedStatus: row.approved_status,
    riskLevel: row.risk_level,
    notes: hidePrivateNotes && row.notes_private ? "" : row.notes ?? "",
    notesPrivate: Boolean(row.notes_private),
    blockedReason: row.blocked_reason ?? "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBrokerRequestRow(row: BrokerRequestRow): BrokerCheckRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requestedBy: row.requested_by,
    carrierId: row.carrier_id,
    brokerName: row.broker_name ?? "",
    mcNumber: row.mc_number ?? "",
    notes: row.notes ?? "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
}
