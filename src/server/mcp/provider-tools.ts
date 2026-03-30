import {
  McpServer,
  type RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { KeyPoolProvider, ToolSurfaceSnapshot } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import { HttpRequestError } from "../lib/http.js";
import {
  insertAttemptLogs,
  insertRequestLog,
  mergeRequestLogMetadata,
} from "../repos/log-repo.js";
import {
  getCandidateKeys,
  getProviderConfig,
  getProviderKeyById,
  markKeyUsage,
} from "../repos/provider-repo.js";
import {
  getProviderAsyncJobBinding,
  saveProviderAsyncJobBinding,
  touchProviderAsyncJobBinding,
} from "../repos/provider-async-job-repo.js";
import {
  firecrawlBatchScrape,
  firecrawlBatchScrapeStatus,
  firecrawlCrawl,
  firecrawlCrawlStatus,
  firecrawlExtract,
  firecrawlExtractStatus,
  type FirecrawlBatchScrapeInput,
  type FirecrawlCrawlInput,
  type FirecrawlExtractInput,
} from "../providers/firecrawl-client.js";
import { tavilyCrawl, type TavilyCrawlInput } from "../providers/tavily-client.js";

type ProviderToolConfig = { apiKey: string; baseUrl: string; timeoutMs: number };
type ProviderExecutor<TInput, TResult> = (
  config: ProviderToolConfig,
  input: TInput,
) => Promise<TResult>;

const FIRECRAWL_BINDING_NOT_FOUND = "firecrawl_job_binding_not_found";
const FIRECRAWL_BINDING_MISSING_KEY = "firecrawl_job_binding_missing_key";
const FIRECRAWL_BINDING_TOOL_MISMATCH = "firecrawl_job_binding_tool_mismatch";
const FIRECRAWL_PROVIDER_CONFIG_MISSING = "firecrawl_provider_config_missing";

function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toolJsonResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: toJsonText(value) }],
    structuredContent: value,
  };
}

function createBoundStatusMetadata(
  input: {
    jobId: string;
    expectedToolName: string;
    bindingFound: boolean;
    bindingErrorCode?: string;
    boundKeyFingerprint?: string;
    boundKeyEnabled?: boolean;
  },
): Record<string, unknown> {
  return {
    async: true,
    jobId: input.jobId,
    expectedToolName: input.expectedToolName,
    bindingFound: input.bindingFound,
    bindingErrorCode: input.bindingErrorCode ?? null,
    boundKeyFingerprint: input.boundKeyFingerprint ?? null,
    boundKeyEnabled: input.boundKeyEnabled ?? null,
  };
}

function persistFirecrawlJobBinding(
  context: AppContext,
  input: {
    toolName: string;
    requestLogId: string;
    jobId: string;
    keyId: string;
    keyFingerprint: string;
  },
): void {
  saveProviderAsyncJobBinding(context.db, {
    provider: "firecrawl",
    toolName: input.toolName,
    upstreamJobId: input.jobId,
    providerKeyId: input.keyId,
    providerKeyFingerprint: input.keyFingerprint,
    requestLogId: input.requestLogId,
  });
  mergeRequestLogMetadata(context.db, input.requestLogId, {
    async: true,
    jobId: input.jobId,
    boundKeyId: input.keyId,
    boundKeyFingerprint: input.keyFingerprint,
    bindingPersisted: true,
  });
}

function previewResult(result: unknown): string | null {
  if (typeof result === "string") {
    return result.slice(0, 280);
  }
  try {
    return JSON.stringify(result).slice(0, 280);
  } catch {
    return null;
  }
}

function classifyErrorType(error: unknown): string {
  if (error instanceof HttpRequestError) {
    if (error.statusCode === 429) return "rate_limit";
    if (error.statusCode === 408) return "timeout";
    if (error.statusCode !== null && error.statusCode >= 500) return "upstream_5xx";
    return "http_error";
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "timeout";
  }
  return "network_error";
}

