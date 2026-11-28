import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Linking, Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { EXPO_NATIVE_REDIRECT_URI, type EncoreAuthSnapshot } from "@encore/contracts";
import { exchangeNativeAuthorization, getEncoreSession, nativeBrowserLoginUrl, readNativeAuthCallback, revokeEncoreSession } from "@/lib/encore-auth";
import { EncoreApiError, encoreApiBase } from "@/lib/api-client";

// Safely access native modules through globalThis.expo.modules without triggering requireNativeModule exceptions
function getNativeModule(name: string): any {
  try {
    const modules = (globalThis as any)?.expo?.modules;
    if (modules && modules[name]) {
      return modules[name];
    }
  } catch {
    // ignore
  }
  return null;
}

const inMemoryStorage = new Map<string, string>();

const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    const SecureStore = getNativeModule("ExpoSecureStore");
    if (SecureStore?.getValueWithKeyAsync) {
      try {
        return await SecureStore.getValueWithKeyAsync(key, {});
      } catch {
        return inMemoryStorage.get(key) ?? null;
      }
    }
    return inMemoryStorage.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const SecureStore = getNativeModule("ExpoSecureStore");
    if (SecureStore?.setValueWithKeyAsync) {
      try {
        await SecureStore.setValueWithKeyAsync(value, key, {});
        return;
      } catch {
        inMemoryStorage.set(key, value);
        return;
      }
    }
    inMemoryStorage.set(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    const SecureStore = getNativeModule("ExpoSecureStore");
    if (SecureStore?.deleteValueWithKeyAsync) {
      try {
        await SecureStore.deleteValueWithKeyAsync(key, {});
      } catch {
        // ignore
      }
    }
    inMemoryStorage.delete(key);
  },
};

const storageKey = "encore.api.session";

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const Account = createContext<{
  account: EncoreAuthSnapshot | null;
  token?: string;
  busy: boolean;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);

export function EncoreAccountProvider({ children }: PropsWithChildren) {
  const [account, setAccount] = useState<EncoreAuthSnapshot | null>(null);
  const [token, setToken] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let current = true;
    const refreshBrowserSession = () => {
      void getEncoreSession().then((restored) => {
        if (current) setAccount(restored);
      }).catch(() => {
        if (current) setAccount(null);
      });
    };
    if (Platform.OS === "web") window.addEventListener("focus", refreshBrowserSession);
    (async () => {
      const previous = Platform.OS === "web" ? undefined : (await safeStorage.getItem(storageKey)) ?? undefined;
      if (Platform.OS !== "web" && !previous) return;
      const restored = await getEncoreSession(previous);
      if (current) {
        setToken(previous);
        setAccount(restored);
      }
    })()
      .catch((failure) => {
        if (Platform.OS !== "web" && failure instanceof EncoreApiError && failure.status === 401) {
          void safeStorage.deleteItem(storageKey).catch(() => {});
        }
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
      if (Platform.OS === "web") window.removeEventListener("focus", refreshBrowserSession);
    };
  }, []);

  async function signIn() {
    if (Platform.OS === "web") {
      window.location.assign(new URL("/login", encoreApiBase || window.location.origin).href);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const codeVerifier = hex(Crypto.getRandomBytes(32));
      const state = hex(Crypto.getRandomBytes(24));
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
        encoding: Crypto.CryptoEncoding.BASE64
      });
      const codeChallenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

      const redirectUri = EXPO_NATIVE_REDIRECT_URI;
      const loginUrl = nativeBrowserLoginUrl({ codeChallenge, redirectUri, state });
      const WebBrowser = getNativeModule("ExpoWebBrowser");

      if (WebBrowser?.openAuthSessionAsync) {
        const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUri);
        if (result.type !== "success") return;
        const code = readNativeAuthCallback(result.url, state, redirectUri);
        const session = await exchangeNativeAuthorization({ code, codeVerifier, redirectUri });
        await safeStorage.setItem(storageKey, session.accessToken);
        setToken(session.accessToken);
        setAccount(session);
      } else {
        // Fallback to standard Linking if native WebBrowser is not present in build
        await Linking.openURL(loginUrl);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await revokeEncoreSession(token);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not revoke this session.");
    } finally {
      if (Platform.OS !== "web") await safeStorage.deleteItem(storageKey).catch(() => {});
      setToken(undefined);
      setAccount(null);
      setBusy(false);
    }
  }

  return (
    <Account.Provider value={{ account, token, busy, error, signIn, signOut }}>
      {children}
    </Account.Provider>
  );
}

export function useEncoreAccount() {
  const value = useContext(Account);
  if (!value) throw new Error("EncoreAccountProvider is required");
  return value;
}
