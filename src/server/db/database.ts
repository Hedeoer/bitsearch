import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import type { BootstrapConfig } from "../bootstrap.js";
import { SCHEMA_SQL } from "./schema.js";

export interface AppDatabase {
  sqlite: DatabaseSync;
  now(): string;
}

function ensureDataDirectory(databasePath: string): void {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function seedAdminUser(db: DatabaseSync, config: BootstrapConfig, now: string): void {
  const count = db.prepare("SELECT COUNT(*) AS count FROM admin_users").get() as {
    count: number;
  };
  if (count.count > 0) {
    return;
  }

  db.prepare(
    "INSERT INTO admin_users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
  ).run(nanoid(), config.adminUsername, bcrypt.hashSync(config.adminPassword, 10), now);
}

function seedSystemSettings(db: DatabaseSync, now: string): void {
  const defaults = [
    ["fetch_mode", JSON.stringify("auto_ordered")],
    ["provider_priority", JSON.stringify(["tavily", "firecrawl"])],
    ["default_grok_model", JSON.stringify("grok-4-fast")],
    ["log_retention_days", JSON.stringify(7)],
    ["allowed_origins", JSON.stringify([])],
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
  const now = new Date().toISOString();
  seedAdminUser(sqlite, config, now);
  seedSystemSettings(sqlite, now);
  seedProviderConfigs(sqlite, now);
  return {
    sqlite,
    now: () => new Date().toISOString(),
  };
}
