import { nanoid } from "nanoid";
import type {
  ActivityPageResult,
  RequestActivityRecord,
  RequestAttemptRecord,
  RequestLogRecord,
  RequestStatus,
  RemoteProvider,
} from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";
import { invalidateDashboardSummaryCache } from "../services/dashboard-cache.js";

type AttemptInsert = Omit<RequestAttemptRecord, "id" | "createdAt">;
type RequestInsert = Omit<RequestLogRecord, "createdAt">;

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value.length === 0) {
    return {};
  }
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseMessages(value: unknown): Array<{ role: string; content: string }> | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Array<{ role?: string; content?: string }>;
    return parsed
      .filter((item) => typeof item.role === "string" && typeof item.content === "string")
      .map((item) => ({
        role: item.role as string,
        content: item.content as string,
      }));
  } catch {
    return null;
  }
}

function parseJsonArray(value: unknown): RemoteProvider[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    return JSON.parse(value) as RemoteProvider[];
  } catch {
    return [];
  }
}

export function mapRequestLog(row: Record<string, unknown>): RequestLogRecord {
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
    inputJson:
      typeof row.input_json === "string" && row.input_json.length > 0
        ? parseJsonObject(row.input_json)
        : null,
    resultPreview: row.result_preview ? String(row.result_preview) : null,
    messages: parseMessages(row.messages_json),
    providerOrder: parseJsonArray(row.provider_order_json),
    metadata: parseJsonObject(row.metadata_json),
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
    errorType: row.error_type ? String(row.error_type) : null,
    providerBaseUrl: row.provider_base_url ? String(row.provider_base_url) : null,
    createdAt: String(row.created_at),
  };
}

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

export type ActivityFilters = {
  query?: string;
  toolName?: string;
  status?: string;
  timePreset?: string;
  customStart?: string;
  customEnd?: string;
};

function buildActivityWhere(filters: ActivityFilters): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.query) {
    const like = `%${filters.query}%`;
    conditions.push(
      "(tool_name LIKE ? OR target_url LIKE ? OR final_provider LIKE ? OR error_summary LIKE ?)",
    );
    params.push(like, like, like, like);
  }

  if (filters.toolName && filters.toolName !== "all") {
    conditions.push("tool_name = ?");
    params.push(filters.toolName);
  }

  if (filters.status && filters.status !== "all") {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  const preset = filters.timePreset;
  if (preset && preset !== "all") {
    if (preset === "today") {
      conditions.push("date(created_at) = date('now', 'localtime')");
    } else if (preset === "last_hour") {
      conditions.push("created_at >= datetime('now', '-1 hour')");
    } else if (preset === "last_24_hours") {
      conditions.push("created_at >= datetime('now', '-24 hours')");
    } else if (preset === "custom") {
      if (filters.customStart) {
        conditions.push("created_at >= ?");
        params.push(filters.customStart);
      }
      if (filters.customEnd) {
        conditions.push("created_at <= ?");
        params.push(filters.customEnd);
      }
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export function countRequestActivities(db: AppDatabase, filters: ActivityFilters): number {
  const { where, params } = buildActivityWhere(filters);
  const row = db.sqlite
    .prepare(`SELECT COUNT(*) as cnt FROM request_logs ${where}`)
    .get(...(params as Parameters<typeof db.sqlite.prepare>[0][])) as { cnt: number };
  return row.cnt;
}

export function listRequestActivities(
  db: AppDatabase,
  page: number,
  pageSize: number,
  filters: ActivityFilters,
): ActivityPageResult {
  const { where, params } = buildActivityWhere(filters);
  const total = countRequestActivities(db, filters);
  const offset = page * pageSize;

  const requests = (db.sqlite
    .prepare(
      `SELECT * FROM request_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...([...params, pageSize, offset] as Parameters<typeof db.sqlite.prepare>[0][])) as Record<string, unknown>[]).map(mapRequestLog);

  if (requests.length === 0) {
    return { items: [], total, page, pageSize };
  }

  const ids = requests.map((item) => item.id);
  const placeholders = ids.map(() => "?").join(", ");
  const attempts = db.sqlite
    .prepare(
      `SELECT * FROM request_attempt_logs
       WHERE request_log_id IN (${placeholders})
       ORDER BY attempt_no ASC, created_at ASC`,
    )
    .all(...ids) as Record<string, unknown>[];

  const grouped = new Map<string, RequestAttemptRecord[]>();
  for (const row of attempts) {
    const mapped = mapAttemptLog(row);
    const bucket = grouped.get(mapped.requestLogId) ?? [];
    bucket.push(mapped);
    grouped.set(mapped.requestLogId, bucket);
  }

  return {
    items: requests.map((request) => ({
      request,
      attempts: grouped.get(request.id) ?? [],
    })),
    total,
    page,
    pageSize,
  };
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
