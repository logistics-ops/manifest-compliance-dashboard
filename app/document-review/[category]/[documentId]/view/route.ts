import { NextResponse, type NextRequest } from "next/server";
import { requireStaffAccess } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";
import type { DocumentReviewCategory } from "@/lib/data/document-review";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";
const categories = new Set<DocumentReviewCategory>(["carrier", "driver", "vehicle"]);

type RouteProps = {
  params: Promise<{ category: string; documentId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteProps) {
  const session = await requireStaffAccess();
  const supabase = await createClient();
  const { category, documentId } = await params;

  if (!supabase || !categories.has(category as DocumentReviewCategory) || !documentId) {
    return unavailable(request, "Document files are unavailable.");
  }

  const document = await getDocumentFiles(supabase, session, category as DocumentReviewCategory, documentId);
  if (!document) return unavailable(request, "Document files are unavailable.");

  const signedFiles = [];
  for (const file of document.files) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.storagePath, 60);
    if (!error && data?.signedUrl) {
      signedFiles.push({ ...file, signedUrl: data.signedUrl });
    }
  }

  if (!signedFiles.length) return unavailable(request, "No uploaded files are available for this document.");

  if (signedFiles.length === 1) {
    return NextResponse.redirect(signedFiles[0].signedUrl);
  }

  return new NextResponse(renderFileList(document.documentName, signedFiles), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function getDocumentFiles(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: Awaited<ReturnType<typeof requireStaffAccess>>,
  category: DocumentReviewCategory,
  documentId: string,
) {
  if (category === "carrier") {
    let query = supabase
      .from("carrier_documents")
      .select("id, organization_id, carrier_id, document_name, storage_path, file_name, uploaded_at")
      .eq("id", documentId);
    if (session.organizationId && !session.platformSuperAdmin) query = query.eq("organization_id", session.organizationId);
    const { data } = await query.maybeSingle();
    if (!data) return null;
    const { data: versions } = await supabase
      .from("carrier_document_versions")
      .select("storage_path, file_name, uploaded_at")
      .eq("organization_id", data.organization_id)
      .eq("carrier_document_id", data.id)
      .order("uploaded_at", { ascending: false });
    const files = ((versions ?? []) as Array<{ storage_path: string; file_name: string | null; uploaded_at: string | null }>).map((version) => ({
      storagePath: version.storage_path,
      fileName: version.file_name ?? fileNameFromPath(version.storage_path),
      uploadedAt: version.uploaded_at,
    }));
    const fallback = data.storage_path ? [{ storagePath: data.storage_path, fileName: data.file_name ?? fileNameFromPath(data.storage_path), uploadedAt: data.uploaded_at }] : [];
    return { documentName: data.document_name as string, files: files.length ? files : fallback };
  }

  const table = category === "driver" ? "driver_documents" : "equipment_documents";
  let query = supabase
    .from(table)
    .select("id, organization_id, document_name, storage_path, uploaded_at")
    .eq("id", documentId);
  if (session.organizationId && !session.platformSuperAdmin) query = query.eq("organization_id", session.organizationId);
  const { data } = await query.maybeSingle();
  if (!data?.storage_path) return null;
  return {
    documentName: data.document_name as string,
    files: [{ storagePath: data.storage_path as string, fileName: fileNameFromPath(data.storage_path as string), uploadedAt: data.uploaded_at as string | null }],
  };
}

function unavailable(request: NextRequest, message: string) {
  const url = new URL("/document-review", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

function renderFileList(documentName: string, files: Array<{ fileName: string | null; uploadedAt: string | null; signedUrl: string }>) {
  const items = files.map((file) => `
    <li>
      <a href="${escapeHtml(file.signedUrl)}" target="_blank" rel="noopener noreferrer">
        <strong>${escapeHtml(file.fileName ?? "Uploaded file")}</strong>
        <span>${file.uploadedAt ? escapeHtml(new Date(file.uploadedAt).toLocaleString("en-US")) : "Uploaded file"}</span>
      </a>
    </li>
  `).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentName)} files</title>
  <style>
    body{margin:0;background:#08080a;color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
    main{max-width:760px;margin:0 auto}
    section{border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.35);border-radius:8px;padding:20px}
    p{color:#a7a7ad;line-height:1.6}
    ul{list-style:none;padding:0;margin:18px 0 0;display:grid;gap:10px}
    a{display:flex;justify-content:space-between;gap:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.035);border-radius:8px;padding:14px;color:#fff;text-decoration:none}
    a:hover{border-color:rgba(227,25,55,.65);background:rgba(227,25,55,.12)}
    span{color:#a7a7ad;font-size:12px}
    @media(max-width:560px){body{padding:12px}a{display:grid}}
  </style>
</head>
<body>
  <main>
    <section>
      <h1>${escapeHtml(documentName)}</h1>
      <p>These secure review links expire shortly. Open each file you need to review.</p>
      <ul>${items}</ul>
    </section>
  </main>
</body>
</html>`;
}

function fileNameFromPath(storagePath: string | null) {
  if (!storagePath) return null;
  return storagePath.split("/").pop() ?? null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}
