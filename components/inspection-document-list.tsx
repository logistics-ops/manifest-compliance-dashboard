"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { InspectionDocument } from "@/lib/data/inspections";

type InspectionDocumentListProps = {
  documents: InspectionDocument[];
};

const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

export function InspectionDocumentList({ documents }: InspectionDocumentListProps) {
  const [error, setError] = useState<string | null>(null);

  async function openSignedFile(document: InspectionDocument, download: boolean) {
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    const { data, error: signedUrlError } = await supabase
      .storage
      .from(storageBucket)
      .createSignedUrl(document.storagePath, 60, {
        download: download ? document.fileName : undefined,
      });

    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || "Unable to create file link.");
      return;
    }

    if (download) {
      const anchor = window.document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.download = document.fileName;
      anchor.click();
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (!documents.length) return <div className="empty-state">No inspection evidence uploaded yet.</div>;

  return (
    <div className="grid gap-3">
      {documents.map((document) => (
        <article key={document.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-md:grid-cols-1">
          <div className="min-w-0">
            <strong className="block truncate text-sm text-white">{document.fileName}</strong>
            <span className="mt-1 block text-xs text-manifest-muted">{document.documentName} · {formatDateTime(document.uploadedAt)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void openSignedFile(document, false)} className="form-button">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </button>
            <button type="button" onClick={() => void openSignedFile(document, true)} className="form-button">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </article>
      ))}
      {error ? <p className="rounded-md border border-manifest-danger/35 bg-manifest-danger/10 px-3 py-2 text-xs font-bold text-manifest-danger">{error}</p> : null}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
