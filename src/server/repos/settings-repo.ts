import type { AppDatabase } from "../db/database.js";
import type { KeyPoolProvider, SystemSettings } from "../../shared/contracts.js";
import {
  createDefaultSystemSettings,
  mapLegacyRoutingSettings,
  normalizeGenericProviderOrder,
} from "../lib/generic-routing.js";

const DEFAULT_SEARCH_MODEL_KEY = "default_search_model";
const GENERIC_PROVIDER_ORDER_KEY = "generic_provider_order";
const GENERIC_ROUTING_MODE_KEY = "generic_routing_mode";
const MCP_BEARER_TOKEN_KEY = "mcp_bearer_token";

interface SettingRow {
  key: string;
  value: string;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function getStoredSetting<T>(
  db: AppDatabase,
  key: string,
): T | null {
  const row = db.sqlite
    .prepare("SELECT value FROM system_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (!row) {
    return null;
  }
  return parseJson<T>(row.value);
}

export function getSystemSettings(db: AppDatabase): SystemSettings {
  const rows = db.sqlite
    .prepare("SELECT key, value FROM system_settings")
    .all() as unknown as SettingRow[];

  const map = new Map(rows.map((row) => [row.key, row.value]));
  const defaults = createDefaultSystemSettings();
  const genericRoutingMode = getStoredSetting<SystemSettings["genericRoutingMode"]>(
    db,
    GENERIC_ROUTING_MODE_KEY,
  );
  const genericProviderOrder = getStoredSetting<KeyPoolProvider[]>(
    db,
    GENERIC_PROVIDER_ORDER_KEY,
  );
  const routingSettings =
    genericRoutingMode && genericProviderOrder
      ? {
          genericRoutingMode,
          genericProviderOrder: normalizeGenericProviderOrder(
            genericRoutingMode,
            genericProviderOrder,
          ),
        }
      : mapLegacyRoutingSettings(
          getStoredSetting<"strict_firecrawl" | "strict_tavily" | "auto_ordered">(
            db,
            "fetch_mode",
          ),
          getStoredSetting<KeyPoolProvider[]>(db, "provider_priority"),
        );

  return {
    ...routingSettings,
    defaultSearchModel: parseJson<string>(
      map.get(DEFAULT_SEARCH_MODEL_KEY) ?? JSON.stringify(defaults.defaultSearchModel),
    ),
    logRetentionDays: parseJson<number>(
      map.get("log_retention_days") ?? JSON.stringify(defaults.logRetentionDays),
    ),
    allowedOrigins: parseJson<string[]>(
      map.get("allowed_origins") ?? JSON.stringify(defaults.allowedOrigins),
    ),
  };
}

export function saveSystemSetting(db: AppDatabase, key: string, value: unknown): void {
  db.sqlite
    .prepare(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(value), db.now());
}

export function saveSystemSettings(db: AppDatabase, settings: Partial<SystemSettings>): void {
  if (settings.genericRoutingMode) {
    saveSystemSetting(db, GENERIC_ROUTING_MODE_KEY, settings.genericRoutingMode);
  }
  if (settings.genericProviderOrder) {
    const mode = settings.genericRoutingMode ?? getSystemSettings(db).genericRoutingMode;
    saveSystemSetting(
      db,
      GENERIC_PROVIDER_ORDER_KEY,
      normalizeGenericProviderOrder(mode, settings.genericProviderOrder),
    );
  }
  if (settings.defaultSearchModel) {
    saveSystemSetting(db, DEFAULT_SEARCH_MODEL_KEY, settings.defaultSearchModel);
  }
  if (typeof settings.logRetentionDays === "number") {
    saveSystemSetting(db, "log_retention_days", settings.logRetentionDays);
  }
  if (settings.allowedOrigins) {
    saveSystemSetting(db, "allowed_origins", settings.allowedOrigins);
  }
}

export function getEffectiveMcpBearerToken(
  db: AppDatabase,
  fallbackToken: string,
): string {
  const storedToken = getStoredSetting<string>(db, MCP_BEARER_TOKEN_KEY)?.trim();
  return storedToken || fallbackToken;
}

export function saveMcpBearerToken(
  db: AppDatabase,
  token: string,
): void {
  saveSystemSetting(db, MCP_BEARER_TOKEN_KEY, token);
}