function describeError(
  error: unknown,
): { retryable: boolean; statusCode: number | null; message: string } {
  if (error instanceof HttpRequestError) {
    const retryable =
      error.statusCode === 429 ||
      error.statusCode === 408 ||
      (error.statusCode !== null && error.statusCode >= 500);
    return { retryable, statusCode: error.statusCode, message: error.message };
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return { retryable: true, statusCode: null, message: error.message };
  }
  if (error instanceof Error) {
    return { retryable: true, statusCode: null, message: error.message };
  }
  return { retryable: true, statusCode: null, message: "Unknown provider error" };
}

function logProviderRequest(
  context: AppContext,
  payload: {
    id: string;
    provider: KeyPoolProvider;
    toolName: string;
    targetUrl: string | null;
    finalKeyFingerprint: string | null;
    attempts: number;
    status: "success" | "failed";
    startedAt: number;
    errorSummary?: string | null;
    inputJson: Record<string, unknown>;
    resultPreview?: string | null;
    metadata?: Record<string, unknown>;
  },
): void {
  insertRequestLog(context.db, {
    id: payload.id,
    toolName: payload.toolName,
    targetUrl: payload.targetUrl,
    strategy: null,
    finalProvider: payload.status === "success" ? payload.provider : null,
    finalKeyFingerprint: payload.finalKeyFingerprint,
    attempts: payload.attempts,
    status: payload.status,
    durationMs: Date.now() - payload.startedAt,
    errorSummary: payload.errorSummary ?? null,
    inputJson: payload.inputJson,
    resultPreview: payload.resultPreview ?? null,
    messages: null,
    providerOrder: [payload.provider],
    metadata: payload.metadata ?? {},
  });
}

async function runWithProviderKeys<TInput extends object, TResult>(
  context: AppContext,
  options: {
    provider: KeyPoolProvider;
    toolName: string;
    targetUrl: string | null;
    input: TInput;
    inputJson?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    execute: ProviderExecutor<TInput, TResult>;
  },
): Promise<
  | {
      ok: true;
      data: TResult;
      keyId: string;
      keyFingerprint: string;
      requestLogId: string;
    }
  | { ok: false; error: string }
> {
  const requestId = nanoid();
  const startedAt = Date.now();
  const providerConfig = getProviderConfig(context.db, options.provider);
  const metadata = { provider: options.provider, ...(options.metadata ?? {}) };
  const inputJson = options.inputJson ?? (options.input as Record<string, unknown>);

  if (!providerConfig?.enabled) {
    const error = `Provider ${options.provider} is not enabled`;
    logProviderRequest(context, {
      id: requestId,
      provider: options.provider,
      toolName: options.toolName,
      targetUrl: options.targetUrl,
      finalKeyFingerprint: null,
      attempts: 0,
      status: "failed",
      startedAt,
      errorSummary: error,
      inputJson,
      metadata,
    });
    return { ok: false, error };
  }

  const keys = getCandidateKeys(context.db, options.provider, context.bootstrap.encryptionKey);
  if (keys.length === 0) {
    const error = `No enabled ${options.provider} key is available`;
    logProviderRequest(context, {
      id: requestId,
      provider: options.provider,
      toolName: options.toolName,
      targetUrl: options.targetUrl,
      finalKeyFingerprint: null,
      attempts: 0,
      status: "failed",
      startedAt,
      errorSummary: error,
      inputJson,
      metadata,
    });
    return { ok: false, error };
  }

  const attemptLogs: Array<{
    requestLogId: string;
    provider: KeyPoolProvider;
    keyFingerprint: string | null;
    attemptNo: number;
    status: "success" | "failed";
    statusCode: number | null;
    durationMs: number;
    errorSummary: string | null;
    errorType: string | null;
    providerBaseUrl: string | null;
  }> = [];

  let attemptNo = 0;
  for (const key of keys) {
    attemptNo += 1;
    const attemptStarted = Date.now();
    try {
      const result = await options.execute(
        { apiKey: key.secret, baseUrl: providerConfig.baseUrl, timeoutMs: providerConfig.timeoutMs },
        options.input,
      );
      markKeyUsage(context.db, key.id, 200, null);
      attemptLogs.push({
        requestLogId: requestId,
        provider: options.provider,
        keyFingerprint: key.fingerprint,
        attemptNo,
        status: "success",
        statusCode: 200,
        durationMs: Date.now() - attemptStarted,
        errorSummary: null,
        errorType: null,
        providerBaseUrl: providerConfig.baseUrl,
      });
      logProviderRequest(context, {
        id: requestId,
        provider: options.provider,
        toolName: options.toolName,
        targetUrl: options.targetUrl,
        finalKeyFingerprint: key.fingerprint,
        attempts: attemptNo,
        status: "success",
        startedAt,
        inputJson,
        resultPreview: previewResult(result),
        metadata,
      });
      insertAttemptLogs(context.db, attemptLogs);
      return {
        ok: true,
        data: result,
        keyId: key.id,
        keyFingerprint: key.fingerprint,
        requestLogId: requestId,
      };
    } catch (error) {
      const info = describeError(error);
      markKeyUsage(context.db, key.id, info.statusCode, info.message);
      attemptLogs.push({
        requestLogId: requestId,
        provider: options.provider,
        keyFingerprint: key.fingerprint,
        attemptNo,
        status: "failed",
        statusCode: info.statusCode,
        durationMs: Date.now() - attemptStarted,
        errorSummary: info.message,
        errorType: classifyErrorType(error),
        providerBaseUrl: providerConfig.baseUrl,
      });
      if (!info.retryable) break;
    }
  }

  const error = attemptLogs.at(-1)?.errorSummary ?? "Unknown provider error";
  logProviderRequest(context, {
    id: requestId,
    provider: options.provider,
    toolName: options.toolName,
    targetUrl: options.targetUrl,
    finalKeyFingerprint: null,
    attempts: attemptNo,
    status: "failed",
    startedAt,
    errorSummary: error,
    inputJson,
    metadata,
  });
  insertAttemptLogs(context.db, attemptLogs);
  return { ok: false, error };
}

