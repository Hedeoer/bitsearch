export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, init);

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      message = json.error ?? json.message ?? text;
    } catch {
      // use raw text
    }
    return { ok: false, status: response.status, message };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return { ok: true, data: (await response.json()) as T };
  }
  return { ok: true, data: (await response.text()) as T };
}
