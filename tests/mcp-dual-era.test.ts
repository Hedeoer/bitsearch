import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createApp } from "../src/server/app.js";
import type { BootstrapConfig } from "../src/server/bootstrap.js";
import { createDatabase, type AppDatabase } from "../src/server/db/database.js";
import { createAdminSessionStore } from "../src/server/lib/admin-session.js";
import { resolveRuntimeSecrets } from "../src/server/lib/runtime-secrets.js";
import { encryptSecret, fingerprintSecret } from "../src/server/lib/crypto.js";
import {
  broadcastToolListChanged,
  closeAllMcpTransports,
  getModernMcpHandlerForTooling,
  closeModernMcpHandler,
  resetModernMcpHandlerForTests,
} from "../src/server/mcp/transport-router.js";
import { MCP_INSTRUCTIONS } from "../src/server/mcp/instructions.js";
import { getToolSurfaceSnapshot } from "../src/server/services/tool-surface-service.js";

const MODERN_PROTOCOL_VERSION = "2026-07-28";
const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientInfo": {
    name: "bitsearch-dual-era-test",
    version: "0.0.1",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};

interface TestApp {
  baseUrl: string;
  bearerToken: string;
  context: ReturnType<typeof createContext>;
  cleanup: () => Promise<void>;
}

function createContext(tempRoot: string) {
  const databasePath = join(tempRoot, "data", "bitsearch.db");
  const runtimeSecrets = resolveRuntimeSecrets(databasePath);
  const bootstrap: BootstrapConfig = {
    port: 0,
    host: "127.0.0.1",
    databasePath,
    encryptionKey: runtimeSecrets.values.encryptionKey,
    adminAuthKey: runtimeSecrets.values.adminAuthKey,
    sessionSecret: runtimeSecrets.values.sessionSecret,
    mcpBearerToken: "dual-era-mcp-token",
    trustProxy: false,
    runtimeSecrets,
  };
  const db = createDatabase(bootstrap);
  return { bootstrap, db };
}

