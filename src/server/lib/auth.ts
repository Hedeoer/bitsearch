import { createHash, timingSafeEqual } from "node:crypto";

function hashToken(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token ? token : null;
}

export function hasMatchingBearerToken(
  header: string | undefined,
  expectedToken: string,
): boolean {
  const actualToken = parseBearerToken(header);
  if (!actualToken) {
    return false;
  }
  return timingSafeEqual(hashToken(actualToken), hashToken(expectedToken));
}

export function hasMatchingSecret(
  value: string,
  expectedSecret: string,
): boolean {
  if (!value.trim()) {
    return false;
  }
  return timingSafeEqual(hashToken(value.trim()), hashToken(expectedSecret));
}
