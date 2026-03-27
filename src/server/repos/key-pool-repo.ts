import type {
  KeyHealthStatus,
  KeyListStatus,
  KeyPoolProvider,
  KeyPoolSummary,
  ProviderKeyQuotaSnapshot,
  ProviderKeyRecord,
} from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";
import { decryptSecret } from "../lib/crypto.js";
import { buildKeyPoolSummary } from "./key-pool-summary.js";

const MASK_PREFIX = 4;
const MASK_SUFFIX = 4;
const UNKNOWN_HEALTH_STATUS: KeyHealthStatus = "unknown";

interface ProviderKeyAdminRow {
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

export interface KeyListFilters {
  provider: KeyPoolProvider;
  status: KeyListStatus;
  query: string;
  tag: string;
}

export interface ActionableKeyRecord extends ProviderKeyRecord {
  secret: string;
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown[];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseHealthStatus(value: string): KeyHealthStatus {
  return value === "healthy" || value === "unhealthy"
    ? value
    : UNKNOWN_HEALTH_STATUS;
}

function parseQuota(value: string): ProviderKeyQuotaSnapshot | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as ProviderKeyQuotaSnapshot;
  } catch {
    return null;
  }
}

function maskSecret(secret: string): string {
  if (secret.length <= MASK_PREFIX + MASK_SUFFIX) {
    return secret;
  }
  return `${secret.slice(0, MASK_PREFIX)}...${secret.slice(-MASK_SUFFIX)}`;
}

function mapRow(
  row: ProviderKeyAdminRow,
  encryptionKey: string,
): ActionableKeyRecord {
  const secret = decryptSecret(row.encrypted_key, encryptionKey);
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    fingerprint: row.fingerprint,
    maskedValue: maskSecret(secret),
    enabled: Boolean(row.enabled),
    tags: parseTags(row.tags_json),
    note: row.note,
    healthStatus: parseHealthStatus(row.last_check_status),
    lastCheckedAt: row.last_checked_at,
    lastCheckError: row.last_check_error,
    lastUsedAt: row.last_used_at,
    lastError: row.last_error,
    lastStatusCode: row.last_status_code,
    requestCount: Number(row.request_count ?? 0),
    failureCount: Number(row.failure_count ?? 0),
    quota: parseQuota(row.quota_json),
    quotaSyncedAt: row.quota_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    secret,
  };
}

function matchStatus(record: ProviderKeyRecord, status: KeyListStatus): boolean {
  if (status === "all") {
    return true;
  }
  if (status === "enabled" || status === "disabled") {
    return record.enabled === (status === "enabled");
  }
  return record.healthStatus === status;
}

function matchTag(record: ProviderKeyRecord, tag: string): boolean {
  return !tag || record.tags.includes(tag);
}

function matchQuery(record: ActionableKeyRecord, query: string): boolean {
  if (!query) {
    return true;
  }
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (record.secret === query.trim()) {
    return true;
  }
  const haystack = [
    record.name,
    record.fingerprint,
    record.maskedValue,
    record.note,
    ...record.tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

function stripSecret(record: ActionableKeyRecord): ProviderKeyRecord {
  const { secret: _secret, ...rest } = record;
  return rest;
}

function loadRows(db: AppDatabase, provider: KeyPoolProvider): ProviderKeyAdminRow[] {
  return db.sqlite
    .prepare(
      `SELECT pk.*,
              COALESCE(stats.request_count, 0) AS request_count,
              COALESCE(stats.failure_count, 0) AS failure_count
       FROM provider_keys pk
       LEFT JOIN (
         SELECT provider,
                key_fingerprint,
                COUNT(*) AS request_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failure_count
         FROM request_attempt_logs
         WHERE key_fingerprint IS NOT NULL
         GROUP BY provider, key_fingerprint
       ) stats
         ON stats.provider = pk.provider
        AND stats.key_fingerprint = pk.fingerprint
       WHERE pk.provider = ?
       ORDER BY pk.created_at DESC`,
    )
    .all(provider) as unknown as ProviderKeyAdminRow[];
}

export function listManagedKeys(
  db: AppDatabase,
  filters: KeyListFilters,
  encryptionKey: string,
): ProviderKeyRecord[] {
  return loadRows(db, filters.provider)
    .map((row) => mapRow(row, encryptionKey))
    .filter((record) => matchStatus(record, filters.status))
    .filter((record) => matchTag(record, filters.tag.trim()))
    .filter((record) => matchQuery(record, filters.query))
    .map(stripSecret);
}

export function listActionableKeys(
  db: AppDatabase,
  provider: KeyPoolProvider,
  ids: string[],
  encryptionKey: string,
): ActionableKeyRecord[] {
  const idSet = new Set(ids);
  return loadRows(db, provider)
    .map((row) => mapRow(row, encryptionKey))
    .filter((record) => idSet.size === 0 || idSet.has(record.id));
}

export function getKeyPoolSummary(
  db: AppDatabase,
  provider: KeyPoolProvider,
  encryptionKey: string,
): KeyPoolSummary {
  const records = loadRows(db, provider).map((row) => stripSecret(mapRow(row, encryptionKey)));
  return buildKeyPoolSummary(provider, records);
}

export function updateKeyNote(db: AppDatabase, id: string, note: string): void {
  db.sqlite
    .prepare("UPDATE provider_keys SET note = ?, updated_at = ? WHERE id = ?")
    .run(note.trim(), db.now(), id);
}

export function saveKeyHealth(
  db: AppDatabase,
  id: string,
  status: KeyHealthStatus,
  error: string | null,
): void {
  db.sqlite
    .prepare(
      `UPDATE provider_keys
       SET last_check_status = ?, last_checked_at = ?, last_check_error = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(status, db.now(), error, db.now(), id);
}

export function saveKeyQuota(
  db: AppDatabase,
  id: string,
  quota: ProviderKeyQuotaSnapshot | null,
): void {
  db.sqlite
    .prepare(
      `UPDATE provider_keys
       SET quota_json = ?, quota_synced_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(JSON.stringify(quota ?? {}), db.now(), db.now(), id);
}

export function getKeySecret(
  db: AppDatabase,
  id: string,
  encryptionKey: string,
): string | null {
  const row = db.sqlite
    .prepare("SELECT encrypted_key FROM provider_keys WHERE id = ?")
    .get(id) as { encrypted_key?: string } | undefined;
  return row?.encrypted_key
    ? decryptSecret(row.encrypted_key, encryptionKey)
    : null;
}
