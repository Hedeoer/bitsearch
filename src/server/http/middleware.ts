import type { NextFunction, Request, Response } from "express";
import type { AppContext } from "../app-context.js";
import { getAdminUsername } from "../repos/admin-repo.js";
import { getSystemSettings } from "../repos/settings-repo.js";

export function requireAdmin(context: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session.adminUserId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const username = getAdminUsername(context.db, userId);
    if (!username) {
      req.session.destroy(() => undefined);
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.locals.adminUsername = username;
    next();
  };
}

export function requireMcpAuth(context: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.header("authorization") ?? "";
    if (authHeader !== `Bearer ${context.bootstrap.mcpBearerToken}`) {
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
