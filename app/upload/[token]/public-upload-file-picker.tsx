"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

type PublicUploadFilePickerProps = {
  uploaded: boolean;
};

export function PublicUploadFilePicker({ uploaded }: PublicUploadFilePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        name="file"
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        required
        onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? null)}
      />
      <button type="button" className="form-button min-h-12 w-fit px-4 text-sm max-sm:w-full" onClick={() => inputRef.current?.click()}>
        <UploadCloud className="h-4 w-4" />
        Select File
      </button>
      <span className="min-h-5 text-xs font-bold text-manifest-muted">
        {fileName ?? (uploaded ? "Choose a replacement file." : "No file selected.")}
      </span>
    </div>
  );
}
