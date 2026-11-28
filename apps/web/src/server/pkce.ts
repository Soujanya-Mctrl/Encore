import { createHash } from "node:crypto";
import { EXPO_NATIVE_REDIRECT_URI } from "@encore/contracts";

export const PKCE_TTL_SECONDS = 120;

export function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function s256(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function permitsNativeRedirect(redirectUri: string) {
  const allowed = (process.env.ENCORE_NATIVE_REDIRECT_URIS ?? EXPO_NATIVE_REDIRECT_URI)
    .split(",").map((uri) => uri.trim());
  if (!allowed.includes(redirectUri)) return false;
  try {
    const url = new URL(redirectUri);
    return ["encore:", "https:"].includes(url.protocol) && Boolean(url.host) &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