async function runFirecrawlStatusWithBoundKey<TResult>(
  context: AppContext,
  options: {
    toolName: string;
    expectedSubmitToolName: string;
    jobId: string;
    execute: ProviderExecutor<{ id: string }, TResult>;
  },
): Promise<{ ok: true; data: TResult } | { ok: false; error: string }> {
  const requestId = nanoid();
  const startedAt = Date.now();
  const binding = getProviderAsyncJobBinding(context.db, "firecrawl", options.jobId);

  if (!binding) {
    const error = FIRECRAWL_BINDING_NOT_FOUND;
    logProviderRequest(context, {
      id: requestId,
      provider: "firecrawl",
      toolName: options.toolName,
      targetUrl: null,
      finalKeyFingerprint: null,
      attempts: 0,
      status: "failed",
      startedAt,
      errorSummary: error,
      inputJson: { id: options.jobId },
      metadata: createBoundStatusMetadata({
        jobId: options.jobId,
        expectedToolName: options.expectedSubmitToolName,
        bindingFound: false,
        bindingErrorCode: error,
      }),
    });
    return { ok: false, error };
  }

  touchProviderAsyncJobBinding(context.db, "firecrawl", options.jobId);

  if (binding.toolName !== options.expectedSubmitToolName) {
    const error = FIRECRAWL_BINDING_TOOL_MISMATCH;
    logProviderRequest(context, {
      id: requestId,
      provider: "firecrawl",
      toolName: options.toolName,
      targetUrl: null,
      finalKeyFingerprint: null,
      attempts: 0,
      status: "failed",
      startedAt,
      errorSummary: error,
      inputJson: { id: options.jobId },
      metadata: createBoundStatusMetadata({
        jobId: options.jobId,
        expectedToolName: options.expectedSubmitToolName,
        bindingFound: true,
        bindingErrorCode: error,
        boundKeyFingerprint: binding.providerKeyFingerprint,
      }),
    });
    return { ok: false, error };
  }

  const boundKey = getProviderKeyById(
    context.db,
    binding.providerKeyId,
    context.bootstrap.encryptionKey,
  );
  if (!boundKey) {
    const error = FIRECRAWL_BINDING_MISSING_KEY;
    logProviderRequest(context, {
      id: requestId,
      provider: "firecrawl",
      toolName: options.toolName,
      targetUrl: null,
      finalKeyFingerprint: null,
      attempts: 0,
      status: "failed",
      startedAt,
      errorSummary: error,
      inputJson: { id: options.jobId },
      metadata: createBoundStatusMetadata({
        jobId: options.jobId,
        expectedToolName: options.expectedSubmitToolName,
        bindingFound: true,
        bindingErrorCode: error,
        boundKeyFingerprint: binding.providerKeyFingerprint,
      }),
    });
    return { ok: false, error };
  }

  const providerConfig = getProviderConfig(context.db, "firecrawl");
  if (!providerConfig?.baseUrl) {
    const error = FIRECRAWL_PROVIDER_CONFIG_MISSING;
    logProviderRequest(context, {
      id: requestId,
      provider: "firecrawl",
      toolName: options.toolName,
      targetUrl: null,
      finalKeyFingerprint: null,
      attempts: 0,
      status: "failed",
      startedAt,
      errorSummary: error,
      inputJson: { id: options.jobId },
      metadata: createBoundStatusMetadata({
        jobId: options.jobId,
        expectedToolName: options.expectedSubmitToolName,
        bindingFound: true,
        bindingErrorCode: error,
        boundKeyFingerprint: boundKey.fingerprint,
        boundKeyEnabled: boundKey.enabled,
      }),
    });
    return { ok: false, error };
  }

  const attemptStarted = Date.now();
  try {
    const result = await options.execute(
      {
        apiKey: boundKey.secret,
        baseUrl: providerConfig.baseUrl,
        timeoutMs: providerConfig.timeoutMs,
      },
      { id: options.jobId },
    );
    markKeyUsage(context.db, boundKey.id, 200, null);
    logProviderRequest(context, {
      id: requestId,
      provider: "firecrawl",
      toolName: options.toolName,
      targetUrl: null,
      finalKeyFingerprint: boundKey.fingerprint,
      attempts: 1,
      status: "success",
      startedAt,
      inputJson: { id: options.jobId },
      resultPreview: previewResult(result),
      metadata: createBoundStatusMetadata({
        jobId: options.jobId,
        expectedToolName: options.expectedSubmitToolName,
        bindingFound: true,
        boundKeyFingerprint: boundKey.fingerprint,
        boundKeyEnabled: boundKey.enabled,
      }),
    });
    insertAttemptLogs(context.db, [
      {
        requestLogId: requestId,
        provider: "firecrawl",
        keyFingerprint: boundKey.fingerprint,
        attemptNo: 1,
        status: "success",
        statusCode: 200,
        durationMs: Date.now() - attemptStarted,
        errorSummary: null,
        errorType: null,
        providerBaseUrl: providerConfig.baseUrl,
      },
    ]);
    return { ok: true, data: result };
  } catch (error) {
    const info = describeError(error);
    markKeyUsage(context.db, boundKey.id, info.statusCode, info.message);
    logProviderRequest(context, {
      id: requestId,
      provider: "firecrawl",
      toolName: options.toolName,
      targetUrl: null,
      finalKeyFingerprint: null,
      attempts: 1,
      status: "failed",
      startedAt,
      errorSummary: info.message,
      inputJson: { id: options.jobId },
      metadata: createBoundStatusMetadata({
        jobId: options.jobId,
        expectedToolName: options.expectedSubmitToolName,
        bindingFound: true,
        boundKeyFingerprint: boundKey.fingerprint,
        boundKeyEnabled: boundKey.enabled,
      }),
    });
    insertAttemptLogs(context.db, [
      {
        requestLogId: requestId,
        provider: "firecrawl",
        keyFingerprint: boundKey.fingerprint,
        attemptNo: 1,
        status: "failed",
        statusCode: info.statusCode,
        durationMs: Date.now() - attemptStarted,
        errorSummary: info.message,
        errorType: classifyErrorType(error),
        providerBaseUrl: providerConfig.baseUrl,
      },
    ]);
    return { ok: false, error: info.message };
  }
}

