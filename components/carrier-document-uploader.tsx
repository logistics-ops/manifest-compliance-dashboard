"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileUp, RefreshCw, UploadCloud } from "lucide-react";
import {
  createCarrierDocumentUploadTargetAction,
  finalizeCarrierDocumentUploadAction,
  updateCarrierDocumentAction,
} from "@/app/actions/carriers";
import { getDocumentMimeType, uploadCarrierDocument, validateDocumentFile } from "@/lib/integrations/uploads";
import { createClient } from "@/lib/supabase/client";
import type { EnrichedDocument, RequiredDocumentName } from "@/types/carrier";

type CarrierDocumentUploaderProps = {
  carrierId: string;
  document: EnrichedDocument;
  canEdit: boolean;
};

const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

export function CarrierDocumentUploader({
  carrierId,
  document,
  canEdit,
}: CarrierDocumentUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expirationRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestFile, setLatestFile] = useState({
    fileName: document.fileName,
    storagePath: document.storagePath,
    uploadedAt: document.uploadedAt,
    uploadedBy: document.uploadedBy,
    versionNumber: document.versionNumber,
  });

  const isUploading = progress > 0 && progress < 100;
  const hasFile = Boolean(latestFile.storagePath);
  const uploadState = isUploading ? "uploading" : progress === 100 ? "complete" : "idle";

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files.item(0);
    if (file) {
      void handleUpload(file);
    }
  }

  async function handleUpload(file: File) {
    if (!canEdit) return;

    setError(null);
    setMessage(null);
    setProgress(1);

    try {
      validateDocumentFile(file);

      const supabase = createClient();
      if (!supabase) {
        throw new Error("Supabase is not configured for uploads.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sign in again before uploading documents.");
      }

      const target = await createCarrierDocumentUploadTargetAction({
        carrierId,
        documentName: document.name as RequiredDocumentName,
        fileName: file.name,
      });

      await uploadCarrierDocument({
        carrierId,
        documentName: document.name as RequiredDocumentName,
        file,
        bucket: target.bucket,
        path: target.path,
        accessToken: session.access_token,
        onProgress: setProgress,
      });

      const result = await finalizeCarrierDocumentUploadAction({
        carrierId,
        documentName: document.name as RequiredDocumentName,
        storagePath: target.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: getDocumentMimeType(file),
        versionNumber: target.versionNumber,
        expirationDate: expirationRef.current?.value || null,
        notes: notesRef.current?.value || null,
      });

      setLatestFile({
        fileName: file.name,
        storagePath: target.path,
        uploadedAt: result.uploadedAt,
        uploadedBy: result.uploadedBy,
        versionNumber: target.versionNumber,
      });
      setMessage(`Uploaded v${target.versionNumber}: ${file.name}`);
      startTransition(() => router.refresh());
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      setProgress(0);
    }
  }

  async function openSignedFile(download: boolean) {
    setError(null);

    if (!latestFile.storagePath) return;

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    const { data, error: signedUrlError } = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(latestFile.storagePath, 300);

    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || "Unable to create file link.");
      return;
    }

    if (download) {
      const anchor = window.document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.download = latestFile.fileName || document.name;
      anchor.click();
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <form
      action={updateCarrierDocumentAction}
      onSubmit={() => {
        setError(null);
        setMessage("Document metadata saved.");
      }}
      className="grid grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)] gap-3 rounded-md border border-white/10 bg-black/25 p-3 max-lg:grid-cols-1"
    >
      <input type="hidden" name="carrierId" value={carrierId} />
      <input type="hidden" name="documentName" value={document.name} />

      <div className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-sm:grid-cols-1">
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            Expiration Date
            <input
              ref={expirationRef}
              name="expirationDate"
              type="date"
              defaultValue={document.expirationDate ?? ""}
              disabled={!canEdit}
              className="form-control disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 px-3 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            Uploaded
            <input
              name="uploaded"
              type="checkbox"
              defaultChecked={document.uploaded}
              disabled={!canEdit}
              className="h-4 w-4 accent-manifest-red disabled:opacity-50"
            />
          </label>
        </div>

        <label
          onDragOver={(event) => {
            event.preventDefault();
            if (canEdit) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`grid min-h-24 cursor-pointer place-items-center rounded-md border border-dashed px-4 py-3 text-center transition ${
            isDragging
              ? "border-manifest-red bg-manifest-red/15"
              : uploadState === "complete"
                ? "border-manifest-green/45 bg-manifest-green/10"
                : "border-white/15 bg-black/25 hover:border-manifest-red/50 hover:bg-manifest-red/10"
          } ${canEdit ? "" : "cursor-not-allowed opacity-60"}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={!canEdit || isUploading}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUpload(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <span className="flex items-center justify-center gap-3 text-left max-sm:grid max-sm:justify-items-center max-sm:text-center">
            <UploadCloud className="h-5 w-5 shrink-0 text-manifest-red" />
            <span className="grid gap-1">
              <span className="text-sm font-extrabold text-white">
                {isUploading ? "Uploading document..." : hasFile ? "Replace document" : "Drop file or browse"}
              </span>
              <span className="text-xs font-bold text-manifest-muted">PDF, JPG, PNG, DOC, DOCX · 25 MB max</span>
            </span>
          </span>
        </label>

        {progress > 0 ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-manifest-muted">
              <span>{progress < 100 ? "Uploading securely" : "Upload complete"}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${progress === 100 ? "bg-manifest-green" : "bg-gradient-to-r from-manifest-red to-manifest-danger"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs leading-5 text-manifest-muted">
              {progress < 100 ? "Keep this tab open while the file is uploaded and versioned." : "Metadata saved and the dashboard is refreshing."}
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div className="rounded-md border border-white/10 bg-black/25 p-3">
        <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.18em] text-manifest-quiet">
          Current File
        </span>
        {hasFile ? (
          <div className="grid gap-2">
            <strong className="truncate text-sm text-white">{latestFile.fileName}</strong>
            <div className="flex flex-wrap gap-2 text-xs font-bold text-manifest-muted">
              <span>v{latestFile.versionNumber ?? 1}</span>
              {latestFile.uploadedAt ? <span>{formatDateTime(latestFile.uploadedAt)}</span> : null}
              {latestFile.uploadedBy ? <span>{latestFile.uploadedBy}</span> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void openSignedFile(false)} className="form-button">
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </button>
              <button type="button" onClick={() => void openSignedFile(true)} className="form-button">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download
              </button>
            </div>
          </div>
        ) : (
          <span className="text-sm text-manifest-muted">No file uploaded.</span>
        )}
      </div>

        <label className="grid gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-manifest-quiet">
          Document Notes
        </span>
        <textarea
          ref={notesRef}
          name="notes"
          data-carrier-id={carrierId}
          data-document-name={document.name}
          defaultValue={document.notes ?? ""}
          placeholder="Add renewal notes, upload context, or exception details."
          disabled={!canEdit}
          className="min-h-20 resize-y rounded-md border border-white/10 bg-black/35 p-3 text-sm leading-5 text-white outline-none placeholder:text-manifest-quiet focus:border-manifest-red focus:ring-2 focus:ring-manifest-red/25 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

        {message ? <p className="rounded-md border border-manifest-green/30 bg-manifest-green/10 px-3 py-2 text-xs font-bold text-manifest-green">{message}</p> : null}
        {error ? <p className="rounded-md border border-manifest-danger/35 bg-manifest-danger/10 px-3 py-2 text-xs font-bold text-manifest-danger">{error}</p> : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button className="form-button" disabled={isPending || isUploading}>
              {isPending ? "Saving..." : "Save document"}
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="form-button"
            >
              <FileUp className="mr-1.5 h-3.5 w-3.5" />
              Select file
            </button>
            {hasFile ? (
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="form-button"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Replace
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {message ? <div className="toast" role="status">{message}</div> : null}
      {error ? <div className="toast border-manifest-danger/45" role="alert">{error}</div> : null}
    </form>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
