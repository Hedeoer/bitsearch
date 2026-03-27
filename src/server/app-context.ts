import type { BootstrapConfig } from "./bootstrap.js";
import type { AppDatabase } from "./db/database.js";

export interface AppContext {
  bootstrap: BootstrapConfig;
  db: AppDatabase;
}
