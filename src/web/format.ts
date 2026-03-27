export function asText(
  source: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "-";
}

export function formatDuration(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return "-";
  }
  return `${Math.round(num)} ms`;
}

export function statusTone(value: string): string {
  if (value === "success" || value === "enabled") {
    return "positive";
  }
  if (value === "failed" || value === "disabled") {
    return "danger";
  }
  return "neutral";
}
