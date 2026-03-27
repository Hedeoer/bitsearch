import { nanoid } from "nanoid";
import type { AppContext } from "../app-context.js";
import {
  ensurePlanningSession,
  getPlanningSnapshot,
  savePlanningPhase,
  updatePlanningComplexity,
} from "../repos/planning-repo.js";

const PHASE_NAMES = [
  "intent_analysis",
  "complexity_assessment",
  "query_decomposition",
  "search_strategy",
  "tool_selection",
  "execution_order",
] as const;

const REQUIRED_PHASES: Record<number, string[]> = {
  1: ["intent_analysis", "complexity_assessment", "query_decomposition"],
  2: [
    "intent_analysis",
    "complexity_assessment",
    "query_decomposition",
    "search_strategy",
    "tool_selection",
  ],
  3: [...PHASE_NAMES],
};

type PhaseName = (typeof PHASE_NAMES)[number];

function createSessionId(): string {
  return nanoid(12).toLowerCase();
}

function getRequiredPhases(level: number | null): string[] {
  return REQUIRED_PHASES[level ?? 3];
}

function buildPhaseMap(snapshot: ReturnType<typeof getPlanningSnapshot>) {
  return new Map((snapshot?.phases ?? []).map((item) => [item.phaseName, item]));
}

function mergePhaseData(
  current: unknown,
  phase: PhaseName,
  incoming: unknown,
  isRevision: boolean,
): unknown {
  if (isRevision || current === undefined) {
    return incoming;
  }
  if (phase === "query_decomposition" || phase === "tool_selection") {
    return [...((current as unknown[]) ?? []), incoming];
  }
  if (phase === "search_strategy") {
    const existing = (current as Record<string, unknown>) ?? {};
    const next = (incoming as Record<string, unknown>) ?? {};
    return {
      ...existing,
      ...next,
      search_terms: [
        ...(((existing.search_terms as unknown[]) ?? []) as unknown[]),
        ...(((next.search_terms as unknown[]) ?? []) as unknown[]),
      ],
    };
  }
  return incoming;
}

export function processPlanningPhase(
  context: AppContext,
  phase: PhaseName,
  payload: {
    sessionId?: string;
    thought: string;
    confidence?: number;
    data: unknown;
    isRevision?: boolean;
  },
): Record<string, unknown> {
  const sessionId = payload.sessionId?.trim() || createSessionId();
  ensurePlanningSession(context.db, sessionId);
  const snapshot = getPlanningSnapshot(context.db, sessionId);
  const phaseMap = buildPhaseMap(snapshot);
  const mergedData = mergePhaseData(
    phaseMap.get(phase)?.data,
    phase,
    payload.data,
    Boolean(payload.isRevision),
  );

  savePlanningPhase(context.db, sessionId, {
    phaseName: phase,
    thought: payload.thought,
    data: mergedData,
    confidence: payload.confidence ?? 1,
  });

  if (phase === "complexity_assessment") {
    const level = Number((payload.data as { level?: number }).level ?? 3);
    updatePlanningComplexity(context.db, sessionId, level);
  }

  const nextSnapshot = getPlanningSnapshot(context.db, sessionId);
  const completedPhases = nextSnapshot?.phases.map((item) => item.phaseName) ?? [];
  const remaining = getRequiredPhases(nextSnapshot?.complexityLevel ?? null).filter(
    (item) => !completedPhases.includes(item),
  );
  const executablePlan =
    remaining.length === 0
      ? Object.fromEntries((nextSnapshot?.phases ?? []).map((item) => [item.phaseName, item.data]))
      : undefined;

  return {
    session_id: sessionId,
    completed_phases: completedPhases,
    complexity_level: nextSnapshot?.complexityLevel ?? null,
    plan_complete: remaining.length === 0,
    phases_remaining: remaining,
    executable_plan: executablePlan,
  };
}
