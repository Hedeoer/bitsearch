import type { AppContext } from "../app-context.js";
import { cleanupOldLogs } from "../repos/log-repo.js";
import { cleanupPlanningSessions } from "../repos/planning-repo.js";
import { cleanupSearchSessions } from "../repos/search-repo.js";
import { getSystemSettings } from "../repos/settings-repo.js";

const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

function runMaintenancePass(context: AppContext): void {
  const { logRetentionDays } = getSystemSettings(context.db);
  cleanupOldLogs(context.db, logRetentionDays);
  cleanupSearchSessions(context.db, logRetentionDays);
  cleanupPlanningSessions(context.db, logRetentionDays);
  context.adminSessions.cleanupExpired();
}

export function startMaintenance(context: AppContext): void {
  runMaintenancePass(context);

  const timer = setInterval(() => {
    try {
      runMaintenancePass(context);
    } catch (error) {
      console.error("Maintenance pass failed", error);
    }
  }, MAINTENANCE_INTERVAL_MS);

  timer.unref();
}