function enableFirecrawl(context: ReturnType<typeof createContext>): void {
  const now = new Date().toISOString();
  const secret = "fc-dual-era-secret";
  context.db.sqlite.prepare(
    "UPDATE provider_configs SET enabled = 1 WHERE provider = ?",
  ).run("firecrawl");
  context.db.sqlite.prepare(
    `INSERT OR IGNORE INTO provider_keys
      (id, provider, name, fingerprint, encrypted_key, enabled, tags_json, note, last_check_status, quota_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "fc-dual-era",
    "firecrawl",
    "fc-dual-era",
    fingerprintSecret(secret),
    encryptSecret(secret, context.bootstrap.encryptionKey),
    1,
    "[]",
    "",
    "unknown",
    "{}",
    now,
    now,
  );
}

async function startApp(): Promise<TestApp> {
  const tempRoot = mkdtempSync(join(tmpdir(), "bitsearch-mcp-dual-era-"));
  const context = createContext(tempRoot);
  const app = createApp({
    bootstrap: context.bootstrap,
    db: context.db,
    adminSessions: createAdminSessionStore(context.bootstrap.sessionSecret),
  });
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const readinessProbe = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
    method: "POST",
    headers: modernHeaders(context.bootstrap.mcpBearerToken, "server/discover"),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "server/discover",
      params: { _meta: MODERN_META },
    }),
  });
  await readinessProbe.text();
  let closed = false;
  return {
    baseUrl: `http://127.0.0.1:${address.port}/mcp`,
    bearerToken: context.bootstrap.mcpBearerToken,
    context,
    async cleanup() {
      if (closed) {
        return;
      }
      closed = true;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await closeAllMcpTransports();
      await closeModernMcpHandler().catch(() => {});
      (context.db as AppDatabase).sqlite.close();
      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

function modernHeaders(bearerToken: string, method: string): Record<string, string> {
  return {
    authorization: `Bearer ${bearerToken}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-method": method,
    "mcp-name": "bitsearch-dual-era-test",
    "mcp-protocol-version": MODERN_PROTOCOL_VERSION,
  };
}

async function readJsonRpcResult(response: Response): Promise<any> {
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const messages = (await response.text())
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim()));
    const resultMessage = messages.find((message) => message.result !== undefined);
    assert.ok(resultMessage, "Expected a JSON-RPC result frame");
    return resultMessage.result;
  }
  return (await response.json()).result;
}

function assertServerInstructions(value: unknown): asserts value is string {
  assert.equal(value, MCP_INSTRUCTIONS);
  assert.match(value, /Use the Planning Engine for ambiguous, multi-hop/);
  assert.doesNotMatch(value, /Planning Workflow \(MANDATORY\)/);
  assert.doesNotMatch(value, /For any research.*MUST use/s);
  assert.doesNotMatch(value, /SESSION_SECRET|APP_ENCRYPTION_KEY|MCP_BEARER_TOKEN|API_KEY/i);
}

test("MCP dual-era routing preserves legacy security and serves strict modern requests", async (t) => {
  const appContext = await startApp();
  t.after(() => appContext.cleanup());

  for (const method of ["POST", "GET", "DELETE"] as const) {
    const response = await fetch(appContext.baseUrl, {
      method,
      headers:
        method === "GET" || method === "DELETE"
          ? {}
          : {
              accept: "application/json, text/event-stream",
              "content-type": "application/json",
            },
      body: method === "POST" ? JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
        params: { _meta: MODERN_META },
      }) : undefined,
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "invalid_token" });
  }

  const modernDiscover = await fetch(appContext.baseUrl, {
    method: "POST",
    headers: modernHeaders(appContext.bearerToken, "server/discover"),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "server/discover",
      params: { _meta: MODERN_META },
    }),
  });
  const discoverResult = await readJsonRpcResult(modernDiscover);
  assert.equal(modernDiscover.status, 200);
  assert.deepEqual(discoverResult.supportedVersions, [MODERN_PROTOCOL_VERSION]);
  assertServerInstructions(discoverResult.instructions);
  assert.ok(discoverResult.capabilities.tools?.listChanged);

  const headerMismatch = await fetch(appContext.baseUrl, {
    method: "POST",
    headers: {
      ...modernHeaders(appContext.bearerToken, "tools/list"),
      "mcp-method": "server/discover",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: { _meta: MODERN_META },
    }),
  });
  const mismatchBody = await headerMismatch.json();
  assert.notEqual(headerMismatch.status, 200);
  assert.ok(mismatchBody.error?.code < -32000 || mismatchBody.error?.code >= -32700);
  assert.match(String(mismatchBody.error?.message ?? ""), /method|header|protocol/i);

  for (const method of ["GET", "DELETE"] as const) {
    const modernSessionOperation = await fetch(appContext.baseUrl, {
      method,
      headers: { "mcp-protocol-version": MODERN_PROTOCOL_VERSION },
    });
    const body = await modernSessionOperation.json();
    assert.equal(modernSessionOperation.status, 405);
    assert.equal(body.error.code, -32000);
  }

  const legacyInitialize = await fetch(appContext.baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appContext.bearerToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "legacy-client", version: "1.0.0" },
      },
    }),
  });
  assert.equal(legacyInitialize.status, 200);
  const sessionId = legacyInitialize.headers.get("mcp-session-id");
  assert.ok(sessionId);
  const initializeResult = await readJsonRpcResult(legacyInitialize);
  assertServerInstructions(initializeResult.instructions);

  const notificationResponse = await fetch(appContext.baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appContext.bearerToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });
  assert.equal(notificationResponse.status, 202);

  const toolsListResponse = await fetch(appContext.baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appContext.bearerToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": "2025-03-26",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list", params: {} }),
  });
  assert.equal(toolsListResponse.status, 200);
  assert.match(await toolsListResponse.text(), /"name":"get_result_page"/);
});

test("admin tool surface changes notify both eras and refresh conditional tools", async (t) => {
  const appContext = await startApp();
  t.after(() => appContext.cleanup());

  await resetModernMcpHandlerForTests();
  const beforeSnapshot = getToolSurfaceSnapshot(appContext.context);
  assert.ok(!beforeSnapshot.exposedTools.includes("firecrawl_batch_scrape"));

  enableFirecrawl(appContext.context);
  let modernEvent: unknown;
  const unsubscribe = getModernMcpHandlerForTooling().bus.subscribe((event) => {
    modernEvent = event;
  });
  broadcastToolListChanged(appContext.context);
  unsubscribe();
  assert.deepEqual(modernEvent, { kind: "tools_list_changed" });
  const afterSnapshot = getToolSurfaceSnapshot(appContext.context);
  assert.ok(afterSnapshot.exposedTools.includes("firecrawl_batch_scrape"));

  const modernTools = await fetch(appContext.baseUrl, {
    method: "POST",
    headers: modernHeaders(appContext.bearerToken, "tools/list"),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/list",
      params: { _meta: MODERN_META },
    }),
  });
  assert.equal(modernTools.status, 200, await modernTools.clone().text());
  const toolsResult = await readJsonRpcResult(modernTools.clone());
  assert.equal(toolsResult.ttlMs, 10_000);
  assert.equal(toolsResult.cacheScope, "private");
  assert.ok(toolsResult.tools.some((tool: any) => (
    tool.name === "firecrawl_batch_scrape"
  )));
});

test("Firecrawl batch scrape normalizes scrape options before provider execution", async (t) => {
  const appContext = await startApp();
  t.after(() => appContext.cleanup());

  enableFirecrawl(appContext.context);
  const executedInputs: unknown[] = [];
  let requestCount = 0;
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: any, init?: any) => {
    const url = String(input);
    if (!url.includes("api.firecrawl.dev/v2/batch/scrape")) {
      return originalFetch(input, init);
    }
    requestCount += 1;
    executedInputs.push(JSON.parse(init.body));
    return new Response(JSON.stringify({
      success: true,
      id: `fc-${requestCount}`,
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  const legacyInitialize = await fetch(appContext.baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appContext.bearerToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "firecrawl-options-test", version: "1.0.0" },
      },
    }),
  });
  const sessionId = legacyInitialize.headers.get("mcp-session-id");
  assert.ok(sessionId);
  await legacyInitialize.text();
  await fetch(appContext.baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appContext.bearerToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });

  const call = await fetch(appContext.baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appContext.bearerToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": "2025-03-26",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "firecrawl_batch_scrape",
        arguments: {
          urls: ["https://example.com/"],
          formats: ["markdown"],
          only_main_content: true,
          scrape_options: { max_age: 1000, only_clean_content: false },
        },
      },
    }),
  });
  assert.equal(call.status, 200, await call.clone().text());
  const result = await readJsonRpcResult(call);
  assert.equal(result.structuredContent.success, true);
  assert.equal(executedInputs[0].formats?.[0], "markdown");
  assert.equal(executedInputs[0].onlyMainContent, true);
  assert.equal(executedInputs[0].maxAge, 1000);
  assert.equal(executedInputs[0].onlyCleanContent, false);
  assert.equal("scrapeOptions" in executedInputs[0], false);
});
