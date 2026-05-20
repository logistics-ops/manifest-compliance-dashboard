import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { getFuelReceipts } from "@/lib/data/fuel";
import { requireSession } from "@/lib/integrations/auth";
import type { FuelReceiptFilters } from "@/types/fuel";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  const searchParams = request.nextUrl.searchParams;
  const filters: FuelReceiptFilters = {
    q: searchParams.get("q") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    carrierId: searchParams.get("carrierId") ?? undefined,
    state: searchParams.get("state") ?? undefined,
    fuelType: searchParams.get("fuelType") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  };
  const receipts = await getFuelReceipts(filters);
  const csv = toCsv([
    [
      "vendor_name",
      "carrier",
      "load_number",
      "transaction_date",
      "transaction_time",
      "fuel_type",
      "gallons",
      "price_per_gallon",
      "total_amount",
      "city",
      "state",
      "odometer",
      "payment_method",
      "card_last4",
      "extraction_status",
      "extraction_confidence",
      "created_at",
    ],
    ...receipts.map((receipt) => [
      receipt.vendorName,
      receipt.carrierName,
      receipt.loadNumber ?? "",
      receipt.transactionDate ?? "",
      receipt.transactionTime ?? "",
      receipt.fuelType,
      String(receipt.gallons),
      String(receipt.pricePerGallon),
      String(receipt.totalAmount),
      receipt.city,
      receipt.state,
      receipt.odometer ? String(receipt.odometer) : "",
      receipt.paymentMethod,
      receipt.cardLast4,
      receipt.extractionStatus,
      String(receipt.extractionConfidence),
      receipt.createdAt,
    ]),
  ]);

  if (session.organizationId || session.platformSuperAdmin) {
    await writeAuditLog({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      action: "fuel_receipt.exported",
      entityType: "fuel_receipt",
      entityId: null,
      metadata: {
        count: receipts.length,
        filters,
        carrier_id: session.role === "carrier" ? session.carrierId : filters.carrierId ?? null,
      },
    });
  }

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="fuel-receipts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
}
