import type { NextFunction, Request, Response } from "express";
import type { AppContext } from "../app-context.js";
import { hasMatchingBearerToken } from "../lib/auth.js";
import {
  getEffectiveMcpBearerToken,
  getSystemSettings,
} from "../repos/settings-repo.js";
import { isRequestOriginAllowed } from "./origin-utils.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function createOriginGuard(context: AppContext, writeOnly: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (writeOnly && !WRITE_METHODS.has(req.method)) {
      next();
      return;
    }
    const allowedOrigins = getSystemSettings(context.db).allowedOrigins;
    if (isRequestOriginAllowed(req, allowedOrigins, context.bootstrap.trustProxy)) {
      next();
      return;
    }
    res.status(403).json({ error: "origin_not_allowed" });
  };
}

export function requireAdminAuth(context: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!context.adminSessions.hasSession(req.header("cookie"))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}

export function requireMcpAuth(context: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    const expectedToken = getEffectiveMcpBearerToken(
      context.db,
      context.bootstrap.mcpBearerToken,
    );
    if (!hasMatchingBearerToken(req.header("authorization"), expectedToken)) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    next();
  };
}

export function requireAllowedOrigin(context: AppContext) {
  return createOriginGuard(context, false);
}

export function requireAdminWriteOrigin(context: AppContext) {
  return createOriginGuard(context, true);
}
