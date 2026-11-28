import { Link, usePathname } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Pressable, Text, View } from "react-native";
import type { DiscoveryTrack } from "@encore/contracts";
import { encoreColors as c } from "@/features/encore/ui/tokens";
import { previewSource } from "./api";

// Safely check for native module existence before attempting to require expo-audio
function getAudioModule(): typeof import("expo-audio") | null {
  try {
    const modules = (globalThis as any)?.expo?.modules;
    if (modules?.ExpoAudio) {
      return require("expo-audio");
    }
  } catch {
    // ignore
  }
  return null;
}

const expoAudioModule = getAudioModule();

type PlayerState = {
  track: DiscoveryTrack | null;
  pending: boolean;
  error: string;
  playing: boolean;
  position: number;
  duration: number;
  hasNext: boolean;
  hasPrevious: boolean;
  select: (track: DiscoveryTrack, queue?: DiscoveryTrack[]) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  move: (offset: number) => void;
};

const Music = createContext<PlayerState | null>(null);

function NativeMusicProvider({ children }: PropsWithChildren) {
  const { useAudioPlayer, useAudioPlayerStatus } = expoAudioModule!;
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [track, setTrack] = useState<DiscoveryTrack | null>(null);
  const [queue, setQueue] = useState<DiscoveryTrack[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const expiry = useRef(0);
  const seekAfterLoad = useRef(0);
  const finishHandled = useRef(false);
  const activeIndex = queue.findIndex((entry) => entry.id === track?.id);

  async function load(next: DiscoveryTrack, position = 0, startPlaying = true) {
    const request = ++generation.current;
    setTrack(next);
    setPending(true);
    setError("");
    finishHandled.current = true;
    try {
      player.pause();
    } catch {
      // ignore pause failure
    }
    expiry.current = 0;
    try {
      const source = await previewSource(next.id);
      if (request !== generation.current) return;
      expiry.current = Date.parse(source.expiresAt);
      seekAfterLoad.current = position;
      player.replace(source.url);
      if (startPlaying) player.play();
    } catch (failure) {
      if (request === generation.current) {
        setError(failure instanceof Error ? failure.message : "Could not play preview.");
      }
    } finally {
      if (request === generation.current) setPending(false);
    }
  }

  useEffect(() => {
    if (status.isLoaded && seekAfterLoad.current > 0) {
      const position = seekAfterLoad.current;
      seekAfterLoad.current = 0;
      void player.seekTo(position).catch(() => setError("Could not restore playback position."));
    }
  }, [player, status.isLoaded]);

  useEffect(() => {
    if (status.playing) finishHandled.current = false;
    if (!status.didJustFinish || finishHandled.current) return;
    finishHandled.current = true;
    const next = queue[activeIndex + 1];
    if (next) void load(next);
  }, [status.playing, status.didJustFinish, activeIndex, queue]);

  useEffect(() => {
    if (status.playbackState === "error" && track) {
      setError("Playback failed. Press Play to refresh the preview.");
    }
  }, [status.playbackState, track]);

  return (
    <Music.Provider
      value={{
        track,
        pending,
        error,
        playing: status.playing,
        position: status.currentTime,
        duration: status.duration,
        hasNext: activeIndex >= 0 && activeIndex + 1 < queue.length,
        hasPrevious: activeIndex > 0,
        select: (selected, context = [selected]) => {
          if (selected.id === track?.id && status.playing) return;
          setQueue(context.filter((item) => item.rights.preview));
          void load(selected);
        },
        toggle: () => {
          if (!track || pending) return;
          if (status.playing) player.pause();
          else if (Date.now() >= expiry.current || !status.isLoaded || error) {
            void load(track, status.currentTime);
          } else if (status.duration > 0 && status.currentTime >= status.duration - 0.1) {
            void player.seekTo(0).then(() => player.play()).catch(() => setError("Could not restart preview."));
          } else player.play();
        },
        seek: (seconds) => {
          if (!track || !status.duration) return;
          const position = Math.min(status.duration, Math.max(0, seconds));
          if (Date.now() >= expiry.current) void load(track, position, status.playing);
          else void player.seekTo(position).catch(() => setError("Could not seek in preview."));
        },
        move: (offset) => {
          const next = queue[activeIndex + offset];
          if (next) void load(next);
        },
      }}
    >
      {children}
    </Music.Provider>
  );
}

function FallbackMusicProvider({ children }: PropsWithChildren) {
  const [track, setTrack] = useState<DiscoveryTrack | null>(null);
  const [queue, setQueue] = useState<DiscoveryTrack[]>([]);
  const [playing, setPlaying] = useState(false);
  const activeIndex = queue.findIndex((entry) => entry.id === track?.id);

  return (
    <Music.Provider
      value={{
        track,
        pending: false,
        error: "",
        playing,
        position: 0,
        duration: 30,
        hasNext: activeIndex >= 0 && activeIndex + 1 < queue.length,
        hasPrevious: activeIndex > 0,
        select: (selected, context = [selected]) => {
          setTrack(selected);
          setQueue(context);
          setPlaying(true);
        },
        toggle: () => setPlaying((prev) => !prev),
        seek: () => {},
        move: (offset) => {
          const next = queue[activeIndex + offset];
          if (next) setTrack(next);
        },
      }}
    >
      {children}
    </Music.Provider>
  );
}

export function MusicProvider({ children }: PropsWithChildren) {
  if (!expoAudioModule?.useAudioPlayer) {
    return <FallbackMusicProvider>{children}</FallbackMusicProvider>;
  }
  return <NativeMusicProvider>{children}</NativeMusicProvider>;
}

export function useMusic() {
  const value = useContext(Music);
  if (!value) throw new Error("MusicProvider is required");
  return value;
}

export function MiniPlayer() {
  const { track, playing, pending, toggle } = useMusic();
  const path = usePathname();
  if (!track || path.startsWith("/player/")) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        gap: 12,
        backgroundColor: c.oat,
        borderTopWidth: 1,
        borderColor: c.border,
      }}
    >
      <Link href={`/player/${track.id}`} style={{ color: c.ink, flex: 1, fontWeight: "700" }}>
        {track.title} · {track.artistName}
      </Link>
      <Pressable accessibilityRole="button" onPress={toggle} disabled={pending}>
        <Text style={{ color: c.berry, padding: 8 }}>{pending ? "Loading…" : playing ? "Pause" : "Play"}</Text>
      </Pressable>
    </View>
  );
}
