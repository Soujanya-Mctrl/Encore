import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { EXPO_NATIVE_REDIRECT_URI, type EncoreAuthSnapshot } from "@encore/contracts";
import { exchangeNativeAuthorization, getEncoreSession, nativeBrowserLoginUrl, readNativeAuthCallback, revokeEncoreSession } from "@/lib/encore-auth";
import { EncoreApiError } from "@/lib/api-client";

const storageKey = "encore.api.session";
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const Account = createContext<{
  account: EncoreAuthSnapshot | null; token?: string; busy: boolean; error: string;
  signIn: () => Promise<void>; signOut: () => Promise<void>;
} | null>(null);

export function EncoreAccountProvider({ children }: PropsWithChildren) {
  const [account, setAccount] = useState<EncoreAuthSnapshot | null>(null);
  const [token, setToken] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let current = true;
    (async () => {
      const previous = Platform.OS === "web" ? undefined : await SecureStore.getItemAsync(storageKey) ?? undefined;
      if (Platform.OS !== "web" && !previous) return;
      const restored = await getEncoreSession(previous);
      if (current) { setToken(previous); setAccount(restored); }
    })().catch((failure) => {
      if (Platform.OS !== "web" && failure instanceof EncoreApiError && failure.status === 401) {
        void SecureStore.deleteItemAsync(storageKey).catch(() => {});
      }
    }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, []);
  async function signIn() {
    if (Platform.OS === "web") {
      window.location.assign("/login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const codeVerifier = hex(await Crypto.getRandomBytesAsync(32));
      const state = hex(await Crypto.getRandomBytesAsync(24));
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, { encoding: Crypto.CryptoEncoding.BASE64 });
      const codeChallenge = digest.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      const redirectUri = EXPO_NATIVE_REDIRECT_URI;
      const result = await WebBrowser.openAuthSessionAsync(nativeBrowserLoginUrl({ codeChallenge, redirectUri, state }), redirectUri);
      if (result.type !== "success") return;
      const code = readNativeAuthCallback(result.url, state, redirectUri);
      const session = await exchangeNativeAuthorization({ code, codeVerifier, redirectUri });
      await SecureStore.setItemAsync(storageKey, session.accessToken);
      setToken(session.accessToken);
      setAccount(session);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
    } finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await revokeEncoreSession(token);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not revoke this session.");
    } finally {
      if (Platform.OS !== "web") await SecureStore.deleteItemAsync(storageKey).catch(() => {});
      setToken(undefined);
      setAccount(null);
      setBusy(false);
    }
  }
  return <Account.Provider value={{ account, token, busy, error, signIn, signOut }}>{children}</Account.Provider>;
}

export function useEncoreAccount() {
  const value = useContext(Account);
  if (!value) throw new Error("EncoreAccountProvider is required");
  return value;
}
