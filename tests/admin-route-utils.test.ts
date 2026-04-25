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
      apiFormat: "openai_chat_completions",
      apiKey: "  draft-key  ",
      useSavedApiKey: false,
    },
    true,
  );

  assert.deepEqual(payload, {
    baseUrl: "http://localhost:11434/v1",
    timeoutMs: 45_000,
    apiFormat: "openai_chat_completions",
    apiKey: "draft-key",
    useSavedApiKey: false,
  });
});

test("parseSearchEngineRequestTestPayload accepts saved-key mode", () => {
  const payload = parseSearchEngineRequestTestPayload(
    {
      baseUrl: "https://api.openai.com/v1",
      timeoutMs: 60_000,
      apiFormat: "openai_responses",
      apiKey: "",
      useSavedApiKey: true,
      model: "gpt-4o-mini",
    },
    false,
  );

  assert.equal(payload.baseUrl, "https://api.openai.com/v1");
  assert.equal(payload.timeoutMs, 60_000);
  assert.equal(payload.apiFormat, "openai_responses");
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
          apiFormat: "openai_chat_completions",
          apiKey: "draft-key",
          useSavedApiKey: false,
        },
        false,
      ),
    (error: unknown) =>
      error instanceof AppHttpError && error.code === "invalid_provider_base_url",
  );
});

test("parseSearchEngineProbePayload accepts private-lan http urls in dev mode", () => {
  const payload = parseSearchEngineProbePayload(
    {
      baseUrl: "http://192.168.2.7:8090/v1",
      timeoutMs: 30_000,
      apiFormat: "openai_responses",
      apiKey: "draft-key",
      useSavedApiKey: false,
    },
    true,
  );

  assert.deepEqual(payload, {
    baseUrl: "http://192.168.2.7:8090/v1",
    timeoutMs: 30_000,
    apiFormat: "openai_responses",
    apiKey: "draft-key",
    useSavedApiKey: false,
  });
});

test("parseSearchEngineProbePayload normalizes anthropic base url without forcing /v1", () => {
  const payload = parseSearchEngineProbePayload(
    {
      baseUrl: "https://api.anthropic.com/",
      timeoutMs: 30_000,
      apiFormat: "anthropic_messages",
      apiKey: "draft-key",
      useSavedApiKey: false,
    },
    false,
  );

  assert.deepEqual(payload, {
    baseUrl: "https://api.anthropic.com",
    timeoutMs: 30_000,
    apiFormat: "anthropic_messages",
    apiKey: "draft-key",
    useSavedApiKey: false,
  });
});

test("parseSearchEngineProbePayload preserves google generative language base url", () => {
  const payload = parseSearchEngineProbePayload(
    {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      timeoutMs: 30_000,
      apiFormat: "google_gemini",
      apiKey: "draft-key",
      useSavedApiKey: false,
    },
    false,
  );

  assert.deepEqual(payload, {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    timeoutMs: 30_000,
    apiFormat: "google_gemini",
    apiKey: "draft-key",
    useSavedApiKey: false,
  });
});

test("parseSearchEngineRequestTestPayload requires a non-empty model", () => {
  assert.throws(
    () =>
      parseSearchEngineRequestTestPayload(
        {
          baseUrl: "https://api.openai.com/v1",
          timeoutMs: 30_000,
          apiFormat: "openai_chat_completions",
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

test("parseSearchEngineProbePayload requires a valid apiFormat", () => {
  assert.throws(
    () =>
      parseSearchEngineProbePayload(
        {
          baseUrl: "https://api.openai.com/v1",
          timeoutMs: 30_000,
          apiFormat: "unsupported_format",
          apiKey: "draft-key",
          useSavedApiKey: false,
        },
        false,
      ),
    (error: unknown) =>
      error instanceof AppHttpError && error.code === "invalid_search_engine_probe",
  );
});
