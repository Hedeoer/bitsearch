import { Router } from "express";
import type { AppContext } from "../app-context.js";
import {
  getRequestActivity,
  getDashboardSummary,
  listRequestActivities,
  listRequestAttempts,
  listRequestLogs,
} from "../repos/log-repo.js";
import {
  deleteKeys,
  importKeys,
  listProviderConfigs,
  listProviderKeys,
  saveProviderConfig,
  setKeysEnabled,
} from "../repos/provider-repo.js";
import { getSystemSettings, saveSystemSettings } from "../repos/settings-repo.js";
import { getAdminProfile, updateAdminPassword } from "../repos/admin-repo.js";

function parseTags(raw: unknown): string[] {
  return String(raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsvKeys(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter(Boolean);
}

export function createAdminRouter(context: AppContext): Router {
  const router = Router();

  router.get("/dashboard", (_req, res) => {
    res.json(getDashboardSummary(context.db));
  });

  router.get("/profile", (req, res) => {
    const profile = req.session.adminUserId
      ? getAdminProfile(context.db, req.session.adminUserId)
      : null;
    if (!profile) {
      res.status(404).json({ error: "admin_profile_not_found" });
      return;
    }
    res.json(profile);
  });

  router.put("/profile/password", (req, res) => {
    const userId = req.session.adminUserId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const currentPassword = String(req.body?.currentPassword ?? "");
    const nextPassword = String(req.body?.nextPassword ?? "");
    const result = updateAdminPassword(
      context.db,
      userId,
      currentPassword,
      nextPassword,
    );
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({ ok: true });
  });

  router.get("/system", (_req, res) => {
    res.json(getSystemSettings(context.db));
  });

  router.put("/system", (req, res) => {
    saveSystemSettings(context.db, req.body ?? {});
    res.json(getSystemSettings(context.db));
  });

  router.get("/providers", (_req, res) => {
    res.json(listProviderConfigs(context.db));
  });

  router.put("/providers/:provider", (req, res) => {
    const provider = req.params.provider as "grok" | "tavily" | "firecrawl";
    saveProviderConfig(context.db, provider, {
      enabled: Boolean(req.body?.enabled),
      baseUrl: String(req.body?.baseUrl ?? ""),
      timeoutMs: Number(req.body?.timeoutMs ?? 30000),
      apiKey: req.body?.apiKey === undefined ? undefined : String(req.body.apiKey),
      encryptionKey: context.bootstrap.encryptionKey,
    });
    res.json(listProviderConfigs(context.db));
  });

  router.get("/keys", (req, res) => {
    const provider = req.query.provider as "tavily" | "firecrawl" | undefined;
    res.json(listProviderKeys(context.db, provider));
  });

  router.post("/keys/import-text", (req, res) => {
    const provider = req.body?.provider as "tavily" | "firecrawl";
    const raw = String(req.body?.rawKeys ?? "");
    const tags = parseTags(req.body?.tags);
    res.json(importKeys(context.db, provider, parseKeyLines(raw), tags, context.bootstrap.encryptionKey));
  });

  router.post("/keys/import-csv", (req, res) => {
    const provider = req.body?.provider as "tavily" | "firecrawl";
    const csv = String(req.body?.csv ?? "");
    const tags = parseTags(req.body?.tags);
    res.json(importKeys(context.db, provider, parseCsvKeys(csv), tags, context.bootstrap.encryptionKey));
  });

  router.patch("/keys/bulk", (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const enabled = Boolean(req.body?.enabled);
    res.json({ changed: setKeysEnabled(context.db, ids, enabled) });
  });

  router.delete("/keys", (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    res.json({ changed: deleteKeys(context.db, ids) });
  });

  router.get("/keys/export.csv", (req, res) => {
    const provider = req.query.provider as "tavily" | "firecrawl" | undefined;
    const rows = listProviderKeys(context.db, provider);
    const csv = [
      "fingerprint,name,provider,enabled,tags,last_used_at,last_error,last_status_code",
      ...rows.map((row) =>
        [
          row.fingerprint,
          row.name,
          row.provider,
          row.enabled ? "true" : "false",
          row.tags.join("|"),
          row.lastUsedAt ?? "",
          row.lastError ?? "",
          row.lastStatusCode ?? "",
        ].join(","),
      ),
    ].join("\n");
    res.type("text/csv").send(csv);
  });

  router.get("/logs", (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    res.json(listRequestLogs(context.db, Math.min(limit, 500)));
  });

  router.get("/activity", (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    res.json(listRequestActivities(context.db, Math.min(limit, 500)));
  });

  router.get("/activity/:requestId", (req, res) => {
    const activity = getRequestActivity(context.db, req.params.requestId);
    if (!activity) {
      res.status(404).json({ error: "activity_not_found" });
      return;
    }
    res.json(activity);
  });

  router.get("/logs/attempts", (req, res) => {
    const limit = Number(req.query.limit ?? 200);
    res.json(listRequestAttempts(context.db, Math.min(limit, 1000)));
  });

  return router;
}
