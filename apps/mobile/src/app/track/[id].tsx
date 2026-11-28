import { Link, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { readTrack } from "@/features/music/api";
import { useEncoreAccount } from "@/features/music/account";
import { MusicRights } from "@/features/music/rights";
import { Action, Heading, MusicPage, Note, elapsed, formatLabel } from "@/features/music/ui";
import { encoreColors as c } from "@/features/encore/ui/tokens";

export default function TrackDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, account } = useEncoreAccount();
  const query = useQuery({ queryKey: ["track", id, account?.user.id], queryFn: () => readTrack(id, token), retry: false });
  const track = query.data?.track;
  return <MusicPage>
    <Link href="/discover" style={{ color: c.berry }}>Discover</Link>
    <Heading>{track?.title ?? "Music Passport"}</Heading>
    {query.isPending && <Note>Loading track…</Note>}
    {query.isError && <><Note>{query.error.message}</Note><Action label="Retry track" run={() => void query.refetch()} /></>}
    {track && <>
      <Note>{track.artistName} · {track.genre} · {elapsed(track.durationSeconds)}</Note>
      {track.description && <Text style={{ color: c.ink }}>{track.description}</Text>}
      {track.rights.preview && <Link href={`/player/${track.id}`} style={{ color: c.berry, fontWeight: "700", paddingVertical: 12 }}>Open preview player</Link>}
      <View style={{ gap: 6, padding: 14, borderColor: c.border, borderWidth: 1, borderRadius: 14 }}>
        <Text style={{ color: c.ink, fontSize: 18, fontWeight: "700" }}>Music Passport v{track.manifest.version}</Text>
        <Note>Declared origin · {formatLabel(track.manifest.originCategory)}</Note>
        <Note>Evidence · {formatLabel(track.manifest.evidenceStatus)}</Note>
        {track.manifest.provenance && <Note>{formatLabel(track.manifest.provenance.outcome)}</Note>}
        {track.manifest.contributions.map((item, index) => <Note key={index}>{item.role} · {item.creatorRef} · {formatLabel(item.mode)}</Note>)}
        <Note>{query.data?.history.length ?? 0} recorded revisions</Note>
      </View>
      <MusicRights track={track} />
    </>}
  </MusicPage>;
}
