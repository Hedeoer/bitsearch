import { Router } from "express";
import { SEARCH_ENGINE_PROVIDER } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import { HttpRequestError } from "../lib/http.js";
import { getDashboardSummary } from "../repos/dashboard-repo.js";
import {
  getRequestActivity,
  listRequestActivities,
  listRequestAttempts,
  listRequestLogs,
  type ActivityFilters,
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
import {
  getEffectiveMcpBearerToken,
  getSystemSettings,
  saveMcpBearerToken,
  saveSystemSettings,
} from "../repos/settings-repo.js";
import {
  getAdminAccessInfo,
  getAdminAuthKey,
  saveAdminAuthKey,
} from "../services/admin-access-service.js";
import { syncKeyQuotas, testKeys } from "../services/key-pool-service.js";
import { getMcpAccessInfo } from "../services/mcp-access-service.js";
import { listAvailableSearchEngineModels } from "../services/search-engine-service.js";
import {
  csvEscape,
  parseAdminAccessPayload,
  parseCsvKeys,
  parseIds,
  parseKeyLines,
  parseMcpAccessPayload,
  parseKeyPoolProvider,
  parseKeyStatus,
  parseLimit,
  parsePage,
  parseOptionalKeyPoolProvider,
  parseProviderConfigPayload,
  parseRemoteProvider,
  parseRequiredId,
  parseSystemSettingsPayload,
  parseTags,
} from "./admin-route-utils.js";

export function createAdminRouter(context: AppContext): Router {
  const router = Router();
  const allowHttpLocal = process.env.NODE_ENV !== "production";

  router.get("/dashboard", (_req, res) => {
    res.json(getDashboardSummary(context.db));
  });

  router.get("/system", (_req, res) => {
    res.json(getSystemSettings(context.db));
  });

  router.put("/system", (req, res) => {
    saveSystemSettings(context.db, parseSystemSettingsPayload(req.body ?? {}, allowHttpLocal));
    res.json(getSystemSettings(context.db));
  });

  router.get("/mcp-access", (req, res) => {
    res.json(getMcpAccessInfo(context, req));
  });

  router.put("/mcp-access", (req, res) => {
    const payload = parseMcpAccessPayload(req.body ?? {});
    saveMcpBearerToken(context.db, payload.bearerToken);
    res.json(getMcpAccessInfo(context, req));
  });

  router.post("/mcp-access/reveal", (_req, res) => {
    res.json({
      secret: getEffectiveMcpBearerToken(
        context.db,
        context.bootstrap.mcpBearerToken,
      ),
    });
  });

  router.get("/admin-access", (_req, res) => {
    res.json(getAdminAccessInfo(context));
  });

  router.put("/admin-access", (req, res) => {
    const payload = parseAdminAccessPayload(req.body ?? {});
    saveAdminAuthKey(context, payload.authKey);
    res.json(getAdminAccessInfo(context));
  });

  router.post("/admin-access/reveal", (_req, res) => {
    res.json({
      secret: getAdminAuthKey(context),
    });
  });

  router.get("/providers", (_req, res) => {
    res.json(listProviderConfigs(context.db));
  });

  router.put("/providers/:provider", (req, res) => {
    const provider = parseRemoteProvider(req.params.provider);
    const payload = parseProviderConfigPayload(req.body ?? {}, allowHttpLocal);
    saveProviderConfig(context.db, provider, {
      ...payload,
      encryptionKey: context.bootstrap.encryptionKey,
    });
    res.json(listProviderConfigs(context.db));
  });

  router.get("/providers/:provider/models", (req, res) => {
    const provider = parseRemoteProvider(req.params.provider);
    if (provider !== SEARCH_ENGINE_PROVIDER) {
      res.status(400).json({ error: "provider_model_listing_not_supported" });
      return;
    }
    listAvailableSearchEngineModels(context)
      .then((models) => {
        res.json({
          provider,
          models,
        });
      })
      .catch((error) => {
        if (error instanceof HttpRequestError) {
          res.status(502).json({ message: error.message || "search_engine_models_fetch_failed" });
          return;
        }
        res.status(400).json({
          message: error instanceof Error ? error.message : "search_engine_models_unavailable",
        });
      });
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
    const id = parseRequiredId(req.body?.id, "invalid_key_id");
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
    const id = parseRequiredId(req.body?.id, "invalid_key_id");
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
    const provider = parseOptionalKeyPoolProvider(req.query.provider);
    const rows = listProviderKeys(context.db, provider);
    const csv = [
      [
        "fingerprint",
        "name",
        "provider",
        "enabled",
        "tags",
        "last_used_at",
        "last_error",
        "last_status_code",
      ].map(csvEscape).join(","),
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
        ].map(csvEscape).join(","),
      ),
    ].join("\n");
    res.type("text/csv").send(csv);
  });

  router.get("/logs", (req, res) => {
    res.json(listRequestLogs(context.db, parseLimit(req.query.limit, 100, 500)));
  });

  router.get("/activity", (req, res) => {
    const page = parsePage(req.query.page);
    const pageSize = parseLimit(req.query.pageSize, 25, 100);
    const filters: ActivityFilters = {
      toolName: req.query.toolName ? String(req.query.toolName) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      timePreset: req.query.timePreset ? String(req.query.timePreset) : undefined,
      customStart: req.query.customStart ? String(req.query.customStart) : undefined,
      customEnd: req.query.customEnd ? String(req.query.customEnd) : undefined,
      query: req.query.q ? String(req.query.q) : undefined,
    };
    res.json(listRequestActivities(context.db, page, pageSize, filters));
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
    res.json(listRequestAttempts(context.db, parseLimit(req.query.limit, 200, 1000)));
  });

  return router;
}
