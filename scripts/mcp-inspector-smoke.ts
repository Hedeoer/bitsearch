import assert from "node:assert/strict";
import { runLocalBinCapture } from "./lib/local-bin.js";
import { startMcpToolingHarness } from "./lib/mcp-tooling-harness.js";

interface InspectorEnvelope {
  result?: Record<string, unknown>;
}

async function runInspector(
  mcpUrl: string,
  bearerToken: string,
  methodArgs: string[],
): Promise<InspectorEnvelope> {
  const result = await runLocalBinCapture(
    "mcp-inspector",
    [
      "--cli",
      "--server-url",
      mcpUrl,
      "--transport",
      "http",
      "--header",
      `Authorization: Bearer ${bearerToken}`,
      ...methodArgs,
      "--format",
      "json",
    ],
    {
      env: {
        ...process.env,
        MCP_AUTO_OPEN_ENABLED: "false",
      },
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Inspector failed: ${String(result.stderr || result.stdout).trim()}`,
    );
  }
  return JSON.parse(String(result.stdout)) as InspectorEnvelope;
}

async function main(): Promise<void> {
  const harness = await startMcpToolingHarness();
  try {
    const initialize = await runInspector(
      harness.protectedMcpUrl,
      harness.bearerToken,
      ["--method", "initialize"],
    );
    assert.equal(initialize.result?.protocolVersion, "2025-11-25");
    console.log("PASS Inspector initialize");

    const toolsList = await runInspector(
      harness.protectedMcpUrl,
      harness.bearerToken,
      ["--method", "tools/list"],
    );
    const tools = Array.isArray(toolsList.result?.tools)
      ? toolsList.result.tools as Array<{ name?: string }>
      : [];
    for (const toolName of [
      "web_search",
      "get_result_page",
      "get_config_info",
      "test_simple_text",
    ]) {
      assert.ok(tools.some((tool) => tool.name === toolName), `Missing tool ${toolName}`);
    }
    console.log("PASS Inspector tools/list");

    const toolCall = await runInspector(
      harness.protectedMcpUrl,
      harness.bearerToken,
      [
        "--method",
        "tools/call",
        "--tool-name",
        "test_simple_text",
        "--tool-args-json",
        "{}",
      ],
    );
    assert.match(JSON.stringify(toolCall.result), /simple text response/i);
    console.log("PASS Inspector tools/call");

    const resource = await runInspector(
      harness.protectedMcpUrl,
      harness.bearerToken,
      ["--method", "resources/read", "--uri", "test://static-text"],
    );
    assert.match(JSON.stringify(resource.result), /static text resource/i);
    console.log("PASS Inspector resources/read");

    const prompt = await runInspector(
      harness.protectedMcpUrl,
      harness.bearerToken,
      ["--method", "prompts/get", "--prompt-name", "test_simple_prompt"],
    );
    assert.match(JSON.stringify(prompt.result), /simple prompt/i);
    console.log("PASS Inspector prompts/get");
  } finally {
    await harness.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
