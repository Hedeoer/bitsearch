const AUTH_STORAGE_KEY = "authKey";

export function getStoredAuthKey(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY)?.trim() ?? "";
}

export function setStoredAuthKey(value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, value.trim());
}

export function clearStoredAuthKey(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function apiRequest<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const authKey = getStoredAuthKey();
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(authKey ? { authorization: `Bearer ${authKey}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}
