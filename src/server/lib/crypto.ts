import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function fingerprintSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

export function encryptSecret(secret: string, keyMaterial: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(keyMaterial);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, payload]).toString("base64");
}

export function decryptSecret(payload: string, keyMaterial: string): string {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(keyMaterial), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
