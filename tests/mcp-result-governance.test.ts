import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AppContext } from "../src/server/app-context.js";
import type { BootstrapConfig } from "../src/server/bootstrap.js";
import type { AppDatabase } from "../src/server/db/database.js";
import { SCHEMA_SQL } from "../src/server/db/schema.js";
import { createMcpServer } from "../src/server/mcp/register-tools.js";
import { createAdminSessionStore } from "../src/server/lib/admin-session.js";

function createDb(): AppDatabase {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA_SQL);
  sqlite.exec(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES
       ('generic_routing_mode', '"ordered_failover"', '2026-03-30T12:00:00.000Z'),
       ('generic_provider_order', '["tavily","firecrawl"]', '2026-03-30T12:00:00.000Z'),
       ('default_search_model', '"grok-4-fast"', '2026-03-30T12:00:00.000Z'),
       ('log_retention_days', '7', '2026-03-30T12:00:00.000Z'),
       ('allowed_origins', '[]', '2026-03-30T12:00:00.000Z'),
       ('mcp_result_budget', '{"firstResponseChars":40,"pageChars":60,"hardResponseChars":100}', '2026-03-30T12:00:00.000Z')`,
  );
  return {
    sqlite,
    now: () => "2026-03-30T12:00:00.000Z",
  };
}

function createContext(): AppContext {
  const db = createDb();
  return {
    db,
    adminSessions: createAdminSessionStore("test-secret"),
    bootstrap: {
      port: 0,
      host: "127.0.0.1",
      databasePath: ":memory:",
      encryptionKey: "test-encryption-key",
      adminAuthKey: "test-admin-key",
      sessionSecret: "test-session-secret",
      mcpBearerToken: "test-mcp-token",
      trustProxy: false,
      runtimeSecrets: {
        path: null,
        values: {
          encryptionKey: "test-encryption-key",
          adminAuthKey: "test-admin-key",
          sessionSecret: "test-session-secret",
          mcpBearerToken: "test-mcp-token",
        },
        generated: new Set(),
      },
    } satisfies BootstrapConfig,
  };
}

async function connectClient(context: AppContext) {
  const server = createMcpServer(context);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    {
      name: "bitsearch-test-client",
      version: "1.0.0",
    },
    { capabilities: {} },
  );
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

test("MCP tool surface returns bounded previews and manifest resources", async (t) => {
  const context = createContext();
  const { client, server } = await connectClient(context);
  t.after(async () => {
    await client.close();
    await server.close();
    context.db.sqlite.close();
  });

  const largeText = "x".repeat(180);
  const artifactPage = [
    { title: "alpha", text: "a".repeat(40) },
    { title: "beta", text: "b".repeat(40) },
    { title: "gamma", text: "c".repeat(40) },
  ];

  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === "get_result_page"));
  assert.ok(!tools.tools.some((tool) => tool.name === "toggle_builtin_tools"));

  const manualLargeArtifact = context.db.sqlite.prepare(
    `INSERT INTO tool_result_artifacts
     (id, tool_name, kind, uri, mime_type, title, summary_json, content_json, total_items, total_chars, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  manualLargeArtifact.run(
    "text-artifact",
    "test_tool",
    "text",
    "bitsearch://results/text-artifact",
    "application/json",
    "text artifact",
    JSON.stringify({ tool_name: "test_tool" }),
    JSON.stringify(largeText),
    null,
    largeText.length,
    "2026-03-30T12:00:00.000Z",
  );
  manualLargeArtifact.run(
    "array-artifact",
    "test_tool",
    "items",
    "bitsearch://results/array-artifact",
    "application/json",
    "array artifact",
    JSON.stringify({ tool_name: "test_tool" }),
    JSON.stringify(artifactPage),
    artifactPage.length,
    JSON.stringify(artifactPage).length,
    "2026-03-30T12:00:00.000Z",
  );

  const pageOne = await client.callTool({
    name: "get_result_page",
    arguments: { result_id: "array-artifact", max_items: 1, max_chars: 1_000 },
  });
  const pageOneContent = JSON.parse(
    String(pageOne.content[0] && "text" in pageOne.content[0] ? pageOne.content[0].text : "{}"),
  ) as Record<string, unknown>;
  assert.equal(pageOneContent.returned_items, 1);
  assert.ok(pageOneContent.next_cursor);

  const pageTwo = await client.callTool({
    name: "get_result_page",
    arguments: {
      result_id: "array-artifact",
      cursor: String(pageOneContent.next_cursor),
      max_items: 1,
      max_chars: 1_000,
    },
  });
  const pageTwoContent = JSON.parse(
    String(pageTwo.content[0] && "text" in pageTwo.content[0] ? pageTwo.content[0].text : "{}"),
  ) as Record<string, unknown>;
  assert.equal(pageTwoContent.returned_items, 1);

  const resource = await client.readResource({ uri: "bitsearch://results/array-artifact" });
  const manifest = JSON.parse(resource.contents[0].text) as Record<string, unknown>;
  assert.equal(manifest.result_id, "array-artifact");
  assert.equal(manifest.tool_name, "test_tool");
  assert.ok(manifest.first_page);
  assert.ok(String(manifest.read_with).includes("get_result_page"));

  const textPage = await client.callTool({
    name: "get_result_page",
    arguments: { result_id: "text-artifact", max_chars: 1_000 },
  });
  const textPageContent = JSON.parse(
    String(textPage.content[0] && "text" in textPage.content[0] ? textPage.content[0].text : "{}"),
  ) as Record<string, unknown>;
  assert.equal(textPageContent.truncated, true);
  assert.ok(textPageContent.next_cursor);
});
