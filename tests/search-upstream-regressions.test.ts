import assert from "node:assert/strict";
import test from "node:test";
import { createSearchContext, jsonResponse, llmResponse, mockSearchFetch, TAVILY_RESPONSE } from "./helpers/search-fixture.js";
import { runUpstreamSearch, UpstreamSearchError } from "../src/server/services/search-upstream-service.js";
import { parseSystemSettingsPayload } from "../src/server/http/admin-route-utils.js";
import { getSystemSettings, saveSystemSettings } from "../src/server/repos/settings-repo.js";

const INPUT = { query: "test query", platform: "", model: "", sessionId: "test-search" };

for (const mode of ["llm_only", "llm_first", "tavily_only", "tavily_first"] as const) {
  test(`${mode} uses only its first upstream on success`, async (t) => {
    const context = createSearchContext(t);
    const calls = mockSearchFetch(t, (url) => url.includes("llm.invalid") ? llmResponse("LLM answer") : jsonResponse(TAVILY_RESPONSE));
    const result = await runUpstreamSearch(context, { ...INPUT, mode });
    assert.equal(result.upstream, mode.startsWith("llm") ? "llm" : "tavily");
    assert.equal(result.takeover, false);
    assert.equal(calls.length, 1);
  });
}

for (const text of ["", "<think>Only thinking</think>", "## Sources\n[Evidence](https://evidence.invalid/page)"]) {
  test(`llm_first takes over when the final answer is empty: ${JSON.stringify(text)}`, async (t) => {
    const context = createSearchContext(t);
    const calls = mockSearchFetch(t, (url) => url.includes("llm.invalid") ? llmResponse(text) : jsonResponse(TAVILY_RESPONSE));
    const result = await runUpstreamSearch(context, { ...INPUT, mode: "llm_first" });
    assert.equal(result.upstream, "tavily");
    assert.equal(result.takeover, true);
    assert.equal(result.answer, "Tavily answer");
    assert.equal(calls.length, 2);
    assert.match(result.primaryUpstreamError ?? "", /empty answer/);
  });
}

for (const results of [[], [{}], [null], [{ title: "No URL", content: "Not a usable source" }], [{ title: "Unsafe", url: "javascript:alert(1)" }]]) {
  test(`tavily_first takes over when there is no answer or usable evidence: ${JSON.stringify(results)}`, async (t) => {
    const context = createSearchContext(t);
    const calls = mockSearchFetch(t, (url) => url.includes("tavily.invalid") ? jsonResponse({ answer: null, results }) : llmResponse("LLM recovery"));
    const result = await runUpstreamSearch(context, { ...INPUT, mode: "tavily_first" });
    assert.equal(result.upstream, "llm");
    assert.equal(result.takeover, true);
    assert.equal(result.answer, "LLM recovery");
    assert.equal(calls.length, 2, "No-result queries must not be repeated with every key");
  });
}

test("tavily_only reports failure rather than a fabricated success heading for no results", async (t) => {
  const context = createSearchContext(t);
  const calls = mockSearchFetch(t, () => jsonResponse({ answer: null, results: [] }));
  await assert.rejects(runUpstreamSearch(context, { ...INPUT, mode: "tavily_only" }), UpstreamSearchError);
  assert.equal(calls.length, 1);
});

test("legacy system payload preserves a saved search mode while updating unrelated settings", (t) => {
  const context = createSearchContext(t);
  saveSystemSettings(context.db, { searchUpstreamMode: "tavily_only" });
  const { searchUpstreamMode: _mode, ...oldPayload } = getSystemSettings(context.db);
  saveSystemSettings(context.db, parseSystemSettingsPayload({ ...oldPayload, logRetentionDays: 14 }, true));
  assert.equal(getSystemSettings(context.db).searchUpstreamMode, "tavily_only");
  assert.equal(getSystemSettings(context.db).logRetentionDays, 14);
});
