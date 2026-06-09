"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

type PublicUploadFilePickerProps = {
  uploaded: boolean;
};

export function PublicUploadFilePicker({ uploaded }: PublicUploadFilePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        name="files"
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        required
        onChange={(event) => setFileNames(Array.from(event.currentTarget.files ?? []).map((file) => file.name))}
      />
      <button type="button" className="form-button min-h-12 w-fit px-4 text-sm max-sm:w-full" onClick={() => inputRef.current?.click()}>
        <UploadCloud className="h-4 w-4" />
        Select files
      </button>
      {fileNames.length ? (
        <ul className="grid gap-1 text-xs font-bold text-manifest-muted">
          {fileNames.map((fileName) => (
            <li key={fileName} className="truncate rounded-md border border-white/10 bg-black/25 px-2 py-1">
              {fileName}
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
