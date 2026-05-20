import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { getFuelReceiptQueryScope } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { FuelExtractionStatus, FuelReceipt, FuelReceiptFilters, FuelReceiptMetrics } from "@/types/fuel";

type FuelReceiptRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  load_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  receipt_file_path: string;
  file_name: string | null;
  vendor_name: string | null;
  transaction_date: string | null;
  transaction_time: string | null;
  fuel_type: string | null;
  gallons: number | string | null;
  price_per_gallon: number | string | null;
  total_amount: number | string | null;
  city: string | null;
  state: string | null;
  odometer: number | string | null;
  payment_method: string | null;
  card_last4: string | null;
  extraction_status: FuelExtractionStatus;
  extraction_confidence: number | string | null;
  raw_extraction: Record<string, unknown> | null;
  notes: string | null;
  uploaded_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getFuelReceipts(filters: FuelReceiptFilters = {}): Promise<FuelReceipt[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!supabase || !session) return [];

  const scope = getFuelReceiptQueryScope(session);
  let query = supabase
    .from("fuel_receipts")
    .select("*")
    .order("transaction_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (scope.carrierId) query = query.eq("carrier_id", scope.carrierId);
  if (filters.carrierId) query = query.eq("carrier_id", filters.carrierId);
  if (filters.state) query = query.eq("state", filters.state.toUpperCase());
  if (filters.fuelType) query = query.ilike("fuel_type", `%${filters.fuelType}%`);
  if (filters.status && filters.status !== "all") query = query.eq("extraction_status", filters.status);
  if (filters.dateFrom) query = query.gte("transaction_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("transaction_date", filters.dateTo);

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load fuel receipts", error?.message);
    return [];
  }

  const rows = data as FuelReceiptRow[];
  const carrierNames = await getCarrierNames(supabase, rows, scope.organizationId, scope.carrierId);
  const loadNumbers = await getLoadNumbers(supabase, rows, scope.organizationId, scope.carrierId);
  const uploaders = await getUploaderNames(supabase, rows, scope.organizationId);
  const receipts = rows.map((row) => mapFuelReceipt(row, carrierNames, loadNumbers, uploaders));
  const needle = filters.q?.trim().toLowerCase();

  if (!needle) return receipts;

  return receipts.filter((receipt) =>
    [
      receipt.vendorName,
      receipt.carrierName,
      receipt.loadNumber,
      receipt.city,
      receipt.state,
      receipt.fuelType,
      receipt.cardLast4,
    ].join(" ").toLowerCase().includes(needle),
  );
}

export async function getFuelReceipt(receiptId: string): Promise<FuelReceipt | null> {
  const receipts = await getFuelReceipts();
  return receipts.find((receipt) => receipt.id === receiptId) ?? null;
}

export function getFuelReceiptMetrics(receipts: FuelReceipt[]): FuelReceiptMetrics {
  const stateMap = new Map<string, { gallons: number; spend: number; count: number }>();
  receipts.forEach((receipt) => {
    const state = receipt.state || "Unknown";
    const current = stateMap.get(state) ?? { gallons: 0, spend: 0, count: 0 };
    current.gallons += receipt.gallons;
    current.spend += receipt.totalAmount;
    current.count += 1;
    stateMap.set(state, current);
  });

  const states = Array.from(stateMap.entries()).sort((a, b) => b[1].spend - a[1].spend);
  return {
    totalGallons: round(receipts.reduce((total, receipt) => total + receipt.gallons, 0)),
    totalSpend: round(receipts.reduce((total, receipt) => total + receipt.totalAmount, 0)),
    missingReviewCount: receipts.filter((receipt) => ["needs_review", "failed", "pending", "extracted"].includes(receipt.extractionStatus)).length,
    spendByState: states.map(([state, value]) => ({ state, value: round(value.spend) })),
    gallonsByState: states.map(([state, value]) => ({ state, value: round(value.gallons) })),
    countByState: states.map(([state, value]) => ({ state, value: value.count })),
  };
}

async function getCarrierNames(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  rows: FuelReceiptRow[],
  organizationId: string | null,
  carrierId: string | null,
) {
  const ids = Array.from(new Set(rows.map((row) => row.carrier_id).filter(Boolean)));
  if (!ids.length) return new Map<string, string>();
  let query = supabase.from("carriers").select("id, organization_id, company_name").in("id", ids);
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (carrierId) query = query.eq("id", carrierId);
  const { data } = await query;
  return new Map((data ?? []).map((row) => [`${row.organization_id}:${row.id}`, row.company_name ?? "Carrier"]));
}

async function getLoadNumbers(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  rows: FuelReceiptRow[],
  organizationId: string | null,
  carrierId: string | null,
) {
  const ids = Array.from(new Set(rows.map((row) => row.load_id).filter(Boolean))) as string[];
  if (!ids.length) return new Map<string, string>();
  let query = supabase.from("loads").select("id, organization_id, carrier_id, load_number").in("id", ids);
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (carrierId) query = query.eq("carrier_id", carrierId);
  const { data } = await query;
  return new Map((data ?? []).map((row) => [row.id, row.load_number]));
}

async function getUploaderNames(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  rows: FuelReceiptRow[],
  organizationId: string | null,
) {
  const ids = Array.from(new Set(rows.map((row) => row.uploaded_by).filter(Boolean))) as string[];
  if (!ids.length) return new Map<string, string>();
  let query = supabase.from("users").select("id, organization_id, full_name, email").in("id", ids);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data } = await query;
  return new Map((data ?? []).map((row) => [row.id, row.full_name || row.email || "User"]));
}

function mapFuelReceipt(
  row: FuelReceiptRow,
  carrierNames: Map<string, string>,
  loadNumbers: Map<string, string>,
  uploaders: Map<string, string>,
): FuelReceipt {
  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    carrierName: carrierNames.get(`${row.organization_id}:${row.carrier_id}`) ?? "Carrier",
    loadId: row.load_id,
    loadNumber: row.load_id ? loadNumbers.get(row.load_id) ?? null : null,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    receiptFilePath: row.receipt_file_path,
    fileName: row.file_name ?? row.receipt_file_path.split("/").pop() ?? "receipt",
    vendorName: row.vendor_name ?? "",
    transactionDate: row.transaction_date,
    transactionTime: row.transaction_time,
    fuelType: row.fuel_type ?? "",
    gallons: Number(row.gallons ?? 0),
    pricePerGallon: Number(row.price_per_gallon ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    city: row.city ?? "",
    state: row.state ?? "",
    odometer: row.odometer === null ? null : Number(row.odometer),
    paymentMethod: row.payment_method ?? "",
    cardLast4: row.card_last4 ?? "",
    extractionStatus: row.extraction_status,
    extractionConfidence: Number(row.extraction_confidence ?? 0),
    rawExtraction: row.raw_extraction ?? {},
    notes: row.notes ?? "",
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by ? uploaders.get(row.uploaded_by) ?? null : null,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
