import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AppContext } from "../src/server/app-context.js";
import { createMcpServer } from "../src/server/mcp/register-tools.js";
import { saveSystemSettings } from "../src/server/repos/settings-repo.js";
import { listRequestLogs, listRequestAttempts } from "../src/server/repos/log-repo.js";
import { loadManagedKeyRows } from "../src/server/repos/key-pool-queries.js";
import { listActivityItems } from "../src/server/repos/activity-repo.js";
import { createSearchContext, jsonResponse, llmResponse, mockSearchFetch, TAVILY_RESPONSE } from "./helpers/search-fixture.js";

async function connect(context: AppContext) {
  const server = createMcpServer(context);
  const client = new Client({ name: "search-regression-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

function payload(result: Awaited<ReturnType<Client["callTool"]>>): Record<string, unknown> {
  return JSON.parse(String((result.content as Array<{ text: string }>)[0]?.text ?? "{}"));
}

const ACTIVITY_QUERY = { page: 1, pageSize: 20, sortBy: "created_at", sortDir: "desc" } as const;

for (const status of [401, 408, 429, 432, 433, 500]) {
  test(`MCP search logs every key attempt and updates key stats for HTTP ${status}`, async (t) => {
    const context = createSearchContext(t);
    saveSystemSettings(context.db, { searchUpstreamMode: "tavily_only" });
    const calls = mockSearchFetch(t, (_url, init) => new Headers(init?.headers).get("authorization") === "Bearer test-key-1"
      ? jsonResponse({ detail: { error: "first key failed" } }, status)
      : jsonResponse(TAVILY_RESPONSE));
    const { client, close } = await connect(context);
    try {
      const response = await client.callTool({ name: "web_search", arguments: { query: "retry query" } });
      assert.notEqual(response.isError, true);
      assert.equal(payload(response).content, "Tavily answer");
      assert.equal(calls.length, 2);
      const [log] = listRequestLogs(context.db, 10);
      assert.equal(log.finalProvider, "tavily");
      assert.equal(log.status, "success");
      assert.equal(log.attempts, 2);
      assert.deepEqual(log.providerOrder, ["tavily"]);
      const attempts = listRequestAttempts(context.db, 10).sort((a, b) => a.attemptNo - b.attemptNo);
      assert.deepEqual(attempts.map((attempt) => [attempt.attemptNo, attempt.status, attempt.statusCode]), [[1, "failed", status], [2, "success", 200]]);
      assert.ok(attempts.every((attempt) => attempt.requestLogId === log.id));
      assert.ok(attempts.every((attempt) => attempt.durationMs >= 0 && attempt.providerBaseUrl === "https://tavily.invalid"));
      const keys = loadManagedKeyRows(context.db, "tavily", "all").sort((a, b) => a.id.localeCompare(b.id));
      assert.deepEqual(keys.map((key) => [key.request_count, key.failure_count]), [[1, 1], [1, 0]]);
      const recovered = listActivityItems(context.db, { ...ACTIVITY_QUERY, onlyFallback: true });
      assert.equal(recovered.total, 1);
    } finally { await close(); }
  });
}

test("MCP tavily-only failures stay attributable to Tavily, not search_engine", async (t) => {
  const context = createSearchContext(t);
  saveSystemSettings(context.db, { searchUpstreamMode: "tavily_only" });
  mockSearchFetch(t, () => jsonResponse({ detail: { error: "plan exhausted" } }, 432));
  const { client, close } = await connect(context);
  try {
    const response = await client.callTool({ name: "web_search", arguments: { query: "all keys failed" } });
    assert.match(String(payload(response).content), /Upstream search failed/);
    const [log] = listRequestLogs(context.db, 10);
    assert.equal(log.finalProvider, null, "No upstream successfully delivered an answer");
    assert.equal(log.status, "failed");
    assert.equal(log.attempts, 2);
    const attempts = listRequestAttempts(context.db, 10);
    assert.equal(attempts.length, 2);
    assert.ok(attempts.every((attempt) => attempt.provider === "tavily" && attempt.errorType === "rate_limit"));
    assert.equal(listActivityItems(context.db, { ...ACTIVITY_QUERY, provider: "tavily", errorType: "rate_limit" }).total, 1);
    assert.equal(listActivityItems(context.db, { ...ACTIVITY_QUERY, provider: "search_engine" }).total, 0);
  } finally { await close(); }
});

for (const mode of ["llm_first", "tavily_first"] as const) {
  test(`MCP records ordered takeover and supports provider filters in ${mode}`, async (t) => {
    const context = createSearchContext(t);
    saveSystemSettings(context.db, { searchUpstreamMode: mode });
    mockSearchFetch(t, (url) => {
      if (url.includes("llm.invalid")) return mode === "llm_first" ? llmResponse("<think>No answer</think>") : llmResponse("LLM answer");
      return mode === "tavily_first" ? jsonResponse({ answer: null, results: [] }) : jsonResponse(TAVILY_RESPONSE);
    });
    const { client, close } = await connect(context);
    try {
      await client.callTool({ name: "web_search", arguments: { query: "takeover query" } });
      const [log] = listRequestLogs(context.db, 10);
      const expected = mode === "llm_first" ? ["search_engine", "tavily"] : ["tavily", "search_engine"];
      assert.equal(log.attempts, 2);
      assert.equal(log.metadata.takeover, true);
      assert.equal(log.finalProvider, expected[1]);
      assert.deepEqual(log.providerOrder, expected);
      const attempts = listRequestAttempts(context.db, 10).sort((a, b) => a.attemptNo - b.attemptNo);
      assert.deepEqual(attempts.map((attempt) => attempt.provider), expected);
      assert.equal(attempts[0].errorType, "empty_result");
      for (const provider of ["tavily", "search_engine"] as const) {
        assert.equal(listActivityItems(context.db, { ...ACTIVITY_QUERY, provider, onlyFallback: true }).total, 1);
      }
    } finally { await close(); }
  });
}

for (const status of [400, 403, 404, 422]) {
  test(`MCP does not exhaust the whole key pool on non-retryable HTTP ${status}`, async (t) => {
    const context = createSearchContext(t);
    saveSystemSettings(context.db, { searchUpstreamMode: "tavily_only" });
    const calls = mockSearchFetch(t, () => jsonResponse({ detail: { error: "invalid request" } }, status));
    const { client, close } = await connect(context);
    try {
      await client.callTool({ name: "web_search", arguments: { query: "invalid request" } });
      assert.equal(calls.length, 1);
      assert.equal(listRequestLogs(context.db, 10)[0].status, "failed");
      assert.equal(listRequestAttempts(context.db, 10)[0].statusCode, status);
    } finally { await close(); }
  });
}

test("MCP web_search keeps its schema, sources and pagination with live mode changes", async (t) => {
  const context = createSearchContext(t);
  saveSystemSettings(context.db, {
    searchUpstreamMode: "tavily_only",
    mcpResultBudget: { firstResponseChars: 40, pageChars: 60, hardResponseChars: 200 },
  });
  const answer = "Evidence answer. ".repeat(30).trim();
  mockSearchFetch(t, (url) => url.includes("tavily.invalid") ? jsonResponse({ ...TAVILY_RESPONSE, answer }) : llmResponse("LLM answer"));
  const { client, close } = await connect(context);
  try {
    const tools = await client.listTools();
    assert.deepEqual(Object.keys(tools.tools.find((tool) => tool.name === "web_search")?.inputSchema.properties ?? {}).sort(), ["extra_sources", "model", "platform", "query"]);
    const response = payload(await client.callTool({ name: "web_search", arguments: { query: "long answer" } }));
    assert.equal(response.content_truncated, true);
    assert.equal(response.sources_count, 1);
    let full = String(response.content);
    let cursor = response.next_cursor;
    while (cursor) {
      const page = payload(await client.callTool({ name: "get_result_page", arguments: { result_id: response.result_id, cursor } }));
      full += String(page.text);
      cursor = page.next_cursor;
    }
    assert.equal(full, answer);
    const sources = payload(await client.callTool({ name: "get_sources", arguments: { session_id: response.session_id } }));
    assert.equal(sources.sources_count, 1);
    saveSystemSettings(context.db, { searchUpstreamMode: "llm_only" });
    const next = payload(await client.callTool({ name: "web_search", arguments: { query: "new mode" } }));
    assert.equal(next.content, "LLM answer");
  } finally { await close(); }
});
