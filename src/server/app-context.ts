import type { BootstrapConfig } from "./bootstrap.js";
import type { AppDatabase } from "./db/database.js";
import type { AdminSessionStore } from "./lib/admin-session.js";

export interface AppContext {
  bootstrap: BootstrapConfig;
  db: AppDatabase;
  adminSessions: AdminSessionStore;
}
