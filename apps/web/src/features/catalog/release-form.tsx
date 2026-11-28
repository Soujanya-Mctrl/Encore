"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function ReleaseForm() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = new FormData();
    payload.set("audio", form.get("audio")!);
    const origin = String(form.get("originCategory"));
    payload.set(
      "metadata",
      JSON.stringify({
        title: form.get("title"),
        artistName: form.get("artistName"),
        genre: form.get("genre"),
        description: form.get("description"),
        originCategory: origin,
        previewConsent: form.get("consent") === "on",
        contributions: [
          {
            role: "Creator",
            mode:
              origin === "HUMAN_CREATED"
                ? "human"
                : origin === "AI_ASSISTED"
                  ? "assisted"
                  : origin === "AI_GENERATED"
                    ? "generative_ai"
                    : "unknown",
            creatorRef: form.get("artistName"),
            consent: true,
          },
        ],
      }),
    );
    try {
      const audio = payload.get("audio") as File;
      const init = await fetch("/api/v1/uploads/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ size: audio.size }),
      });
      const grant = await init.json();
      if (!init.ok) throw new Error(grant.error);
      const upload = await fetch(grant.url, {
        method: "PUT",
        headers: { "content-type": "audio/mpeg" },
        body: audio,
      });
      if (!upload.ok) throw new Error("Audio upload failed; please retry");
      const response = await fetch("/api/v1/uploads/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant: grant.grant,
          metadata: JSON.parse(String(payload.get("metadata"))),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.push(`/tracks/${body.track.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5 max-w-2xl">
      {[
        ["title", "Track title"],
        ["artistName", "Artist name"],
        ["genre", "Genre"],
      ].map(([name, label]) => (
        <label className="block" key={name}>
          {label}
          <input
            className="block w-full rounded bg-slate-800 p-3"
            name={name}
            required
            maxLength={name === "title" ? 160 : name === "genre" ? 60 : 100}
          />
        </label>
      ))}
      <label className="block">
        Description
        <textarea
          name="description"
          maxLength={2000}
          className="block w-full rounded bg-slate-800 p-3"
        />
      </label>
      <label className="block">
        Creative origin
        <select
          name="originCategory"
          className="block w-full rounded bg-slate-800 p-3"
        >
          <option value="UNKNOWN">Unknown / undisclosed</option>
          <option value="HUMAN_CREATED">Human-created</option>
          <option value="AI_ASSISTED">AI-assisted</option>
          <option value="AI_GENERATED">AI-generated</option>
        </select>
      </label>
      <label className="block">
        MP3 preview (20 MB maximum)
        <input
          className="block py-3"
          name="audio"
          type="file"
          accept=".mp3,audio/mpeg"
          required
        />
      </label>
      <label className="flex gap-3">
        <input type="checkbox" name="consent" required />I have permission from
        the relevant contributors to publish this preview and these claims.
      </label>
      <p className="text-sm text-slate-400">
        Uploads remain private drafts until independent review and a finalized
        Music Passport. A hash proves integrity, not how music was made.
      </p>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="rounded bg-violet-600 px-6 py-3 disabled:opacity-50"
      >
        {busy ? "Validating and uploading…" : "Save private draft"}
      </button>
    </form>
  );
}
