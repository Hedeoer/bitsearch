import { z } from "zod";
import {
  GENERIC_ROUTING_MODES,
  KEY_LIST_STATUSES,
  KEY_POOL_PROVIDERS,
  REMOTE_PROVIDERS,
  type KeyListStatus,
  type KeyPoolProvider,
  type RemoteProvider,
  type SystemSettings,
  type UpdateAdminAccessPayload,
  type UpdateMcpAccessPayload,
} from "../../shared/contracts.js";
import { normalizeGenericProviderOrder } from "../lib/generic-routing.js";
import { AppHttpError } from "../lib/http.js";
import { isLocalHostname, normalizeOrigin } from "./origin-utils.js";

const DEFAULT_LIMIT_MIN = 1;
const MAX_ALLOWED_ORIGINS = 50;
const MAX_ADMIN_AUTH_KEY_LENGTH = 512;
const MAX_BEARER_TOKEN_LENGTH = 512;
const MAX_MODEL_NAME_LENGTH = 120;
const MAX_PROVIDER_TIMEOUT_MS = 120_000;
const MAX_RETENTION_DAYS = 365;
const MIN_PROVIDER_TIMEOUT_MS = 1_000;
const PROVIDER_URL_SCHEMES = new Set(["https:", "http:"]);
const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@]/;

const keyListStatusSchema = z.enum(KEY_LIST_STATUSES);
const keyPoolProviderSchema = z.enum(KEY_POOL_PROVIDERS);
const genericProviderOrderSchema = z
  .array(keyPoolProviderSchema)
  .min(1)
  .max(KEY_POOL_PROVIDERS.length)
  .refine((value) => new Set(value).size === value.length, {
    message: "duplicates_not_allowed",
  });
const remoteProviderSchema = z.enum(REMOTE_PROVIDERS);

const providerConfigSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().trim(),
  timeoutMs: z.coerce.number().int().min(MIN_PROVIDER_TIMEOUT_MS).max(MAX_PROVIDER_TIMEOUT_MS),
  apiKey: z.string().optional(),
});
const searchEngineDraftProbeSchema = z.object({
  baseUrl: z.string().trim().min(1),
  timeoutMs: z.coerce.number().int().min(MIN_PROVIDER_TIMEOUT_MS).max(MAX_PROVIDER_TIMEOUT_MS),
  apiKey: z.string(),
  useSavedApiKey: z.boolean(),
});
const searchEngineRequestTestSchema = searchEngineDraftProbeSchema.extend({
  model: z.string().trim().min(1).max(MAX_MODEL_NAME_LENGTH),
});

const systemSettingsSchema = z
  .object({
    genericRoutingMode: z.enum(GENERIC_ROUTING_MODES),
    genericProviderOrder: genericProviderOrderSchema,
    defaultSearchModel: z.string().trim().min(1).max(MAX_MODEL_NAME_LENGTH),
    logRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    allowedOrigins: z.array(z.string().trim().min(1)).max(MAX_ALLOWED_ORIGINS),
  })
  .superRefine((value, context) => {
    const expectedLength = value.genericRoutingMode === "single_provider" ? 1 : KEY_POOL_PROVIDERS.length;
    if (value.genericProviderOrder.length !== expectedLength) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "invalid_generic_provider_order_length",
        path: ["genericProviderOrder"],
      });
    }
  });
const adminAccessSchema = z.object({
  authKey: z.string().trim().min(1).max(MAX_ADMIN_AUTH_KEY_LENGTH),
});
const mcpAccessSchema = z.object({
  bearerToken: z.string().trim().min(1).max(MAX_BEARER_TOKEN_LENGTH),
});

function fail(code: string): never {
  throw new AppHttpError(400, code);
}

function parseSchema<T>(schema: z.ZodType<T>, value: unknown, code: string): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  return fail(code);
}

function normalizeProviderBaseUrl(value: string, allowHttpLocal: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return fail("invalid_provider_base_url");
  }

  const isLocalHttp = parsed.protocol === "http:" && isLocalHostname(parsed.hostname);
  if (!PROVIDER_URL_SCHEMES.has(parsed.protocol)) {
    return fail("invalid_provider_base_url");
  }
  if (parsed.protocol === "http:" && (!allowHttpLocal || !isLocalHttp)) {
    return fail("invalid_provider_base_url");
  }
  if (parsed.username || parsed.password || !parsed.hostname || parsed.search || parsed.hash) {
    return fail("invalid_provider_base_url");
  }
  return parsed.toString().replace(/\/$/, "");
}

