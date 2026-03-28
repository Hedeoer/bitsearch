import type { AppDatabase } from "../db/database.js";
import type { FetchMode, KeyPoolProvider, SystemSettings } from "../../shared/contracts.js";

const DEFAULT_SEARCH_MODEL_KEY = "default_search_model";
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
  return {
    fetchMode: parseJson<FetchMode>(map.get("fetch_mode") ?? "\"auto_ordered\""),
    providerPriority: parseJson<KeyPoolProvider[]>(
      map.get("provider_priority") ?? "[\"tavily\",\"firecrawl\"]",
    ),
    defaultSearchModel: parseJson<string>(
      map.get(DEFAULT_SEARCH_MODEL_KEY) ?? "\"grok-4-fast\"",
    ),
    logRetentionDays: parseJson<number>(map.get("log_retention_days") ?? "7"),
    allowedOrigins: parseJson<string[]>(map.get("allowed_origins") ?? "[]"),
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
  if (settings.fetchMode) {
    saveSystemSetting(db, "fetch_mode", settings.fetchMode);
  }
  if (settings.providerPriority) {
    saveSystemSetting(db, "provider_priority", settings.providerPriority);
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
