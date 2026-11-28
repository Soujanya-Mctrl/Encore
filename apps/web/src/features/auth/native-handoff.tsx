"use client";

import { useState } from "react";
import type { PkceBrowserRequest } from "@encore/contracts";

export function NativeHandoff({ request, displayName }: {
  request: PkceBrowserRequest;
  displayName: string;
}) {
  const [callback, setCallback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function prepareHandoff() {
    setLoading(true);
    setCallback(null);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/pkce/code", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codeChallenge: request.codeChallenge, redirectUri: request.redirectUri })
      });
      if (response.status === 401) throw new Error("The browser session expired. Reload and sign in again.");
      if (!response.ok) throw new Error("Could not connect the app. Please try again.");
      const { code } = await response.json() as { code: string };
      const url = new URL(request.redirectUri);
      url.searchParams.set("code", code);
      url.searchParams.set("state", request.state);
      setCallback(url.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect the app. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-[#1B1E30] p-6">
      <h1 className="text-xl font-bold text-white">Connect Encore to your app</h1>
      <p className="mt-2 text-sm text-slate-300">Signed in as {displayName}.</p>
      {error && <p className="mt-3 text-sm text-amber-200" role="alert">{error}</p>}
      {callback && (
        <a className="mt-4 block rounded-xl bg-indigo-600 p-3 text-center text-white" href={callback} rel="noreferrer">
          Return to Encore app
        </a>
      )}
      <button
        className="mt-4 w-full rounded-xl border border-slate-600 p-3 text-white disabled:opacity-50"
        type="button"
        disabled={loading}
        onClick={() => void prepareHandoff()}
      >
        {loading ? "Connecting…" : callback ? "Get a new connection link" : "Connect app"}
      </button>
    </div>
  );
}
