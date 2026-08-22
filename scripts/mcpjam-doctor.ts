import assert from "node:assert/strict";
import { runLocalBinCapture } from "./lib/local-bin.js";
import { startMcpToolingHarness } from "./lib/mcp-tooling-harness.js";

interface DoctorResult {
  status?: string;
}

async function main(): Promise<void> {
  const harness = await startMcpToolingHarness();
  try {
    const result = await runLocalBinCapture(
      "mcpjam",
      [
        "server",
        "doctor",
        "--url",
        harness.protectedMcpUrl,
        "--access-token",
        harness.bearerToken,
        "--quiet",
        "--format",
        "json",
      ],
      {},
    );
    if (result.status !== 0) {
      throw new Error(`MCPJam doctor failed: ${String(result.stderr).trim()}`);
    }
    const report = JSON.parse(String(result.stdout)) as DoctorResult;
    assert.equal(report.status, "ready");
    console.log("PASS MCPJam server doctor");
  } finally {
    await harness.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
