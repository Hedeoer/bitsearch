import { runLocalBin } from "./lib/local-bin.js";
import { startMcpToolingHarness } from "./lib/mcp-tooling-harness.js";

async function main(): Promise<void> {
  const harness = await startMcpToolingHarness();
  try {
    console.log(`Inspector target: ${harness.protectedMcpUrl}`);

    const inspector = runLocalBin(
      "mcp-inspector",
      [
        "--server-url",
        harness.protectedMcpUrl,
        "--transport",
        "http",
        "--header",
        `Authorization: Bearer ${harness.bearerToken}`,
      ],
      { stdio: "inherit" },
    );

    process.exitCode = await new Promise<number>((resolve, reject) => {
      inspector.once("error", reject);
      inspector.once("exit", (code, signal) => {
        if (signal) {
          resolve(1);
          return;
        }
        resolve(code ?? 1);
      });
    });
  } finally {
    await harness.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
