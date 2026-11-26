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
  pollarConfigured,
  children
}: {
  pollarConfigured: boolean;
  children: React.ReactNode;
}) {
  const pollar = pollarConfigured ? usePollar() : null;
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

  // Exchange verified Pollar Web2 session for an Encore HttpOnly session cookie
  useEffect(() => {
    if (!pollar || !pollar.isAuthenticated || !pollar.verified) return;
    const client = pollar.getClient();
    const profile = client.getUserProfile();
    const pollarWallets = pollar.wallets ?? [];
    const solWallet = pollarWallets.find((w) => w.chain === "SOLANA") ?? pollar.wallet;

    const provider = profile?.providers.google
      ? "google"
      : profile?.providers.github
        ? "github"
        : "email";
    const subject =
      profile?.providers.google?.id ??
      profile?.providers.github?.id ??
      profile?.providers.email?.address ??
      profile?.mail ??
      solWallet?.address;

    if (!subject || syncedPollarRef.current === subject) return;
    syncedPollarRef.current = subject;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/auth/pollar/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            provider,
            providerSubject: subject,
            email: profile?.mail || undefined,
            displayName:
              [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
              undefined,
            avatarUrl: profile?.avatar || undefined,
            embeddedWalletAddress: solWallet?.address
          })
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to establish Encore session");
        }
        const data = (await res.json()) as { user: EncoreUser; wallets: WalletRecord[] };
        setUser(data.user);
        setWallets(data.wallets);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication exchange failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [pollar, pollar?.isAuthenticated, pollar?.verified]);

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
      const client = pollar.getClient();
      client.beginEmailLogin();
      client.sendEmailCode(email);
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
    []
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (pollar?.isAuthenticated) {
        pollar.logout();
      }
      syncedPollarRef.current = null;
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
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

export function EncorePollarProvider({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY;
  if (!apiKey) {
    return <EncoreAuthBridge pollarConfigured={false}>{children}</EncoreAuthBridge>;
  }

  return (
    <PollarSdkProvider client={{ apiKey }}>
      <EncoreAuthBridge pollarConfigured={true}>{children}</EncoreAuthBridge>
    </PollarSdkProvider>
  );
}

export function useEncoreAuth(): EncoreAuthContextValue {
  const ctx = useContext(EncoreAuthContext);
  if (!ctx) {
    throw new Error("useEncoreAuth must be used within EncorePollarProvider");
  }
  return ctx;
}
