"use client";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { DiscoveryTrack, PreviewSource } from "@encore/contracts";

const Player = createContext<((track: DiscoveryTrack, queue: DiscoveryTrack[]) => void) | null>(null);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function PreviewProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const generation = useRef(0);
  const expiresAt = useRef(0);
  const playlist = useRef<DiscoveryTrack[]>([]);
  const loadedTrack = useRef<DiscoveryTrack | null>(null);
  const recoveryAttempted = useRef(false);
  const [track, setTrack] = useState<DiscoveryTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  async function load(next: DiscoveryTrack, start = 0, startPlaying = true) {
    const element = audio.current;
    if (!element) return;
    const request = ++generation.current;
    loadedTrack.current = next;
    element.pause();
    element.removeAttribute("src");
    element.load();
    setTrack(next);
    setPending(true);
    setError("");
    setPosition(start);
    setDuration(0);
    try {
      const response = await fetch(`/api/v1/tracks/${next.id}/play?format=json`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? "This preview is unavailable." : "Could not load preview.");
      const source: PreviewSource = await response.json();
      if (request !== generation.current) return;
      expiresAt.current = Date.parse(source.expiresAt);
      element.onloadedmetadata = () => {
        if (request !== generation.current) return;
        if (start > 0 && start < element.duration) element.currentTime = start;
        setDuration(Number.isFinite(element.duration) ? element.duration : 0);
      };
      element.src = source.url;
      if (!startPlaying) { element.load(); return; }
      try { await element.play(); } catch (failure) {
        if (request === generation.current && failure instanceof DOMException && failure.name === "NotAllowedError") {
          setError("Press Play to start the preview.");
        }
      }
    } catch (failure) {
      if (request !== generation.current) return;
      element.removeAttribute("src");
      element.load();
      setError(failure instanceof Error ? failure.message : "Could not load preview.");
    } finally {
      if (request === generation.current) setPending(false);
    }
  }

  function move(offset: number) {
    const index = playlist.current.findIndex((item) => item.id === loadedTrack.current?.id) + offset;
    const next = playlist.current[index];
    if (next) {
      recoveryAttempted.current = false;
      void load(next);
    }
  }

  const select = (selected: DiscoveryTrack, queue: DiscoveryTrack[]) => {
    playlist.current = queue.filter((item) => item.rights.preview);
    recoveryAttempted.current = false;
    void load(selected);
  };

  return <Player.Provider value={select}>
    {children}
    <audio ref={audio} preload="metadata"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)}
      onEnded={() => { setPlaying(false); move(1); }}
      onError={() => {
        const current = loadedTrack.current;
        if (!current || !audio.current?.getAttribute("src")) return;
        if (!recoveryAttempted.current) {
          recoveryAttempted.current = true;
          void load(current, audio.current.currentTime);
        } else setError("Playback failed. Press Play to try again.");
      }}
    />
    {track && <aside aria-label="Preview player" className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-3 border-t border-violet-400/40 bg-slate-950 px-5 py-3 text-white">
      <div className="min-w-36">
        <Link href={`/tracks/${track.id}`} className="font-semibold">{track.title}</Link>
        <p className="text-sm text-slate-300">{track.artistName}</p>
      </div>
      <button type="button" onClick={() => move(-1)} disabled={playlist.current[0]?.id === track.id}>Previous</button>
      <button type="button" disabled={pending} className="rounded bg-violet-700 px-3 py-2" onClick={() => {
        const element = audio.current;
        if (!element) return;
        if (playing) element.pause();
        else if (!element.getAttribute("src") || !element.readyState || Date.now() >= expiresAt.current) {
          recoveryAttempted.current = false;
          void load(track, position);
        } else void element.play().then(() => setError(""), () => setError("Could not resume playback."));
      }}>{pending ? "Loading…" : playing ? "Pause" : "Play"}</button>
      <button type="button" onClick={() => move(1)} disabled={playlist.current.at(-1)?.id === track.id}>Next</button>
      <input aria-label="Seek preview" className="min-w-28 flex-1 accent-violet-400" type="range" min={0} max={duration || 0}
        value={Math.min(position, duration)} step={0.1} disabled={!duration}
        onChange={(event) => {
          const time = Number(event.target.value);
          if (Date.now() >= expiresAt.current) { void load(track, time, playing); return; }
          if (audio.current) audio.current.currentTime = time;
          setPosition(time);
        }}
      />
      <span aria-label="Playback progress" className="text-xs">{clock(position)} / {clock(duration)}</span>
      <button type="button" onClick={() => {
        generation.current++;
        loadedTrack.current = null;
        audio.current?.pause();
        audio.current?.removeAttribute("src");
        audio.current?.load();
        setTrack(null);
      }}>Close player</button>
      {error && <p role="alert" className="w-full text-sm text-amber-200">{error}</p>}
    </aside>}
  </Player.Provider>;
}

export function PlayPreview({ track, queue = [track] }: { track: DiscoveryTrack; queue?: DiscoveryTrack[] }) {
  const play = useContext(Player);
  if (!track.rights.preview) return <span className="text-sm text-slate-400">Preview unavailable</span>;
  return <button type="button" className="rounded bg-violet-700 px-3 py-2 text-sm" onClick={() => play?.(track, queue)}>Play preview</button>;
}
