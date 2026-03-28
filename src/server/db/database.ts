import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { BootstrapConfig } from "../bootstrap.js";
import { SCHEMA_SQL } from "./schema.js";

export interface AppDatabase {
  sqlite: DatabaseSync;
  now(): string;
}

function columnExists(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === column);
}

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  alterSql: string,
): void {
  if (!columnExists(db, table, column)) {
    db.exec(alterSql);
  }
}

function ensureDataDirectory(databasePath: string): void {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function applyMigrations(db: DatabaseSync): void {
  ensureColumn(
    db,
    "admin_users",
    "password_updated_at",
    "ALTER TABLE admin_users ADD COLUMN password_updated_at TEXT",
  );
  ensureColumn(
    db,
    "request_logs",
    "input_json",
    "ALTER TABLE request_logs ADD COLUMN input_json TEXT",
  );
  ensureColumn(
    db,
    "request_logs",
    "result_preview",
    "ALTER TABLE request_logs ADD COLUMN result_preview TEXT",
  );
  ensureColumn(
    db,
    "request_logs",
    "messages_json",
    "ALTER TABLE request_logs ADD COLUMN messages_json TEXT",
  );
  ensureColumn(
    db,
    "request_logs",
    "provider_order_json",
    "ALTER TABLE request_logs ADD COLUMN provider_order_json TEXT NOT NULL DEFAULT '[]'",
  );
  ensureColumn(
    db,
    "request_logs",
    "metadata_json",
    "ALTER TABLE request_logs ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'",
  );
  ensureColumn(
    db,
    "request_attempt_logs",
    "error_type",
    "ALTER TABLE request_attempt_logs ADD COLUMN error_type TEXT",
  );
  ensureColumn(
    db,
    "request_attempt_logs",
    "provider_base_url",
    "ALTER TABLE request_attempt_logs ADD COLUMN provider_base_url TEXT",
  );
  ensureColumn(
    db,
    "provider_keys",
    "note",
    "ALTER TABLE provider_keys ADD COLUMN note TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(
    db,
    "provider_keys",
    "last_check_status",
    "ALTER TABLE provider_keys ADD COLUMN last_check_status TEXT NOT NULL DEFAULT 'unknown'",
  );
  ensureColumn(
    db,
    "provider_keys",
    "last_checked_at",
    "ALTER TABLE provider_keys ADD COLUMN last_checked_at TEXT",
  );
  ensureColumn(
    db,
    "provider_keys",
    "last_check_error",
    "ALTER TABLE provider_keys ADD COLUMN last_check_error TEXT",
  );
  ensureColumn(
    db,
    "provider_keys",
    "quota_json",
    "ALTER TABLE provider_keys ADD COLUMN quota_json TEXT NOT NULL DEFAULT '{}'",
  );
  ensureColumn(
    db,
    "provider_keys",
    "quota_synced_at",
    "ALTER TABLE provider_keys ADD COLUMN quota_synced_at TEXT",
  );
}

function seedSystemSettings(
  db: DatabaseSync,
  now: string,
  mcpBearerToken: string,
): void {
  const defaults = [
    ["fetch_mode", JSON.stringify("auto_ordered")],
    ["provider_priority", JSON.stringify(["tavily", "firecrawl"])],
    ["default_grok_model", JSON.stringify("grok-4-fast")],
    ["log_retention_days", JSON.stringify(7)],
    ["allowed_origins", JSON.stringify([])],
    ["mcp_bearer_token", JSON.stringify(mcpBearerToken)],
  ];
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)",
  );
  for (const [key, value] of defaults) {
    stmt.run(key, value, now);
  }
}

function seedProviderConfigs(db: DatabaseSync, now: string): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO provider_configs (provider, enabled, base_url, api_key_encrypted, timeout_ms, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  stmt.run("grok", 0, "", "", 30000, now);
  stmt.run("tavily", 0, "https://api.tavily.com", "", 30000, now);
  stmt.run("firecrawl", 0, "https://api.firecrawl.dev/v2", "", 30000, now);
}

export function createDatabase(config: BootstrapConfig): AppDatabase {
  ensureDataDirectory(config.databasePath);
  const sqlite = new DatabaseSync(config.databasePath);
  sqlite.exec(SCHEMA_SQL);
  applyMigrations(sqlite);
  const now = new Date().toISOString();
  seedSystemSettings(sqlite, now, config.mcpBearerToken);
  seedProviderConfigs(sqlite, now);
  return {
    sqlite,
    now: () => new Date().toISOString(),
  };
}
