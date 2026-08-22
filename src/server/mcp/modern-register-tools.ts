import {
  type CallToolResult,
  McpServer,
  ResourceTemplate,
  type RegisteredTool,
} from "@modelcontextprotocol/server";
import type { ToolSurfaceSnapshot } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import { readArtifactResource } from "./result-artifacts.js";
import { MCP_INSTRUCTIONS } from "./instructions.js";
import { createMcpRuntime, type McpRuntime } from "./register-tools.js";

export interface ModernMcpRuntime {
  server: McpServer;
  syncToolSurface(nextToolSurface: ToolSurfaceSnapshot): void;
}

export function createModernMcpRuntime(
  context: AppContext,
  legacyRuntimeFactory: (context: AppContext) => McpRuntime = createMcpRuntime,
): ModernMcpRuntime {
  const legacyRuntime = legacyRuntimeFactory(context);
  const server = new McpServer(
    {
      name: "bitsearch",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
        resources: {},
        prompts: {},
      },
      instructions: MCP_INSTRUCTIONS,
      cacheHints: {
        "tools/list": {
          ttlMs: 10_000,
          cacheScope: "private",
        },
        "resources/read": {
          ttlMs: 0,
          cacheScope: "private",
        },
      },
    },
  );
  const conditionalTools = new Map<string, RegisteredTool>();

  server.registerResource(
    "tool-result-artifact",
    new ResourceTemplate("bitsearch://results/{id}", { list: undefined }),
    {
      title: "Tool Result Artifact",
      description: "Read a stored BitSearch MCP tool result by URI.",
      mimeType: "application/json",
      cacheHint: {
        ttlMs: 0,
        cacheScope: "private",
      },
    },
    (uri) => readArtifactResource(context, uri),
  );

  registerModernTools(server, conditionalTools, legacyRuntime);

  return {
    server,
    syncToolSurface(nextToolSurface: ToolSurfaceSnapshot) {
      syncConditionalTools(conditionalTools, nextToolSurface);
    },
  };
}

function syncConditionalTools(
  conditionalTools: Map<string, RegisteredTool>,
  nextToolSurface: ToolSurfaceSnapshot,
): void {
  const exposedTools = new Set(nextToolSurface.exposedTools);
  for (const [toolName, tool] of conditionalTools.entries()) {
    if (exposedTools.has(toolName)) {
      tool.enable();
    } else {
      tool.disable();
    }
  }
}

function registerModernTools(
  server: McpServer,
  conditionalTools: Map<string, RegisteredTool>,
  legacyRuntime: McpRuntime,
): void {
  for (const [toolName, legacyTool] of legacyRuntime.registeredTools.entries()) {
    const modernTool = server.registerTool(
      toolName,
      {
        title: legacyTool.title,
        description: legacyTool.description,
        inputSchema: legacyTool.inputSchema as never,
      },
      ((args: unknown) =>
        (
          legacyTool as unknown as {
            handler: (args: unknown, context: never) => Promise<CallToolResult>;
          }
        ).handler(args, {} as never)) as never,
    );
    conditionalTools.set(toolName, modernTool);
  }

}
