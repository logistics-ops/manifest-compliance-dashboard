import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceStatus } from "@/types/invoice";

type InvoiceRow = {
  id: string;
  organization_id: string;
  carrier_id: string;
  load_id: string;
  invoice_number: string;
  broker_name: string | null;
  broker_email: string | null;
  invoice_date: string;
  due_date: string | null;
  subtotal: number | string;
  total_amount: number | string;
  notes: string | null;
  status: InvoiceStatus;
  storage_path: string | null;
  file_name: string | null;
  version_number: number | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  loads?: { load_number: string | null } | Array<{ load_number: string | null }> | null;
  carriers?: { company_name: string | null } | Array<{ company_name: string | null }> | null;
};

export async function getInvoices(): Promise<Invoice[]> {
  noStore();
  const session = await getCurrentSession();
  const supabase = await createClient();
  if (!supabase || !session) return [];

  let query = supabase
    .from("invoices")
    .select("*, loads!invoices_organization_load_fkey(load_number), carriers!invoices_organization_carrier_fkey(company_name)")
    .order("created_at", { ascending: false });

  if (session.organizationId && !session.platformSuperAdmin) {
    query = query.eq("organization_id", session.organizationId);
  }

  if (session.role === "carrier" && session.carrierId && !session.platformSuperAdmin) {
    query = query.eq("carrier_id", session.carrierId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Unable to load invoices", error?.message);
    return [];
  }

  return (data as InvoiceRow[]).map(mapInvoiceRow);
}

export async function getInvoice(invoiceId: string) {
  const invoices = await getInvoices();
  return invoices.find((invoice) => invoice.id === invoiceId) ?? null;
}

export async function getInvoicesForLoad(loadId: string) {
  const invoices = await getInvoices();
  return invoices.filter((invoice) => invoice.loadId === loadId);
}

function mapInvoiceRow(row: InvoiceRow): Invoice {
  const load = Array.isArray(row.loads) ? row.loads[0] : row.loads;
  const carrier = Array.isArray(row.carriers) ? row.carriers[0] : row.carriers;
  return {
    id: row.id,
    organizationId: row.organization_id,
    carrierId: row.carrier_id,
    loadId: row.load_id,
    invoiceNumber: row.invoice_number,
    loadNumber: load?.load_number ?? "",
    carrierName: carrier?.company_name ?? "Carrier",
    brokerName: row.broker_name ?? "",
    brokerEmail: row.broker_email ?? "",
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    subtotal: Number(row.subtotal ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    notes: row.notes ?? "",
    status: row.status,
    storagePath: row.storage_path,
    fileName: row.file_name,
    versionNumber: Number(row.version_number ?? 0),
    sentAt: row.sent_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
