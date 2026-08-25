import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { AppDatabase } from "../src/server/db/database.js";
import { SCHEMA_SQL } from "../src/server/db/schema.js";
import { getToolSurfaceSnapshot } from "../src/server/services/tool-surface-service.js";
import {
  getSystemSettings,
  saveSystemSetting,
  saveSystemSettings,
} from "../src/server/repos/settings-repo.js";

function createDb(): AppDatabase {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA_SQL);
  return {
    sqlite,
    now: () => "2026-08-25T12:00:00.000Z",
  };
}

test("getSystemSettings defaults disabledTools to an empty list", () => {
  const db = createDb();
  assert.deepEqual(getSystemSettings(db).disabledTools, []);
});

test("getSystemSettings filters unknown and duplicate tool names from stored disabled_tools", () => {
  const db = createDb();
  saveSystemSetting(db, "disabled_tools", [
    "web_map",
    "not_a_real_tool",
    "web_map",
    42,
    "switch_model",
  ]);
  assert.deepEqual(getSystemSettings(db).disabledTools, ["web_map", "switch_model"]);
});

test("saveSystemSettings persists disabledTools including an empty list", () => {
  const db = createDb();
  saveSystemSettings(db, { disabledTools: ["web_map"] });
  assert.deepEqual(getSystemSettings(db).disabledTools, ["web_map"]);
  saveSystemSettings(db, { disabledTools: [] });
  assert.deepEqual(getSystemSettings(db).disabledTools, []);
});

test("tool surface snapshot moves manually disabled tools from exposed to hidden", () => {
  const db = createDb();
  saveSystemSettings(db, { disabledTools: ["web_map", "tavily_crawl", "plan_intent"] });

  const snapshot = getToolSurfaceSnapshot({
    db,
    bootstrap: { mcpBearerToken: "token", adminAuthKey: "key", encryptionKey: "enc" },
  } as Parameters<typeof getToolSurfaceSnapshot>[0]);

  assert.ok(!snapshot.exposedTools.includes("web_map"));
  assert.ok(!snapshot.exposedTools.includes("tavily_crawl"));
  assert.ok(!snapshot.exposedTools.includes("plan_intent"));
  assert.ok(snapshot.exposedTools.includes("web_search"));

  assert.ok(!snapshot.genericTools.includes("web_map"));
  assert.ok(!snapshot.providerTools.includes("tavily_crawl"));
  assert.ok(!snapshot.planningTools.includes("plan_intent"));
  assert.ok(snapshot.metaTools.includes("get_config_info"));

  const manualRecords = snapshot.hiddenTools.filter(
    (record) => record.reason === "manually_disabled",
  );
  assert.deepEqual(
    manualRecords.map((record) => record.tool).sort(),
    ["plan_intent", "tavily_crawl", "web_map"],
  );
  assert.equal(
    manualRecords.find((record) => record.tool === "tavily_crawl")?.provider,
    "tavily",
  );
  assert.equal(
    manualRecords.find((record) => record.tool === "web_map")?.provider,
    null,
  );

  // No duplicate hidden records when a tool is both disabled and derived-hidden.
  const hiddenCounts = new Map<string, number>();
  for (const record of snapshot.hiddenTools) {
    hiddenCounts.set(record.tool, (hiddenCounts.get(record.tool) ?? 0) + 1);
  }
  for (const [tool, count] of hiddenCounts) {
    assert.equal(count, 1, `tool ${tool} appears ${count} times in hiddenTools`);
  }
});

test("client guidance drops the web_search hint when the tool is disabled", () => {
  const db = createDb();
  saveSystemSettings(db, { disabledTools: ["web_search"] });

  const snapshot = getToolSurfaceSnapshot({
    db,
    bootstrap: { mcpBearerToken: "token", adminAuthKey: "key", encryptionKey: "enc" },
  } as Parameters<typeof getToolSurfaceSnapshot>[0]);

  assert.ok(!snapshot.clientGuidance.recommendedPrompt.includes("Use web_search"));
  assert.ok(snapshot.clientGuidance.recommendedPrompt.includes("get_result_page"));
});
