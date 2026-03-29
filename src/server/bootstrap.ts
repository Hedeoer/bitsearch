import path from "node:path";
import type { RuntimeSecretsState } from "./lib/runtime-secrets.js";
import { resolveRuntimeSecrets } from "./lib/runtime-secrets.js";

export interface BootstrapConfig {
  port: number;
  host: string;
  databasePath: string;
  encryptionKey: string;
  adminAuthKey: string;
  sessionSecret: string;
  mcpBearerToken: string;
  trustProxy: boolean;
  runtimeSecrets: RuntimeSecretsState;
}

const DEFAULT_DATABASE_PATH = path.resolve(process.cwd(), "data/bitsearch.db");

function readString(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function readPort(): number {
  const raw = process.env.APP_PORT?.trim();
  const parsed = raw ? Number(raw) : 8097;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid APP_PORT: ${raw}`);
  }
  return parsed;
}

function readTrustProxy(): boolean {
  const value = process.env.TRUST_PROXY?.trim().toLowerCase();
  if (!value || value === "0" || value === "false") {
    return false;
  }
  if (value === "1" || value === "true") {
    return true;
  }
  throw new Error(`Invalid TRUST_PROXY: ${process.env.TRUST_PROXY}`);
}

export function readBootstrapConfig(): BootstrapConfig {
  const databasePath = readString("DATABASE_PATH", DEFAULT_DATABASE_PATH);
  const runtimeSecrets = resolveRuntimeSecrets(databasePath);
  return {
    port: readPort(),
    host: readString("APP_HOST", "0.0.0.0"),
    databasePath,
    encryptionKey: runtimeSecrets.values.encryptionKey,
    adminAuthKey: runtimeSecrets.values.adminAuthKey,
    sessionSecret: runtimeSecrets.values.sessionSecret,
    mcpBearerToken: runtimeSecrets.values.mcpBearerToken,
    trustProxy: readTrustProxy(),
    runtimeSecrets,
  };
}
