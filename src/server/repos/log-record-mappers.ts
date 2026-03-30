import type {
  RemoteProvider,
  RequestAttemptRecord,
  RequestLogRecord,
  RequestStatus,
} from "../../shared/contracts.js";

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value.length === 0) {
    return {};
  }
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function parseMessages(value: unknown): Array<{ role: string; content: string }> | null {
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

export function parseJsonArray(value: unknown): RemoteProvider[] {
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

export function mapAttemptLog(row: Record<string, unknown>): RequestAttemptRecord {
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
