"use client";

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";

type PublicUploadFilePickerProps = {
  uploaded: boolean;
};

export function PublicUploadFilePicker({ uploaded }: PublicUploadFilePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  function syncInputFiles(files: File[]) {
    if (!inputRef.current) return;
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    inputRef.current.files = dataTransfer.files;
  }

  function handleFilesSelected(files: FileList | null) {
    const incomingFiles = Array.from(files ?? []);
    if (!incomingFiles.length) return;

    setSelectedFiles((currentFiles) => {
      const mergedFiles = [...currentFiles];
      incomingFiles.forEach((file) => {
        const duplicate = mergedFiles.some((existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified,
        );
        if (!duplicate) mergedFiles.push(file);
      });
      syncInputFiles(mergedFiles);
      return mergedFiles;
    });
  }

  function removeFile(fileName: string, fileSize: number, lastModified: number) {
    setSelectedFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((file) =>
        file.name !== fileName ||
        file.size !== fileSize ||
        file.lastModified !== lastModified,
      );
      syncInputFiles(nextFiles);
      return nextFiles;
    });
  }

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        name="files"
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple={true}
        required
        onChange={(event) => handleFilesSelected(event.currentTarget.files)}
      />
      <button type="button" className="form-button min-h-12 w-fit px-4 text-sm max-sm:w-full" onClick={() => inputRef.current?.click()}>
        <UploadCloud className="h-4 w-4" />
        Select files
      </button>
      {selectedFiles.length ? (
        <ul className="grid gap-1 text-xs font-bold text-manifest-muted">
          <li className="rounded-md border border-manifest-red/25 bg-manifest-red/10 px-2 py-1 text-manifest-red">
            {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected
          </li>
          {selectedFiles.map((file) => (
            <li key={`${file.name}:${file.size}:${file.lastModified}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1">
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded border border-white/10 text-manifest-muted transition hover:border-manifest-red/50 hover:text-white"
                onClick={() => removeFile(file.name, file.size, file.lastModified)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <span className="min-h-5 text-xs font-bold text-manifest-muted">
          {uploaded ? "Choose replacement or additional files." : "No files selected."}
        </span>
      )}
    </div>
  );
}
