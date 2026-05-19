import type { RequiredDocumentName } from "@/types/carrier";

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

export type UploadDocumentInput = {
  carrierId?: string;
  documentName?: RequiredDocumentName;
  file: File;
  bucket: string;
  path: string;
  accessToken: string;
  onProgress?: (progress: number) => void;
};

export function validateDocumentFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_DOCUMENT_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  const hasAllowedMimeType = ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type);

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    throw new Error("Upload a PDF, JPG, PNG, DOC, or DOCX file.");
  }
}

export async function uploadCarrierDocument(input: UploadDocumentInput): Promise<{ path: string }> {
  return uploadStorageDocument(input);
}

export async function uploadStorageDocument(input: UploadDocumentInput): Promise<{ path: string }> {
  validateDocumentFile(input.file);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase environment variables are required for file uploads.");
  }

  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${input.bucket}/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", uploadUrl);
    request.setRequestHeader("apikey", anonKey);
    request.setRequestHeader("Authorization", `Bearer ${input.accessToken}`);
    request.setRequestHeader("Content-Type", getDocumentMimeType(input.file));
    request.setRequestHeader("x-upsert", "false");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        input.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        input.onProgress?.(100);
        resolve();
        return;
      }

      reject(new Error(parseStorageError(request.responseText) || "Upload failed."));
    };

    request.onerror = () => reject(new Error("Upload failed. Check your Supabase Storage policies."));
    request.send(input.file);
  });

  return { path: input.path };
}

export function getDocumentMimeType(file: File) {
  if (ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lowerName.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

function parseStorageError(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as { message?: string; error?: string };
    return parsed.message || parsed.error;
  } catch {
    return responseText;
  }
}
