import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAdminSessionStore } from "../src/server/lib/admin-session.ts";
import { readBootstrapConfig } from "../src/server/bootstrap.ts";
import { createDatabase } from "../src/server/db/database.ts";
import { createMcpServer } from "../src/server/mcp/register-tools.ts";
import { saveArtifact } from "../src/server/mcp/result-artifacts.ts";
import { getProviderConfig, saveProviderConfig } from "../src/server/repos/provider-repo.ts";
import { getSystemSettings, saveSystemSettings } from "../src/server/repos/settings-repo.ts";
import { listAvailableSearchEngineModels } from "../src/server/services/search-engine-service.ts";

type ToolResult = Awaited<ReturnType<Client["callTool"]>>;

interface SmokeStep {
  name: string;
  status: "pass" | "fail" | "skip";
  detail?: string;
}

interface ResultHandle {
  result_id: string;
  result_uri: string;
  next_cursor?: string | null;
}

const SEARCH_ENGINE_BASE_URL = process.env.BITSEARCH_SMOKE_SEARCH_ENGINE_URL
  ?? "http://192.168.2.7:8090/v1";
const SEARCH_ENGINE_MODEL = process.env.BITSEARCH_SMOKE_MODEL?.trim() || "";
const SMOKE_URL = process.env.BITSEARCH_SMOKE_URL ?? "https://example.com";
const TIMEOUT_MS = Number(process.env.BITSEARCH_SMOKE_TIMEOUT_MS ?? "120000");
const POLL_COUNT = Number(process.env.BITSEARCH_SMOKE_POLL_COUNT ?? "6");
const POLL_DELAY_MS = Number(process.env.BITSEARCH_SMOKE_POLL_DELAY_MS ?? "5000");
const MAX_SYNTHETIC_PAGES = Number(process.env.BITSEARCH_SMOKE_MAX_SYNTHETIC_PAGES ?? "1000");

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseToolResult(result: ToolResult): Record<string, unknown> {
  if (result.structuredContent) {
    return result.structuredContent;
  }
  const first = result.content[0];
  if (!first || first.type !== "text") {
    return {};
  }
  try {
    return asRecord(JSON.parse(first.text));
  } catch {
    return {};
  }
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getHandle(payload: Record<string, unknown>): ResultHandle | null {
  const resultId = getString(payload.result_id);
  const resultUri = getString(payload.result_uri);
  if (!resultId || !resultUri) {
    return null;
  }
  return {
    result_id: resultId,
    result_uri: resultUri,
    next_cursor: typeof payload.next_cursor === "string" ? payload.next_cursor : null,
  };
}

function hasUsableId(payload: Record<string, unknown>): string | null {
  return getString(payload.id);
}

function pushStep(
  steps: SmokeStep[],
  name: string,
  status: SmokeStep["status"],
  detail?: string,
): void {
  steps.push({ name, status, detail });
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status.toUpperCase()} ${name}${suffix}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await client.callTool(
    {
      name,
      arguments: args,
    },
    undefined,
    { timeout: TIMEOUT_MS },
  );
  return parseToolResult(result);
}

