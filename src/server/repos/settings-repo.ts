import type { AppDatabase } from "../db/database.js";
import type { FetchMode, KeyPoolProvider, SystemSettings } from "../../shared/contracts.js";

interface SettingRow {
  key: string;
  value: string;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
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
    defaultGrokModel: parseJson<string>(map.get("default_grok_model") ?? "\"grok-4-fast\""),
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
  if (settings.defaultGrokModel) {
    saveSystemSetting(db, "default_grok_model", settings.defaultGrokModel);
  }
  if (typeof settings.logRetentionDays === "number") {
    saveSystemSetting(db, "log_retention_days", settings.logRetentionDays);
  }
  if (settings.allowedOrigins) {
    saveSystemSetting(db, "allowed_origins", settings.allowedOrigins);
  }
}
