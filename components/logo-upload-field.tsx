"use client";

import { ImageUp } from "lucide-react";
import { useState, type ChangeEvent } from "react";

export function LogoUploadField({
  defaultValue,
  organizationName,
}: {
  defaultValue: string;
  organizationName: string;
}) {
  const [logoUrl, setLogoUrl] = useState(defaultValue);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose a PNG, JPG, SVG, or WebP logo.");
      event.currentTarget.value = "";
      return;
    }

    if (file.size > 250_000) {
      setError("Logo must be under 250 KB for this setup step.");
      event.currentTarget.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="logoUrl" value={logoUrl} />
      <div className="flex items-center gap-3 rounded-md border border-white/10 bg-black/25 p-3">
        {logoUrl ? (
          <img src={logoUrl} alt={`${organizationName} logo preview`} className="h-14 w-14 rounded-md border border-white/10 bg-black/30 object-contain p-1" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-md border border-dashed border-white/15 bg-black/30 text-manifest-muted">
            <ImageUp className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <label className="form-button cursor-pointer">
            <ImageUp className="h-3.5 w-3.5" />
            Upload logo
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleFile} className="sr-only" />
          </label>
          <p className="mt-2 truncate text-xs font-bold text-manifest-muted">
            {fileName ?? "PNG, JPG, SVG, or WebP under 250 KB"}
          </p>
        </div>
      </div>
      {error ? <p className="rounded-md border border-manifest-danger/35 bg-manifest-danger/10 px-3 py-2 text-xs font-bold text-manifest-danger">{error}</p> : null}
    </div>
  );
}
