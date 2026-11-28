import { Platform } from "react-native";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "web" ? "" : "http://localhost:3000");

export async function encoreApiFetch<T>(
  path: string,
  options: RequestInit & { bearerToken?: string | null } = {}
): Promise<T> {
  const { bearerToken, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: Platform.OS === "web" ? "include" : "omit",
    headers: {
      "content-type": "application/json",
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
      ...headers
    }
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}
