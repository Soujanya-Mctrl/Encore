import { Platform } from "react-native";

const nativeApiBase = (
  process.env.EXPO_PUBLIC_ENCORE_API_URL || process.env.EXPO_PUBLIC_API_URL || ""
).trim().replace(/\/+$/, "");
const webApiBase = (process.env.EXPO_PUBLIC_ENCORE_WEB_API_URL || "").trim().replace(/\/+$/, "");

export const encoreApiBase = Platform.OS === "web" ? webApiBase : nativeApiBase;
export const encoreApiConfigured = Platform.OS === "web" || Boolean(encoreApiBase);

export class EncoreApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "EncoreApiError";
  }
}

export async function encoreApiFetch<T>(
  path: string,
  options: RequestInit & { bearerToken?: string | null } = {}
): Promise<T> {
  if (!encoreApiConfigured) throw new Error("Set EXPO_PUBLIC_ENCORE_API_URL for the native Encore app");
  if (!path.startsWith("/api/v1/")) throw new Error("Expected an Encore API path");
  const { bearerToken, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);
  if (typeof rest.body === "string" && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }
  if (bearerToken) requestHeaders.set("authorization", `Bearer ${bearerToken}`);
  const response = await fetch(`${encoreApiBase}${path}`, {
    ...rest,
    credentials: Platform.OS === "web" && !requestHeaders.has("authorization") ? "include" : "omit",
    headers: requestHeaders
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string };
    throw new EncoreApiError(response.status, error.error ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}
