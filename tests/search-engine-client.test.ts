import assert from "node:assert/strict";
import test from "node:test";
import {
  listSearchEngineModels,
  searchWithSearchEngine,
  type SearchEngineClientConfig,
} from "../src/server/providers/search-engine-client.js";

const openAIChatConfig: SearchEngineClientConfig = {
  apiUrl: "http://example.com/openai",
  apiKey: "test-key",
  apiFormat: "openai_chat_completions",
  model: "gpt-4o-mini",
  timeoutMs: 30_000,
};

function openAIChatChunk(content: string): string {
  return `data: ${JSON.stringify({
    choices: [
      {
        delta: { content },
        finish_reason: null,
        index: 0,
      },
    ],
  })}\n\n`;
}

function openAIChatDoneChunk(): string {
  return `data: ${JSON.stringify({
    choices: [
      {
        delta: {},
        finish_reason: "stop",
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
    },
  })}\n\ndata: [DONE]\n\n`;
}

async function readRequestBody(init: RequestInit | undefined): Promise<Record<string, unknown>> {
  assert.equal(typeof init?.body, "string");
  return JSON.parse(init.body) as Record<string, unknown>;
}

function assertStatusCode(error: unknown, statusCode: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === statusCode
  );
}

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

test("openai chat completions uses AI SDK streaming path when supported", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: await readRequestBody(init),
    });
    return new Response(`${openAIChatChunk("hello ")}${openAIChatChunk("world")}${openAIChatDoneChunk()}`, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;

  try {
    const text = await searchWithSearchEngine(openAIChatConfig, [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Search query" },
    ]);

    assert.equal(text, "hello world");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://example.com/openai/v1/chat/completions");
    assert.equal(calls[0].body.stream, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("openai chat completions falls back to non-streaming when streaming fails", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = await readRequestBody(init);
    calls.push({
      url: String(input),
      body,
    });

    if (body.stream === true) {
      return new Response("stream not supported", { status: 400 });
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: "fallback response",
            },
            index: 0,
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const text = await searchWithSearchEngine(openAIChatConfig, [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Search query" },
    ]);

    assert.equal(text, "fallback response");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.stream, true);
    assert.notEqual(calls[1].body.stream, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("openai chat completions does not fall back on authentication failure", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = await readRequestBody(init);
    calls.push({
      url: String(input),
      body,
    });

    return new Response("invalid api key", { status: 401 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        searchWithSearchEngine(openAIChatConfig, [
          { role: "system", content: "System prompt" },
          { role: "user", content: "Search query" },
        ]),
      (error: unknown) => assertStatusCode(error, 401),
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.stream, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("openai chat completions does not fall back on unrelated bad request", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = await readRequestBody(init);
    calls.push({
      url: String(input),
      body,
    });

    return new Response("invalid model", { status: 400 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        searchWithSearchEngine(openAIChatConfig, [
          { role: "system", content: "System prompt" },
          { role: "user", content: "Search query" },
        ]),
      (error: unknown) => assertStatusCode(error, 400),
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.stream, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