async function expectHandle(
  steps: SmokeStep[],
  client: Client,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ResultHandle | null> {
  try {
    const payload = await callTool(client, toolName, args);
    const handle = getHandle(payload);
    if (!handle) {
      pushStep(
        steps,
        toolName,
        "fail",
        `missing result handle: ${JSON.stringify(payload).slice(0, 240)}`,
      );
      return null;
    }
    pushStep(
      steps,
      toolName,
      "pass",
      `${handle.result_id} ${handle.next_cursor ? "truncated" : "complete"}`,
    );
    return handle;
  } catch (error) {
    pushStep(steps, toolName, "fail", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function submitFirecrawlJob(
  steps: SmokeStep[],
  client: Client,
  toolName: "firecrawl_crawl" | "firecrawl_batch_scrape" | "firecrawl_extract",
  args: Record<string, unknown>,
  options: { allowZdrUnavailable?: boolean } = {},
): Promise<{ id: string; handle: ResultHandle } | null> {
  try {
    const payload = await callTool(client, toolName, args);
    if (
      options.allowZdrUnavailable &&
      payload.status === "failed" &&
      String(payload.error ?? "").toLowerCase().includes("zero data retention")
    ) {
      pushStep(steps, `${toolName}.zdr`, "skip", "ZDR is not enabled for this Firecrawl team");
      return null;
    }
    const id = hasUsableId(payload);
    if (!id) {
      pushStep(steps, toolName, "fail", `missing id: ${JSON.stringify(payload).slice(0, 240)}`);
      return null;
    }
    const handle = getHandle(payload);
    if (!handle) {
      pushStep(
        steps,
        toolName,
        "fail",
        `missing result handle: ${JSON.stringify(payload).slice(0, 240)}`,
      );
      return null;
    }
    pushStep(steps, toolName, "pass", `${id} ${handle.result_id}`);
    await readManifest(steps, client, handle, toolName);
    return { id, handle };
  } catch (error) {
    pushStep(steps, toolName, "fail", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function pollStatusHandle(
  steps: SmokeStep[],
  client: Client,
  toolName: "firecrawl_crawl_status" | "firecrawl_batch_scrape_status" | "firecrawl_extract_status",
  id: string,
): Promise<ResultHandle | null> {
  let lastPayload: Record<string, unknown> = {};
  for (let attempt = 1; attempt <= POLL_COUNT; attempt += 1) {
    try {
      lastPayload = await callTool(client, toolName, { id });
      const handle = getHandle(lastPayload);
      if (handle) {
        pushStep(steps, toolName, "pass", `${handle.result_id} after ${attempt} poll(s)`);
        return handle;
      }
      const status = getString(lastPayload.status);
      if (status && !["completed", "complete", "finished", "success", "failed", "cancelled"].includes(status)) {
        await sleep(POLL_DELAY_MS);
        continue;
      }
      break;
    } catch (error) {
      pushStep(steps, toolName, "fail", error instanceof Error ? error.message : String(error));
      return null;
    }
  }
  pushStep(
    steps,
    toolName,
    "fail",
    `missing result handle: ${JSON.stringify(lastPayload).slice(0, 240)}`,
  );
  return null;
}

async function pageUntilDone(
  steps: SmokeStep[],
  client: Client,
  handle: ResultHandle,
  label: string,
): Promise<void> {
  let cursor = handle.next_cursor ?? null;
  let pageCount = 0;
  while (cursor) {
    pageCount += 1;
    const page = await callTool(client, "get_result_page", {
      result_id: handle.result_id,
      cursor,
      max_items: 5,
      max_chars: 10_000,
    });
    cursor = typeof page.next_cursor === "string" ? page.next_cursor : null;
    if (pageCount > MAX_SYNTHETIC_PAGES) {
      pushStep(
        steps,
        `${label}.pagination`,
        "fail",
        `cursor did not terminate after ${MAX_SYNTHETIC_PAGES} pages`,
      );
      return;
    }
  }
  pushStep(steps, `${label}.pagination`, "pass", `${pageCount} follow-up page(s)`);
}

async function readManifest(
  steps: SmokeStep[],
  client: Client,
  handle: ResultHandle,
  label: string,
): Promise<void> {
  try {
    const resource = await client.readResource({ uri: handle.result_uri }, { timeout: TIMEOUT_MS });
    const first = resource.contents[0];
    const text = first && "text" in first ? first.text : "";
    const manifest = asRecord(JSON.parse(text));
    if (manifest.result_id !== handle.result_id || !String(manifest.read_with).includes("get_result_page")) {
      pushStep(steps, `${label}.resource`, "fail", "resource did not return a pagination manifest");
      return;
    }
    pushStep(steps, `${label}.resource`, "pass", "bounded manifest");
  } catch (error) {
    pushStep(steps, `${label}.resource`, "fail", error instanceof Error ? error.message : String(error));
  }
}

async function runSyntheticLargeResultChecks(
  steps: SmokeStep[],
  client: Client,
  context: Awaited<ReturnType<typeof createContext>>["context"],
): Promise<void> {
  const textArtifact = saveArtifact(context, {
    toolName: "synthetic_text",
    kind: "text",
    title: "Synthetic long text",
    summary: { synthetic: true },
    content: "synthetic-text-".repeat(30_000),
    totalItems: null,
  });
  const arrayArtifact = saveArtifact(context, {
    toolName: "synthetic_array",
    kind: "items",
    title: "Synthetic array",
    summary: { synthetic: true },
    content: Array.from({ length: 600 }, (_, index) => ({
      index,
      title: `item-${index}`,
      body: `body-${index}-`.repeat(120),
    })),
    totalItems: 600,
  });
  const oversizedItemArtifact = saveArtifact(context, {
    toolName: "synthetic_oversized_item",
    kind: "items",
    title: "Synthetic oversized item",
    summary: { synthetic: true },
    content: [{ url: SMOKE_URL, raw_content: "oversized-item-".repeat(50_000) }],
    totalItems: 1,
  });

  for (const [label, artifact] of [
    ["synthetic.text", textArtifact],
    ["synthetic.array", arrayArtifact],
    ["synthetic.oversized_item", oversizedItemArtifact],
  ] as const) {
    const firstPage = await callTool(client, "get_result_page", {
      result_id: artifact.id,
      max_items: 5,
      max_chars: 10_000,
    });
    const handle = getHandle(firstPage);
    if (!handle) {
      pushStep(steps, label, "fail", "first page did not expose result handle");
      continue;
    }
    pushStep(steps, label, "pass", `${handle.result_id}`);
    await pageUntilDone(steps, client, handle, label);
    await readManifest(steps, client, handle, label);
  }

  const itemPage = await callTool(client, "get_result_page", {
    result_id: oversizedItemArtifact.id,
    item_index: 0,
    max_chars: 10_000,
  });
  pushStep(
    steps,
    "synthetic.oversized_item.item_index",
    itemPage.item_index === 0 && itemPage.next_cursor ? "pass" : "fail",
    itemPage.next_cursor ? "item continuation cursor returned" : "missing continuation cursor",
  );

  for (const [label, cursor] of [
    ["missing", ""],
    ["invalid_cursor", "not-base64"],
    [
      "bad_shape_cursor",
      Buffer.from(JSON.stringify({ kind: "text", offset: -1 }), "utf8").toString("base64url"),
    ],
  ] as const) {
    const payload = await callTool(client, "get_result_page", {
      result_id: label === "missing" ? "does-not-exist" : textArtifact.id,
      cursor,
      max_chars: 10_000,
    });
    pushStep(
      steps,
      `synthetic.${label}`,
      payload.status === "failed" || payload.error === "result_not_found_or_expired" ? "pass" : "fail",
      JSON.stringify(payload).slice(0, 160),
    );
  }
}

async function createContext() {
  const bootstrap = readBootstrapConfig();
  const db = createDatabase(bootstrap);
  const context = {
    bootstrap,
    db,
    adminSessions: createAdminSessionStore(bootstrap.sessionSecret),
  };
  const originalSearchEngineConfig = getProviderConfig(db, "search_engine");
  const originalSettings = getSystemSettings(db);
  saveProviderConfig(db, "search_engine", {
    enabled: true,
    baseUrl: SEARCH_ENGINE_BASE_URL,
    timeoutMs: TIMEOUT_MS,
    apiFormat: "openai_chat_completions",
    encryptionKey: bootstrap.encryptionKey,
  });
  const availableModels = await listAvailableSearchEngineModels(context).catch(() => []);
  const selectedModel = SEARCH_ENGINE_MODEL || availableModels[0] || "grok-4-fast";
  saveSystemSettings(db, {
    defaultSearchModel: selectedModel,
    mcpResultBudget: {
      firstResponseChars: 20_000,
      pageChars: 50_000,
      hardResponseChars: 200_000,
    },
  });
  return {
    context,
    selectedModel,
    availableModels,
    async restore() {
      if (originalSearchEngineConfig) {
        saveProviderConfig(db, "search_engine", {
          enabled: originalSearchEngineConfig.enabled,
          baseUrl: originalSearchEngineConfig.baseUrl,
          timeoutMs: originalSearchEngineConfig.timeoutMs,
          apiFormat: originalSearchEngineConfig.apiFormat ?? "openai_chat_completions",
          encryptionKey: bootstrap.encryptionKey,
        });
      }
      saveSystemSettings(db, {
        defaultSearchModel: originalSettings.defaultSearchModel,
        mcpResultBudget: originalSettings.mcpResultBudget,
      });
    },
  };
}

async function main() {
  const steps: SmokeStep[] = [];
  const { context, selectedModel, availableModels, restore } = await createContext();
  const server = createMcpServer(context);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "bitsearch-large-result-smoke", version: "1.0.0" });

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    pushStep(steps, "listTools", "pass", `${tools.tools.length} tools`);

    const searchEngine = getProviderConfig(context.db, "search_engine");
    const tavily = getProviderConfig(context.db, "tavily");
    const firecrawl = getProviderConfig(context.db, "firecrawl");
    console.log("Provider readiness:", {
      search_engine: {
        enabled: searchEngine?.enabled,
        base_url: searchEngine?.baseUrl,
        api_format: searchEngine?.apiFormat,
        has_api_key: searchEngine?.hasApiKey,
        selected_model: selectedModel,
        models_count: availableModels.length,
      },
      tavily: {
        enabled: tavily?.enabled,
        key_count: tavily?.keyCount,
      },
      firecrawl: {
        enabled: firecrawl?.enabled,
        key_count: firecrawl?.keyCount,
      },
    });

    const webSearch = await expectHandle(steps, client, "web_search", {
      query: "BitSearch MCP large result smoke test",
      model: selectedModel,
      extra_sources: 2,
    });
    if (webSearch) {
      await pageUntilDone(steps, client, webSearch, "web_search");
      await readManifest(steps, client, webSearch, "web_search");
    }

    const searchPayload = webSearch
      ? await callTool(client, "get_result_page", { result_id: webSearch.result_id, max_chars: 10_000 })
      : null;
    const sessionId = getString(searchPayload?.summary && asRecord(searchPayload.summary).session_id);
    if (sessionId) {
      const sources = await expectHandle(steps, client, "get_sources", { session_id: sessionId });
      if (sources) {
        await pageUntilDone(steps, client, sources, "get_sources");
        await readManifest(steps, client, sources, "get_sources");
      }
    } else {
      pushStep(steps, "get_sources", "skip", "web_search did not expose a session_id");
    }

    for (const [toolName, args] of [
      ["web_fetch", { url: SMOKE_URL }],
      ["web_map", { url: SMOKE_URL, limit: 10 }],
      ["tavily_crawl", { url: SMOKE_URL, limit: 3, max_depth: 1, max_breadth: 3 }],
    ] as const) {
      const handle = await expectHandle(steps, client, toolName, args);
      if (handle) {
        await pageUntilDone(steps, client, handle, toolName);
        await readManifest(steps, client, handle, toolName);
      }
    }

    const crawlId = await submitFirecrawlJob(steps, client, "firecrawl_crawl", {
      url: SMOKE_URL,
      limit: 3,
      max_discovery_depth: 1,
      zero_data_retention: false,
    });
    if (crawlId) {
      await pageUntilDone(steps, client, crawlId.handle, "firecrawl_crawl");
      await pollStatusHandle(steps, client, "firecrawl_crawl_status", crawlId.id);
    }

    const zdrCrawlId = await submitFirecrawlJob(steps, client, "firecrawl_crawl", {
      url: SMOKE_URL,
      limit: 1,
      max_discovery_depth: 0,
      zero_data_retention: true,
    }, { allowZdrUnavailable: true });
    if (zdrCrawlId) {
      await pageUntilDone(steps, client, zdrCrawlId.handle, "firecrawl_crawl.zdr");
      await pollStatusHandle(steps, client, "firecrawl_crawl_status", zdrCrawlId.id);
    }

    const batchId = await submitFirecrawlJob(steps, client, "firecrawl_batch_scrape", {
      urls: [SMOKE_URL],
      formats: ["markdown"],
      zero_data_retention: false,
    });
    if (batchId) {
      await pageUntilDone(steps, client, batchId.handle, "firecrawl_batch_scrape");
      await pollStatusHandle(steps, client, "firecrawl_batch_scrape_status", batchId.id);
    }

    const zdrBatchId = await submitFirecrawlJob(steps, client, "firecrawl_batch_scrape", {
      urls: [SMOKE_URL],
      formats: ["markdown"],
      zero_data_retention: true,
    }, { allowZdrUnavailable: true });
    if (zdrBatchId) {
      await pageUntilDone(steps, client, zdrBatchId.handle, "firecrawl_batch_scrape.zdr");
      await pollStatusHandle(steps, client, "firecrawl_batch_scrape_status", zdrBatchId.id);
    }

    const extractId = await submitFirecrawlJob(steps, client, "firecrawl_extract", {
      urls: [SMOKE_URL],
      prompt: "Return the page title and a one sentence summary.",
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
        },
        required: ["title", "summary"],
      },
    });
    if (extractId) {
      await pageUntilDone(steps, client, extractId.handle, "firecrawl_extract");
      await pollStatusHandle(steps, client, "firecrawl_extract_status", extractId.id);
    }

    await runSyntheticLargeResultChecks(steps, client, context);
  } finally {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
    await restore().catch((error: unknown) => {
      console.error("Failed to restore pre-smoke runtime settings", error);
    });
    context.db.sqlite.close();
  }

  const failures = steps.filter((step) => step.status === "fail");
  console.log(JSON.stringify({ steps, failures: failures.length }, null, 2));
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
