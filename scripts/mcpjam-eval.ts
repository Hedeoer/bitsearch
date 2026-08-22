import {
  EvalSuite,
  EvalTest,
  HostRunner,
  MCPClientManager,
} from "@mcpjam/sdk";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const serverUrl = requireEnv("MCP_SERVER_URL");
  const bearerToken = requireEnv("MCP_BEARER_TOKEN");
  const model = requireEnv("MCPJAM_MODEL");
  const apiKey = requireEnv("MCPJAM_LLM_API_KEY");
  const iterations = Number(process.env.MCPJAM_ITERATIONS ?? "10");
  const minimumAccuracy = Number(process.env.MCPJAM_MIN_ACCURACY ?? "0.9");

  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error("MCPJAM_ITERATIONS must be a positive integer");
  }
  if (!Number.isFinite(minimumAccuracy) || minimumAccuracy < 0 || minimumAccuracy > 1) {
    throw new Error("MCPJAM_MIN_ACCURACY must be between 0 and 1");
  }

  const manager = new MCPClientManager({
    bitsearch: {
      url: serverUrl,
      accessToken: bearerToken,
    },
  });

  try {
    await manager.connectToServer("bitsearch");
    const runner = new HostRunner({
      tools: await manager.getTools(["bitsearch"]),
      model,
      apiKey,
      mcpClientManager: manager,
      temperature: 0.1,
      maxSteps: 6,
      systemPrompt:
        "你正在评估 BitSearch MCP Server。根据工具描述选择最精确的工具，并使用合法参数。",
    });
    const suite = new EvalSuite({ name: "BitSearch Tool Selection" });

    suite.add(new EvalTest({
      id: "bitsearch-web-search",
      name: "current-information-uses-web-search",
      test: async (executor) => {
        const result = await executor.run("搜索最近一周 MCP 生态的重要更新，并给出来源。");
        return result.hasToolCall("web_search");
      },
    }));
    suite.add(new EvalTest({
      id: "bitsearch-web-fetch",
      name: "known-url-uses-web-fetch",
      test: async (executor) => {
        const result = await executor.run("读取 https://example.com 页面正文，不要搜索其他网站。");
        return result.hasToolCall("web_fetch");
      },
    }));
    suite.add(new EvalTest({
      id: "bitsearch-web-map",
      name: "site-discovery-uses-web-map",
      test: async (executor) => {
        const result = await executor.run("列出 https://example.com 站点中的页面 URL，不需要抓取正文。");
        return result.hasToolCall("web_map");
      },
    }));
    suite.add(new EvalTest({
      id: "bitsearch-result-pagination",
      name: "large-result-uses-get-result-page",
      test: async (executor) => {
        const result = await executor.run(
          "上一轮结果返回 result_id=missing-eval-fixture 和 next_cursor=100，请继续读取下一页。",
        );
        return result.hasToolCall("get_result_page");
      },
    }));

    const runOptions = {
      iterations,
      concurrency: Math.min(2, iterations),
      timeoutMs: 120_000,
      ...(process.env.MCPJAM_API_KEY
        ? {
            mcpjam: {
              suiteName: "BitSearch Tool Selection",
              passCriteria: {
                minimumPassRate: Math.round(minimumAccuracy * 100),
              },
              strict: true,
              failOnToolError: false,
            },
          }
        : {}),
    };
    await suite.run(runner, runOptions);
    const accuracy = suite.accuracy();
    console.log(`MCPJam eval accuracy: ${(accuracy * 100).toFixed(1)}%`);
    if (accuracy < minimumAccuracy) {
      throw new Error(
        `MCPJam eval accuracy ${accuracy.toFixed(3)} is below ${minimumAccuracy.toFixed(3)}`,
      );
    }
  } finally {
    await manager.disconnectServer("bitsearch").catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