function failureResult(provider: KeyPoolProvider, error: string) {
  return toolJsonResult({ provider, status: "failed", error });
}

function tavilyCrawlResult(data: Awaited<ReturnType<typeof tavilyCrawl>>) {
  return toolJsonResult({
    provider: "tavily",
    base_url: data.baseUrl,
    results: data.results.map((item) => ({
      url: item.url,
      raw_content: item.rawContent,
      favicon: item.favicon,
    })),
    response_time: data.responseTime,
    usage: data.usage,
    request_id: data.requestId,
  });
}

function firecrawlSubmitResult(
  name: "crawl" | "batch_scrape" | "extract",
  data: Awaited<ReturnType<typeof firecrawlCrawl>>,
) {
  return toolJsonResult({
    provider: "firecrawl",
    tool: name,
    status: "submitted",
    success: data.success,
    id: data.id,
    url: data.url,
    invalid_urls: data.invalidUrls,
  });
}

function firecrawlStatusResult(
  tool: "crawl" | "batch_scrape",
  id: string,
  data: Awaited<ReturnType<typeof firecrawlCrawlStatus>>,
) {
  return toolJsonResult({
    provider: "firecrawl",
    tool,
    id,
    status: data.status,
    total: data.total,
    completed: data.completed,
    credits_used: data.creditsUsed,
    expires_at: data.expiresAt,
    next: data.next,
    data: data.data,
  });
}

