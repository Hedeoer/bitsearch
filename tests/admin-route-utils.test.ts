import assert from "node:assert/strict";
import test from "node:test";
import { AppHttpError } from "../src/server/lib/http.js";
import {
  parseSearchEngineProbePayload,
  parseSearchEngineRequestTestPayload,
} from "../src/server/http/admin-route-utils.js";

test("parseSearchEngineProbePayload normalizes local draft settings", () => {
  const payload = parseSearchEngineProbePayload(
    {
      baseUrl: "http://localhost:11434/v1/",
      timeoutMs: 45_000,
      apiKey: "  draft-key  ",
      useSavedApiKey: false,
    },
    true,
  );

  assert.deepEqual(payload, {
    baseUrl: "http://localhost:11434/v1",
    timeoutMs: 45_000,
    apiKey: "draft-key",
    useSavedApiKey: false,
  });
});

test("parseSearchEngineRequestTestPayload accepts saved-key mode", () => {
  const payload = parseSearchEngineRequestTestPayload(
    {
      baseUrl: "https://api.openai.com/v1",
      timeoutMs: 60_000,
      apiKey: "",
      useSavedApiKey: true,
      model: "gpt-4o-mini",
    },
    false,
  );

  assert.equal(payload.baseUrl, "https://api.openai.com/v1");
  assert.equal(payload.timeoutMs, 60_000);
  assert.equal(payload.apiKey, "");
  assert.equal(payload.useSavedApiKey, true);
  assert.equal(payload.model, "gpt-4o-mini");
});

test("parseSearchEngineProbePayload rejects non-local http urls", () => {
  assert.throws(
    () =>
      parseSearchEngineProbePayload(
        {
          baseUrl: "http://example.com/v1",
          timeoutMs: 30_000,
          apiKey: "draft-key",
          useSavedApiKey: false,
        },
        false,
      ),
    (error: unknown) =>
      error instanceof AppHttpError && error.code === "invalid_provider_base_url",
  );
});

test("parseSearchEngineRequestTestPayload requires a non-empty model", () => {
  assert.throws(
    () =>
      parseSearchEngineRequestTestPayload(
        {
          baseUrl: "https://api.openai.com/v1",
          timeoutMs: 30_000,
          apiKey: "draft-key",
          useSavedApiKey: false,
          model: "   ",
        },
        false,
      ),
    (error: unknown) =>
      error instanceof AppHttpError && error.code === "invalid_search_engine_request_test",
  );
});
