import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { runLocalBinCapture } from "./lib/local-bin.js";
import { startMcpToolingHarness } from "./lib/mcp-tooling-harness.js";

const CONFORMANCE_SCENARIOS = [
  "server-initialize",
  "ping",
  "tools-list",
  "tools-call-simple-text",
  "resources-list",
  "resources-read-text",
  "resources-read-binary",
  "prompts-list",
  "prompts-get-simple",
  "prompts-get-with-args",
] as const;

async function main(): Promise<void> {
  const outputDirectory = resolve(process.cwd(), ".mcp-results", "conformance");
  mkdirSync(outputDirectory, { recursive: true });
  const harness = await startMcpToolingHarness();

  try {
    for (const scenario of CONFORMANCE_SCENARIOS) {
      console.log(`\nRunning MCP Conformance: ${scenario}`);
      const result = await runLocalBinCapture(
        "conformance",
        [
          "server",
          "--url",
          harness.conformanceMcpUrl,
          "--scenario",
          scenario,
          "--spec-version",
          "2025-11-25",
          "--output-dir",
          outputDirectory,
        ],
        {},
      );
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      if (result.status !== 0) {
        throw new Error(`Conformance scenario failed: ${scenario}`);
      }
    }
  } finally {
    await harness.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
