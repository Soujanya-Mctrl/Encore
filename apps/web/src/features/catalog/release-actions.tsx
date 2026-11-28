"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ReleaseActions({
  id,
  owner,
  reviewer,
  status,
}: {
  id: string;
  owner: boolean;
  reviewer: boolean;
  status: string;
}) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function act(action: string, body: unknown) {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/tracks/${id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-x-4 my-5">
      {owner && status === "draft" && (
        <button disabled={busy} onClick={() => act("submit", {})}>
          Submit for independent review
        </button>
      )}
      {reviewer && status === "submitted" && (
        <>
          <button
            disabled={busy}
            onClick={() => act("review", { approve: true })}
          >
            Approve preview claims
          </button>
          <button
            disabled={busy}
            onClick={() => act("review", { approve: false })}
          >
            Return for revision
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function PassportRevision({
  id,
  version,
  artistName,
}: {
  id: string;
  version: number;
  artistName: string;
}) {
  const [origin, setOrigin] = useState("UNKNOWN"),
    [error, setError] = useState("");
  const router = useRouter();
  async function revise() {
    try {
      const mode =
        origin === "HUMAN_CREATED"
          ? "human"
          : origin === "AI_ASSISTED"
            ? "assisted"
            : origin === "AI_GENERATED"
              ? "generative_ai"
              : "unknown";
      const r = await fetch(`/api/v1/tracks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: version,
          manifest: {
            originCategory: origin,
            contributions: [
              { role: "Creator", mode, creatorRef: artistName, consent: true },
            ],
          },
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revision failed");
    }
  }
  return (
    <details className="my-6">
      <summary>Append a corrected Passport version</summary>
      <p className="my-3">
        Previous claims remain in history. Confirm contributor consent and
        select the corrected origin.
      </p>
      <select
        aria-label="Revised origin"
        className="bg-slate-800 p-3"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
      >
        {["UNKNOWN", "HUMAN_CREATED", "AI_ASSISTED", "AI_GENERATED"].map(
          (o) => (
            <option key={o}>{o}</option>
          ),
        )}
      </select>
      <button className="ml-3 p-3 bg-violet-600 rounded" onClick={revise}>
        Confirm consent & append version
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
