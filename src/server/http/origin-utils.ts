import type { Request } from "express";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname);
}

export function normalizeOrigin(value: string, allowHttpLocal: boolean): string {
  const parsed = parseUrl(value.trim());
  if (!parsed) {
    throw new Error("invalid_origin");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("invalid_origin");
  }
  if (parsed.pathname !== "/") {
    throw new Error("invalid_origin");
  }
  if (
    parsed.protocol !== "https:" &&
    !(allowHttpLocal && parsed.protocol === "http:" && isLocalHostname(parsed.hostname))
  ) {
    throw new Error("invalid_origin");
  }
  return parsed.origin;
}

function isSafeFetchSite(req: Request): boolean {
  const fetchSite = req.header("sec-fetch-site");
  return !fetchSite || fetchSite === "none" || fetchSite === "same-origin" || fetchSite === "same-site";
}

function getExpectedHost(req: Request, trustProxy: boolean): string | null {
  const forwardedHost = trustProxy
    ? req.header("x-forwarded-host")?.split(",")[0]?.trim()
    : null;
  return forwardedHost || req.header("host") || null;
}

export function isRequestOriginAllowed(
  req: Request,
  allowedOrigins: string[],
  trustProxy: boolean,
): boolean {
  const rawOrigin = req.header("origin");
  if (!rawOrigin) {
    return isSafeFetchSite(req);
  }

  const parsed = parseUrl(rawOrigin);
  if (!parsed) {
    return false;
  }
  if (allowedOrigins.includes(parsed.origin)) {
    return true;
  }

  const expectedHost = getExpectedHost(req, trustProxy);
  if (expectedHost && parsed.host === expectedHost) {
    return true;
  }

  return isLocalHostname(parsed.hostname);
}
