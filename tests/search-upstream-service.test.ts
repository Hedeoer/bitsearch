import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { AppContext } from "../src/server/app-context.js";
import { SCHEMA_SQL } from "../src/server/db/schema.js";
import { encryptSecret, fingerprintSecret } from "../src/server/lib/crypto.js";
import { HttpRequestError } from "../src/server/lib/http.js";
import { isFailoverError } from "../src/server/providers/fetch-router.js";
import {
  resolveUpstreamOrder,
  runUpstreamSearch,
  UpstreamSearchError,
} from "../src/server/services/search-upstream-service.js";

const NOW = "2026-10-06T12:00:00.000Z";
const ENCRYPTION_KEY = "test-encryption-key";

interface TestContextOptions {
  tavilyKeyCount?: number;
  withSearchEngine?: boolean;
}

function createTestContext(
  options: TestContextOptions = {},
): AppContext {
  const tavilyKeyCount = options.tavilyKeyCount ?? 1;
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA_SQL);

  sqlite.prepare(
    "INSERT INTO provider_configs (provider, enabled, base_url, api_key_encrypted, api_format, timeout_ms, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "tavily",
    1,
    "https://api.tavily.test",
    "",
    "openai_chat_completions",
    30_000,
    NOW,
  );

  if (options.withSearchEngine) {
    sqlite.prepare(
      "INSERT INTO provider_configs (provider, enabled, base_url, api_key_encrypted, api_format, timeout_ms, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "search_engine",
      1,
      "https://search-engine.test/v1",
      encryptSecret("sk-search-engine", ENCRYPTION_KEY),
      "openai_chat_completions",
      30_000,
      NOW,
    );
  }

  const insertKey = sqlite.prepare(
    `INSERT INTO provider_keys
      (id, provider, name, fingerprint, encrypted_key, enabled, tags_json, note, last_check_status, quota_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let index = 1; index <= tavilyKeyCount; index += 1) {
    const secret = `tvly-key-${index}`;
    insertKey.run(
      `tvly-${index}`,
      "tavily",
      `tvly-${index}`,
      fingerprintSecret(secret),
      encryptSecret(secret, ENCRYPTION_KEY),
      1,
      "[]",
      "",
      "unknown",
      "{}",
      `${NOW}-${index}`,
      `${NOW}-${index}`,
    );
  }

  return {
    bootstrap: {
      port: 8097,
      host: "127.0.0.1",
      databasePath: ":memory:",
      encryptionKey: ENCRYPTION_KEY,
      adminAuthKey: "admin",
      sessionSecret: "session",
      mcpBearerToken: "token",
      trustProxy: false,
      runtimeSecrets: {
        filePath: "",
        dirty: false,
        sources: {
          encryptionKey: "env",
          adminAuthKey: "env",
          sessionSecret: "env",
          mcpBearerToken: "env",
        },
        values: {
          encryptionKey: ENCRYPTION_KEY,
          adminAuthKey: "admin",
          sessionSecret: "session",
          mcpBearerToken: "token",
        },
      },
    },
    db: {
      sqlite,
      now: () => NOW,
    },
    adminSessions: {
      issue() {
        throw new Error("not_implemented");
      },
      validate() {
        return null;
      },
      revoke() {
        return false;
      },
      revokeUserSessions() {
        return 0;
      },
    },
  };
}

interface RecordedRequest {
  url: string;
  authorization: string | null;
  sessionId: string | null;
  body: Record<string, unknown>;
}

type MockHandler = (
  request: RecordedRequest,
) => { status: number; json: unknown } | { status: number; text: string };

function installFetchMock(
  t: test.TestContext,
  handler: MockHandler,
): RecordedRequest[] {
  const recorded: RecordedRequest[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const headers = new Headers(init?.headers);
    const request: RecordedRequest = {
      url,
      authorization: headers.get("authorization"),
      sessionId: headers.get("x-session-id"),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    };
    recorded.push(request);
    const result = handler(request);
    if ("json" in result) {
      return new Response(JSON.stringify(result.json), {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(result.text, {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  return recorded;
}

function tavilySuccessPayload(answer: string | null) {
  return {
    answer,
    results: [
      {
        title: "Messi facts",
        url: "https://example.com/messi",
        content: "Lionel Messi is an Argentine footballer.",
        score: 0.81,
      },
      {
        title: "Messi wiki",
        url: "https://example.com/messi-wiki",
        content: "Widely regarded as one of the greatest players.",
        score: 0.75,
      },
    ],
    usage: { credits: 2 },
    request_id: "req-123",
  };
}

function keyFingerprint(index: number): string {
  return fingerprintSecret(`tvly-key-${index}`);
}

function lastKeyStatus(context: AppContext, keyId: string): number | null {
  const row = context.db.sqlite
    .prepare("SELECT last_status_code FROM provider_keys WHERE id = ?")
    .get(keyId) as { last_status_code: number | null } | undefined;
  return row?.last_status_code ?? null;
}

test("resolveUpstreamOrder maps every search upstream mode", () => {
  assert.deepEqual(resolveUpstreamOrder("llm_only"), ["llm"]);
  assert.deepEqual(resolveUpstreamOrder("tavily_only"), ["tavily"]);
  assert.deepEqual(resolveUpstreamOrder("llm_first"), ["llm", "tavily"]);
  assert.deepEqual(resolveUpstreamOrder("tavily_first"), ["tavily", "llm"]);
});

test("tavily_only succeeds with the locked search parameters", async (t) => {
  const context = createTestContext();
  const recorded = installFetchMock(t, () => ({
    status: 200,
    json: tavilySuccessPayload("Messi is an Argentine footballer."),
  }));

  const outcome = await runUpstreamSearch(context, {
    query: "Who is Leo Messi?",
    platform: "",
    model: "",
    sessionId: "sess-abc",
    mode: "tavily_only",
  });

  assert.equal(recorded.length, 1);
  assert.match(recorded[0].url, /\/search$/);
  assert.equal(recorded[0].authorization, "Bearer tvly-key-1");
  assert.equal(recorded[0].sessionId, "sess-abc");
  assert.deepEqual(
    {
      search_depth: recorded[0].body.search_depth,
      include_answer: recorded[0].body.include_answer,
      include_raw_content: recorded[0].body.include_raw_content,
      max_results: recorded[0].body.max_results,
      chunks_per_source: recorded[0].body.chunks_per_source,
      auto_parameters: recorded[0].body.auto_parameters,
      include_usage: recorded[0].body.include_usage,
    },
    {
      search_depth: "advanced",
      include_answer: "advanced",
      include_raw_content: false,
      max_results: 5,
      chunks_per_source: 3,
      auto_parameters: false,
      include_usage: true,
    },
  );

  assert.equal(outcome.upstream, "tavily");
  assert.equal(outcome.takeover, false);
  assert.equal(outcome.invalidModel, null);
  assert.equal(outcome.answer, "Messi is an Argentine footballer.");
  assert.equal(outcome.usedLocalAssembly, false);
  assert.equal(outcome.keyFingerprint, keyFingerprint(1));
  assert.equal(outcome.tavilyRequestId, "req-123");
  assert.equal(outcome.usageCredits, 2);
  assert.equal(outcome.searchEngineApiFormat, null);
  assert.equal(outcome.primaryUpstreamError, null);
  assert.equal(outcome.sources.length, 2);
  assert.equal(outcome.sources[0]?.provider, "tavily");
  assert.equal(lastKeyStatus(context, "tvly-1"), 200);
});

test("empty tavily answer falls back to local assembly from results", async (t) => {
  const context = createTestContext();
  installFetchMock(t, () => ({
    status: 200,
    json: tavilySuccessPayload(null),
  }));

  const outcome = await runUpstreamSearch(context, {
    query: "Who is Leo Messi?",
    platform: "",
    model: "",
    sessionId: "sess-abc",
    mode: "tavily_only",
  });

  assert.equal(outcome.usedLocalAssembly, true);
  assert.match(outcome.answer, /Top search results:/);
  assert.match(outcome.answer, /\[Messi facts\]\(https:\/\/example\.com\/messi\)/);
  assert.equal(outcome.sources.length, 2);
});

test("exhausted tavily key (432) moves on to the next key", async (t) => {
  const context = createTestContext({ tavilyKeyCount: 2 });
  const recorded = installFetchMock(t, (request) => {
    if (request.authorization === "Bearer tvly-key-1") {
      return {
        status: 432,
        json: { detail: { error: "This request exceeds your plan's usage limit." } },
      };
    }
    return { status: 200, json: tavilySuccessPayload("Answer from key 2") };
  });

  const outcome = await runUpstreamSearch(context, {
    query: "latest AI news",
    platform: "",
    model: "",
    sessionId: "sess-abc",
    mode: "tavily_only",
  });

  assert.equal(recorded.length, 2);
  assert.equal(outcome.answer, "Answer from key 2");
  assert.equal(outcome.keyFingerprint, keyFingerprint(2));
  assert.equal(lastKeyStatus(context, "tvly-1"), 432);
  assert.equal(lastKeyStatus(context, "tvly-2"), 200);
});

test("invalid tavily key (401) moves on to the next key", async (t) => {
  const context = createTestContext({ tavilyKeyCount: 2 });
  installFetchMock(t, (request) => {
    if (request.authorization === "Bearer tvly-key-1") {
      return {
        status: 401,
        json: { detail: { error: "Unauthorized: missing or invalid API key." } },
      };
    }
    return { status: 200, json: tavilySuccessPayload("Answer from key 2") };
  });

  const outcome = await runUpstreamSearch(context, {
    query: "latest AI news",
    platform: "",
    model: "",
    sessionId: "sess-abc",
    mode: "tavily_only",
  });

  assert.equal(outcome.keyFingerprint, keyFingerprint(2));
  assert.equal(lastKeyStatus(context, "tvly-1"), 401);
});

test("parameter error (400) aborts the key pool instead of retrying", async (t) => {
  const context = createTestContext({ tavilyKeyCount: 2 });
  const recorded = installFetchMock(t, () => ({
    status: 400,
    json: { detail: { error: "Bad request." } },
  }));

  await assert.rejects(
    runUpstreamSearch(context, {
      query: "broken query",
      platform: "",
      model: "",
      sessionId: "sess-abc",
      mode: "tavily_only",
    }),
    (error: unknown) => {
      assert.ok(error instanceof UpstreamSearchError);
      assert.equal(error.attempts.length, 1);
      assert.equal(error.attempts[0]?.upstream, "tavily");
      assert.match(error.message, /^Upstream search failed: tavily:/);
      return true;
    },
  );

  assert.equal(recorded.length, 1);
  assert.equal(lastKeyStatus(context, "tvly-1"), 400);
  assert.equal(lastKeyStatus(context, "tvly-2"), null);
});

test("llm_first takes over to tavily when search_engine is not configured", async (t) => {
  const context = createTestContext();
  installFetchMock(t, () => ({
    status: 200,
    json: tavilySuccessPayload("Tavily takeover answer"),
  }));

  const outcome = await runUpstreamSearch(context, {
    query: "latest AI news",
    platform: "",
    model: "",
    sessionId: "sess-abc",
    mode: "llm_first",
  });

  assert.equal(outcome.upstream, "tavily");
  assert.equal(outcome.takeover, true);
  assert.match(
    outcome.primaryUpstreamError ?? "",
    /search_engine is not fully configured/,
  );
  assert.equal(outcome.answer, "Tavily takeover answer");
});

test("llm_first surfaces UpstreamSearchError when both upstreams fail", async (t) => {
  const context = createTestContext();
  installFetchMock(t, () => ({
    status: 500,
    json: { detail: { error: "Internal server error." } },
  }));

  await assert.rejects(
    runUpstreamSearch(context, {
      query: "latest AI news",
      platform: "",
      model: "",
      sessionId: "sess-abc",
      mode: "llm_first",
    }),
    (error: unknown) => {
      assert.ok(error instanceof UpstreamSearchError);
      assert.deepEqual(
        error.attempts.map((attempt) => attempt.upstream),
        ["llm", "tavily"],
      );
      assert.match(error.attempts[0]?.error, /search_engine is not fully configured/);
      assert.match(error.attempts[1]?.error, /all tavily keys failed/);
      return true;
    },
  );
});

test("invalid model is surfaced without upstream takeover", async (t) => {
  const context = createTestContext({ withSearchEngine: true });
  installFetchMock(t, (request) => {
    if (request.url.endsWith("/models")) {
      return { status: 200, json: { data: [{ id: "model-a" }] } };
    }
    return { status: 200, json: tavilySuccessPayload("should not be reached") };
  });

  const outcome = await runUpstreamSearch(context, {
    query: "latest AI news",
    platform: "",
    model: "model-b",
    sessionId: "sess-abc",
    mode: "llm_first",
  });

  assert.equal(outcome.invalidModel, "model-b");
  assert.equal(outcome.upstream, "llm");
  assert.equal(outcome.takeover, false);
  assert.equal(outcome.sources.length, 0);
});

test("isFailoverError treats exhausted or invalid keys as retryable", () => {
  assert.equal(isFailoverError(new HttpRequestError("limit", 429)).retryable, true);
  assert.equal(isFailoverError(new HttpRequestError("unauthorized", 401)).retryable, true);
  assert.equal(isFailoverError(new HttpRequestError("plan limit", 432)).retryable, true);
  assert.equal(isFailoverError(new HttpRequestError("paygo limit", 433)).retryable, true);
  assert.equal(isFailoverError(new HttpRequestError("timeout", 408)).retryable, true);
  assert.equal(isFailoverError(new HttpRequestError("server", 500)).retryable, true);
  assert.equal(isFailoverError(new HttpRequestError("bad request", 400)).retryable, false);
  assert.equal(isFailoverError(new HttpRequestError("forbidden", 403)).retryable, false);
  assert.equal(isFailoverError(new HttpRequestError("validation", 422)).retryable, false);
  assert.equal(isFailoverError(new Error("network")).retryable, true);
});
