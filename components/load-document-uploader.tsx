"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, UploadCloud } from "lucide-react";
import {
  createLoadDocumentUploadTargetAction,
  finalizeLoadDocumentUploadAction,
} from "@/app/actions/loads";
import { getDocumentMimeType, uploadStorageDocument, validateDocumentFile } from "@/lib/integrations/uploads";
import { createClient } from "@/lib/supabase/client";
import type { LoadDocument, LoadDocumentType } from "@/types/load";

export function LoadDocumentUploader({
  loadId,
  documentType,
  label,
  document,
  canUpload,
}: {
  loadId: string;
  documentType: LoadDocumentType;
  label: string;
  document: LoadDocument | null;
  canUpload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    if (!canUpload) return;

    setError(null);
    setMessage(null);
    setProgress(1);

    try {
      validateDocumentFile(file);
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured for uploads.");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in again before uploading documents.");

      const target = await createLoadDocumentUploadTargetAction({
        loadId,
        documentType,
        fileName: file.name,
      });

      await uploadStorageDocument({
        file,
        bucket: target.bucket,
        path: target.path,
        accessToken: session.access_token,
        onProgress: setProgress,
      });

      await finalizeLoadDocumentUploadAction({
        loadId,
        documentType,
        storagePath: target.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: getDocumentMimeType(file),
        versionNumber: target.versionNumber,
      });

      setMessage(`Uploaded v${target.versionNumber}: ${file.name}`);
      startTransition(() => router.refresh());
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      setProgress(0);
    }
  }

  return (
    <section className="rounded-md border border-white/10 bg-black/25 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="panel-label">{label}</p>
          <h3 className="text-lg font-extrabold text-white">{document ? document.fileName : "No file uploaded"}</h3>
          {document ? (
            <p className="mt-1 text-xs font-bold text-manifest-muted">
              v{document.versionNumber} · {formatDate(document.uploadedAt)} · {document.uploadedBy ?? "Unknown user"}
            </p>
          ) : null}
        </div>
        <UploadCloud className="h-5 w-5 text-manifest-red" />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={!canUpload || isPending || (progress > 0 && progress < 100)}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
          event.currentTarget.value = "";
        }}
      />

      {progress > 0 ? (
        <div className="mb-3 grid gap-2">
          <div className="flex justify-between text-xs font-bold text-manifest-muted">
            <span>{progress < 100 ? "Uploading" : "Upload complete"}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-manifest-red transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {message ? <p className="mb-3 rounded-md border border-manifest-green/30 bg-manifest-green/10 px-3 py-2 text-xs font-bold text-manifest-green">{message}</p> : null}
      {error ? <p className="mb-3 rounded-md border border-manifest-danger/35 bg-manifest-danger/10 px-3 py-2 text-xs font-bold text-manifest-danger">{error}</p> : null}

      {canUpload ? (
        <button type="button" onClick={() => inputRef.current?.click()} className="form-button min-h-10 px-3 text-sm">
          <FileUp className="h-4 w-4" />
          {document ? "Replace document" : "Upload document"}
        </button>
      ) : (
        <p className="text-sm text-manifest-muted">You can view this load, but uploads are not available for your role.</p>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
