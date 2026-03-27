import { nanoid } from "nanoid";
import type { FetchMode, KeyPoolProvider } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import {
  insertAttemptLogs,
  insertRequestLog,
} from "../repos/log-repo.js";
import {
  getCandidateKeys,
  getProviderConfig,
  markKeyUsage,
} from "../repos/provider-repo.js";
import { getSystemSettings } from "../repos/settings-repo.js";
import { HttpRequestError } from "../lib/http.js";

type FetchExecutor<TInput, TResult> = (
  provider: KeyPoolProvider,
  secret: string,
  input: TInput,
  timeoutMs: number,
) => Promise<TResult>;

interface RouterResult<TResult> {
  ok: boolean;
  data?: TResult;
  error?: string;
}

function previewResult(result: unknown): string | null {
  if (typeof result === "string") {
    return result.slice(0, 280);
  }
  try {
    return JSON.stringify(result).slice(0, 280);
  } catch {
    return null;
  }
}

function classifyErrorType(error: unknown): string {
  if (error instanceof HttpRequestError) {
    if (error.statusCode === 429) {
      return "rate_limit";
    }
    if (error.statusCode === 408) {
      return "timeout";
    }
    if (error.statusCode !== null && error.statusCode >= 500) {
      return "upstream_5xx";
    }
    return "http_error";
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "timeout";
  }
  return "network_error";
}

function resolveProviders(mode: FetchMode, priority: KeyPoolProvider[]): KeyPoolProvider[] {
  if (mode === "strict_firecrawl") {
    return ["firecrawl"];
  }
  if (mode === "strict_tavily") {
    return ["tavily"];
  }
  return priority;
}

function isFailoverError(error: unknown): { retryable: boolean; statusCode: number | null; message: string } {
  if (error instanceof HttpRequestError) {
    const retryable =
      error.statusCode === 429 ||
      error.statusCode === 408 ||
      (error.statusCode !== null && error.statusCode >= 500);
    return { retryable, statusCode: error.statusCode, message: error.message };
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return { retryable: true, statusCode: null, message: error.message };
  }
  if (error instanceof Error) {
    return { retryable: true, statusCode: null, message: error.message };
  }
  return { retryable: true, statusCode: null, message: "Unknown provider error" };
}

export async function runWithKeyPool<TInput, TResult>(
  context: AppContext,
  toolName: string,
  targetUrl: string,
  input: TInput,
  executor: FetchExecutor<TInput, TResult>,
): Promise<RouterResult<TResult>> {
  const settings = getSystemSettings(context.db);
  const requestId = nanoid();
  const startedAt = Date.now();
  const providerOrder = resolveProviders(settings.fetchMode, settings.providerPriority);
  const attemptLogs: Array<{
    requestLogId: string;
    provider: KeyPoolProvider;
    keyFingerprint: string | null;
    attemptNo: number;
    status: "success" | "failed";
    statusCode: number | null;
    durationMs: number;
    errorSummary: string | null;
    errorType: string | null;
    providerBaseUrl: string | null;
  }> = [];

  const providers = providerOrder;
  let attemptNo = 0;

  for (const provider of providers) {
    const providerConfig = getProviderConfig(context.db, provider);
    if (!providerConfig?.enabled) {
      continue;
    }

    const keys = getCandidateKeys(context.db, provider, context.bootstrap.encryptionKey);
    for (const key of keys) {
      attemptNo += 1;
      const attemptStarted = Date.now();
      try {
        const result = await executor(provider, key.secret, input, providerConfig.timeoutMs);
        markKeyUsage(context.db, key.id, 200, null);
        attemptLogs.push({
          requestLogId: requestId,
          provider,
          keyFingerprint: key.fingerprint,
          attemptNo,
          status: "success",
          statusCode: 200,
          durationMs: Date.now() - attemptStarted,
          errorSummary: null,
          errorType: null,
          providerBaseUrl: providerConfig.baseUrl,
        });
        insertRequestLog(context.db, {
          id: requestId,
          toolName,
          targetUrl,
          strategy: settings.fetchMode,
          finalProvider: provider,
          finalKeyFingerprint: key.fingerprint,
          attempts: attemptNo,
          status: "success",
          durationMs: Date.now() - startedAt,
          errorSummary: null,
          inputJson: input as Record<string, unknown>,
          resultPreview: previewResult(result),
          providerOrder,
          metadata: {
            fetchMode: settings.fetchMode,
          },
        });
        insertAttemptLogs(context.db, attemptLogs);
        return { ok: true, data: result };
      } catch (error) {
        const info = isFailoverError(error);
        markKeyUsage(context.db, key.id, info.statusCode, info.message);
        attemptLogs.push({
          requestLogId: requestId,
          provider,
          keyFingerprint: key.fingerprint,
          attemptNo,
          status: "failed",
          statusCode: info.statusCode,
          durationMs: Date.now() - attemptStarted,
          errorSummary: info.message,
          errorType: classifyErrorType(error),
          providerBaseUrl: providerConfig.baseUrl,
        });
        if (!info.retryable) {
          break;
        }
      }
    }
  }

  const errorSummary =
    attemptLogs.at(-1)?.errorSummary ??
    "No enabled provider or usable key is available for the current strategy";
  insertRequestLog(context.db, {
    id: requestId,
    toolName,
    targetUrl,
    strategy: settings.fetchMode,
    finalProvider: null,
    finalKeyFingerprint: null,
    attempts: attemptNo,
    status: "failed",
    durationMs: Date.now() - startedAt,
    errorSummary,
    inputJson: input as Record<string, unknown>,
    resultPreview: null,
    providerOrder,
    metadata: {
      fetchMode: settings.fetchMode,
    },
  });
  insertAttemptLogs(context.db, attemptLogs);
  return { ok: false, error: errorSummary };
}
