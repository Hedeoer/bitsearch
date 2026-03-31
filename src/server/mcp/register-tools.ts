import {
  McpServer,
  type RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  type GenericRoutingSnapshot,
  REMOTE_PROVIDERS,
  SEARCH_ENGINE_PROVIDER,
  type ToolSurfaceSnapshot,
} from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import {
  insertRequestLog,
} from "../repos/log-repo.js";
import {
  getCandidateKeys,
  getProviderConfig,
  markKeyUsage,
} from "../repos/provider-repo.js";
import { getSearchSession, saveSearchSession } from "../repos/search-repo.js";
import {
  getSystemSettings,
  saveSystemSetting,
} from "../repos/settings-repo.js";
import { splitAnswerAndSources, mergeSources } from "../lib/source-utils.js";
import {
  buildSearchMessages,
  listSearchEngineModels,
  searchWithSearchEngine,
} from "../providers/search-engine-client.js";
import {
  tavilyExtract,
  tavilyMap,
  tavilySearch,
} from "../providers/tavily-client.js";
import {
  firecrawlMap,
  firecrawlScrape,
  firecrawlSearch,
} from "../providers/firecrawl-client.js";
import { runWithKeyPool } from "../providers/fetch-router.js";
import { processPlanningPhase } from "../services/planning-engine.js";
import {
  requireSearchEngineConfig,
} from "../services/search-engine-service.js";
import {
  getCurrentGenericRoutingSnapshot,
  getToolSurfaceSnapshot,
  shouldExposeTool,
} from "../services/tool-surface-service.js";
import { registerProviderTools } from "./provider-tools.js";

export interface McpRuntime {
  server: McpServer;
  syncToolSurface(nextToolSurface: ToolSurfaceSnapshot): void;
}

function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toolJsonResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: toJsonText(value) }],
    structuredContent: value,
  };
}

function logSearchRequest(
  context: AppContext,
  routing: GenericRoutingSnapshot,
  payload: {
    toolName: string;
    targetUrl?: string | null;
    status: "success" | "failed";
    startedAt: number;
    errorSummary?: string | null;
    inputJson?: Record<string, unknown>;
    resultPreview?: string | null;
    messages?: Array<{ role: string; content: string }> | null;
    metadata?: Record<string, unknown>;
  },
): void {
  insertRequestLog(context.db, {
    id: nanoid(),
    toolName: payload.toolName,
    targetUrl: payload.targetUrl ?? null,
    strategy: null,
    finalProvider: SEARCH_ENGINE_PROVIDER,
    finalKeyFingerprint: null,
    attempts: 1,
    status: payload.status,
    durationMs: Date.now() - payload.startedAt,
    errorSummary: payload.errorSummary ?? null,
    inputJson: payload.inputJson ?? null,
    resultPreview: payload.resultPreview ?? null,
    messages: payload.messages ?? null,
    providerOrder: routing.effectiveProviderOrder,
    metadata: {
      genericRoutingMode: routing.mode,
      requestedProviderOrder: routing.requestedProviderOrder,
      effectiveProviderOrder: routing.effectiveProviderOrder,
      ...(payload.metadata ?? {}),
    },
  });
}

async function getExtraSources(
  context: AppContext,
  routing: GenericRoutingSnapshot,
  query: string,
  count: number,
) {
  if (count <= 0) {
    return [];
  }
  const providers = routing.effectiveProviderOrder;
  const results: Array<Record<string, unknown>> = [];

  for (const provider of providers) {
    const config = getProviderConfig(context.db, provider);
    if (!config?.enabled) {
      continue;
    }
    const keys = getCandidateKeys(
      context.db,
      provider,
      context.bootstrap.encryptionKey,
    );
    if (keys.length === 0) {
      continue;
    }

    for (const key of keys) {
      try {
        if (provider === "tavily") {
          results.push(
            ...(await tavilySearch(
              { apiKey: key.secret, baseUrl: config.baseUrl, timeoutMs: config.timeoutMs },
              query,
              count,
            )),
          );
        }
        if (provider === "firecrawl") {
          results.push(
            ...(await firecrawlSearch(
              { apiKey: key.secret, baseUrl: config.baseUrl, timeoutMs: config.timeoutMs },
              query,
              count,
            )),
          );
        }
        markKeyUsage(context.db, key.id, 200, null);
        break;
      } catch (error) {
        markKeyUsage(
          context.db,
          key.id,
          null,
          error instanceof Error ? error.message : "Unknown search error",
        );
      }
    }
  }
  return results.slice(0, count);
}

