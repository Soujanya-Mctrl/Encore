"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { EncoreUser, WalletRecord } from "@encore/core";
import { Check, Copy, Music, Sparkles, UserCheck } from "lucide-react";
import { useEncoreAuth } from "@/providers/pollar-provider";

const GENRE_OPTIONS = [
  "Ambient",
  "Electronic",
  "Indie",
  "Hip-Hop",
  "Classical",
  "Experimental",
  "Jazz",
  "Folk"
];

type OnboardingCompletion = {
  user: EncoreUser;
  wallets: WalletRecord[];
  studioChannel: { displayName: string } | null;
};

export function OnboardingWizard({
  initialDisplayName,
  initialAvatarUrl,
  enablingStudio,
  preserveProfile
}: {
  initialDisplayName: string;
  initialAvatarUrl: string;
  enablingStudio: boolean;
  preserveProfile: boolean;
}) {
  const { refreshSession } = useEncoreAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [journey, setJourney] = useState<"listener" | "artist">(
    enablingStudio ? "artist" : "listener"
  );
  const [preferredGenres, setPreferredGenres] = useState<string[]>(["Ambient"]);
  const [humanCreated, setHumanCreated] = useState(true);
  const [aiAssisted, setAiAssisted] = useState(true);
  const [aiGenerated, setAiGenerated] = useState(true);
  const [exploreAll, setExploreAll] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [completion, setCompletion] = useState<OnboardingCompletion | null>(null);

  const wallets = completion?.wallets ?? [];
  const primaryWallet = wallets.find((wallet) => wallet.isPrimary) ?? wallets[0];
  const studioChannel = completion?.user.roles.includes("artist") ? completion.studioChannel : null;
  const currentStep = completion ? (preserveProfile ? 2 : 3) : step;

  const toggleGenre = (genre: string) => {
    setPreferredGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSaveOnboarding = async () => {
    setSubmitting(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await fetch("/api/v1/auth/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: preserveProfile ? initialDisplayName.trim().slice(0, 60) || "Artist" : displayName.trim(),
          avatarUrl: preserveProfile ? undefined : avatarUrl.trim(),
          journey,
          preferredGenres,
          creativeOriginPreferences: {
            humanCreated,
            aiAssisted,
            aiGenerated,
            exploreAll
          }
        })
      });
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? "Failed to save onboarding");
      }
      setCompletion((await res.json()) as OnboardingCompletion);
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!primaryWallet) return;
    try {
      await navigator.clipboard.writeText(primaryWallet.address);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-[#1B1E30] p-6 shadow-2xl [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-[#A99BFF]">
      <div className="mb-6 flex items-center justify-between text-xs text-slate-400">
        <span>Step {currentStep} of {preserveProfile ? 2 : 3}</span>
        <span className="rounded-full bg-[#3275B9]/20 px-2.5 py-0.5 text-[#7CB7FF]">
          Solana Devnet
        </span>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </div>
      )}

      {sessionExpired && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Your session expired. <Link href="/login" className="underline">Sign in again</Link> to continue setup.
        </div>
      )}

      {!completion && preserveProfile && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-white">Set up Artist Studio</h1>
          <p className="text-sm text-slate-300">
            Create an artist channel for <strong className="text-white">{initialDisplayName}</strong>.
            Your profile and listening preferences will carry over.
          </p>
          <button
            type="button"
            disabled={submitting || sessionExpired}
            onClick={() => void handleSaveOnboarding()}
            className="w-full rounded-xl bg-[#6954CF] py-2.5 text-sm font-semibold text-white hover:bg-[#5B46C0] disabled:opacity-50"
          >
            {submitting ? "Creating channel…" : "Create my artist channel"}
          </button>
          <Link href="/discover" className="inline-block text-sm text-[#A99BFF] underline">
            Back to Discover
          </Link>
        </div>
      )}

      {!completion && !preserveProfile && step === 1 && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (displayName.trim().length < 2) {
              setError("Enter a display name with at least 2 characters.");
              return;
            }
            setError(null);
            setStep(2);
          }}
        >
          <h1 className="text-xl font-bold text-white">
            {enablingStudio ? "Set up Artist Studio" : "Set up your Encore profile"}
          </h1>
          <div>
            <label htmlFor="onboarding-display-name" className="block text-xs font-medium text-slate-300">Display name</label>
            <input
              id="onboarding-display-name"
              name="displayName"
              autoComplete="nickname"
              type="text"
              required
              minLength={2}
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your artist or listener name"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151725] px-3 py-2 text-sm text-white focus:border-[#6954CF]"
            />
          </div>
          <div>
            <label htmlFor="onboarding-avatar" className="block text-xs font-medium text-slate-300">
              Avatar URL (optional)
            </label>
            <input
              id="onboarding-avatar"
              name="avatarUrl"
              autoComplete="url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151725] px-3 py-2 text-sm text-white focus:border-[#6954CF]"
            />
          </div>
          {!enablingStudio && (
            <fieldset className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <legend className="text-xs font-medium text-slate-300">Choose how to start</legend>
              <button
                type="button"
                aria-pressed={journey === "listener"}
                onClick={() => setJourney("listener")}
                className={`rounded-xl border p-3 text-left transition ${
                  journey === "listener"
                    ? "border-[#6954CF] bg-[#6954CF]/15"
                    : "border-slate-700 bg-[#151725]"
                }`}
              >
                <Music className="h-5 w-5 text-[#A99BFF]" />
                <div className="mt-2 text-sm font-semibold text-white">Listener</div>
                <div className="text-xs text-slate-400">Discover & support creators</div>
              </button>
              <button
                type="button"
                aria-pressed={journey === "artist"}
                onClick={() => setJourney("artist")}
                className={`rounded-xl border p-3 text-left transition ${
                  journey === "artist"
                    ? "border-[#168579] bg-[#168579]/15"
                    : "border-slate-700 bg-[#151725]"
                }`}
              >
                <Sparkles className="h-5 w-5 text-[#4ED9C8]" />
                <div className="mt-2 text-sm font-semibold text-white">Artist</div>
                <div className="text-xs text-slate-400">Set up your artist channel</div>
              </button>
            </fieldset>
          )}
          {journey === "artist" && (
            <p className="rounded-lg border border-slate-700 bg-[#151725] p-2.5 text-xs text-slate-300">
              Your channel gives you access to Artist Studio. You can still browse music as a listener.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-[#6954CF] py-2.5 text-sm font-semibold text-white hover:bg-[#5B46C0]"
          >
            Continue to preferences
          </button>
        </form>
      )}

      {!completion && !preserveProfile && step === 2 && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting && !sessionExpired) void handleSaveOnboarding();
          }}
        >
          <h1 className="text-xl font-bold text-white">Personalize your discovery</h1>
          <div>
            <div className="mb-2 text-xs font-medium text-slate-300">Preferred Genres</div>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={preferredGenres.includes(g)}
                  onClick={() => toggleGenre(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    preferredGenres.includes(g)
                      ? "bg-[#6954CF] text-white"
                      : "bg-[#151725] text-slate-300"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-800 bg-[#151725] p-3">
            <div className="text-xs font-medium text-slate-300">Creative Origin Preferences</div>
            {[
              { label: "Human-created music", val: humanCreated, set: setHumanCreated },
              { label: "AI-assisted music", val: aiAssisted, set: setAiAssisted },
              { label: "AI-generated music", val: aiGenerated, set: setAiGenerated },
              { label: "Explore all music", val: exploreAll, set: setExploreAll }
            ].map((item) => (
              <label key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-200">{item.label}</span>
                <input
                  type="checkbox"
                  checked={item.val}
                  onChange={(e) => item.set(e.target.checked)}
                  className="h-4 w-4 accent-[#168579]"
                />
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setError(null);
                setStep(1);
              }}
              className="w-1/3 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-200"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || sessionExpired}
              className="w-2/3 rounded-xl bg-[#168579] py-2.5 text-sm font-semibold text-white hover:bg-[#137268] disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Complete Setup"}
            </button>
          </div>
        </form>
      )}

      {completion && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#168579]/20 text-[#4ED9C8]">
            <UserCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white">{studioChannel ? "Your artist channel is ready" : "Your profile is ready"}</h1>
          {studioChannel && (
            <p className="text-sm text-slate-300">
              Open Artist Studio to manage <strong className="text-white">{studioChannel.displayName}</strong>.
            </p>
          )}

          {primaryWallet ? (
            <div className="rounded-xl border border-slate-700 bg-[#151725] p-3 text-left">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {primaryWallet.walletType === "embedded"
                    ? "Embedded Solana Wallet"
                    : "External Solana Wallet"}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyAddress()}
                  className="inline-flex items-center gap-1 text-[#A99BFF] hover:underline"
                >
                  {copyStatus === "copied" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copyStatus === "copied" ? "Copied" : "Copy address"}
                </button>
              </div>
              <div className="mt-1 break-all font-mono text-xs text-slate-100">
                {primaryWallet.address}
              </div>
              <p role="status" className="mt-1 text-xs text-slate-300">
                {copyStatus === "copied" && "Wallet address copied."}
                {copyStatus === "failed" && "Could not copy. Select the address to copy it manually."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-[#151725] p-3 text-xs text-slate-400">
              No verified wallet is linked to this profile.
            </div>
          )}

          <Link
            href={studioChannel ? "/studio/dashboard" : "/discover"}
            className="block w-full rounded-xl bg-[#6954CF] py-2.5 text-sm font-semibold text-white hover:bg-[#5B46C0]"
          >
            {studioChannel ? "Open Artist Studio" : "Continue to Discover"}
          </Link>
        </div>
      )}
    </div>
  );
}
