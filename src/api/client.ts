import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; apiKey?: string };

const getBaseUrl = (): string => {
  const url = extra.apiUrl ?? (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_API_URL : undefined);
  if (!url) throw new Error("EXPO_PUBLIC_API_URL is not set. Add it to .env and restart the app.");
  return url.replace(/\/$/, "");
};

const getApiKey = (): string => {
  const key = extra.apiKey ?? (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_API_KEY : undefined);
  if (!key) throw new Error("EXPO_PUBLIC_API_KEY is not set. Add it to .env and restart the app.");
  return key;
};

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const base = getBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": getApiKey(),
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data as T;
}
