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
import {
  loadActionableKeyRows,
  loadManagedKeyRows,
  type ProviderKeyAdminRow,
} from "./key-pool-queries.js";

const MASK_PREFIX = 4;
const MASK_SUFFIX = 4;
const UNKNOWN_HEALTH_STATUS: KeyHealthStatus = "unknown";

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

export function listManagedKeys(
  db: AppDatabase,
  filters: KeyListFilters,
  encryptionKey: string,
): ProviderKeyRecord[] {
  return loadManagedKeyRows(db, filters.provider, filters.status)
    .map((row) => mapRow(row, encryptionKey))
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
  return loadActionableKeyRows(db, provider, ids)
    .map((row) => mapRow(row, encryptionKey))
    .filter((record) => idSet.size === 0 || idSet.has(record.id));
}

export function getKeyPoolSummary(
  db: AppDatabase,
  provider: KeyPoolProvider,
  encryptionKey: string,
): KeyPoolSummary {
  const records = loadManagedKeyRows(db, provider, "all").map((row) =>
    stripSecret(mapRow(row, encryptionKey)),
  );
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
