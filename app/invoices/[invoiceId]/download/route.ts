import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { getInvoice } from "@/lib/data/invoices";
import { requireSession } from "@/lib/integrations/auth";
import { canAccessInvoiceRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

export async function GET(_: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireSession();
  const supabase = await createClient();
  const { invoiceId } = await params;
  const invoice = await getInvoice(invoiceId);

  if (!supabase || !invoice?.storagePath) redirect("/invoices");
  if (!canAccessInvoiceRecord(session, { organizationId: invoice.organizationId, carrierId: invoice.carrierId })) {
    redirect("/unauthorized");
  }

  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(invoice.storagePath, 300);
  if (!data?.signedUrl) redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("Unable to create invoice download link.")}`);

  await writeAuditLog({
    organizationId: invoice.organizationId,
    actorUserId: session.userId,
    action: "invoice.downloaded",
    entityType: "invoice",
    entityId: invoice.id,
    metadata: {
      invoice_number: invoice.invoiceNumber,
      load_id: invoice.loadId,
      load_number: invoice.loadNumber,
      carrier_id: invoice.carrierId,
      carrier_name: invoice.carrierName,
    },
  });

  redirect(data.signedUrl);
}
