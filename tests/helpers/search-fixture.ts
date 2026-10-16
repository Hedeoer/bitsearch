import type { TestContext } from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { AppContext } from "../../src/server/app-context.js";
import { SCHEMA_SQL } from "../../src/server/db/schema.js";
import { createAdminSessionStore } from "../../src/server/lib/admin-session.js";
import { encryptSecret, fingerprintSecret } from "../../src/server/lib/crypto.js";

const NOW = "2026-10-16T00:00:00.000Z";

export function createSearchContext(t: TestContext): AppContext {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA_SQL);
  t.after(() => sqlite.close());
  const secrets = {
    encryptionKey: "test-encryption-key",
    adminAuthKey: "test-admin",
    sessionSecret: "test-session",
    mcpBearerToken: "test-mcp",
  };
  const provider = sqlite.prepare(
    "INSERT INTO provider_configs (provider, enabled, base_url, api_key_encrypted, api_format, timeout_ms, updated_at) VALUES (?, 1, ?, ?, 'openai_chat_completions', 1000, ?)",
  );
  provider.run("tavily", "https://tavily.invalid", "", NOW);
  provider.run("search_engine", "https://llm.invalid/v1", encryptSecret("test-llm", secrets.encryptionKey), NOW);
  for (let index = 1; index <= 2; index += 1) {
    const secret = `test-key-${index}`;
    sqlite.prepare(
      "INSERT INTO provider_keys (id, provider, name, fingerprint, encrypted_key, enabled, tags_json, created_at, updated_at) VALUES (?, 'tavily', ?, ?, ?, 1, '[]', ?, ?)",
    ).run(`key-${index}`, `key-${index}`, fingerprintSecret(secret), encryptSecret(secret, secrets.encryptionKey), `2026-10-15T00:00:0${index}.000Z`, NOW);
  }
  return {
    db: { sqlite, now: () => NOW },
    adminSessions: createAdminSessionStore(secrets.sessionSecret),
    bootstrap: {
      ...secrets,
      port: 0,
      host: "127.0.0.1",
      databasePath: ":memory:",
      trustProxy: false,
      runtimeSecrets: {
        filePath: "",
        dirty: false,
        sources: { encryptionKey: "env", adminAuthKey: "env", sessionSecret: "env", mcpBearerToken: "env" },
        values: secrets,
      },
    },
  };
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

export function llmResponse(text: string): Response {
  const data = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
  return new Response(
    data({ choices: [{ delta: { content: text }, finish_reason: null, index: 0 }] }) +
    data({ choices: [{ delta: {}, finish_reason: "stop", index: 0 }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }) +
    "data: [DONE]\n\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}

export const TAVILY_RESPONSE = {
  answer: "Tavily answer",
  results: [{ title: "Evidence", url: "https://evidence.invalid/page", content: "Evidence text", score: 0.9 }],
  usage: { credits: 2 },
  request_id: "test-request",
};

export function mockSearchFetch(t: TestContext, respond: (url: string, init?: RequestInit) => Response) {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(url));
    return respond(String(url), init);
  });
  return calls;
}
