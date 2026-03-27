import type { NextFunction, Request, Response } from "express";
import type { AppContext } from "../app-context.js";
import { hasMatchingBearerToken } from "../lib/auth.js";
import { getSystemSettings } from "../repos/settings-repo.js";

export function requireAdminAuth(context: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hasMatchingBearerToken(req.header("authorization"), context.bootstrap.adminAuthKey)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}

export function requireMcpAuth(context: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hasMatchingBearerToken(req.header("authorization"), context.bootstrap.mcpBearerToken)) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    next();
  };
}

export function requireAllowedOrigin(context: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header("origin");
    const allowedOrigins = getSystemSettings(context.db).allowedOrigins;
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      next();
      return;
    }
    res.status(403).json({ error: "origin_not_allowed" });
  };
}