async function buildWebFetchResult(
  context: AppContext,
  url: string,
) {
  const routing = getCurrentGenericRoutingSnapshot(context);
  const result = await runWithKeyPool(
    context,
    routing,
    "web_fetch",
    url,
    { url },
    async (provider, secret, input, timeoutMs) => {
      if (provider === "tavily") {
        const config = getProviderConfig(context.db, "tavily");
        return (
          (await tavilyExtract(
            { apiKey: secret, baseUrl: config?.baseUrl ?? "", timeoutMs },
            input.url,
          )) ?? ""
        );
      }
      const config = getProviderConfig(context.db, "firecrawl");
      return (
        (await firecrawlScrape(
          { apiKey: secret, baseUrl: config?.baseUrl ?? "", timeoutMs },
          input.url,
        )) ?? ""
      );
    },
  );
  return result.ok ? result.data ?? "" : `Extraction failed: ${result.error}`;
}

async function buildWebMapResult(
  context: AppContext,
  input: {
    url: string;
    instructions: string;
    maxDepth: number;
    maxBreadth: number;
    limit: number;
    timeout: number;
  },
) {
  const routing = getCurrentGenericRoutingSnapshot(context);
  const result = await runWithKeyPool(
    context,
    routing,
    "web_map",
    input.url,
    input,
    async (provider, secret, value, timeoutMs) => {
      const config = getProviderConfig(context.db, provider);
      if (provider === "tavily") {
        return tavilyMap(
          { apiKey: secret, baseUrl: config?.baseUrl ?? "", timeoutMs },
          value,
        );
      }
      return firecrawlMap(
        { apiKey: secret, baseUrl: config?.baseUrl ?? "", timeoutMs },
        {
          url: value.url,
          instructions: value.instructions,
          limit: value.limit,
        },
      );
    },
  );
  return result.ok ? result.data ?? "" : `Mapping failed: ${result.error}`;
}

