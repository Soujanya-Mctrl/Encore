"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { PollarProvider as PollarSdkProvider, usePollar } from "@pollar/react";
import { WebCryptoKeyManager, type KeyManager, type PollarClientConfig } from "@pollar/core";
import { exchangePollarSession } from "@/features/auth/exchange-pollar-session";
import {
  solanaWalletStandardAdapters,
  type SolanaWalletStandardAdapter
} from "@pollar/solana-wallet-standard-adapter";
import type { EncoreUser, WalletRecord } from "@encore/core";

export interface EncoreAuthContextValue {
  user: EncoreUser | null;
  wallets: WalletRecord[];
  loading: boolean;
  error: string | null;
  pollarConfigured: boolean;
  discoveredWallets: SolanaWalletStandardAdapter[];
  refreshSession: () => Promise<void>;
  loginWithGoogle: () => void;
  loginWithGithub: () => void;
  sendEmailOtp: (email: string) => void;
  verifyEmailOtp: (code: string) => void;
  connectAndSignInSolana: (adapter: SolanaWalletStandardAdapter) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const EncoreAuthContext = createContext<EncoreAuthContextValue | null>(null);

function EncoreAuthBridge({
  pollar,
  keys,
  children
}: {
  pollar: ReturnType<typeof usePollar> | null;
  keys: KeyManager | null;
  children: React.ReactNode;
}) {
  const pollarConfigured = pollar !== null;
  const [user, setUser] = useState<EncoreUser | null>(null);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveredWallets, setDiscoveredWallets] = useState<SolanaWalletStandardAdapter[]>(
    []
  );
  const syncedPollarRef = useRef<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { user: EncoreUser; wallets: WalletRecord[] };
        setUser(data.user);
        setWallets(data.wallets);
      } else {
        setUser(null);
        setWallets([]);
      }
    } catch {
      setUser(null);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDiscoveredWallets(solanaWalletStandardAdapters());
    } catch {
      setDiscoveredWallets([]);
    }
  }, []);

  // Exchange only a provider-verified session. Never send identity claims as proof.
  const authenticated = pollar?.isAuthenticated ?? false;
  const verified = pollar?.verified ?? false;
  const providerClient = pollar?.getClient() ?? null;
  useEffect(() => {
    if (!authenticated || !verified || !providerClient || !keys) return;
    const client = providerClient;
    const state = client.getAuthState();
    if (state.step !== "authenticated") return;
    const sessionId = state.session.clientSessionId;
    if (syncedPollarRef.current === sessionId) return;
    syncedPollarRef.current = sessionId;
    let cancelled = false;
    setLoading(true);
    void exchangePollarSession(client, keys).then((data) => {
      if (!cancelled) { setUser(data.user); setWallets(data.wallets); setError(null); }
    }).catch((err: unknown) => {
      syncedPollarRef.current = null;
      if (!cancelled) setError(err instanceof Error ? err.message : "Authentication exchange failed");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; syncedPollarRef.current = null; };
  }, [authenticated, verified, providerClient, keys]);

  useEffect(() => {
    if (!providerClient) return;
    return providerClient.onAuthStateChange((state) => {
      if (state.step === "error") {
        setError("Pollar sign-in failed. Please try again.");
        setLoading(false);
      }
    });
  }, [providerClient]);

  const loginWithGoogle = useCallback(() => {
    if (!pollar) {
      setError("Pollar publishable key is not configured in .env.local");
      return;
    }
    setError(null);
    pollar.login({ provider: "google" });
  }, [pollar]);

  const loginWithGithub = useCallback(() => {
    if (!pollar) {
      setError("Pollar publishable key is not configured in .env.local");
      return;
    }
    setError(null);
    pollar.login({ provider: "github" });
  }, [pollar]);

  const sendEmailOtp = useCallback(
    (email: string) => {
      if (!pollar) {
        setError("Pollar publishable key is not configured in .env.local");
        return;
      }
      setError(null);
      pollar.login({ provider: "email", email });
    },
    [pollar]
  );

  const verifyEmailOtp = useCallback(
    (code: string) => {
      if (!pollar) {
        setError("Pollar publishable key is not configured in .env.local");
        return;
      }
      setError(null);
      pollar.getClient().verifyEmailCode(code);
    },
    [pollar]
  );

  const connectAndSignInSolana = useCallback(
    async (adapter: SolanaWalletStandardAdapter): Promise<boolean> => {
      if (pollar) {
        setError(null);
        pollar.login({ provider: adapter.type });
        return true;
      }
      setLoading(true);
      setError(null);
      try {
        const connected = await adapter.connect();
        const address = connected.address;
        if (!address) throw new Error("Wallet did not return a public key");

        const challengeRes = await fetch("/api/v1/auth/siws/challenge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address, intendedAction: "login" })
        });
        if (!challengeRes.ok) {
          throw new Error("Failed to request Sign-In with Solana challenge");
        }
        const { nonce, message } = (await challengeRes.json()) as {
          nonce: string;
          message: string;
        };

        const signed = await adapter.signMessage(new TextEncoder().encode(message));
        const signatureBase64 = btoa(String.fromCharCode(...signed.signature));

        const verifyRes = await fetch("/api/v1/auth/siws/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            address,
            nonce,
            message,
            signatureBase64,
            walletProvider: adapter.meta.label
          })
        });
        if (!verifyRes.ok) {
          const errBody = (await verifyRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error ?? "Wallet signature verification failed");
        }
        const data = (await verifyRes.json()) as { user: EncoreUser; wallets: WalletRecord[] };
        setUser(data.user);
        setWallets(data.wallets);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Wallet sign-in cancelled or failed");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [pollar]
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (pollar?.isAuthenticated) {
        await pollar.getClient().logout();
      }
      syncedPollarRef.current = null;
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include",
        headers: { "content-type": "application/json" }, body: "{}" });
      setUser(null);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [pollar]);

  const value = useMemo<EncoreAuthContextValue>(
    () => ({
      user,
      wallets,
      loading,
      error,
      pollarConfigured,
      discoveredWallets,
      refreshSession,
      loginWithGoogle,
      loginWithGithub,
      sendEmailOtp,
      verifyEmailOtp,
      connectAndSignInSolana,
      logout,
      clearError: () => setError(null)
    }),
    [
      user,
      wallets,
      loading,
      error,
      pollarConfigured,
      discoveredWallets,
      refreshSession,
      loginWithGoogle,
      loginWithGithub,
      sendEmailOtp,
      verifyEmailOtp,
      connectAndSignInSolana,
      logout
    ]
  );

  return <EncoreAuthContext.Provider value={value}>{children}</EncoreAuthContext.Provider>;
}

function ConfiguredBridge({ keys, children }: { keys: KeyManager; children: React.ReactNode }) {
  const pollar = usePollar();
  return <EncoreAuthBridge pollar={pollar} keys={keys}>{children}</EncoreAuthBridge>;
}

export function EncorePollarProvider({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY;
  const [config, setConfig] = useState<PollarClientConfig | null>(null);
  useEffect(() => {
    if (!apiKey) return;
    const keyManager = new WebCryptoKeyManager(apiKey);
    setConfig({ apiKey, keyManager, walletAdapters: solanaWalletStandardAdapters(), confirmation: "prompt" });
  }, [apiKey]);
  if (!config?.keyManager) return <EncoreAuthBridge pollar={null} keys={null}>{children}</EncoreAuthBridge>;
  return <PollarSdkProvider client={config}>
    <ConfiguredBridge keys={config.keyManager}>{children}</ConfiguredBridge>
  </PollarSdkProvider>;
}

export function useEncoreAuth(): EncoreAuthContextValue {
  const ctx = useContext(EncoreAuthContext);
  if (!ctx) {
    throw new Error("useEncoreAuth must be used within EncorePollarProvider");
  }
  return ctx;
}
