"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useEncoreAuth } from "@/providers/pollar-provider";

export function LoginPanel() {
  const router = useRouter();
  const {
    user,
    loading,
    error,
    pollarConfigured,
    discoveredWallets,
    loginWithGoogle,
    loginWithGithub,
    sendEmailOtp,
    verifyEmailOtp,
    connectAndSignInSolana,
    clearError
  } = useEncoreAuth();

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.onboardingStatus === "completed") {
      router.push("/discover");
    } else {
      router.push("/onboarding");
    }
  }, [user, router]);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    sendEmailOtp(email.trim());
    setOtpSent(true);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    verifyEmailOtp(otpCode.trim());
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-[#1B1E30] p-6 shadow-2xl">
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6954CF]/20 px-3 py-1 text-xs font-medium text-[#A99BFF]">
          <Sparkles className="h-3.5 w-3.5" />
          Solana Devnet
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Welcome to Encore</h1>
        <p className="mt-1.5 text-sm text-slate-300">
          Sign in with Google or email — no wallet extension or seed phrase required. Or connect
          your Solana wallet directly.
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

      {!pollarConfigured && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Pollar publishable key not set (`NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`). Wallet Standard
          SIWS remains active.
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
        >
          Continue with Google
        </button>

        <button
          type="button"
          onClick={loginWithGithub}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-50"
        >
          Continue with GitHub
        </button>

        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-2 pt-1">
          <label className="block text-xs font-medium text-slate-300">
            Continue with Email OTP
          </label>
          {!otpSent ? (
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-700 bg-[#151725] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-[#6954CF] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#6954CF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B46C0] disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                Send
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full rounded-xl border border-slate-700 bg-[#151725] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-[#6954CF] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 rounded-xl bg-[#168579] px-4 py-2 text-sm font-semibold text-white hover:bg-[#137268] disabled:opacity-50"
              >
                Verify
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
        <div className="h-px flex-1 bg-slate-800" />
        <span>OR CONNECT SOLANA WALLET</span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

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
            No browser Solana wallet detected (Phantom, Solflare, Backpack). Social/email login
            automatically provisions an embedded wallet.
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
