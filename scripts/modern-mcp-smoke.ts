import assert from "node:assert/strict";
import { startMcpToolingHarness } from "./lib/mcp-tooling-harness.js";

async function readJsonRpcResult(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const body = await response.text();
    const dataLine = body
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim()))
      .find((message) => message.result !== undefined);

    assert.ok(dataLine, "Expected a JSON-RPC SSE result");
    return dataLine.result;
  }

  assert.match(contentType, /application\/json/);
  return (await response.json()).result;
}

const MODERN_PROTOCOL_VERSION = "2026-07-28";

const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientInfo": {
    name: "bitsearch-modern-smoke",
    version: "0.0.1",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
} as const;

function modernHeaders(
  method: string,
  bearerToken: string,
): Record<string, string> {
  return {
    authorization: `Bearer ${bearerToken}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-method": method,
    "mcp-name": "bitsearch-modern-smoke",
    "mcp-protocol-version": MODERN_PROTOCOL_VERSION,
  };
}

const harness = await startMcpToolingHarness();
try {
  const invalidModernPost = await fetch(harness.protectedMcpUrl, {
    method: "POST",
    headers: {
      ...modernHeaders("server/discover", harness.bearerToken),
      authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
      params: { _meta: MODERN_META },
    }),
  });
  assert.equal(invalidModernPost.status, 401);
  assert.deepEqual(await invalidModernPost.json(), { error: "invalid_token" });

  const modernDiscover = await fetch(harness.protectedMcpUrl, {
    method: "POST",
    headers: modernHeaders("server/discover", harness.bearerToken),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
      params: { _meta: MODERN_META },
    }),
  });
  const discoverResult = await readJsonRpcResult(modernDiscover);
  assert.equal(modernDiscover.status, 200);
  assert.deepEqual(discoverResult.supportedVersions, [MODERN_PROTOCOL_VERSION]);
  assert.match(discoverResult.instructions, /BitSearch MCP Server Usage Guide/);
  assert.ok(discoverResult.capabilities.tools?.listChanged);

  const toolsResponse = await fetch(harness.protectedMcpUrl, {
    method: "POST",
    headers: modernHeaders("tools/list", harness.bearerToken),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: { _meta: MODERN_META },
    }),
  });
  const toolsResult = await readJsonRpcResult(toolsResponse);
  assert.equal(toolsResponse.status, 200);
  assert.ok(toolsResult.tools.some((tool: { name: string }) => (
    tool.name === "get_config_info"
  )));
  assert.equal(toolsResult.ttlMs, 10_000);
  assert.equal(toolsResult.cacheScope, "private");

  for (const method of ["GET", "DELETE"] as const) {
    const modernSessionOperation = await fetch(harness.protectedMcpUrl, {
      method,
      headers: { "mcp-protocol-version": MODERN_PROTOCOL_VERSION },
    });
    const body = await modernSessionOperation.json();
    assert.equal(modernSessionOperation.status, 405);
    assert.equal(body.error.code, -32000);
  }

  const unauthenticatedLegacyGet = await fetch(harness.protectedMcpUrl, {
    method: "GET",
  });
  assert.equal(unauthenticatedLegacyGet.status, 401);

  const unauthenticatedLegacyDelete = await fetch(harness.protectedMcpUrl, {
    method: "DELETE",
  });
  assert.equal(unauthenticatedLegacyDelete.status, 401);

  const legacyInitialize = await fetch(harness.protectedMcpUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${harness.bearerToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "legacy-smoke", version: "1.0.0" },
      },
    }),
  });
  assert.equal(legacyInitialize.status, 200);
  assert.ok(legacyInitialize.headers.get("mcp-session-id"));
  const legacyInitializeResult = await readJsonRpcResult(legacyInitialize);
  assert.match(
    legacyInitializeResult.instructions,
    /BitSearch MCP Server Usage Guide/,
  );

  console.log("PASS MCP 2026-07-28 dual-era smoke");
} finally {
  await harness.close();
}
