import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const FILE_VERSION = 1;
const SECRET_FILE_BASENAME = "runtime-secrets.json";
const SECRET_FILE_MODE = 0o600;
const KEY_BYTES = 32;
const TOKEN_BYTES = 24;

export const RUNTIME_SECRETS_FILE_ENV = "RUNTIME_SECRETS_FILE";

const RUNTIME_SECRET_SPECS = {
  encryptionKey: {
    envName: "APP_ENCRYPTION_KEY",
    generate: () => randomBytes(KEY_BYTES).toString("hex"),
  },
  adminAuthKey: {
    envName: "ADMIN_AUTH_KEY",
    generate: () => `bsa_${randomBytes(TOKEN_BYTES).toString("base64url")}`,
  },
  sessionSecret: {
    envName: "SESSION_SECRET",
    generate: () => randomBytes(KEY_BYTES).toString("hex"),
  },
  mcpBearerToken: {
    envName: "MCP_BEARER_TOKEN",
    generate: () => `bsm_${randomBytes(TOKEN_BYTES).toString("base64url")}`,
  },
} as const;

export type RuntimeSecretName = keyof typeof RUNTIME_SECRET_SPECS;
export type RuntimeSecretSource = "env" | "file" | "generated";

export type RuntimeSecretValues = {
  [K in RuntimeSecretName]: string;
};

export interface RuntimeSecretsState {
  filePath: string;
  dirty: boolean;
  sources: Record<RuntimeSecretName, RuntimeSecretSource>;
  values: RuntimeSecretValues;
}

interface StoredRuntimeSecrets {
  version: number;
  secrets: Partial<Record<RuntimeSecretName, string>>;
}

function createDefaultSecretsFilePath(databasePath: string): string {
  return path.resolve(path.dirname(databasePath), SECRET_FILE_BASENAME);
}

function readFileSecrets(filePath: string): Partial<Record<RuntimeSecretName, string>> {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as StoredRuntimeSecrets;
    if (parsed.version !== FILE_VERSION || !parsed.secrets || typeof parsed.secrets !== "object") {
      throw new Error(`Invalid runtime secrets file format: ${filePath}`);
    }
    return parsed.secrets;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function buildState(
  filePath: string,
  fileSecrets: Partial<Record<RuntimeSecretName, string>>,
): RuntimeSecretsState {
  let dirty = false;
  const values = {} as RuntimeSecretValues;
  const sources = {} as Record<RuntimeSecretName, RuntimeSecretSource>;

  for (const [name, spec] of Object.entries(RUNTIME_SECRET_SPECS) as Array<
    [RuntimeSecretName, (typeof RUNTIME_SECRET_SPECS)[RuntimeSecretName]]
  >) {
    const envValue = process.env[spec.envName]?.trim();
    const fileValue = fileSecrets[name]?.trim();

    if (envValue) {
      values[name] = envValue;
      sources[name] = "env";
      if (fileValue !== envValue) {
        dirty = true;
      }
      continue;
    }

    if (fileValue) {
      values[name] = fileValue;
      sources[name] = "file";
      continue;
    }

    values[name] = spec.generate();
    sources[name] = "generated";
    dirty = true;
  }

  return {
    filePath,
    dirty,
    sources,
    values,
  };
}

export function resolveRuntimeSecrets(databasePath: string): RuntimeSecretsState {
  const filePath = process.env[RUNTIME_SECRETS_FILE_ENV]?.trim() || createDefaultSecretsFilePath(databasePath);
  return buildState(filePath, readFileSecrets(filePath));
}

export function persistRuntimeSecrets(state: RuntimeSecretsState): void {
  if (!state.dirty) {
    return;
  }

  fs.mkdirSync(path.dirname(state.filePath), { recursive: true });
  const tempPath = `${state.filePath}.tmp-${process.pid}`;
  const payload = JSON.stringify(
    {
      version: FILE_VERSION,
      secrets: state.values,
    },
    null,
    2,
  );
  fs.writeFileSync(tempPath, `${payload}\n`, { mode: SECRET_FILE_MODE });
  fs.renameSync(tempPath, state.filePath);
  fs.chmodSync(state.filePath, SECRET_FILE_MODE);
  state.dirty = false;
}

export function setRuntimeSecret(
  state: RuntimeSecretsState,
  name: RuntimeSecretName,
  value: string,
): void {
  state.values[name] = value;
  state.sources[name] = "file";
  state.dirty = true;
}

export function isRuntimeSecretGenerated(
  state: RuntimeSecretsState,
  name: RuntimeSecretName,
): boolean {
  return state.sources[name] === "generated";
}
