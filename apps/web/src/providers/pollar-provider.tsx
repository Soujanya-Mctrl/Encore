"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
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
  discoveredWallets: SolanaWalletStandardAdapter[];
  refreshSession: () => Promise<void>;
  connectAndSignInSolana: (adapter: SolanaWalletStandardAdapter) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const EncoreAuthContext = createContext<EncoreAuthContextValue | null>(null);

export function EncorePollarProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EncoreUser | null>(null);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveredWallets, setDiscoveredWallets] = useState<SolanaWalletStandardAdapter[]>(
    []
  );

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
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
      setUser(null);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<EncoreAuthContextValue>(
    () => ({
      user,
      wallets,
      loading,
      error,
      discoveredWallets,
      refreshSession,
      connectAndSignInSolana,
      logout,
      clearError: () => setError(null)
    }),
    [
      user,
      wallets,
      loading,
      error,
      discoveredWallets,
      refreshSession,
      connectAndSignInSolana,
      logout
    ]
  );

  return <EncoreAuthContext.Provider value={value}>{children}</EncoreAuthContext.Provider>;
}

export function useEncoreAuth(): EncoreAuthContextValue {
  const ctx = useContext(EncoreAuthContext);
  if (!ctx) {
    throw new Error("useEncoreAuth must be used within EncorePollarProvider");
  }
  return ctx;
}
