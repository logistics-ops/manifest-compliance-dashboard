"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileUp, UploadCloud } from "lucide-react";
import {
  createInspectionDocumentUploadTargetAction,
  finalizeInspectionDocumentUploadAction,
} from "@/app/actions/inspections";
import { getDocumentMimeType, uploadStorageDocument, validateDocumentFile } from "@/lib/integrations/uploads";
import { createClient } from "@/lib/supabase/client";

type InspectionDocumentUploaderProps = {
  inspectionId: string;
  defaultDocumentName?: string;
  canUpload: boolean;
};

const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

export function InspectionDocumentUploader({
  inspectionId,
  defaultDocumentName = "Inspection Evidence",
  canUpload,
}: InspectionDocumentUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentNameRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [latestFile, setLatestFile] = useState<{ storagePath: string | null; fileName: string | null; uploadedAt: string | null }>({
    storagePath: null,
    fileName: null,
    uploadedAt: null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isUploading = progress > 0 && progress < 100;

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) void handleUpload(file);
  }

  async function handleUpload(file: File) {
    if (!canUpload) return;
    setProgress(1);
    setError(null);
    setMessage(null);

    try {
      validateDocumentFile(file);
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured for uploads.");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in again before uploading inspection files.");

      const documentName = documentNameRef.current?.value.trim() || defaultDocumentName;
      const target = await createInspectionDocumentUploadTargetAction({
        inspectionId,
        documentName,
        fileName: file.name,
      });

      await uploadStorageDocument({
        file,
        bucket: target.bucket,
        path: target.path,
        accessToken: session.access_token,
        onProgress: setProgress,
      });

      const result = await finalizeInspectionDocumentUploadAction({
        inspectionId,
        documentName,
        storagePath: target.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: getDocumentMimeType(file),
        versionNumber: target.versionNumber,
      });

      setLatestFile({ storagePath: target.path, fileName: file.name, uploadedAt: result.uploadedAt });
      setMessage(`Uploaded ${file.name}`);
      router.refresh();
    } catch (uploadError) {
      setProgress(0);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    }
  }

  async function openSignedFile(download: boolean) {
    if (!latestFile.storagePath) return;
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    const { data, error: signedUrlError } = await supabase
      .storage
      .from(storageBucket)
      .createSignedUrl(latestFile.storagePath, 60, {
        download: download ? latestFile.fileName || defaultDocumentName : undefined,
      });

    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || "Unable to create file link.");
      return;
    }

    if (download) {
      const anchor = window.document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.download = latestFile.fileName || defaultDocumentName;
      anchor.click();
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-4">
      <div className="mb-3 grid grid-cols-[minmax(220px,0.65fr)_1fr] gap-3 max-md:grid-cols-1">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Evidence Type
          <input
            ref={documentNameRef}
            defaultValue={defaultDocumentName}
            disabled={!canUpload || isUploading}
            className="form-control disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label
          onDragOver={(event) => {
            event.preventDefault();
            if (canUpload) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`grid min-h-24 cursor-pointer place-items-center rounded-md border border-dashed px-4 py-3 text-center transition ${
            isDragging
              ? "border-manifest-red bg-manifest-red/15"
              : "border-white/15 bg-black/25 hover:border-manifest-red/50 hover:bg-manifest-red/10"
          } ${canUpload ? "" : "cursor-not-allowed opacity-60"}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={!canUpload || isUploading}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <span className="flex items-center justify-center gap-3 text-left max-sm:grid max-sm:justify-items-center max-sm:text-center">
            <UploadCloud className="h-5 w-5 shrink-0 text-manifest-red" />
            <span className="grid gap-1">
              <span className="text-sm font-extrabold text-white">{isUploading ? "Uploading inspection evidence..." : "Drop file or browse"}</span>
              <span className="text-xs text-manifest-muted">Photos, PDFs, DOC, or DOCX evidence.</span>
            </span>
          </span>
        </label>
      </div>

      {progress > 0 ? (
        <div className="mb-3 rounded-md border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-manifest-muted">
            <span>{progress < 100 ? "Uploading securely" : "Upload complete"}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-manifest-red transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!canUpload || isUploading} onClick={() => fileInputRef.current?.click()} className="form-button disabled:cursor-not-allowed disabled:opacity-60">
          <FileUp className="mr-1.5 h-3.5 w-3.5" />
          Select file
        </button>
        {latestFile.storagePath ? (
          <>
            <button type="button" onClick={() => void openSignedFile(false)} className="form-button">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </button>
            <button type="button" onClick={() => void openSignedFile(true)} className="form-button">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </button>
            <span className="text-xs font-bold text-manifest-muted">{latestFile.fileName}</span>
          </>
        ) : null}
      </div>

      {message ? <p className="mt-3 rounded-md border border-manifest-green/30 bg-manifest-green/10 px-3 py-2 text-xs font-bold text-manifest-green">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md border border-manifest-danger/35 bg-manifest-danger/10 px-3 py-2 text-xs font-bold text-manifest-danger">{error}</p> : null}
      {message ? <div className="toast" role="status">{message}</div> : null}
      {error ? <div className="toast border-manifest-danger/45" role="alert">{error}</div> : null}
    </div>
  );
}
