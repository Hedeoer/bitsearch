import type { SearchUpstreamMode } from "../../shared/tool-surface.js";
import type { AppContext } from "../app-context.js";
import { HttpRequestError } from "../lib/http.js";
import { splitAnswerAndSources } from "../lib/source-utils.js";
import {
  getCandidateKeys,
  getProviderConfig,
  markKeyUsage,
} from "../repos/provider-repo.js";
import {
  buildSearchMessages,
  listSearchEngineModels,
  searchWithSearchEngine,
} from "../providers/search-engine-client.js";
import { tavilyUpstreamSearch } from "../providers/tavily-client.js";
import { requireSearchEngineConfig } from "./search-engine-service.js";

// Locked Tavily upstream decisions (research report, 2026-10):
// - search_depth "advanced" (2 credits/request)
// - include_answer "advanced" (Tavily-side LLM answer; no extra credit cost documented)
// - max_results 5 (official agents recommendation)
// - chunks_per_source 3 (official default/recommendation)
// - auto_parameters / exact_match / safe_search / raw_content / language / country off
// - dedicated 60s timeout for the search call (official SDK default)
const TAVILY_UPSTREAM_SEARCH_DEPTH = "advanced" as const;
const TAVILY_UPSTREAM_INCLUDE_ANSWER = "advanced" as const;
const TAVILY_UPSTREAM_MAX_RESULTS = 5;
const TAVILY_UPSTREAM_CHUNKS_PER_SOURCE = 3;
const TAVILY_UPSTREAM_TIMEOUT_MS = 60_000;

// Parameter-level errors mean the same request would fail with every key: abort.
const TAVILY_ABORT_STATUS_CODES = new Set([400, 422]);

export type SearchUpstream = "llm" | "tavily";

export interface UpstreamSearchOutcome {
  upstream: SearchUpstream;
  answer: string;
  sources: Array<Record<string, unknown>>;
  messages: Array<{ role: string; content: string }> | null;
  invalidModel: string | null;
  searchEngineApiFormat: string | null;
  keyFingerprint: string | null;
  tavilyRequestId: string | null;
  usageCredits: number | null;
  usedLocalAssembly: boolean;
  takeover: boolean;
  primaryUpstreamError: string | null;
}

export class UpstreamSearchError extends Error {
  readonly attempts: Array<{ upstream: SearchUpstream; error: string }>;

  constructor(attempts: Array<{ upstream: SearchUpstream; error: string }>) {
    super(
      `Upstream search failed: ${attempts
        .map((attempt) => `${attempt.upstream}: ${attempt.error}`)
        .join("; ")}`,
    );
    this.name = "UpstreamSearchError";
    this.attempts = attempts;
  }
}

interface UpstreamAttemptOutcome {
  answer: string;
  sources: Array<Record<string, unknown>>;
  messages: Array<{ role: string; content: string }> | null;
  invalidModel: string | null;
  searchEngineApiFormat: string | null;
  keyFingerprint: string | null;
  tavilyRequestId: string | null;
  usageCredits: number | null;
  usedLocalAssembly: boolean;
}

export function resolveUpstreamOrder(mode: SearchUpstreamMode): SearchUpstream[] {
  switch (mode) {
    case "llm_only":
      return ["llm"];
    case "tavily_only":
      return ["tavily"];
    case "llm_first":
      return ["llm", "tavily"];
    case "tavily_first":
      return ["tavily", "llm"];
  }
}

export function primaryUpstreamOf(mode: SearchUpstreamMode): SearchUpstream {
  return resolveUpstreamOrder(mode)[0];
}

