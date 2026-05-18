import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { AppContext } from "../src/server/app-context.js";
import type { BootstrapConfig } from "../src/server/bootstrap.js";
import type { AppDatabase } from "../src/server/db/database.js";
import { SCHEMA_SQL } from "../src/server/db/schema.js";
import { createAdminSessionStore } from "../src/server/lib/admin-session.js";
import {
  getResultPage,
  readArtifactResource,
  saveArtifact,
} from "../src/server/mcp/result-artifacts.js";

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
       ('mcp_result_budget', '{"firstResponseChars":200,"pageChars":300,"hardResponseChars":500}', '2026-03-30T12:00:00.000Z')`,
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

test("getResultPage pages array artifacts with opaque cursors", () => {
  const context = createContext();
  const artifact = saveArtifact(context, {
    toolName: "test_tool",
    kind: "items",
    content: [
      { title: "alpha", text: "first" },
      { title: "beta", text: "second" },
      { title: "gamma", text: "third" },
    ],
    totalItems: 3,
  });

  const first = getResultPage(context, {
    resultId: artifact.id,
    maxItems: 2,
    maxChars: 200,
  });

  assert.ok(first);
  assert.ok(first.returned_items >= 1);
  assert.equal(first.total_items, 3);
  assert.equal(first.truncated, true);
  assert.ok(first.next_cursor);

  const pages = [first];
  let cursor = first.next_cursor;
  while (cursor) {
    const page = getResultPage(context, {
      resultId: artifact.id,
      cursor,
      maxItems: 2,
      maxChars: 200,
    });
    assert.ok(page);
    pages.push(page);
    cursor = page.next_cursor;
  }

  assert.equal(pages.reduce((sum, page) => sum + (page.returned_items ?? 0), 0), 3);
  assert.equal(pages.at(-1)?.truncated, false);
  assert.equal(pages.at(-1)?.next_cursor, null);
});

test("getResultPage pages text artifacts by character budget", () => {
  const context = createContext();
  const artifact = saveArtifact(context, {
    toolName: "web_fetch",
    kind: "text",
    content: "abcdefghijklmnopqrstuvwxyz",
    totalItems: null,
  });

  const first = getResultPage(context, {
    resultId: artifact.id,
    maxChars: 10,
  });

  assert.ok(first);
  assert.equal(first.text, "abcdefghij");
  assert.equal(first.truncated, true);
  assert.ok(first.next_cursor);

  const second = getResultPage(context, {
    resultId: artifact.id,
    cursor: first.next_cursor ?? undefined,
    maxChars: 10,
  });

  assert.ok(second);
  assert.equal(second.text, "klmnopqrst");
});

test("getResultPage returns item previews for oversized array entries", () => {
  const context = createContext();
  const artifact = saveArtifact(context, {
    toolName: "crawl_tool",
    kind: "items",
    content: [
      { url: "https://example.com/a", raw_content: "a".repeat(2_000) },
      { url: "https://example.com/b", raw_content: "small" },
    ],
    totalItems: 2,
  });

  const page = getResultPage(context, {
    resultId: artifact.id,
    maxItems: 2,
    maxChars: 300,
  });

  assert.ok(page);
  const firstItem = page.items?.[0] as Record<string, unknown>;
  assert.equal(firstItem._item_index, 0);
  assert.equal(firstItem._item_truncated, true);
  assert.match(String(firstItem.raw_content), /truncated/);
  assert.ok((page.returned_items ?? 0) >= 1);

  const itemPage = getResultPage(context, {
    resultId: artifact.id,
    itemIndex: 0,
    maxChars: 300,
  });

  assert.ok(itemPage);
  assert.equal(itemPage.item_index, 0);
  assert.ok(itemPage.text?.includes("raw_content"));
  assert.equal(itemPage.truncated, true);
});

test("readArtifactResource returns a bounded manifest", () => {
  const context = createContext();
  const artifact = saveArtifact(context, {
    toolName: "web_fetch",
    kind: "text",
    content: "full content",
    totalItems: null,
  });

  const resource = readArtifactResource(context, new URL(artifact.uri));

  assert.equal(resource.contents.length, 1);
  assert.equal(resource.contents[0]?.uri, artifact.uri);
  const manifest = JSON.parse(
    ("text" in resource.contents[0] && resource.contents[0].text) || "{}",
  ) as Record<string, unknown>;
  assert.equal(manifest.result_id, artifact.id);
  assert.equal(manifest.total_chars, "full content".length);
  assert.match(String(manifest.read_with), /get_result_page/);
});

test("getResultPage returns null for missing or invalid result state", () => {
  const context = createContext();

  assert.equal(getResultPage(context, { resultId: "missing" }), null);

  const artifact = saveArtifact(context, {
    toolName: "test_tool",
    kind: "text",
    content: "content",
    totalItems: null,
  });

  assert.equal(getResultPage(context, { resultId: artifact.id, cursor: "not-base64" }), null);
});

test("getResultPage rejects mismatched cursor kinds", () => {
  const context = createContext();

  const textArtifact = saveArtifact(context, {
    toolName: "web_fetch",
    kind: "text",
    content: "abcdefghij",
    totalItems: null,
  });
  const arrayArtifact = saveArtifact(context, {
    toolName: "crawl_tool",
    kind: "items",
    content: ["one", "two"],
    totalItems: 2,
  });

  const textCursor = Buffer.from(JSON.stringify({ kind: "text", offset: 3 }), "utf8").toString("base64url");
  const arrayCursor = Buffer.from(JSON.stringify({ kind: "array", index: 1 }), "utf8").toString("base64url");

  assert.equal(
    getResultPage(context, {
      resultId: textArtifact.id,
      cursor: arrayCursor,
    }),
    null,
  );
  assert.equal(
    getResultPage(context, {
      resultId: arrayArtifact.id,
      cursor: textCursor,
    }),
    null,
  );
});

test("getResultPage rejects invalid item-text cursor payloads", () => {
  const context = createContext();
  const artifact = saveArtifact(context, {
    toolName: "crawl_tool",
    kind: "items",
    content: [{ body: "one" }, { body: "two" }],
    totalItems: 2,
  });

  const invalidCursor = Buffer.from(
    JSON.stringify({ kind: "item_text", index: 0, offset: -1 }),
    "utf8",
  ).toString("base64url");

  assert.equal(
    getResultPage(context, {
      resultId: artifact.id,
      cursor: invalidCursor,
      itemIndex: 0,
    }),
    null,
  );
});