export function createMcpRuntime(context: AppContext): McpRuntime {
  const toolSurface = getToolSurfaceSnapshot(context);
  const server = new McpServer({
    name: "bitsearch",
    version: "0.1.0",
  });
  const conditionalTools = new Map<string, RegisteredTool>();

  server.registerTool(
    "web_search",
    {
      description: "Performs a deep web search based on the given query and returns the search engine answer directly.",
      inputSchema: z.object({
        query: z.string(),
        platform: z.string().optional().default(""),
        model: z.string().optional().default(""),
        extra_sources: z.number().int().min(0).optional().default(0),
      }),
    },
    async ({ query, platform = "", model = "", extra_sources = 0 }) => {
      const startedAt = Date.now();
      const sessionId = Math.random().toString(16).slice(2, 14);
      const routing = getCurrentGenericRoutingSnapshot(context);
      try {
        const searchEngineConfig = requireSearchEngineConfig(context, { model });
        if (model) {
          const models = await listSearchEngineModels(searchEngineConfig);
          if (models.length > 0 && !models.includes(model)) {
            const invalidResult = {
              session_id: sessionId,
              content: `Invalid model: ${model}`,
              sources_count: 0,
            };
            saveSearchSession(context.db, sessionId, invalidResult.content, []);
            logSearchRequest(context, routing, {
              toolName: "web_search",
              status: "failed",
              startedAt,
              errorSummary: invalidResult.content,
              inputJson: { query, platform, model, extra_sources },
            });
            return toolJsonResult(invalidResult);
          }
        }

        const messages = buildSearchMessages(query, platform);
        const [answerText, extraSources] = await Promise.all([
          searchWithSearchEngine(searchEngineConfig, messages),
          getExtraSources(context, routing, query, extra_sources),
        ]);
        const { answer, sources } = splitAnswerAndSources(answerText);
        const mergedSources = mergeSources(sources, extraSources);
        saveSearchSession(context.db, sessionId, answer, mergedSources);
        logSearchRequest(context, routing, {
          toolName: "web_search",
          status: "success",
          startedAt,
          inputJson: { query, platform, model, extra_sources },
          resultPreview: answer.slice(0, 280),
          messages,
          metadata: {
            sourcesCount: mergedSources.length,
            extraSourcesRequested: extra_sources,
          },
        });
        return toolJsonResult({
          session_id: sessionId,
          content: answer,
          sources_count: mergedSources.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        saveSearchSession(context.db, sessionId, message, []);
        logSearchRequest(context, routing, {
          toolName: "web_search",
          status: "failed",
          startedAt,
          errorSummary: message,
          inputJson: { query, platform, model, extra_sources },
          messages: buildSearchMessages(query, platform),
        });
        return toolJsonResult({
          session_id: sessionId,
          content: `Configuration error: ${message}`,
          sources_count: 0,
        });
      }
    },
  );

  server.registerTool(
    "get_sources",
    {
      description: "Retrieve all cached sources for a previous web_search call.",
      inputSchema: z.object({
        session_id: z.string(),
      }),
    },
    async ({ session_id }) => {
      const session = getSearchSession(context.db, session_id);
      if (!session) {
        return toolJsonResult({
          session_id,
          sources: [],
          sources_count: 0,
          error: "session_id_not_found_or_expired",
        });
      }
      return toolJsonResult({
        session_id,
        sources: session.sources,
        sources_count: session.sourcesCount,
      });
    },
  );

  {
    const tool = server.registerTool(
      "web_fetch",
      {
        description: "Fetch one known page and return extracted Markdown content. This tool follows generic routing and is not intended for structured extraction or deep crawling.",
        inputSchema: z.object({
          url: z.string().url(),
        }),
      },
      async ({ url }) => ({
        content: [{ type: "text" as const, text: await buildWebFetchResult(context, url) }],
      }),
    );
    if (!shouldExposeTool(toolSurface, "web_fetch")) {
      tool.disable();
    }
    conditionalTools.set("web_fetch", tool);
  }

  {
    const tool = server.registerTool(
      "web_map",
      {
        description: "Discover URLs on one website and return its structure. This tool follows generic routing and does not return full page content.",
        inputSchema: z.object({
          url: z.string().url(),
          instructions: z.string().optional().default(""),
          max_depth: z.number().int().min(1).max(5).optional().default(1),
          max_breadth: z.number().int().min(1).max(500).optional().default(20),
          limit: z.number().int().min(1).max(500).optional().default(50),
          timeout: z.number().int().min(10).max(150).optional().default(150),
        }),
      },
      async ({
        url,
        instructions = "",
        max_depth = 1,
        max_breadth = 20,
        limit = 50,
        timeout = 150,
      }) => ({
        content: [
          {
            type: "text" as const,
            text: await buildWebMapResult(context, {
              url,
              instructions,
              maxDepth: max_depth,
              maxBreadth: max_breadth,
              limit,
              timeout,
            }),
          },
        ],
      }),
    );
    if (!shouldExposeTool(toolSurface, "web_map")) {
      tool.disable();
    }
    conditionalTools.set("web_map", tool);
  }

  const providerTools = registerProviderTools(server, context, toolSurface);
  for (const [toolName, tool] of providerTools.entries()) {
    conditionalTools.set(toolName, tool);
  }

  server.registerTool(
    "get_config_info",
    {
      description: "Returns current server configuration and tests search engine connectivity.",
      inputSchema: z.object({}),
    },
    async () => {
      const liveToolSurface = getToolSurfaceSnapshot(context);
      const providerConfigs = REMOTE_PROVIDERS.map((provider) =>
        getProviderConfig(context.db, provider),
      );
      const settings = getSystemSettings(context.db);
      let connectionTest: Record<string, unknown> = {
        status: "Not tested",
        message: "Configure search_engine first",
      };

      try {
        const models = await listSearchEngineModels(requireSearchEngineConfig(context));
        connectionTest = {
          status: "Connected",
          message: `Retrieved ${models.length} models successfully`,
          available_models: models,
        };
      } catch (error) {
        connectionTest = {
          status: "Connection failed",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: toJsonText({
              settings,
              generic_routing: liveToolSurface.genericRouting,
              provider_capabilities: liveToolSurface.providerCapabilities,
              tool_surface: {
                generic_tools: liveToolSurface.genericTools,
                provider_tools: liveToolSurface.providerTools,
                exposed_tools: liveToolSurface.exposedTools,
                hidden_tools: liveToolSurface.hiddenTools,
                requires_reconnect: liveToolSurface.requiresReconnect,
                behavior_changes_apply_immediately: liveToolSurface.behaviorChangesApplyImmediately,
                last_refreshed_at: liveToolSurface.lastRefreshedAt,
              },
              tool_surface_notes: liveToolSurface.clientGuidance.systemBehavior,
              providers: providerConfigs,
              key_pool_status: providerConfigs
                .filter((item) => item?.provider !== SEARCH_ENGINE_PROVIDER)
                .map((item) => ({
                  provider: item?.provider,
                  enabled: item?.enabled,
                  key_count: item?.keyCount ?? 0,
                })),
              connection_test: connectionTest,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "switch_model",
    {
      description: "Switches the default search model used for web_search operations.",
      inputSchema: z.object({
        model: z.string(),
      }),
    },
    async ({ model }) => {
      const previous = getSystemSettings(context.db).defaultSearchModel;
      saveSystemSetting(context.db, "default_search_model", model);
      return {
        content: [
          {
            type: "text" as const,
            text: toJsonText({
              status: "Success",
              previous_model: previous,
              current_model: model,
              message: `Model switched from ${previous} to ${model}`,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "toggle_builtin_tools",
    {
      description: "Remote deployment cannot modify local Claude Code settings.",
      inputSchema: z.object({
        action: z.string().optional().default("status"),
      }),
    },
    async ({ action = "status" }) => ({
      content: [
        {
          type: "text" as const,
          text: toJsonText({
            blocked: false,
            action,
            error: "unsupported_in_remote_deployment",
            message: "The remote HTTP MCP service cannot modify the client's local .claude/settings.json",
          }),
        },
      ],
      isError: true,
    }),
  );

  server.registerTool(
    "plan_intent",
    {
      description: "Phase 1 of search planning: Analyze user intent.",
      inputSchema: z.object({
        thought: z.string(),
        core_question: z.string(),
        query_type: z.string(),
        time_sensitivity: z.string(),
        session_id: z.string().optional().default(""),
        confidence: z.number().min(0).max(1).optional().default(1),
        domain: z.string().optional().default(""),
        premise_valid: z.boolean().optional(),
        ambiguities: z.string().optional().default(""),
        unverified_terms: z.string().optional().default(""),
        is_revision: z.boolean().optional().default(false),
      }),
    },
    async ({ thought, session_id, confidence, is_revision, ...rest }) =>
      toolJsonResult(
        processPlanningPhase(context, "intent_analysis", {
          sessionId: session_id,
          thought,
          confidence,
          isRevision: is_revision,
          data: {
            ...rest,
            ambiguities: rest.ambiguities
              ? rest.ambiguities.split(",").map((item) => item.trim()).filter(Boolean)
              : undefined,
            unverified_terms: rest.unverified_terms
              ? rest.unverified_terms.split(",").map((item) => item.trim()).filter(Boolean)
              : undefined,
          },
        }),
      ),
  );

  server.registerTool(
    "plan_complexity",
    {
      description: "Phase 2: Assess search complexity.",
      inputSchema: z.object({
        session_id: z.string(),
        thought: z.string(),
        level: z.number().int().min(1).max(3),
        estimated_sub_queries: z.number().int().min(1),
        estimated_tool_calls: z.number().int().min(1),
        justification: z.string(),
        confidence: z.number().min(0).max(1).optional().default(1),
        is_revision: z.boolean().optional().default(false),
      }),
    },
    async ({ session_id, thought, confidence, is_revision, ...rest }) =>
      toolJsonResult(
        processPlanningPhase(context, "complexity_assessment", {
          sessionId: session_id,
          thought,
          confidence,
          isRevision: is_revision,
          data: rest,
        }),
      ),
  );

  server.registerTool(
    "plan_sub_query",
    {
      description: "Phase 3: Add one sub-query.",
      inputSchema: z.object({
        session_id: z.string(),
        thought: z.string(),
        id: z.string(),
        goal: z.string(),
        expected_output: z.string(),
        boundary: z.string(),
        confidence: z.number().min(0).max(1).optional().default(1),
        depends_on: z.string().optional().default(""),
        tool_hint: z.string().optional().default(""),
        is_revision: z.boolean().optional().default(false),
      }),
    },
    async ({ session_id, thought, confidence, is_revision, depends_on, ...rest }) =>
      toolJsonResult(
        processPlanningPhase(context, "query_decomposition", {
          sessionId: session_id,
          thought,
          confidence,
          isRevision: is_revision,
          data: {
            ...rest,
            depends_on: depends_on
              ? depends_on.split(",").map((item) => item.trim()).filter(Boolean)
              : undefined,
          },
        }),
      ),
  );

  server.registerTool(
    "plan_search_term",
    {
      description: "Phase 4: Add one search term.",
      inputSchema: z.object({
        session_id: z.string(),
        thought: z.string(),
        term: z.string(),
        purpose: z.string(),
        round: z.number().int().min(1),
        confidence: z.number().min(0).max(1).optional().default(1),
        approach: z.string().optional().default(""),
        fallback_plan: z.string().optional().default(""),
        is_revision: z.boolean().optional().default(false),
      }),
    },
    async ({
      session_id,
      thought,
      confidence,
      approach,
      fallback_plan,
      is_revision,
      term,
      purpose,
      round,
    }) =>
      toolJsonResult(
        processPlanningPhase(context, "search_strategy", {
          sessionId: session_id,
          thought,
          confidence,
          isRevision: is_revision,
          data: {
            approach: approach || undefined,
            fallback_plan: fallback_plan || undefined,
            search_terms: [{ term, purpose, round }],
          },
        }),
      ),
  );

  server.registerTool(
    "plan_tool_mapping",
    {
      description: "Phase 5: Map a sub-query to a tool.",
      inputSchema: z.object({
        session_id: z.string(),
        thought: z.string(),
        sub_query_id: z.string(),
        tool: z.string(),
        reason: z.string(),
        confidence: z.number().min(0).max(1).optional().default(1),
        params_json: z.string().optional().default(""),
        is_revision: z.boolean().optional().default(false),
      }),
    },
    async ({
      session_id,
      thought,
      confidence,
      params_json,
      is_revision,
      ...rest
    }) =>
      toolJsonResult(
        processPlanningPhase(context, "tool_selection", {
          sessionId: session_id,
          thought,
          confidence,
          isRevision: is_revision,
          data: {
            ...rest,
            params: params_json ? JSON.parse(params_json) : undefined,
          },
        }),
      ),
  );

  server.registerTool(
    "plan_execution",
    {
      description: "Phase 6: Define execution order.",
      inputSchema: z.object({
        session_id: z.string(),
        thought: z.string(),
        parallel_groups: z.string(),
        sequential: z.string(),
        estimated_rounds: z.number().int().min(1),
        confidence: z.number().min(0).max(1).optional().default(1),
        is_revision: z.boolean().optional().default(false),
      }),
    },
    async ({
      session_id,
      thought,
      confidence,
      parallel_groups,
      sequential,
      estimated_rounds,
      is_revision,
    }) =>
      toolJsonResult(
        processPlanningPhase(context, "execution_order", {
          sessionId: session_id,
          thought,
          confidence,
          isRevision: is_revision,
          data: {
            parallel: parallel_groups
              ? parallel_groups
                  .split(";")
                  .map((group) => group.split(",").map((item) => item.trim()).filter(Boolean))
              : [],
            sequential: sequential
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            estimated_rounds,
          },
        }),
      ),
  );

  return {
    server,
    syncToolSurface(nextToolSurface) {
      const exposedTools = new Set(nextToolSurface.exposedTools);
      for (const [toolName, tool] of conditionalTools.entries()) {
        if (exposedTools.has(toolName)) {
          tool.enable();
        } else {
          tool.disable();
        }
      }
    },
  };
}

export function createMcpServer(context: AppContext): McpServer {
  return createMcpRuntime(context).server;
}

export { isInitializeRequest };
