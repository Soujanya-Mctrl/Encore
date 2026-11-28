import {
  EXPO_NATIVE_REDIRECT_URI,
  PkceBrowserRequestSchema,
  PkceExchangeRequestSchema,
  type EncoreAuthSnapshot,
  type ExpoSessionResponse,
  type OnboardingResponse,
  type OnboardingProfileInput,
  type PkceBrowserRequest,
  type PkceExchangeRequest
} from "@encore/contracts";
import { encoreApiBase, encoreApiFetch } from "./api-client";

export function nativeBrowserLoginUrl(request: PkceBrowserRequest): string {
  if (!encoreApiBase) throw new Error("Set EXPO_PUBLIC_ENCORE_API_URL for native sign-in");
  const params = PkceBrowserRequestSchema.parse(request);
  return `${encoreApiBase}/login?${new URLSearchParams(params)}`;
}

export function readNativeAuthCallback(
  callback: string,
  expectedState: string,
  redirectUri = EXPO_NATIVE_REDIRECT_URI
): string {
  const queryIndex = callback.indexOf("?");
  if (queryIndex < 0 || callback.slice(0, queryIndex) !== redirectUri || callback.includes("#")) {
    throw new Error("Encore sign-in could not verify the app callback");
  }
  const params = new URLSearchParams(callback.slice(queryIndex + 1));
  const codes = params.getAll("code");
  const [code] = codes;
  const states = params.getAll("state");
  if (!code || codes.length !== 1 || !/^[A-Za-z0-9_-]{32}$/.test(code) ||
    states.length !== 1 || states[0] !== expectedState) {
    throw new Error("Encore sign-in could not verify the app callback");
  }
  return code;
}

export function exchangeNativeAuthorization(request: PkceExchangeRequest) {
  return encoreApiFetch<ExpoSessionResponse>("/api/v1/auth/pkce/exchange", {
    method: "POST",
    body: JSON.stringify(PkceExchangeRequestSchema.parse(request))
  });
}

export function getEncoreSession(bearerToken?: string) {
  return encoreApiFetch<EncoreAuthSnapshot>("/api/v1/auth/me", { bearerToken });
}

export function saveEncoreOnboarding(input: OnboardingProfileInput, bearerToken?: string) {
  return encoreApiFetch<OnboardingResponse>("/api/v1/auth/onboarding", {
    method: "POST",
    bearerToken,
    body: JSON.stringify(input)
  });
}

export function revokeEncoreSession(bearerToken?: string) {
  return encoreApiFetch<{ ok: true }>("/api/v1/auth/logout", { method: "POST", bearerToken });
}
