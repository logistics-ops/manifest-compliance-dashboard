import { NextResponse, type NextRequest } from "next/server";
import { getPublicUploadDocumentStatuses, getPublicUploadLinkLookup, type UploadDocumentCategory } from "@/lib/data/upload-links";
import { createAdminClient } from "@/lib/supabase/admin";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";
const categories = new Set<UploadDocumentCategory>(["carrier", "driver", "vehicle"]);

type RouteProps = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { token } = await params;
  const category = request.nextUrl.searchParams.get("category");
  const documentName = request.nextUrl.searchParams.get("document");

  if (!category || !categories.has(category as UploadDocumentCategory) || !documentName) {
    return unavailable(request, token, "Document link unavailable.");
  }

  const lookup = await getPublicUploadLinkLookup(token);
  if (!lookup.link?.isUsable) {
    return unavailable(request, token, "Upload link expired or revoked.");
  }

  const statuses = await getPublicUploadDocumentStatuses(lookup.link);
  const match = statuses.find(
    (status) =>
      status.category === category &&
      status.documentName.toLowerCase() === documentName.toLowerCase() &&
      status.uploaded &&
      status.storagePath,
  );

  if (!match?.storagePath) {
    return unavailable(request, token, "Uploaded document not found.");
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return unavailable(request, token, "Document preview unavailable.");
  }

  const { data, error } = await adminSupabase.storage.from(STORAGE_BUCKET).createSignedUrl(match.storagePath, 60);
  if (error || !data?.signedUrl) {
    return unavailable(request, token, "Document preview unavailable.");
  }

  return NextResponse.redirect(data.signedUrl);
}

function unavailable(request: NextRequest, token: string, message: string) {
  const url = new URL(`/upload/${encodeURIComponent(token)}`, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
