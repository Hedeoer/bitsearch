import fs from "node:fs";
import path from "node:path";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { AppContext } from "./app-context.js";
import { createAuthRouter } from "./http/auth-routes.js";
import { createAdminRouter } from "./http/admin-routes.js";
import {
  requireAdmin,
  requireAllowedOrigin,
  requireMcpAuth,
} from "./http/middleware.js";
import { handleMcpDelete, handleMcpGet, handleMcpPost } from "./mcp/transport-router.js";

function resolvePublicDirectory(): string {
  return path.resolve(process.cwd(), "dist/public");
}

export function createApp(context: AppContext) {
  const app = express();
  const publicDir = resolvePublicDirectory();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(
    session({
      secret: context.bootstrap.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    }),
  );

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/admin", createAuthRouter(context));
  app.use("/api/admin", requireAdmin(context), createAdminRouter(context));

  app.post("/mcp", requireMcpAuth(context), requireAllowedOrigin(context), (req, res, next) => {
    handleMcpPost(context, req, res).catch(next);
  });
  app.get("/mcp", requireMcpAuth(context), requireAllowedOrigin(context), (req, res, next) => {
    handleMcpGet(req, res).catch(next);
  });
  app.delete("/mcp", requireMcpAuth(context), requireAllowedOrigin(context), (req, res, next) => {
    handleMcpDelete(req, res).catch(next);
  });

  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.use((_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.type("text/plain").send("Frontend bundle not built yet. Run `npm run build`.");
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}
