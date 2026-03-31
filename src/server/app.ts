import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import type { AppContext } from "./app-context.js";
import { createAuthRouter } from "./http/auth-routes.js";
import { createAdminRouter } from "./http/admin-routes.js";
import {
  requireAdminAuth,
  requireAdminWriteOrigin,
  requireMcpAuth,
} from "./http/middleware.js";
import { AppHttpError } from "./lib/http.js";
import { handleMcpDelete, handleMcpGet, handleMcpPost } from "./mcp/transport-router.js";

function resolvePublicDirectory(): string {
  return path.resolve(process.cwd(), "dist/public");
}

function buildCspDirectives() {
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", "data:"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    imgSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  };
}

export function createApp(context: AppContext) {
  const app = express();
  const publicDir = resolvePublicDirectory();

  if (context.bootstrap.trustProxy) {
    app.set("trust proxy", 1);
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: buildCspDirectives(),
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/admin", createAuthRouter(context));
  app.use(
    "/api/admin",
    requireAdminAuth(context),
    requireAdminWriteOrigin(context),
    createAdminRouter(context),
  );

  app.post("/mcp", requireMcpAuth(context), (req, res, next) => {
    handleMcpPost(context, req, res).catch(next);
  });
  app.get("/mcp", requireMcpAuth(context), (req, res, next) => {
    handleMcpGet(req, res).catch(next);
  });
  app.delete("/mcp", requireMcpAuth(context), (req, res, next) => {
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
    if (error instanceof AppHttpError) {
      res.status(error.statusCode).json({ error: error.code });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}