function firecrawlExtractStatusResult(
  id: string,
  data: Awaited<ReturnType<typeof firecrawlExtractStatus>>,
) {
  return toolJsonResult({
    provider: "firecrawl",
    tool: "extract",
    id,
    success: data.success,
    status: data.status,
    data: data.data,
    expires_at: data.expiresAt,
    tokens_used: data.tokensUsed,
  });
}

export function registerProviderTools(
  server: McpServer,
  context: AppContext,
  toolSurface: ToolSurfaceSnapshot,
): Map<string, RegisteredTool> {
  const objectSchema = z.record(z.unknown());
  const stringArraySchema = z.array(z.string());
  const urlArraySchema = z.array(z.string().url()).min(1);
  const formatSchema = z.array(z.union([z.string(), objectSchema])).optional().default(["markdown"]);
  const exposedTools = new Set(toolSurface.exposedTools);
  const registry = new Map<string, RegisteredTool>();

  {
    const tool = server.registerTool(
      "tavily_crawl",
      {
        description: "Synchronously traverse one site with Tavily and return page content in a single call. Use this for content-rich site crawling, not for generic routed fetches.",
        inputSchema: z.object({
          url: z.string().url(),
          instructions: z.string().optional().default(""),
          chunks_per_source: z.number().int().min(1).max(5).optional(),
          max_depth: z.number().int().min(1).max(5).optional().default(1),
          max_breadth: z.number().int().min(1).max(500).optional().default(20),
          limit: z.number().int().min(1).optional().default(50),
          select_paths: stringArraySchema.optional(),
          select_domains: stringArraySchema.optional(),
          exclude_paths: stringArraySchema.optional(),
          exclude_domains: stringArraySchema.optional(),
          allow_external: z.boolean().optional().default(false),
          include_images: z.boolean().optional().default(false),
          extract_depth: z.enum(["basic", "advanced"]).optional().default("basic"),
          format: z.enum(["markdown", "text"]).optional().default("markdown"),
          include_favicon: z.boolean().optional().default(false),
          timeout: z.number().int().min(10).max(150).optional().default(150),
          include_usage: z.boolean().optional().default(true),
        }),
      },
      async (input) => {
        const mapped: TavilyCrawlInput = {
          url: input.url,
          instructions: input.instructions,
          chunksPerSource: input.chunks_per_source,
          maxDepth: input.max_depth,
          maxBreadth: input.max_breadth,
          limit: input.limit,
          selectPaths: input.select_paths,
          selectDomains: input.select_domains,
          excludePaths: input.exclude_paths,
          excludeDomains: input.exclude_domains,
          allowExternal: input.allow_external,
          includeImages: input.include_images,
          extractDepth: input.extract_depth,
          format: input.format,
          includeFavicon: input.include_favicon,
          timeout: input.timeout,
          includeUsage: input.include_usage,
        };
        const result = await runWithProviderKeys(context, {
          provider: "tavily",
          toolName: "tavily_crawl",
          targetUrl: input.url,
          input: mapped,
          inputJson: input,
          metadata: {
            async: false,
            hasInstructions: Boolean(input.instructions),
            includeUsage: input.include_usage,
            selectPathsCount: input.select_paths?.length ?? 0,
            selectDomainsCount: input.select_domains?.length ?? 0,
          },
          execute: tavilyCrawl,
        });
        return result.ok ? tavilyCrawlResult(result.data) : failureResult("tavily", result.error);
      },
    );
    if (!exposedTools.has("tavily_crawl")) {
      tool.disable();
    }
    registry.set("tavily_crawl", tool);
  }

  {
    const tool = server.registerTool(
      "firecrawl_crawl",
      {
        description: "Submit an asynchronous Firecrawl crawl job for deep site traversal. Call firecrawl_crawl_status until the job reaches a terminal state.",
      inputSchema: z.object({
        url: z.string().url(),
        prompt: z.string().optional().default(""),
        exclude_paths: stringArraySchema.optional(),
        include_paths: stringArraySchema.optional(),
        max_discovery_depth: z.number().int().min(0).optional(),
        sitemap: z.enum(["skip", "include", "only"]).optional().default("include"),
        ignore_query_parameters: z.boolean().optional().default(false),
        regex_on_full_url: z.boolean().optional().default(false),
        limit: z.number().int().min(1).optional().default(10000),
        crawl_entire_domain: z.boolean().optional().default(false),
        allow_external_links: z.boolean().optional().default(false),
        allow_subdomains: z.boolean().optional().default(false),
        delay: z.number().nonnegative().optional(),
        max_concurrency: z.number().int().min(1).optional(),
        webhook: objectSchema.optional(),
        scrape_options: objectSchema.optional(),
        zero_data_retention: z.boolean().optional().default(false),
      }),
      },
      async (input) => {
      const mapped: FirecrawlCrawlInput = {
        url: input.url,
        prompt: input.prompt,
        excludePaths: input.exclude_paths,
        includePaths: input.include_paths,
        maxDiscoveryDepth: input.max_discovery_depth,
        sitemap: input.sitemap,
        ignoreQueryParameters: input.ignore_query_parameters,
        regexOnFullURL: input.regex_on_full_url,
        limit: input.limit,
        crawlEntireDomain: input.crawl_entire_domain,
        allowExternalLinks: input.allow_external_links,
        allowSubdomains: input.allow_subdomains,
        delay: input.delay,
        maxConcurrency: input.max_concurrency,
        webhook: input.webhook,
        scrapeOptions: input.scrape_options,
        zeroDataRetention: input.zero_data_retention,
      };
      const result = await runWithProviderKeys(context, {
        provider: "firecrawl",
        toolName: "firecrawl_crawl",
        targetUrl: input.url,
        input: mapped,
        inputJson: input,
        metadata: {
          async: true,
          hasPrompt: Boolean(input.prompt),
          includePathsCount: input.include_paths?.length ?? 0,
          excludePathsCount: input.exclude_paths?.length ?? 0,
        },
        execute: firecrawlCrawl,
      });
      if (!result.ok) {
        return failureResult("firecrawl", result.error);
      }
      persistFirecrawlJobBinding(context, {
        toolName: "firecrawl_crawl",
        requestLogId: result.requestLogId,
        jobId: result.data.id,
        keyId: result.keyId,
        keyFingerprint: result.keyFingerprint,
      });
      return firecrawlSubmitResult("crawl", result.data);
      },
    );
    if (!exposedTools.has("firecrawl_crawl")) {
      tool.disable();
    }
    registry.set("firecrawl_crawl", tool);
  }

  {
    const tool = server.registerTool(
      "firecrawl_crawl_status",
      {
        description: "Poll the state of a previously submitted Firecrawl crawl job.",
        inputSchema: z.object({ id: z.string() }),
      },
      async ({ id }) => {
        const result = await runFirecrawlStatusWithBoundKey(context, {
          toolName: "firecrawl_crawl_status",
          expectedSubmitToolName: "firecrawl_crawl",
          jobId: id,
          execute: (config, value) => firecrawlCrawlStatus(config, value.id),
        });
        return result.ok
          ? firecrawlStatusResult("crawl", id, result.data)
          : failureResult("firecrawl", result.error);
      },
    );
    if (!exposedTools.has("firecrawl_crawl_status")) {
      tool.disable();
    }
    registry.set("firecrawl_crawl_status", tool);
  }

  {
    const tool = server.registerTool(
      "firecrawl_batch_scrape",
      {
        description: "Submit an asynchronous Firecrawl batch scrape job for multiple known URLs. Call firecrawl_batch_scrape_status for final results.",
      inputSchema: z.object({
        urls: urlArraySchema,
        webhook: objectSchema.optional(),
        max_concurrency: z.number().int().min(1).optional(),
        ignore_invalid_urls: z.boolean().optional().default(true),
        formats: formatSchema,
        only_main_content: z.boolean().optional().default(true),
        include_tags: stringArraySchema.optional(),
        exclude_tags: stringArraySchema.optional(),
        max_age: z.number().int().nonnegative().optional(),
        min_age: z.number().int().nonnegative().optional(),
        headers: z.record(z.string()).optional(),
        wait_for: z.number().int().nonnegative().optional().default(0),
        mobile: z.boolean().optional().default(false),
        skip_tls_verification: z.boolean().optional().default(true),
        timeout: z.number().int().min(1000).max(300000).optional().default(30000),
        parsers: z.array(objectSchema).optional(),
        actions: z.array(objectSchema).optional(),
        location: objectSchema.optional(),
        remove_base64_images: z.boolean().optional().default(true),
        block_ads: z.boolean().optional().default(true),
        proxy: z.enum(["basic", "enhanced", "auto"]).optional().default("auto"),
        store_in_cache: z.boolean().optional().default(true),
        profile: objectSchema.optional(),
        zero_data_retention: z.boolean().optional().default(false),
      }),
      },
      async (input) => {
      const mapped: FirecrawlBatchScrapeInput = {
        urls: input.urls,
        webhook: input.webhook,
        maxConcurrency: input.max_concurrency,
        ignoreInvalidURLs: input.ignore_invalid_urls,
        formats: input.formats,
        onlyMainContent: input.only_main_content,
        includeTags: input.include_tags,
        excludeTags: input.exclude_tags,
        maxAge: input.max_age,
        minAge: input.min_age,
        headers: input.headers,
        waitFor: input.wait_for,
        mobile: input.mobile,
        skipTlsVerification: input.skip_tls_verification,
        timeout: input.timeout,
        parsers: input.parsers,
        actions: input.actions,
        location: input.location,
        removeBase64Images: input.remove_base64_images,
        blockAds: input.block_ads,
        proxy: input.proxy,
        storeInCache: input.store_in_cache,
        profile: input.profile,
        zeroDataRetention: input.zero_data_retention,
      };
      const result = await runWithProviderKeys(context, {
        provider: "firecrawl",
        toolName: "firecrawl_batch_scrape",
        targetUrl: input.urls[0] ?? null,
        input: mapped,
        inputJson: input,
        metadata: {
          async: true,
          urlCount: input.urls.length,
          formatCount: input.formats.length,
          onlyMainContent: input.only_main_content,
        },
        execute: firecrawlBatchScrape,
      });
      if (!result.ok) {
        return failureResult("firecrawl", result.error);
      }
      persistFirecrawlJobBinding(context, {
        toolName: "firecrawl_batch_scrape",
        requestLogId: result.requestLogId,
        jobId: result.data.id,
        keyId: result.keyId,
        keyFingerprint: result.keyFingerprint,
      });
      return firecrawlSubmitResult("batch_scrape", result.data);
      },
    );
    if (!exposedTools.has("firecrawl_batch_scrape")) {
      tool.disable();
    }
    registry.set("firecrawl_batch_scrape", tool);
  }

  {
    const tool = server.registerTool(
      "firecrawl_batch_scrape_status",
      {
        description: "Poll the state of a Firecrawl batch scrape job.",
        inputSchema: z.object({ id: z.string() }),
      },
      async ({ id }) => {
        const result = await runFirecrawlStatusWithBoundKey(context, {
          toolName: "firecrawl_batch_scrape_status",
          expectedSubmitToolName: "firecrawl_batch_scrape",
          jobId: id,
          execute: (config, value) => firecrawlBatchScrapeStatus(config, value.id),
        });
        return result.ok
          ? firecrawlStatusResult("batch_scrape", id, result.data)
          : failureResult("firecrawl", result.error);
      },
    );
    if (!exposedTools.has("firecrawl_batch_scrape_status")) {
      tool.disable();
    }
    registry.set("firecrawl_batch_scrape_status", tool);
  }

  {
    const tool = server.registerTool(
      "firecrawl_extract",
      {
        description: "Submit an asynchronous Firecrawl structured extraction job. Use this when the desired output is typed fields or JSON, then poll firecrawl_extract_status.",
      inputSchema: z.object({
        urls: urlArraySchema,
        prompt: z.string().optional().default(""),
        schema: objectSchema.optional(),
        enable_web_search: z.boolean().optional().default(false),
        ignore_sitemap: z.boolean().optional().default(false),
        include_subdomains: z.boolean().optional().default(true),
        show_sources: z.boolean().optional().default(false),
        scrape_options: objectSchema.optional(),
        ignore_invalid_urls: z.boolean().optional().default(true),
      }),
      },
      async (input) => {
      const mapped: FirecrawlExtractInput = {
        urls: input.urls,
        prompt: input.prompt,
        schema: input.schema,
        enableWebSearch: input.enable_web_search,
        ignoreSitemap: input.ignore_sitemap,
        includeSubdomains: input.include_subdomains,
        showSources: input.show_sources,
        scrapeOptions: input.scrape_options,
        ignoreInvalidURLs: input.ignore_invalid_urls,
      };
      const result = await runWithProviderKeys(context, {
        provider: "firecrawl",
        toolName: "firecrawl_extract",
        targetUrl: input.urls[0] ?? null,
        input: mapped,
        inputJson: input,
        metadata: {
          async: true,
          urlCount: input.urls.length,
          hasPrompt: Boolean(input.prompt),
          hasSchema: Boolean(input.schema),
          showSources: input.show_sources,
        },
        execute: firecrawlExtract,
      });
      if (!result.ok) {
        return failureResult("firecrawl", result.error);
      }
      persistFirecrawlJobBinding(context, {
        toolName: "firecrawl_extract",
        requestLogId: result.requestLogId,
        jobId: result.data.id,
        keyId: result.keyId,
        keyFingerprint: result.keyFingerprint,
      });
      return firecrawlSubmitResult("extract", result.data);
      },
    );
    if (!exposedTools.has("firecrawl_extract")) {
      tool.disable();
    }
    registry.set("firecrawl_extract", tool);
  }

  {
    const tool = server.registerTool(
      "firecrawl_extract_status",
      {
        description: "Poll the state of a previously submitted Firecrawl structured extraction job.",
        inputSchema: z.object({ id: z.string() }),
      },
      async ({ id }) => {
        const result = await runFirecrawlStatusWithBoundKey(context, {
          toolName: "firecrawl_extract_status",
          expectedSubmitToolName: "firecrawl_extract",
          jobId: id,
          execute: (config, value) => firecrawlExtractStatus(config, value.id),
        });
        return result.ok
          ? firecrawlExtractStatusResult(id, result.data)
          : failureResult("firecrawl", result.error);
      },
    );
    if (!exposedTools.has("firecrawl_extract_status")) {
      tool.disable();
    }
    registry.set("firecrawl_extract_status", tool);
  }

  return registry;
}
