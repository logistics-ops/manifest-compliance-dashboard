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

  const files = match.files.length ? match.files : [{ fileName: match.fileName, storagePath: match.storagePath, uploadedAt: match.uploadedAt }];
  const signedFiles = [];

  for (const file of files) {
    if (!file.storagePath) continue;
    const { data, error } = await adminSupabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.storagePath, 60);
    if (!error && data?.signedUrl) {
      signedFiles.push({
        fileName: file.fileName ?? "Uploaded file",
        uploadedAt: file.uploadedAt,
        signedUrl: data.signedUrl,
      });
    }
  }

  if (!signedFiles.length) {
    return unavailable(request, token, "Document preview unavailable.");
  }

  if (signedFiles.length === 1) {
    return NextResponse.redirect(signedFiles[0].signedUrl);
  }

  return new NextResponse(renderFileList(documentName, signedFiles), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function unavailable(request: NextRequest, token: string, message: string) {
  const url = new URL(`/upload/${encodeURIComponent(token)}`, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

function renderFileList(documentName: string, files: Array<{ fileName: string; uploadedAt: string | null; signedUrl: string }>) {
  const items = files.map((file) => `
    <li>
      <a href="${escapeHtml(file.signedUrl)}" target="_blank" rel="noopener noreferrer">
        <strong>${escapeHtml(file.fileName)}</strong>
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
      <p>These secure links expire shortly. Open each file you need to review.</p>
      <ul>${items}</ul>
    </section>
  </main>
</body>
</html>`;
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
