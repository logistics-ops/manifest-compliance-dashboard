import { createHash } from "crypto";

export function normalizeUploadToken(token: string) {
  return token.trim();
}

export function hashUploadToken(token: string) {
  return createHash("sha256").update(normalizeUploadToken(token)).digest("hex");
}
