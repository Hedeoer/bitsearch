import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/database.js";

export interface PlanningPhaseRecord {
  phaseName: string;
  thought: string;
  data: unknown;
  confidence: number;
}

export interface PlanningSessionSnapshot {
  sessionId: string;
  complexityLevel: number | null;
  phases: PlanningPhaseRecord[];
}

export function ensurePlanningSession(db: AppDatabase, sessionId: string): void {
  db.sqlite
    .prepare(
      `INSERT OR IGNORE INTO planning_sessions (id, complexity_level, created_at, updated_at)
       VALUES (?, NULL, ?, ?)`,
    )
    .run(sessionId, db.now(), db.now());
}

export function updatePlanningComplexity(
  db: AppDatabase,
  sessionId: string,
  level: number,
): void {
  db.sqlite
    .prepare(
      "UPDATE planning_sessions SET complexity_level = ?, updated_at = ? WHERE id = ?",
    )
    .run(level, db.now(), sessionId);
}

export function savePlanningPhase(
  db: AppDatabase,
  sessionId: string,
  record: PlanningPhaseRecord,
): void {
  db.sqlite
    .prepare(
      `INSERT INTO planning_phase_records (id, session_id, phase_name, thought, data_json, confidence, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, phase_name) DO UPDATE SET
         thought = excluded.thought,
         data_json = excluded.data_json,
         confidence = excluded.confidence,
         updated_at = excluded.updated_at`,
    )
    .run(
      nanoid(),
      sessionId,
      record.phaseName,
      record.thought,
      JSON.stringify(record.data ?? null),
      record.confidence,
      db.now(),
    );
}

export function getPlanningSnapshot(
  db: AppDatabase,
  sessionId: string,
): PlanningSessionSnapshot | null {
  const session = db.sqlite
    .prepare("SELECT id, complexity_level FROM planning_sessions WHERE id = ?")
    .get(sessionId) as { id: string; complexity_level: number | null } | undefined;

  if (!session) {
    return null;
  }

  const phases = db.sqlite
    .prepare(
      `SELECT phase_name, thought, data_json, confidence
       FROM planning_phase_records
       WHERE session_id = ?
       ORDER BY updated_at ASC`,
    )
    .all(sessionId) as Array<{
    phase_name: string;
    thought: string;
    data_json: string | null;
    confidence: number;
  }>;

  return {
    sessionId: session.id,
    complexityLevel: session.complexity_level,
    phases: phases.map((item) => ({
      phaseName: item.phase_name,
      thought: item.thought,
      data: item.data_json ? JSON.parse(item.data_json) : null,
      confidence: item.confidence,
    })),
  };
}
