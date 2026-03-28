import path from "node:path";

export interface BootstrapConfig {
  port: number;
  host: string;
  databasePath: string;
  encryptionKey: string;
  adminAuthKey: string;
  sessionSecret: string;
  mcpBearerToken: string;
  trustProxy: boolean;
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

function readSecret(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return fallback;
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
  return {
    port: readPort(),
    host: readString("APP_HOST", "0.0.0.0"),
    databasePath: readString("DATABASE_PATH", DEFAULT_DATABASE_PATH),
    encryptionKey: readSecret("APP_ENCRYPTION_KEY", "dev-encryption-secret"),
    adminAuthKey: readSecret("ADMIN_AUTH_KEY", "bitsearch-admin-dev-key"),
    sessionSecret: readSecret("SESSION_SECRET", "bitsearch-session-dev-secret"),
    mcpBearerToken: readSecret("MCP_BEARER_TOKEN", "bitsearch-dev-token"),
    trustProxy: readTrustProxy(),
  };
}
