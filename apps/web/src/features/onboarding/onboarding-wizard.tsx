"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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

export function OnboardingWizard() {
  const router = useRouter();
  const { user, wallets, refreshSession } = useEncoreAuth();
  const [step, setStep] = useState<2 | 3 | 4>(2);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [journey, setJourney] = useState<"listener" | "artist">("listener");
  const [preferredGenres, setPreferredGenres] = useState<string[]>(["Ambient"]);
  const [humanCreated, setHumanCreated] = useState(true);
  const [aiAssisted, setAiAssisted] = useState(true);
  const [aiGenerated, setAiGenerated] = useState(true);
  const [exploreAll, setExploreAll] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];

  const toggleGenre = (genre: string) => {
    setPreferredGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSaveOnboarding = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: displayName.trim() || "Encore Listener",
          avatarUrl: avatarUrl.trim(),
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
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? "Failed to save onboarding");
      }
      await refreshSession();
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!primaryWallet) return;
    await navigator.clipboard.writeText(primaryWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-[#1B1E30] p-6 shadow-2xl">
      <div className="mb-6 flex items-center justify-between text-xs text-slate-400">
        <span>Step {step} of 4</span>
        <span className="rounded-full bg-[#3275B9]/20 px-2.5 py-0.5 text-[#7CB7FF]">
          Solana Devnet
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {error}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Set up your Encore profile</h2>
          <div>
            <label className="block text-xs font-medium text-slate-300">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your artist or listener name"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151725] px-3 py-2 text-sm text-white focus:border-[#6954CF] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300">
              Avatar URL (Optional)
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151725] px-3 py-2 text-sm text-white focus:border-[#6954CF] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
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
              onClick={() => setJourney("artist")}
              className={`rounded-xl border p-3 text-left transition ${
                journey === "artist"
                  ? "border-[#168579] bg-[#168579]/15"
                  : "border-slate-700 bg-[#151725]"
              }`}
            >
              <Sparkles className="h-5 w-5 text-[#4ED9C8]" />
              <div className="mt-2 text-sm font-semibold text-white">Artist</div>
              <div className="text-xs text-slate-400">Publish Music Passports</div>
            </button>
          </div>
          {journey === "artist" && (
            <p className="rounded-lg border border-slate-700 bg-[#151725] p-2.5 text-xs text-slate-300">
              Artists can complete contributor disclosures and licensing packs inside Artist Studio
              after onboarding.
            </p>
          )}
          <button
            type="button"
            onClick={() => setStep(3)}
            className="w-full rounded-xl bg-[#6954CF] py-2.5 text-sm font-semibold text-white hover:bg-[#5B46C0]"
          >
            Continue to Personalization
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Personalize your discovery</h2>
          <div>
            <div className="mb-2 text-xs font-medium text-slate-300">Preferred Genres</div>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
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
              onClick={() => setStep(2)}
              className="w-1/3 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-200"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSaveOnboarding()}
              className="w-2/3 rounded-xl bg-[#168579] py-2.5 text-sm font-semibold text-white hover:bg-[#137268] disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Complete Setup"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#168579]/20 text-[#4ED9C8]">
            <UserCheck className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">You&apos;re ready on Encore</h2>
          <p className="text-xs text-slate-300">
            Connected to <strong className="text-white">Solana Devnet</strong>.
          </p>

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
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-1 break-all font-mono text-xs text-slate-100">
                {primaryWallet.address}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-[#151725] p-3 text-xs text-slate-400">
              Profile active. You can connect or provision a Solana devnet wallet anytime.
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push(journey === "artist" ? "/studio/dashboard" : "/discover")}
            className="w-full rounded-xl bg-[#6954CF] py-2.5 text-sm font-semibold text-white hover:bg-[#5B46C0]"
          >
            {journey === "artist" ? "Open Artist Studio" : "Continue to Discover"}
          </button>
        </div>
      )}
    </div>
  );
}
