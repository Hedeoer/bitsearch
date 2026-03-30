import { nanoid } from "nanoid";
import type {
  RequestActivityRecord,
  RequestAttemptRecord,
  RequestLogRecord,
} from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";
import { invalidateDashboardSummaryCache } from "../services/dashboard-cache.js";
import {
  mapAttemptLog,
  mapRequestLog,
  parseJsonObject,
} from "./log-record-mappers.js";

type AttemptInsert = Omit<RequestAttemptRecord, "id" | "createdAt">;
type RequestInsert = Omit<RequestLogRecord, "createdAt">;

export function insertRequestLog(db: AppDatabase, payload: RequestInsert): void {
  db.sqlite
    .prepare(
      `INSERT INTO request_logs
      (id, tool_name, target_url, strategy, final_provider, final_key_fingerprint, attempts, status, duration_ms, error_summary, input_json, result_preview, messages_json, provider_order_json, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.id,
      payload.toolName,
      payload.targetUrl,
      payload.strategy,
      payload.finalProvider,
      payload.finalKeyFingerprint,
      payload.attempts,
      payload.status,
      payload.durationMs,
      payload.errorSummary,
      payload.inputJson ? JSON.stringify(payload.inputJson) : null,
      payload.resultPreview,
      payload.messages ? JSON.stringify(payload.messages) : null,
      JSON.stringify(payload.providerOrder),
      JSON.stringify(payload.metadata),
      db.now(),
    );
  invalidateDashboardSummaryCache();
}

export function mergeRequestLogMetadata(
  db: AppDatabase,
  requestId: string,
  metadata: Record<string, unknown>,
): void {
  const row = db.sqlite
    .prepare("SELECT metadata_json FROM request_logs WHERE id = ?")
    .get(requestId) as { metadata_json: string | null } | undefined;
  if (!row) {
    return;
  }
  const current = parseJsonObject(row.metadata_json);
  db.sqlite
    .prepare(
      `UPDATE request_logs
       SET metadata_json = ?
       WHERE id = ?`,
    )
    .run(JSON.stringify({ ...current, ...metadata }), requestId);
  invalidateDashboardSummaryCache();
}

export function insertAttemptLogs(db: AppDatabase, attempts: AttemptInsert[]): void {
  const stmt = db.sqlite.prepare(
    `INSERT INTO request_attempt_logs
      (id, request_log_id, provider, key_fingerprint, attempt_no, status, status_code, duration_ms, error_summary, error_type, provider_base_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const attempt of attempts) {
    stmt.run(
      nanoid(),
      attempt.requestLogId,
      attempt.provider,
      attempt.keyFingerprint,
      attempt.attemptNo,
      attempt.status,
      attempt.statusCode,
      attempt.durationMs,
      attempt.errorSummary,
      attempt.errorType,
      attempt.providerBaseUrl,
      db.now(),
    );
  }
  invalidateDashboardSummaryCache();
}

export function listRequestLogs(db: AppDatabase, limit: number): RequestLogRecord[] {
  const rows = db.sqlite
    .prepare("SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapRequestLog);
}

export function listRequestAttempts(
  db: AppDatabase,
  limit: number,
): RequestAttemptRecord[] {
  const rows = db.sqlite
    .prepare("SELECT * FROM request_attempt_logs ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapAttemptLog);
}

export function getRequestActivity(
  db: AppDatabase,
  requestId: string,
): RequestActivityRecord | null {
  const request = db.sqlite
    .prepare("SELECT * FROM request_logs WHERE id = ?")
    .get(requestId) as Record<string, unknown> | undefined;
  if (!request) {
    return null;
  }
  const attempts = db.sqlite
    .prepare(
      "SELECT * FROM request_attempt_logs WHERE request_log_id = ? ORDER BY attempt_no ASC, created_at ASC",
    )
    .all(requestId) as Record<string, unknown>[];
  return {
    request: mapRequestLog(request),
    attempts: attempts.map(mapAttemptLog),
  };
}

export function cleanupOldLogs(db: AppDatabase, retentionDays: number): void {
  db.sqlite
    .prepare(
      `DELETE FROM request_logs
       WHERE datetime(created_at) < datetime('now', ?)`,
    )
    .run(`-${retentionDays} days`);
  invalidateDashboardSummaryCache();
}
