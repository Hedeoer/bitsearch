import { spawn, type SpawnOptions } from "node:child_process";
import { join } from "node:path";

function resolveLocalBin(name: string): string {
  const executable = process.platform === "win32" ? `${name}.cmd` : name;
  return join(process.cwd(), "node_modules", ".bin", executable);
}

export function runLocalBin(
  name: string,
  args: string[],
  options: SpawnOptions = {},
) {
  return spawn(resolveLocalBin(name), args, {
    ...options,
    shell: false,
  });
}

export interface LocalBinResult {
  status: number;
  stdout: string;
  stderr: string;
}

export async function runLocalBinCapture(
  name: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<LocalBinResult> {
  const child = runLocalBin(name, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve({
        status: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}