export async function runUpstreamSearch(
  context: AppContext,
  input: {
    query: string;
    platform: string;
    model: string;
    sessionId: string;
    mode: SearchUpstreamMode;
  },
): Promise<UpstreamSearchOutcome> {
  const order = resolveUpstreamOrder(input.mode);
  const attempts: Array<{ upstream: SearchUpstream; error: string }> = [];
  let primaryUpstreamError: string | null = null;

  for (const [index, upstream] of order.entries()) {
    try {
      const attempt =
        upstream === "llm"
          ? await runLlmUpstream(context, input)
          : await runTavilyUpstream(context, input);

      if (attempt.invalidModel) {
        // Caller error: surface the invalid model without silently
        // switching upstreams.
        return {
          upstream,
          answer: "",
          sources: [],
          messages: null,
          invalidModel: attempt.invalidModel,
          searchEngineApiFormat: attempt.searchEngineApiFormat,
          keyFingerprint: null,
          tavilyRequestId: null,
          usageCredits: null,
          usedLocalAssembly: false,
          takeover: false,
          primaryUpstreamError,
        };
      }

      return {
        upstream,
        ...attempt,
        takeover: index > 0,
        primaryUpstreamError,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown upstream error";
      attempts.push({ upstream, error: message });
      if (index === 0) {
        primaryUpstreamError = message;
      }
    }
  }

  throw new UpstreamSearchError(attempts);
}

async function runLlmUpstream(
  context: AppContext,
  input: { query: string; platform: string; model: string },
): Promise<UpstreamAttemptOutcome> {
  const searchEngineConfig = requireSearchEngineConfig(context, {
    model: input.model,
  });

  if (input.model) {
    const models = await listSearchEngineModels(searchEngineConfig);
    if (models.length > 0 && !models.includes(input.model)) {
      return {
        answer: "",
        sources: [],
        messages: null,
        invalidModel: input.model,
        searchEngineApiFormat: searchEngineConfig.apiFormat,
        keyFingerprint: null,
        tavilyRequestId: null,
        usageCredits: null,
        usedLocalAssembly: false,
      };
    }
  }

  const messages = buildSearchMessages(input.query, input.platform);
  const answerText = await searchWithSearchEngine(searchEngineConfig, messages);
  if (!answerText.trim()) {
    throw new Error("search_engine returned an empty answer");
  }

  const { answer, sources } = splitAnswerAndSources(answerText);
  return {
    answer,
    sources,
    messages,
    invalidModel: null,
    searchEngineApiFormat: searchEngineConfig.apiFormat,
    keyFingerprint: null,
    tavilyRequestId: null,
    usageCredits: null,
    usedLocalAssembly: false,
  };
}

async function runTavilyUpstream(
  context: AppContext,
  input: { query: string; sessionId: string },
): Promise<UpstreamAttemptOutcome> {
  const providerConfig = getProviderConfig(context.db, "tavily");
  if (!providerConfig?.enabled) {
    throw new Error("tavily provider is not enabled");
  }
  const keys = getCandidateKeys(
    context.db,
    "tavily",
    context.bootstrap.encryptionKey,
  );
  if (keys.length === 0) {
    throw new Error("no usable tavily key is available");
  }

  let lastError = "unknown tavily search error";
  for (const key of keys) {
    try {
      const result = await tavilyUpstreamSearch(
        {
          apiKey: key.secret,
          baseUrl: providerConfig.baseUrl,
          timeoutMs: providerConfig.timeoutMs,
        },
        {
          query: input.query,
          maxResults: TAVILY_UPSTREAM_MAX_RESULTS,
          searchDepth: TAVILY_UPSTREAM_SEARCH_DEPTH,
          includeAnswer: TAVILY_UPSTREAM_INCLUDE_ANSWER,
          chunksPerSource: TAVILY_UPSTREAM_CHUNKS_PER_SOURCE,
          includeUsage: true,
          sessionId: input.sessionId,
          timeoutMs: TAVILY_UPSTREAM_TIMEOUT_MS,
        },
      );

      const remoteAnswer = result.answer?.trim() ?? "";
      const usedLocalAssembly = remoteAnswer.length === 0;
      const answer = usedLocalAssembly
        ? assembleTavilyAnswer(input.query, result.results)
        : remoteAnswer;
      if (!answer.trim()) {
        throw new Error("tavily returned neither an answer nor results");
      }

      markKeyUsage(context.db, key.id, 200, null);
      return {
        answer,
        sources: result.results.map((item) => ({
          title: item.title,
          url: item.url,
          content: item.content,
          score: item.score,
          provider: "tavily",
        })),
        messages: null,
        invalidModel: null,
        searchEngineApiFormat: null,
        keyFingerprint: key.fingerprint,
        tavilyRequestId: result.requestId,
        usageCredits: result.usageCredits,
        usedLocalAssembly,
      };
    } catch (error) {
      if (
        error instanceof HttpRequestError &&
        error.statusCode !== null &&
        TAVILY_ABORT_STATUS_CODES.has(error.statusCode)
      ) {
        markKeyUsage(context.db, key.id, error.statusCode, error.message);
        throw error;
      }
      markKeyUsage(
        context.db,
        key.id,
        error instanceof HttpRequestError ? error.statusCode : null,
        error instanceof Error ? error.message : "Unknown tavily search error",
      );
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`all tavily keys failed: ${lastError}`);
}

function assembleTavilyAnswer(
  query: string,
  results: Array<{ title: string; url: string; content: string }>,
): string {
  const lines = [
    `No summarized answer was available for "${query}". Top search results:`,
  ];
  results.forEach((result, index) => {
    const title = result.title?.trim() || result.url;
    lines.push(`${index + 1}. [${title}](${result.url})`);
    const content = result.content?.trim();
    if (content) {
      lines.push(`   ${content}`);
    }
  });
  return lines.join("\n");
}
