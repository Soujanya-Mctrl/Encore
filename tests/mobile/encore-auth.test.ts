import { describe, expect, it, vi } from "vitest";
import {
  exchangeNativeAuthorization,
  getEncoreSession,
  nativeBrowserLoginUrl,
  readNativeAuthCallback,
  revokeEncoreSession
} from "../../apps/mobile/src/lib/encore-auth";

const { encoreApiFetch } = vi.hoisted(() => ({ encoreApiFetch: vi.fn() }));
vi.mock("../../apps/mobile/src/lib/api-client", () => ({
  encoreApiBase: "https://encore.example",
  encoreApiFetch
}));

const redirectUri = "encore://auth/callback";
const code = "c".repeat(32);
const state = "s".repeat(32);

describe("Expo Encore authentication", () => {
  it("preserves the PKCE challenge and state in the browser login URL", () => {
    const codeChallenge = "a".repeat(43);
    const login = new URL(nativeBrowserLoginUrl({ codeChallenge, redirectUri, state }));
    expect(login.origin + login.pathname).toBe("https://encore.example/login");
    expect(Object.fromEntries(login.searchParams)).toEqual({ codeChallenge, redirectUri, state });
  });

  it("rejects a callback with a different URI, state, or duplicate code", () => {
    const query = `code=${code}&state=${state}`;
    expect(readNativeAuthCallback(`${redirectUri}?${query}`, state)).toBe(code);
    expect(() => readNativeAuthCallback(`encore://other/callback?${query}`, state)).toThrow();
    expect(() => readNativeAuthCallback(`${redirectUri}?${query}`, "different-state")).toThrow();
    expect(() => readNativeAuthCallback(`${redirectUri}?${query}&code=${code}`, state)).toThrow();
  });

  it("exchanges a native code with the original verifier and redirect", () => {
    const request = { code, codeVerifier: "v".repeat(43), redirectUri };
    exchangeNativeAuthorization(request);
    expect(encoreApiFetch).toHaveBeenCalledWith("/api/v1/auth/pkce/exchange", {
      method: "POST",
      body: JSON.stringify(request)
    });
  });

  it("passes the explicit bearer token to native session lookup and logout", () => {
    const bearerToken = "native-test-token";
    getEncoreSession(bearerToken);
    revokeEncoreSession(bearerToken);
    expect(encoreApiFetch).toHaveBeenCalledWith("/api/v1/auth/me", { bearerToken });
    expect(encoreApiFetch).toHaveBeenCalledWith("/api/v1/auth/logout", {
      method: "POST", bearerToken
    });
  });
});
