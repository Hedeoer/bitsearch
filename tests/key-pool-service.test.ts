import assert from "node:assert/strict";
import test from "node:test";
import { syncKeyQuotas } from "../src/server/services/key-pool-service.js";
import { SCHEMA_SQL } from "../src/server/db/schema.js";
import type { AppContext } from "../src/server/app-context.js";
import { DatabaseSync } from "node:sqlite";
import { encryptSecret, fingerprintSecret } from "../src/server/lib/crypto.js";

function createContext(): AppContext {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA_SQL);
  const now = "2026-04-25T05:22:34.843Z";
  sqlite.prepare(
    "INSERT INTO provider_configs (provider, enabled, base_url, api_key_encrypted, api_format, timeout_ms, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("firecrawl", 1, "http://127.0.0.1:1", "", "openai_chat_completions", 1000, now);

  const encryptionKey = "test-encryption-key";
  const secret = "fc-demo-secret";
  sqlite.prepare(
    `INSERT INTO provider_keys
      (id, provider, name, fingerprint, encrypted_key, enabled, tags_json, note, last_check_status, quota_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "fc-1",
    "firecrawl",
    "fc-1",
    fingerprintSecret(secret),
    encryptSecret(secret, encryptionKey),
    1,
    "[]",
    "",
    "unknown",
    "{}",
    now,
    now,
  );

  return {
    bootstrap: {
      port: 8097,
      host: "127.0.0.1",
      databasePath: ":memory:",
      encryptionKey,
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
          encryptionKey,
          adminAuthKey: "admin",
          sessionSecret: "session",
          mcpBearerToken: "token",
        },
      },
    },
    db: {
      sqlite,
      now: () => now,
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

test("syncKeyQuotas stores the latest Firecrawl historical period credits", async (t) => {
  const context = createContext();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    if (url.endsWith("/team/credit-usage")) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          remainingCredits: 120,
          planCredits: 500,
          billingPeriodStart: "2026-04-01T00:00:00.000Z",
          billingPeriodEnd: "2026-04-30T23:59:59.999Z",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.endsWith("/team/credit-usage/historical")) {
      return new Response(JSON.stringify({
        success: true,
        periods: [
          {
            startDate: "2026-03-01T00:00:00.000Z",
            endDate: "2026-03-31T23:59:59.999Z",
            creditsUsed: 20,
          },
          {
            startDate: "2026-04-01T00:00:00.000Z",
            endDate: null,
            creditsUsed: 74,
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`unexpected_url:${url}`);
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await syncKeyQuotas(context, "firecrawl", ["fc-1"]);
  assert.deepEqual(result, { updated: 1, failed: 0 });

  const row = context.db.sqlite
    .prepare("SELECT quota_json FROM provider_keys WHERE id = ?")
    .get("fc-1") as { quota_json: string };
  const quota = JSON.parse(row.quota_json) as {
    firecrawl?: {
      historical?: {
        totalCredits?: number | null;
        startDate?: string | null;
        endDate?: string | null;
      };
    };
  };

  assert.equal(quota.firecrawl?.historical?.totalCredits, 74);
  assert.equal(quota.firecrawl?.historical?.startDate, "2026-04-01T00:00:00.000Z");
  assert.equal(quota.firecrawl?.historical?.endDate, null);
});
