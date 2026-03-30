import { nanoid } from "nanoid";
import type { KeyPoolProvider } from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";

export interface ProviderAsyncJobBindingRecord {
  id: string;
  provider: KeyPoolProvider;
  toolName: string;
  upstreamJobId: string;
  providerKeyId: string;
  providerKeyFingerprint: string;
  requestLogId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapBinding(row: Record<string, unknown>): ProviderAsyncJobBindingRecord {
  return {
    id: String(row.id),
    provider: row.provider as KeyPoolProvider,
    toolName: String(row.tool_name),
    upstreamJobId: String(row.upstream_job_id),
    providerKeyId: String(row.provider_key_id),
    providerKeyFingerprint: String(row.provider_key_fingerprint),
    requestLogId: row.request_log_id ? String(row.request_log_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function saveProviderAsyncJobBinding(
  db: AppDatabase,
  payload: Omit<ProviderAsyncJobBindingRecord, "id" | "createdAt" | "updatedAt">,
): ProviderAsyncJobBindingRecord {
  const id = nanoid();
  const now = db.now();
  db.sqlite
    .prepare(
      `INSERT INTO provider_async_jobs
      (id, provider, tool_name, upstream_job_id, provider_key_id, provider_key_fingerprint, request_log_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, upstream_job_id) DO UPDATE SET
        tool_name = excluded.tool_name,
        provider_key_id = excluded.provider_key_id,
        provider_key_fingerprint = excluded.provider_key_fingerprint,
        request_log_id = excluded.request_log_id,
        updated_at = excluded.updated_at`,
    )
    .run(
      id,
      payload.provider,
      payload.toolName,
      payload.upstreamJobId,
      payload.providerKeyId,
      payload.providerKeyFingerprint,
      payload.requestLogId,
      now,
      now,
    );

  return getProviderAsyncJobBinding(db, payload.provider, payload.upstreamJobId) ?? {
    id,
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
}

export function getProviderAsyncJobBinding(
  db: AppDatabase,
  provider: KeyPoolProvider,
  upstreamJobId: string,
): ProviderAsyncJobBindingRecord | null {
  const row = db.sqlite
    .prepare(
      `SELECT * FROM provider_async_jobs
       WHERE provider = ? AND upstream_job_id = ?`,
    )
    .get(provider, upstreamJobId) as Record<string, unknown> | undefined;
  return row ? mapBinding(row) : null;
}

export function touchProviderAsyncJobBinding(
  db: AppDatabase,
  provider: KeyPoolProvider,
  upstreamJobId: string,
): void {
  db.sqlite
    .prepare(
      `UPDATE provider_async_jobs
       SET updated_at = ?
       WHERE provider = ? AND upstream_job_id = ?`,
    )
    .run(db.now(), provider, upstreamJobId);
}

export function cleanupProviderAsyncJobs(
  db: AppDatabase,
  retentionDays: number,
): void {
  db.sqlite
    .prepare(
      `DELETE FROM provider_async_jobs
       WHERE datetime(updated_at) < datetime('now', ?)`,
    )
    .run(`-${retentionDays} days`);
}
