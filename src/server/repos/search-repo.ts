import type { AppDatabase } from "../db/database.js";
import type { SearchSessionRecord } from "../../shared/contracts.js";

interface SearchSessionRow {
  id: string;
  content: string;
  sources_json: string;
  sources_count: number;
  created_at: string;
}

export function saveSearchSession(
  db: AppDatabase,
  sessionId: string,
  content: string,
  sources: Array<Record<string, unknown>>,
): void {
  db.sqlite
    .prepare(
      `INSERT INTO search_sessions (id, content, sources_json, sources_count, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(sessionId, content, JSON.stringify(sources), sources.length, db.now());
}

export function getSearchSession(
  db: AppDatabase,
  sessionId: string,
): SearchSessionRecord | null {
  const row = db.sqlite
    .prepare("SELECT * FROM search_sessions WHERE id = ?")
    .get(sessionId) as SearchSessionRow | undefined;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    content: row.content,
    sources: JSON.parse(row.sources_json) as Array<Record<string, unknown>>,
    sourcesCount: row.sources_count,
    createdAt: row.created_at,
  };
}
