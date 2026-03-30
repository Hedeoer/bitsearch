import type {
  ActivityDetailRecord,
  ActivityDiagnostics,
  RequestActivityRecord,
  RequestAttemptRecord,
} from "../../shared/contracts.js";

export const SLOW_REQUEST_THRESHOLD_MS = 3000;

function getPrimaryErrorType(activity: RequestActivityRecord): string | null {
  for (let index = activity.attempts.length - 1; index >= 0; index -= 1) {
    const errorType = activity.attempts[index]?.errorType;
    if (errorType) {
      return errorType;
    }
  }
  return null;
}

function getFailureStageHint(
  activity: RequestActivityRecord,
  primaryErrorType: string | null,
): string | null {
  if (activity.request.status === "success" && activity.request.attempts > 1) {
    return "Recovered after retry/failover.";
  }
  if (!primaryErrorType) {
    return activity.request.status === "failed" ? "Request failed before a typed upstream error was recorded." : null;
  }
  if (primaryErrorType === "rate_limit") {
    return "Upstream rate limits exhausted the available attempts.";
  }
  if (primaryErrorType === "timeout") {
    return "The request spent most of its time waiting on upstream timeouts.";
  }
  if (primaryErrorType === "upstream_5xx") {
    return "The upstream provider returned a 5xx response.";
  }
  if (primaryErrorType === "http_error") {
    return "The request failed with a non-retryable upstream HTTP response.";
  }
  if (primaryErrorType === "network_error") {
    return "Network or connectivity issues interrupted the request.";
  }
  return "The request failed during provider execution.";
}

function toAttemptSegment(attempt: RequestAttemptRecord): string {
  const status = attempt.status === "success" ? "ok" : "fail";
  return `${attempt.provider}(${status})`;
}

export function buildActivityDiagnostics(
  activity: RequestActivityRecord,
): ActivityDiagnostics {
  const primaryErrorType = getPrimaryErrorType(activity);
  const isSlow = activity.request.durationMs >= SLOW_REQUEST_THRESHOLD_MS;
  const isFallback = activity.request.attempts > 1;
  return {
    primaryErrorType,
    isSlow,
    isFallback,
    retryChainLabel:
      activity.attempts.length > 0
        ? activity.attempts.map(toAttemptSegment).join(" -> ")
        : "No attempts recorded",
    failureStageHint: getFailureStageHint(activity, primaryErrorType),
  };
}

export function toActivityDetailRecord(
  activity: RequestActivityRecord,
): ActivityDetailRecord {
  return {
    request: activity.request,
    attempts: activity.attempts,
    messages: activity.request.messages,
    diagnostics: buildActivityDiagnostics(activity),
  };
}
