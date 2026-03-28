import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Response } from "express";

const SESSION_COOKIE_NAME = "bitsearch_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface SessionRecord {
  expiresAt: number;
}

export interface AdminSessionStore {
  createSession(res: Response): void;
  destroySession(cookieHeader: string | undefined, res: Response): void;
  hasSession(cookieHeader: string | undefined): boolean;
  cleanupExpired(): number;
}

function createSignature(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId, "utf8").digest("base64url");
}

function buildCookieValue(sessionId: string, secret: string): string {
  return `${sessionId}.${createSignature(sessionId, secret)}`;
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) {
    return cookies;
  }

  for (const chunk of header.split(";")) {
    const [name, ...parts] = chunk.trim().split("=");
    if (!name || parts.length === 0) {
      continue;
    }
    cookies.set(name, parts.join("="));
  }
  return cookies;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readSessionId(cookieHeader: string | undefined, secret: string): string | null {
  const cookieValue = parseCookies(cookieHeader).get(SESSION_COOKIE_NAME);
  if (!cookieValue) {
    return null;
  }

  const [sessionId, signature] = cookieValue.split(".");
  if (!sessionId || !signature) {
    return null;
  }

  return safeEqual(signature, createSignature(sessionId, secret))
    ? sessionId
    : null;
}

function buildCookieOptions(clear = false) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(clear ? {} : { maxAge: SESSION_TTL_MS }),
  };
}

export function createAdminSessionStore(secret: string): AdminSessionStore {
  const sessions = new Map<string, SessionRecord>();

  function cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, record] of sessions.entries()) {
      if (record.expiresAt > now) {
        continue;
      }
      sessions.delete(sessionId);
      removed += 1;
    }

    return removed;
  }

  return {
    createSession(res) {
      const sessionId = randomUUID();
      sessions.set(sessionId, { expiresAt: Date.now() + SESSION_TTL_MS });
      res.cookie(SESSION_COOKIE_NAME, buildCookieValue(sessionId, secret), buildCookieOptions());
    },
    destroySession(cookieHeader, res) {
      const sessionId = readSessionId(cookieHeader, secret);
      if (sessionId) {
        sessions.delete(sessionId);
      }
      res.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions(true));
    },
    hasSession(cookieHeader) {
      const sessionId = readSessionId(cookieHeader, secret);
      if (!sessionId) {
        return false;
      }

      const record = sessions.get(sessionId);
      if (!record) {
        return false;
      }
      if (record.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return false;
      }
      return true;
    },
    cleanupExpired,
  };
}
