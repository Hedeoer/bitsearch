import type { KeyListStatus, KeyPoolProvider } from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";

export interface ProviderKeyAdminRow {
  id: string;
  provider: KeyPoolProvider;
  name: string;
  fingerprint: string;
  enabled: number;
  encrypted_key: string;
  tags_json: string;
  note: string;
  last_check_status: string;
  last_checked_at: string | null;
  last_check_error: string | null;
  last_used_at: string | null;
  last_error: string | null;
  last_status_code: number | null;
  quota_json: string;
  quota_synced_at: string | null;
  request_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

function buildStatusClause(status: KeyListStatus): string {
  if (status === "enabled") {
    return " AND pk.enabled = 1";
  }
  if (status === "disabled") {
    return " AND pk.enabled = 0";
  }
  if (status === "healthy" || status === "unhealthy") {
    return " AND pk.last_check_status = ?";
  }
  return "";
}

function buildLoadRowParams(
  provider: KeyPoolProvider,
  status: KeyListStatus,
): [KeyPoolProvider, KeyPoolProvider] | [KeyPoolProvider, KeyPoolProvider, KeyListStatus] {
  return status === "healthy" || status === "unhealthy"
    ? [provider, provider, status]
    : [provider, provider];
}

export function loadManagedKeyRows(
  db: AppDatabase,
  provider: KeyPoolProvider,
  status: KeyListStatus,
): ProviderKeyAdminRow[] {
  const sql = `SELECT pk.*,
                      COALESCE(stats.request_count, 0) AS request_count,
                      COALESCE(stats.failure_count, 0) AS failure_count
               FROM provider_keys pk
               LEFT JOIN (
                 SELECT key_fingerprint,
                        COUNT(*) AS request_count,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failure_count
                 FROM request_attempt_logs
                 WHERE key_fingerprint IS NOT NULL AND provider = ?
                 GROUP BY key_fingerprint
               ) stats
                 ON stats.key_fingerprint = pk.fingerprint
               WHERE pk.provider = ?${buildStatusClause(status)}
               ORDER BY pk.created_at DESC`;

  return db.sqlite
    .prepare(sql)
    .all(...buildLoadRowParams(provider, status)) as unknown as ProviderKeyAdminRow[];
}

export function loadActionableKeyRows(
  db: AppDatabase,
  provider: KeyPoolProvider,
  ids: string[],
): ProviderKeyAdminRow[] {
  if (ids.length === 0) {
    return db.sqlite
      .prepare(
        `SELECT *
         FROM provider_keys
         WHERE provider = ? AND enabled = 1
         ORDER BY COALESCE(last_used_at, created_at) ASC, created_at ASC`,
      )
      .all(provider) as unknown as ProviderKeyAdminRow[];
  }

  const placeholders = ids.map(() => "?").join(", ");
  return db.sqlite
    .prepare(
      `SELECT *
       FROM provider_keys
       WHERE provider = ? AND enabled = 1 AND id IN (${placeholders})
       ORDER BY COALESCE(last_used_at, created_at) ASC, created_at ASC`,
    )
    .all(provider, ...ids) as unknown as ProviderKeyAdminRow[];
}
