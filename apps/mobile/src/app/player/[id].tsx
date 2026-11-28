import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { readTrack } from "@/features/music/api";
import { useMusic } from "@/features/music/player";
import { useEncoreAccount } from "@/features/music/account";
import { Action, Heading, MusicPage, Note, elapsed } from "@/features/music/ui";
import { encoreColors as c } from "@/features/encore/ui/tokens";

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, account } = useEncoreAccount();
  const player = useMusic();
  const previousActive = useRef(player.track?.id);
  useEffect(() => {
    if (previousActive.current === id && player.track?.id && player.track.id !== id) {
      router.replace(`/player/${player.track.id}`);
    }
    previousActive.current = player.track?.id;
  }, [id, player.track?.id, router]);
  const active = player.track?.id === id;
  const detail = useQuery({ queryKey: ["track", id, account?.user.id], queryFn: () => readTrack(id, token), enabled: !active, retry: false });
  const track = active ? player.track : detail.data?.track;
  return <MusicPage>
    <Heading>{track?.title ?? "Preview player"}</Heading>
    {track && <Note>{track.artistName}</Note>}
    {detail.isFetching && !track && <Note>Loading Passport…</Note>}
    {detail.isError && !track && <><Note>{detail.error.message}</Note><Action label="Retry track" run={() => void detail.refetch()} /></>}
    {track?.rights.preview ? <>
      {active && <>
        <Note>{elapsed(player.position)} / {elapsed(player.duration)}</Note>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: c.border, overflow: "hidden" }}>
          <View style={{ height: 5, backgroundColor: c.berry, width: `${Math.min(100, player.duration ? player.position / player.duration * 100 : 0)}%` }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Action label="Back 10 seconds" run={() => player.seek(player.position - 10)} disabled={!player.duration} />
          <Action label="Forward 10 seconds" run={() => player.seek(player.position + 10)} disabled={!player.duration} />
        </View>
      </>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Action label="Previous" run={() => player.move(-1)} disabled={!active || !player.hasPrevious} />
        <Action label={active && player.pending ? "Loading…" : active && player.playing ? "Pause" : "Play preview"}
          run={() => active ? player.toggle() : player.select(track)} disabled={active && player.pending} />
        <Action label="Next" run={() => player.move(1)} disabled={!active || !player.hasNext} />
      </View>
      {active && player.error && <Note>{player.error}</Note>}
    </> : track && <Note>Preview unavailable for this release.</Note>}
    <Link href={`/track/${track?.id ?? id}`} style={{ color: c.berry }}>View Music Passport</Link>
    <Link href="/discover" style={{ color: c.berry }}>Back to Discover</Link>
  </MusicPage>;
}