export function csvEscape(value: unknown): string {
  const raw = String(value ?? "");
  const safeValue = SPREADSHEET_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safeValue.replace(/"/g, "\"\"")}"`;
}

export function parseIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return fail("invalid_ids");
  }
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
}

export function parseKeyLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseCsvKeys(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter(Boolean);
}

export function parseKeyPoolProvider(raw: unknown): KeyPoolProvider {
  return parseSchema(keyPoolProviderSchema, raw, "invalid_key_pool_provider");
}

export function parseKeyStatus(raw: unknown): KeyListStatus {
  return parseSchema(keyListStatusSchema, raw ?? "all", "invalid_key_list_status");
}

export function parseLimit(raw: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed < DEFAULT_LIMIT_MIN) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export function parsePage(raw: unknown): number {
  const parsed = Number.parseInt(String(raw ?? "0"), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export function parseOptionalKeyPoolProvider(
  raw: unknown,
): KeyPoolProvider | undefined {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return undefined;
  }
  return parseKeyPoolProvider(raw);
}

export function parseProviderConfigPayload(
  raw: unknown,
  allowHttpLocal: boolean,
): {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  apiKey?: string;
} {
  const parsed = parseSchema(providerConfigSchema, raw, "invalid_provider_config");
  const apiKey = parsed.apiKey?.trim();
  if (!parsed.baseUrl) {
    if (parsed.enabled) {
      return fail("invalid_provider_base_url");
    }
    return { ...parsed, baseUrl: "", apiKey };
  }

  return {
    ...parsed,
    baseUrl: normalizeProviderBaseUrl(parsed.baseUrl, allowHttpLocal),
    apiKey,
  };
}

export function parseSearchEngineProbePayload(
  raw: unknown,
  allowHttpLocal: boolean,
): {
  baseUrl: string;
  timeoutMs: number;
  apiKey: string;
  useSavedApiKey: boolean;
} {
  const parsed = parseSchema(
    searchEngineDraftProbeSchema,
    raw,
    "invalid_search_engine_probe",
  );
  return {
    baseUrl: normalizeProviderBaseUrl(parsed.baseUrl, allowHttpLocal),
    timeoutMs: parsed.timeoutMs,
    apiKey: parsed.apiKey.trim(),
    useSavedApiKey: parsed.useSavedApiKey,
  };
}

export function parseSearchEngineRequestTestPayload(
  raw: unknown,
  allowHttpLocal: boolean,
): {
  baseUrl: string;
  timeoutMs: number;
  apiKey: string;
  useSavedApiKey: boolean;
  model: string;
} {
  const parsed = parseSchema(
    searchEngineRequestTestSchema,
    raw,
    "invalid_search_engine_request_test",
  );
  return {
    baseUrl: normalizeProviderBaseUrl(parsed.baseUrl, allowHttpLocal),
    timeoutMs: parsed.timeoutMs,
    apiKey: parsed.apiKey.trim(),
    useSavedApiKey: parsed.useSavedApiKey,
    model: parsed.model,
  };
}

export function parseRemoteProvider(raw: unknown): RemoteProvider {
  return parseSchema(remoteProviderSchema, raw, "invalid_provider");
}

export function parseRequiredId(raw: unknown, code: string): string {
  const value = String(raw ?? "").trim();
  return value ? value : fail(code);
}

export function parseSystemSettingsPayload(
  raw: unknown,
  allowHttpLocal: boolean,
): SystemSettings {
  const parsed = parseSchema(systemSettingsSchema, raw, "invalid_system_settings");

  const allowedOrigins = [...new Set(parsed.allowedOrigins.map((origin) => {
    try {
      return normalizeOrigin(origin, allowHttpLocal);
    } catch {
      return fail("invalid_allowed_origin");
    }
  }))];

  return {
    ...parsed,
    genericProviderOrder: normalizeGenericProviderOrder(
      parsed.genericRoutingMode,
      parsed.genericProviderOrder,
    ),
    allowedOrigins,
  };
}

export function parseMcpAccessPayload(
  raw: unknown,
): UpdateMcpAccessPayload {
  return parseSchema(mcpAccessSchema, raw, "invalid_mcp_access");
}

export function parseAdminAccessPayload(
  raw: unknown,
): UpdateAdminAccessPayload {
  return parseSchema(adminAccessSchema, raw, "invalid_admin_access");
}

export function parseTags(raw: unknown): string[] {
  return String(raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
