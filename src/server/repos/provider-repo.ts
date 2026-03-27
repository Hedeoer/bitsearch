import { nanoid } from "nanoid";
import type {
  KeyPoolProvider,
  ProviderConfigRecord,
  ProviderKeyRecord,
  RemoteProvider,
} from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";
import { decryptSecret, encryptSecret, fingerprintSecret } from "../lib/crypto.js";

interface ProviderConfigRow {
  provider: RemoteProvider;
  enabled: number;
  base_url: string;
  api_key_encrypted: string;
  timeout_ms: number;
  updated_at: string;
}

interface ProviderKeyRow {
  id: string;
  provider: KeyPoolProvider;
  name: string;
  fingerprint: string;
  enabled: number;
  encrypted_key: string;
  tags_json: string;
  note?: string;
  last_check_status?: string;
  last_checked_at?: string | null;
  last_check_error?: string | null;
  last_used_at: string | null;
  last_error: string | null;
  last_status_code: number | null;
  quota_json?: string;
  quota_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

function mapProviderConfig(row: ProviderConfigRow): ProviderConfigRecord {
  const countRow = row as ProviderConfigRow & { key_count?: number };
  return {
    provider: row.provider,
    enabled: Boolean(row.enabled),
    baseUrl: row.base_url,
    hasApiKey: Boolean(row.api_key_encrypted),
    keyCount: Number(countRow.key_count ?? 0),
    timeoutMs: row.timeout_ms,
    updatedAt: row.updated_at,
  };
}

function mapProviderKey(row: ProviderKeyRow): ProviderKeyRecord {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    fingerprint: row.fingerprint,
    maskedValue: row.fingerprint,
    enabled: Boolean(row.enabled),
    tags: JSON.parse(row.tags_json) as string[],
    note: row.note ?? "",
    healthStatus:
      row.last_check_status === "healthy" || row.last_check_status === "unhealthy"
        ? row.last_check_status
        : "unknown",
    lastCheckedAt: row.last_checked_at ?? null,
    lastCheckError: row.last_check_error ?? null,
    lastUsedAt: row.last_used_at,
    lastError: row.last_error,
    lastStatusCode: row.last_status_code,
    requestCount: 0,
    failureCount: 0,
    quota:
      typeof row.quota_json === "string" && row.quota_json.length > 0
        ? (JSON.parse(row.quota_json) as ProviderKeyRecord["quota"])
        : null,
    quotaSyncedAt: row.quota_synced_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProviderConfigs(db: AppDatabase): ProviderConfigRecord[] {
  const rows = db.sqlite
    .prepare(
      `SELECT pc.provider, pc.enabled, pc.base_url, pc.api_key_encrypted, pc.timeout_ms, pc.updated_at,
              COUNT(pk.id) AS key_count
       FROM provider_configs pc
       LEFT JOIN provider_keys pk ON pk.provider = pc.provider
       GROUP BY pc.provider
       ORDER BY pc.provider`,
    )
    .all() as unknown as ProviderConfigRow[];
  return rows.map(mapProviderConfig);
}

export function getProviderConfig(
  db: AppDatabase,
  provider: RemoteProvider,
): ProviderConfigRecord | null {
  const row = db.sqlite
    .prepare(
      `SELECT pc.provider, pc.enabled, pc.base_url, pc.api_key_encrypted, pc.timeout_ms, pc.updated_at,
              COUNT(pk.id) AS key_count
       FROM provider_configs pc
       LEFT JOIN provider_keys pk ON pk.provider = pc.provider
       WHERE pc.provider = ?
       GROUP BY pc.provider`,
    )
    .get(provider) as ProviderConfigRow | undefined;
  return row ? mapProviderConfig(row) : null;
}

export function saveProviderConfig(
  db: AppDatabase,
  provider: RemoteProvider,
  payload: Pick<ProviderConfigRecord, "enabled" | "baseUrl" | "timeoutMs"> & {
    apiKey?: string;
    encryptionKey: string;
  },
): void {
  const current = db.sqlite
    .prepare("SELECT api_key_encrypted FROM provider_configs WHERE provider = ?")
    .get(provider) as { api_key_encrypted: string } | undefined;
  const encryptedApiKey =
    payload.apiKey === undefined
      ? (current?.api_key_encrypted ?? "")
      : payload.apiKey
        ? encryptSecret(payload.apiKey, payload.encryptionKey)
        : "";
  db.sqlite
    .prepare(
      `INSERT INTO provider_configs (provider, enabled, base_url, api_key_encrypted, timeout_ms, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET
         enabled = excluded.enabled,
         base_url = excluded.base_url,
         api_key_encrypted = excluded.api_key_encrypted,
         timeout_ms = excluded.timeout_ms,
         updated_at = excluded.updated_at`,
    )
    .run(
      provider,
      payload.enabled ? 1 : 0,
      payload.baseUrl,
      encryptedApiKey,
      payload.timeoutMs,
      db.now(),
    );
}

export function getProviderApiKey(
  db: AppDatabase,
  provider: RemoteProvider,
  encryptionKey: string,
): string | null {
  const row = db.sqlite
    .prepare("SELECT api_key_encrypted FROM provider_configs WHERE provider = ?")
    .get(provider) as { api_key_encrypted: string } | undefined;
  if (!row?.api_key_encrypted) {
    return null;
  }
  return decryptSecret(row.api_key_encrypted, encryptionKey);
}

export function listProviderKeys(
  db: AppDatabase,
  provider?: KeyPoolProvider,
): ProviderKeyRecord[] {
  const sql = provider
    ? "SELECT * FROM provider_keys WHERE provider = ? ORDER BY created_at DESC"
    : "SELECT * FROM provider_keys ORDER BY created_at DESC";
  const rows = provider
    ? ((db.sqlite.prepare(sql).all(provider) as unknown as ProviderKeyRow[]) ?? [])
    : ((db.sqlite.prepare(sql).all() as unknown as ProviderKeyRow[]) ?? []);
  return rows.map(mapProviderKey);
}

export function importKeys(
  db: AppDatabase,
  provider: KeyPoolProvider,
  rawKeys: string[],
  tags: string[],
  encryptionKey: string,
): { inserted: number; skipped: number } {
  const stmt = db.sqlite.prepare(
    `INSERT OR IGNORE INTO provider_keys
      (id, provider, name, fingerprint, encrypted_key, enabled, tags_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  );

  let inserted = 0;
  let skipped = 0;
  const now = db.now();
  for (const secret of rawKeys) {
    const trimmed = secret.trim();
    if (!trimmed) {
      continue;
    }
    const fingerprint = fingerprintSecret(trimmed);
    const result = stmt.run(
      nanoid(),
      provider,
      `${provider}-${fingerprint}`,
      fingerprint,
      encryptSecret(trimmed, encryptionKey),
      JSON.stringify(tags),
      now,
      now,
    );
    if (result.changes > 0) {
      inserted += 1;
      continue;
    }
    skipped += 1;
  }
  return { inserted, skipped };
}

export function setKeysEnabled(db: AppDatabase, ids: string[], enabled: boolean): number {
  const stmt = db.sqlite.prepare(
    "UPDATE provider_keys SET enabled = ?, updated_at = ? WHERE id = ?",
  );
  let changed = 0;
  const now = db.now();
  for (const id of ids) {
    changed += Number(stmt.run(enabled ? 1 : 0, now, id).changes);
  }
  return changed;
}

export function deleteKeys(db: AppDatabase, ids: string[]): number {
  const stmt = db.sqlite.prepare("DELETE FROM provider_keys WHERE id = ?");
  let changed = 0;
  for (const id of ids) {
    changed += Number(stmt.run(id).changes);
  }
  return changed;
}

export function getCandidateKeys(
  db: AppDatabase,
  provider: KeyPoolProvider,
  encryptionKey: string,
): Array<ProviderKeyRecord & { secret: string }> {
  const rows = db.sqlite
    .prepare(
      `SELECT * FROM provider_keys
       WHERE provider = ? AND enabled = 1
       ORDER BY COALESCE(last_used_at, created_at) ASC, created_at ASC`,
    )
    .all(provider) as unknown as ProviderKeyRow[];

  return rows.map((row) => ({
    ...mapProviderKey(row),
    secret: decryptSecret(row.encrypted_key, encryptionKey),
  }));
}

export function markKeyUsage(
  db: AppDatabase,
  id: string,
  statusCode: number | null,
  errorSummary: string | null,
): void {
  db.sqlite
    .prepare(
      `UPDATE provider_keys
       SET last_used_at = ?, last_status_code = ?, last_error = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(db.now(), statusCode, errorSummary, db.now(), id);
}
