import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { EVIDENCE_STATUSES, ORIGIN_CATEGORIES, type EvidenceStatus, type OriginCategory } from "@encore/contracts";
import { encoreColors as c } from "@/features/encore/ui/tokens";
import { discover } from "./api";
import { useMusic } from "./player";
import { Action, Field, Heading, MusicPage, Note, elapsed, formatLabel } from "./ui";

export function DiscoveryScreen({ title }: { title: string }) {
  const [search, setSearch] = useState("");
  const [genreInput, setGenreInput] = useState("");
  const [q, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [origin, setOrigin] = useState<OriginCategory>();
  const [evidence, setEvidence] = useState<EvidenceStatus>();
  const [page, setPage] = useState(1);
  const player = useMusic();
  const result = useQuery({ queryKey: ["discovery", q, genre, origin, evidence, page],
    queryFn: ({ signal }) => discover({ q, genre, origin, evidence, page }, signal), retry: false });
  const runSearch = () => { setQuery(search.trim()); setGenre(genreInput.trim()); setPage(1); };

  return <MusicPage>
    <Heading>{title}</Heading>
    <Link href="/rights" style={{ color: c.berry }}>Rights workspace</Link>
    <Field label="Search tracks" value={search} onChangeText={setSearch} onSubmitEditing={runSearch} maxLength={120} placeholder="Title, artist, or genre" />
    <Field label="Genre filter" value={genreInput} onChangeText={setGenreInput} onSubmitEditing={runSearch} maxLength={60} />
    <Action label="Search catalog" run={runSearch} />
    <Note>Creative origin</Note>
    <ScrollView horizontal contentContainerStyle={{ gap: 7 }} keyboardShouldPersistTaps="handled">
      <Action label="All origins" selected={!origin} run={() => { setOrigin(undefined); setPage(1); }} />
      {ORIGIN_CATEGORIES.map((item) => <Action key={item} label={formatLabel(item)} selected={origin === item} run={() => { setOrigin(item); setPage(1); }} />)}
    </ScrollView>
    <Note>Evidence</Note>
    <ScrollView horizontal contentContainerStyle={{ gap: 7 }} keyboardShouldPersistTaps="handled">
      <Action label="All evidence" selected={!evidence} run={() => { setEvidence(undefined); setPage(1); }} />
      {EVIDENCE_STATUSES.map((item) => <Action key={item} label={formatLabel(item)} selected={evidence === item} run={() => { setEvidence(item); setPage(1); }} />)}
    </ScrollView>
    {result.isPending && <Note>Loading tracks…</Note>}
    {result.isError && <><Note>{result.error.message}</Note><Action label="Retry catalog" run={() => void result.refetch()} /></>}
    {result.data && <>
      <Note>{result.data.total} tracks</Note>
      {result.data.tracks.map((track) => <View key={track.id} style={{ gap: 8, backgroundColor: c.white, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 12 }}>
        <Link href={`/track/${track.id}`} asChild><Pressable style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: "700" }}>{track.title}</Text>
          <Text style={{ color: c.muted }}>{track.artistName} · {track.genre} · {elapsed(track.durationSeconds)}</Text>
        </Pressable></Link>
        <Note>{formatLabel(track.manifest.originCategory)} · {formatLabel(track.manifest.evidenceStatus)}</Note>
        {track.rights.preview ? <Action label="Play preview" run={() => player.select(track, result.data.tracks)} />
          : <Note>{track.rights.externalUrl ? "External licensing" : "Metadata only"}</Note>}
      </View>)}
      {result.data.tracks.length === 0 && <Note>No tracks match these filters.</Note>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {page > 1 && <Action label="Previous page" run={() => setPage(page - 1)} />}
        {result.data.total > page * 12 && <Action label="Next page" run={() => setPage(page + 1)} />}
      </View>
    </>}
  </MusicPage>;
}
