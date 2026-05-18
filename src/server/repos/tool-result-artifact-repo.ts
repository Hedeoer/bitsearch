import type { AppDatabase } from "../db/database.js";

export const TOOL_RESULT_URI_PREFIX = "bitsearch://results/";

export interface ToolResultArtifactRecord {
  id: string;
  toolName: string;
  kind: string;
  uri: string;
  mimeType: string;
  title: string | null;
  summary: Record<string, unknown>;
  content: unknown;
  totalItems: number | null;
  totalChars: number;
  createdAt: string;
}

interface ToolResultArtifactRow {
  id: string;
  tool_name: string;
  kind: string;
  uri: string;
  mime_type: string;
  title: string | null;
  summary_json: string;
  content_json: string;
  total_items: number | null;
  total_chars: number;
  created_at: string;
}

function parseRecord(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function mapArtifact(row: ToolResultArtifactRow): ToolResultArtifactRecord {
  return {
    id: row.id,
    toolName: row.tool_name,
    kind: row.kind,
    uri: row.uri,
    mimeType: row.mime_type,
    title: row.title,
    summary: parseRecord(row.summary_json),
    content: JSON.parse(row.content_json) as unknown,
    totalItems: row.total_items,
    totalChars: row.total_chars,
    createdAt: row.created_at,
  };
}

export function buildToolResultUri(id: string): string {
  return `${TOOL_RESULT_URI_PREFIX}${encodeURIComponent(id)}`;
}

export function parseToolResultUri(uri: string): string | null {
  if (!uri.startsWith(TOOL_RESULT_URI_PREFIX)) {
    return null;
  }
  const raw = uri.slice(TOOL_RESULT_URI_PREFIX.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export function saveToolResultArtifact(
  db: AppDatabase,
  payload: {
    id: string;
    toolName: string;
    kind: string;
    mimeType?: string;
    title?: string | null;
    summary?: Record<string, unknown>;
    content: unknown;
    totalItems?: number | null;
    totalChars: number;
  },
): ToolResultArtifactRecord {
  const uri = buildToolResultUri(payload.id);
  db.sqlite
    .prepare(
      `INSERT INTO tool_result_artifacts
       (id, tool_name, kind, uri, mime_type, title, summary_json, content_json, total_items, total_chars, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.id,
      payload.toolName,
      payload.kind,
      uri,
      payload.mimeType ?? "application/json",
      payload.title ?? null,
      JSON.stringify(payload.summary ?? {}),
      JSON.stringify(payload.content ?? null),
      payload.totalItems ?? null,
      payload.totalChars,
      db.now(),
    );
  const artifact = getToolResultArtifact(db, payload.id);
  if (!artifact) {
    throw new Error("tool_result_artifact_save_failed");
  }
  return artifact;
}

export function getToolResultArtifact(
  db: AppDatabase,
  id: string,
): ToolResultArtifactRecord | null {
  const row = db.sqlite
    .prepare("SELECT * FROM tool_result_artifacts WHERE id = ?")
    .get(id) as ToolResultArtifactRow | undefined;
  return row ? mapArtifact(row) : null;
}

export function cleanupToolResultArtifacts(
  db: AppDatabase,
  retentionDays: number,
): void {
  db.sqlite
    .prepare(
      `DELETE FROM tool_result_artifacts
       WHERE datetime(created_at) < datetime('now', ?)`,
    )
    .run(`-${retentionDays} days`);
}
