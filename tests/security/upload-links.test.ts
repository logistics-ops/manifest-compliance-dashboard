import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { hashUploadToken, normalizeUploadToken } from "../../lib/security/upload-token";

test("secure upload link hashing uses normalized raw token bytes", () => {
  const token = "abcDEF123_-";
  const expected = createHash("sha256").update(token).digest("hex");

  assert.equal(normalizeUploadToken(` ${token}\n`), token);
  assert.equal(hashUploadToken(token), expected);
  assert.equal(hashUploadToken(` ${token}\n`), expected);
});
