import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createApp } from "../src/server/app.js";
import type { BootstrapConfig } from "../src/server/bootstrap.js";
import { createDatabase } from "../src/server/db/database.js";
import { createAdminSessionStore } from "../src/server/lib/admin-session.js";
import { resolveRuntimeSecrets } from "../src/server/lib/runtime-secrets.js";

function createTestBootstrap(tempRoot: string): BootstrapConfig {
  const databasePath = join(tempRoot, "data", "bitsearch.db");
  const runtimeSecrets = resolveRuntimeSecrets(databasePath);
  return {
    port: 0,
    host: "127.0.0.1",
    databasePath,
    encryptionKey: runtimeSecrets.values.encryptionKey,
    adminAuthKey: runtimeSecrets.values.adminAuthKey,
    sessionSecret: runtimeSecrets.values.sessionSecret,
    mcpBearerToken: runtimeSecrets.values.mcpBearerToken,
    trustProxy: true,
    runtimeSecrets,
  };
}

test("MCP initialize accepts desktop client Origin headers when bearer token is valid", async (t) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "bitsearch-mcp-origin-"));
  t.after(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  const bootstrap = createTestBootstrap(tempRoot);
  const db = createDatabase(bootstrap);
  const app = createApp({
    bootstrap,
    db,
    adminSessions: createAdminSessionStore(bootstrap.sessionSecret),
  });

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.sqlite.close();
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bootstrap.mcpBearerToken}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      Origin: "null",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "node-test",
          version: "1.0.0",
        },
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.ok(response.headers.get("mcp-session-id"));
});
