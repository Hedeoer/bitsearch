import { readBootstrapConfig } from "./bootstrap.js";
import { createDatabase } from "./db/database.js";
import { createApp } from "./app.js";

async function main() {
  const bootstrap = readBootstrapConfig();
  const db = createDatabase(bootstrap);
  const app = createApp({ bootstrap, db });

  app.listen(bootstrap.port, bootstrap.host, () => {
    console.log(`BitSearch listening on http://${bootstrap.host}:${bootstrap.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
