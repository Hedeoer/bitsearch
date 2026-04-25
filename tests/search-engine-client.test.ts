import assert from "node:assert/strict";
import test from "node:test";
import { listSearchEngineModels } from "../src/server/providers/search-engine-client.js";

test("openai compatible probe appends /v1 when base url has no version segment", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ data: [{ id: "gpt-4o-mini" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const models = await listSearchEngineModels({
      apiUrl: "http://example.com/openai",
      apiKey: "test-key",
      apiFormat: "openai_chat_completions",
      model: "gpt-4o-mini",
      timeoutMs: 30_000,
    });

    assert.deepEqual(models, ["gpt-4o-mini"]);
    assert.equal(calls[0], "http://example.com/openai/v1/models");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("anthropic probe strips compat suffix then appends /v1/models", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ data: [{ id: "claude-sonnet-4-5" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const models = await listSearchEngineModels({
      apiUrl: "http://example.com/anthropic",
      apiKey: "test-key",
      apiFormat: "anthropic_messages",
      model: "claude-sonnet-4-5",
      timeoutMs: 30_000,
    });

    assert.deepEqual(models, ["claude-sonnet-4-5"]);
    assert.equal(calls[0], "http://example.com/v1/models");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("google probe appends /v1beta/models when base url has no version segment", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ models: [{ name: "models/gemini-2.5-flash" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const models = await listSearchEngineModels({
      apiUrl: "http://example.com/gemini",
      apiKey: "test-key",
      apiFormat: "google_gemini",
      model: "gemini-2.5-flash",
      timeoutMs: 30_000,
    });

    assert.deepEqual(models, ["gemini-2.5-flash"]);
    assert.equal(calls[0], "http://example.com/gemini/v1beta/models?pageSize=1000");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
