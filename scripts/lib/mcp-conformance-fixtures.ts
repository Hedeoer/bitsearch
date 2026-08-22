import { z } from "zod";
import type { AppContext } from "../../src/server/app-context.js";
import {
  createMcpRuntime,
  type McpRuntime,
} from "../../src/server/mcp/register-tools.js";

const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

export function createMcpToolingRuntime(context: AppContext): McpRuntime {
  const runtime = createMcpRuntime(context);

  runtime.server.registerTool(
    "test_simple_text",
    {
      description: "Conformance fixture that returns one text content block.",
      inputSchema: z.object({}),
    },
    async () => ({
      content: [
        {
          type: "text" as const,
          text: "This is a simple text response for testing.",
        },
      ],
    }),
  );

  runtime.server.registerResource(
    "conformance-static-text",
    "test://static-text",
    {
      description: "Static text resource used by the official MCP Conformance suite.",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: "This is the content of the static text resource.",
        },
      ],
    }),
  );

  runtime.server.registerResource(
    "conformance-static-binary",
    "test://static-binary",
    {
      description: "Static binary resource used by the official MCP Conformance suite.",
      mimeType: "image/png",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "image/png",
          blob: TEST_IMAGE_BASE64,
        },
      ],
    }),
  );

  runtime.server.registerPrompt(
    "test_simple_prompt",
    {
      description: "Conformance fixture prompt without arguments.",
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "This is a simple prompt for testing.",
          },
        },
      ],
    }),
  );

  runtime.server.registerPrompt(
    "test_prompt_with_arguments",
    {
      description: "Conformance fixture prompt with two required arguments.",
      argsSchema: {
        arg1: z.string(),
        arg2: z.string(),
      },
    },
    async ({ arg1, arg2 }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Prompt with arguments: arg1='${arg1}', arg2='${arg2}'`,
          },
        },
      ],
    }),
  );

  return runtime;
}
