import { NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { upsertLoadNotification } from "@/lib/data/load-notifications";
import { getLoads } from "@/lib/data/loads";
import { requireSession } from "@/lib/integrations/auth";
import { createLoadsSummaryXlsx, type ArchiveSummaryRow } from "@/lib/archives/xlsx";
import { createZipStream } from "@/lib/archives/zip";
import { createClient } from "@/lib/supabase/server";
import { canExportLoadArchive } from "@/lib/security/tenant-rules";
import type { Load, LoadDocument, LoadStatus } from "@/types/load";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";
const statuses: Array<LoadStatus | "all"> = ["all", "booked", "in_transit", "delivered", "pod_uploaded", "pod_sent", "invoiced", "cancelled"];

export async function GET(request: NextRequest) {
  const session = await requireSession();
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;
  if (session.role === "carrier" && !session.platformSuperAdmin && session.carrierId) {
    const carrierParam = params.get("carrierId");
    if (carrierParam && carrierParam !== session.carrierId) {
      return Response.json({ error: "Carrier exports are limited to your linked carrier profile." }, { status: 403 });
    }
  }
  const loads = filterLoads(await getLoads(), params, session.role === "carrier" && !session.platformSuperAdmin)
    .filter((load) => canExportLoadArchive(session, { organizationId: load.organizationId, carrierId: load.carrierId }));

  const summary = await createLoadsSummaryXlsx(loads.map(toSummaryRow));
  const archiveName = `${archiveLabel(params)}-Archive.zip`;
  const entries = createArchiveEntries(loads, summary, async (document) => {
    if (!supabase || !document.storagePath) return null;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(document.storagePath, 300);
    if (error || !data?.signedUrl) return null;
    const response = await fetch(data.signedUrl);
    if (!response.ok || !response.body) return null;
    return response.body;
  });

  await Promise.all(loads.map(async (load) => {
    await writeAuditLog({
      organizationId: load.organizationId,
      actorUserId: session.userId,
      action: "load.archive_downloaded",
      entityType: "load",
      entityId: load.id,
      metadata: {
        load_number: load.loadNumber,
        carrier_id: load.carrierId,
        carrier_name: load.carrierName,
        broker: params.get("broker") || null,
        status: params.get("status") || "all",
        from: params.get("from") || null,
        to: params.get("to") || null,
        month: params.get("month") || null,
      },
    });
    await upsertLoadNotification({
      session,
      load,
      kind: "archive_export_completed",
      priority: "low",
    });
  }));

  return new Response(createZipStream(entries), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archiveName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function filterLoads(loads: Load[], params: URLSearchParams, carrierMode = false) {
  const month = params.get("month") ?? "";
  if (carrierMode) {
    return loads.filter((load) => {
      const loadDate = load.pickupDate || load.deliveryDate || load.createdAt.slice(0, 10);
      return !month || loadDate.startsWith(month);
    });
  }

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const carrierId = params.get("carrierId") ?? "";
  const broker = params.get("broker")?.trim().toLowerCase() ?? "";
  const statusParam = params.get("status") as LoadStatus | "all" | null;
  const status = statuses.includes(statusParam ?? "all") ? statusParam ?? "all" : "all";

  return loads.filter((load) => {
    const loadDate = load.pickupDate || load.deliveryDate || load.createdAt.slice(0, 10);
    if (month && !loadDate.startsWith(month)) return false;
    if (from && loadDate < from) return false;
    if (to && loadDate > to) return false;
    if (carrierId && load.carrierId !== carrierId) return false;
    if (broker && !`${load.brokerName} ${load.brokerEmail}`.toLowerCase().includes(broker)) return false;
    if (status !== "all" && load.status !== status) return false;
    return true;
  });
}

async function* createArchiveEntries(
  loads: Load[],
  summary: Uint8Array,
  getDocumentStream: (document: LoadDocument) => Promise<ReadableStream<Uint8Array> | null>,
) {
  yield { name: "loads-summary.xlsx", data: summary };

  for (const load of loads) {
    const folder = `${safeName(load.carrierName)}/${safeName(`Load-${load.loadNumber}`)}`;
    for (const type of ["rate_confirmation", "pod"] as const) {
      const document = latestDocument(load.documents, type);
      if (!document) continue;
      const stream = await getDocumentStream(document);
      if (!stream) continue;
      const defaultName = type === "rate_confirmation" ? "rate-confirmation" : "pod";
      yield { name: `${folder}/${safeName(document.fileName || defaultName)}`, data: stream };
    }
  }
}

function toSummaryRow(load: Load): ArchiveSummaryRow {
  const documents = load.documents.map((document) => ({
    type: document.documentType,
    fileName: document.fileName,
    version: document.versionNumber,
    uploadedAt: document.uploadedAt,
    fileSize: document.fileSize,
  }));

  return {
    loadNumber: load.loadNumber,
    carrier: load.carrierName,
    driverName: load.driverName,
    brokerName: load.brokerName,
    brokerEmail: load.brokerEmail,
    origin: `${load.originCity}, ${load.originState}`,
    destination: `${load.destinationCity}, ${load.destinationState}`,
    pickupDate: load.pickupDate ?? "",
    deliveryDate: load.deliveryDate ?? "",
    rateAmount: load.rateAmount,
    status: load.status,
    podSentStatus: load.podSentAt ? `Sent ${load.podSentAt}` : "Not sent",
    createdAt: load.createdAt,
    updatedAt: load.updatedAt,
    archivedAt: load.archivedAt ?? "",
    documentMetadata: JSON.stringify(documents),
    documentFileNames: load.documents.map((document) => document.fileName).join(", "),
  };
}

function latestDocument(documents: LoadDocument[], documentType: LoadDocument["documentType"]) {
  return documents.filter((document) => document.documentType === documentType).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}

function archiveLabel(params: URLSearchParams) {
  const month = params.get("month");
  if (month) {
    const [year, monthNumber] = month.split("-");
    const date = new Date(Number(year), Number(monthNumber) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).replace(/\s+/g, "-");
  }
  return "Loads";
}

function safeName(value: string) {
  return (value || "Unknown")
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
