export class AppHttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string) {
    super(code);
    this.name = "AppHttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class HttpRequestError extends Error {
  statusCode: number | null;

  constructor(message: string, statusCode: number | null = null) {
    super(message);
    this.name = "HttpRequestError";
    this.statusCode = statusCode;
  }
}

export interface JsonRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
  timeoutMs?: number;
}

function buildHeaders(headers?: Record<string, string>): Headers {
  const result = new Headers(headers);
  if (!result.has("content-type")) {
    result.set("content-type", "application/json");
  }
  return result;
}

function extractCompletionText(payload: unknown): string {
  const parsed = payload as {
    choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
  };
  const choice = parsed.choices?.[0];
  return choice?.delta?.content ?? choice?.message?.content ?? "";
}

async function readJsonCompletion(response: Response): Promise<string> {
  const payload = await response.json();
  const content = extractCompletionText(payload);
  return content || JSON.stringify(payload);
}

async function readEventStream(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }
      try {
        content += extractCompletionText(JSON.parse(payload));
      } catch {
        continue;
      }
    }
  }

  return content || buffer.trim();
}

export async function requestJson<T>(
  url: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "POST",
    headers: buildHeaders(options.headers),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
  });

  if (!response.ok) {
    throw new HttpRequestError(await response.text(), response.status);
  }

  return (await response.json()) as T;
}

export async function requestTextStream(
  url: string,
  options: JsonRequestOptions = {},
): Promise<string> {
  const response = await fetch(url, {
    method: options.method ?? "POST",
    headers: buildHeaders(options.headers),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 120000),
  });

  if (!response.ok) {
    throw new HttpRequestError(await response.text(), response.status);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return readJsonCompletion(response);
  }
  return readEventStream(response);
}
