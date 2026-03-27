import { nanoid } from "nanoid";
import type {
  DashboardSummary,
  RequestAttemptRecord,
  RequestLogRecord,
  RequestStatus,
} from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";

type AttemptInsert = Omit<RequestAttemptRecord, "id" | "createdAt">;
type RequestInsert = Omit<RequestLogRecord, "createdAt">;

function mapRequestLog(row: Record<string, unknown>): RequestLogRecord {
  return {
    id: String(row.id),
    toolName: String(row.tool_name),
    targetUrl: row.target_url ? String(row.target_url) : null,
    strategy: row.strategy ? String(row.strategy) : null,
    finalProvider: row.final_provider ? String(row.final_provider) : null,
    finalKeyFingerprint: row.final_key_fingerprint
      ? String(row.final_key_fingerprint)
      : null,
    attempts: Number(row.attempts),
    status: row.status as RequestStatus,
    durationMs: Number(row.duration_ms),
    errorSummary: row.error_summary ? String(row.error_summary) : null,
    createdAt: String(row.created_at),
  };
}

function mapAttemptLog(row: Record<string, unknown>): RequestAttemptRecord {
  return {
    id: String(row.id),
    requestLogId: String(row.request_log_id),
    provider: String(row.provider) as RequestAttemptRecord["provider"],
    keyFingerprint: row.key_fingerprint ? String(row.key_fingerprint) : null,
    attemptNo: Number(row.attempt_no),
    status: row.status as RequestStatus,
    statusCode: row.status_code === null ? null : Number(row.status_code),
    durationMs: Number(row.duration_ms),
    errorSummary: row.error_summary ? String(row.error_summary) : null,
    createdAt: String(row.created_at),
  };
}

export function insertRequestLog(db: AppDatabase, payload: RequestInsert): void {
  db.sqlite
    .prepare(
      `INSERT INTO request_logs
      (id, tool_name, target_url, strategy, final_provider, final_key_fingerprint, attempts, status, duration_ms, error_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      db.now(),
    );
}

export function insertAttemptLogs(db: AppDatabase, attempts: AttemptInsert[]): void {
  const stmt = db.sqlite.prepare(
    `INSERT INTO request_attempt_logs
      (id, request_log_id, provider, key_fingerprint, attempt_no, status, status_code, duration_ms, error_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      db.now(),
    );
  }
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

export function getDashboardSummary(db: AppDatabase): DashboardSummary {
  const totals = db.sqlite
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
       FROM request_logs`,
    )
    .get() as {
    total: number;
    success_count: number | null;
    failed_count: number | null;
  };

  const providerErrors = db.sqlite
    .prepare(
      `SELECT provider, COUNT(*) AS count
       FROM request_attempt_logs
       WHERE status = 'failed'
       GROUP BY provider
       ORDER BY count DESC`,
    )
    .all() as Array<{ provider: string; count: number }>;

  return {
    totalRequests: totals.total,
    successCount: totals.success_count ?? 0,
    failedCount: totals.failed_count ?? 0,
    providerErrors,
    latestErrors: listRequestLogs(db, 10).filter((item) => item.status === "failed"),
  };
}

export function cleanupOldLogs(db: AppDatabase, retentionDays: number): void {
  db.sqlite
    .prepare(
      `DELETE FROM request_logs
       WHERE datetime(created_at) < datetime('now', ?)`,
    )
    .run(`-${retentionDays} days`);
}
