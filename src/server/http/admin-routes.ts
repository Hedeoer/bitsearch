import { Router } from "express";
import type { AppContext } from "../app-context.js";
import { getDashboardSummary } from "../repos/dashboard-repo.js";
import {
  getRequestActivity,
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
import {
  getKeyPoolSummary,
  getKeySecret,
  listManagedKeys,
  updateKeyNote,
} from "../repos/key-pool-repo.js";
import { getSystemSettings, saveSystemSettings } from "../repos/settings-repo.js";
import { syncKeyQuotas, testKeys } from "../services/key-pool-service.js";

const KEY_POOL_PROVIDERS = new Set(["tavily", "firecrawl"]);
const KEY_LIST_STATUSES = new Set([
  "all",
  "enabled",
  "disabled",
  "healthy",
  "unhealthy",
]);

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

function parseKeyPoolProvider(raw: unknown): "tavily" | "firecrawl" {
  if (!KEY_POOL_PROVIDERS.has(String(raw))) {
    throw new Error("invalid_key_pool_provider");
  }
  return String(raw) as "tavily" | "firecrawl";
}

function parseKeyStatus(raw: unknown): "all" | "enabled" | "disabled" | "healthy" | "unhealthy" {
  const value = String(raw ?? "all");
  if (!KEY_LIST_STATUSES.has(value)) {
    throw new Error("invalid_key_list_status");
  }
  return value as "all" | "enabled" | "disabled" | "healthy" | "unhealthy";
}

function parseIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

export function createAdminRouter(context: AppContext): Router {
  const router = Router();

  router.get("/dashboard", (_req, res) => {
    res.json(getDashboardSummary(context.db));
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
    const provider = parseKeyPoolProvider(req.query.provider);
    res.json(
      listManagedKeys(
        context.db,
        {
          provider,
          status: parseKeyStatus(req.query.status),
          query: String(req.query.query ?? ""),
          tag: String(req.query.tag ?? ""),
        },
        context.bootstrap.encryptionKey,
      ),
    );
  });

  router.get("/keys/summary", (req, res) => {
    const provider = parseKeyPoolProvider(req.query.provider);
    res.json(getKeyPoolSummary(context.db, provider, context.bootstrap.encryptionKey));
  });

  router.post("/keys/import-text", (req, res) => {
    const provider = parseKeyPoolProvider(req.body?.provider);
    const raw = String(req.body?.rawKeys ?? "");
    const tags = parseTags(req.body?.tags);
    res.json(importKeys(context.db, provider, parseKeyLines(raw), tags, context.bootstrap.encryptionKey));
  });

  router.post("/keys/import-csv", (req, res) => {
    const provider = parseKeyPoolProvider(req.body?.provider);
    const csv = String(req.body?.csv ?? "");
    const tags = parseTags(req.body?.tags);
    res.json(importKeys(context.db, provider, parseCsvKeys(csv), tags, context.bootstrap.encryptionKey));
  });

  router.patch("/keys/meta", (req, res) => {
    const id = String(req.body?.id ?? "");
    updateKeyNote(context.db, id, String(req.body?.note ?? ""));
    res.json({ ok: true });
  });

  router.patch("/keys/bulk", (req, res) => {
    const ids = parseIds(req.body?.ids);
    const enabled = Boolean(req.body?.enabled);
    res.json({ changed: setKeysEnabled(context.db, ids, enabled) });
  });

  router.post("/keys/test", (req, res, next) => {
    const provider = parseKeyPoolProvider(req.body?.provider);
    testKeys(context, provider, parseIds(req.body?.ids))
      .then((result) => res.json(result))
      .catch(next);
  });

  router.post("/keys/quota-sync", (req, res, next) => {
    const provider = parseKeyPoolProvider(req.body?.provider);
    syncKeyQuotas(context, provider, parseIds(req.body?.ids))
      .then((result) => res.json(result))
      .catch(next);
  });

  router.post("/keys/reveal", (req, res) => {
    const id = String(req.body?.id ?? "");
    const secret = getKeySecret(context.db, id, context.bootstrap.encryptionKey);
    if (!secret) {
      res.status(404).json({ error: "key_not_found" });
      return;
    }
    res.json({ secret });
  });

  router.delete("/keys", (req, res) => {
    const ids = parseIds(req.body?.ids);
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
