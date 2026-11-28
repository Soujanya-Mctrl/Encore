"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { PkceBrowserRequest } from "@encore/contracts";
import { useEncoreAuth } from "@/providers/pollar-provider";
import { NativeHandoff } from "./native-handoff";

export function LoginPanel({ nativeHandoff, socialSignInEnabled }: {
  nativeHandoff: PkceBrowserRequest | null;
  socialSignInEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const {
    user,
    loading,
    error,
    pollarConfigured,
    discoveredWallets,
    connectAndSignInSolana,
    clearError,
    loginWithGoogle,
    loginWithGithub,
    sendEmailOtp,
    verifyEmailOtp
  } = useEncoreAuth();
  const socialAvailable = socialSignInEnabled && pollarConfigured;

  useEffect(() => {
    if (!user || nativeHandoff) return;
    if (user.onboardingStatus === "completed") {
      router.push("/discover");
    } else {
      router.push("/onboarding");
    }
  }, [user, router, nativeHandoff]);

  if (user && nativeHandoff) return <NativeHandoff request={nativeHandoff} displayName={user.displayName} />;

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-[#1B1E30] p-6 shadow-2xl">
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6954CF]/20 px-3 py-1 text-xs font-medium text-[#A99BFF]">
          <Sparkles className="h-3.5 w-3.5" />
          Solana Devnet
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Welcome to Encore</h1>
        <p className="mt-1.5 text-sm text-slate-300">
          {socialAvailable ? "Sign in with email, a social account, or a Solana wallet." : "Sign in with a Solana wallet. Social and email sign-in are temporarily unavailable."}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          <span>{error}</span>
          <button type="button" onClick={clearError} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {socialAvailable && (
        <div className="mb-4 space-y-2">
          <button className="w-full rounded-xl border border-slate-600 p-2 text-white" type="button" disabled={loading} onClick={loginWithGoogle}>Continue with Google</button>
          <button className="w-full rounded-xl border border-slate-600 p-2 text-white" type="button" disabled={loading} onClick={loginWithGithub}>Continue with GitHub</button>
          <form className="space-y-2" onSubmit={(event) => {
            event.preventDefault();
            if (codeRequested) {
              verifyEmailOtp(code.trim());
            } else {
              sendEmailOtp(email.trim());
              setCodeRequested(true);
            }
          }}>
            {codeRequested ? (
              <label className="block text-sm text-white">Email verification code
                <input className="mt-1 block w-full rounded bg-slate-900 p-2" autoComplete="one-time-code" inputMode="numeric" required maxLength={12} value={code} onChange={(event) => setCode(event.target.value)} />
              </label>
            ) : (
              <label className="block text-sm text-white">Email address
                <input className="mt-1 block w-full rounded bg-slate-900 p-2" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
            )}
            <button className="w-full rounded-xl border border-slate-600 p-2 text-white" type="submit" disabled={loading}>{codeRequested ? "Verify email code" : "Send email code"}</button>
            {codeRequested && <button className="text-sm text-white underline" type="button" onClick={() => { setCode(""); setCodeRequested(false); }}>Change email or request a new code</button>}
          </form>
        </div>
      )}

      <div className="space-y-2">
        {discoveredWallets.length > 0 ? (
          discoveredWallets.map((adapter) => (
            <button
              key={adapter.meta.label}
              type="button"
              disabled={loading}
              onClick={() => void connectAndSignInSolana(adapter)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-[#151725] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-[#3275B9] disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#3275B9]" />
                {adapter.meta.label}
              </span>
              <span className="text-xs text-slate-400">Sign-In with Solana</span>
            </button>
          ))
        ) : (
          <p className="rounded-xl border border-slate-800 bg-[#151725] px-3 py-2.5 text-center text-xs text-slate-400">
            No browser Solana wallet detected. Open Encore in a browser with Phantom, Solflare, or Backpack.
          </p>
        )}
      </div>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5 text-[#168579]" />
        Public music discovery is always available without signing in.
      </p>
    </div>
  );
}
