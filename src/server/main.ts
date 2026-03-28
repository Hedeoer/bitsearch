import { readBootstrapConfig } from "./bootstrap.js";
import { createDatabase } from "./db/database.js";
import { createAdminSessionStore } from "./lib/admin-session.js";
import { startMaintenance } from "./services/maintenance-service.js";
import { createApp } from "./app.js";

async function main() {
  const bootstrap = readBootstrapConfig();
  const db = createDatabase(bootstrap);
  const context = {
    bootstrap,
    db,
    adminSessions: createAdminSessionStore(bootstrap.sessionSecret),
  };
  startMaintenance(context);
  const app = createApp(context);

  app.listen(bootstrap.port, bootstrap.host, () => {
    console.log(`BitSearch listening on http://${bootstrap.host}:${bootstrap.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
