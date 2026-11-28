import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { ScrollView, Pressable, Text, TextInput, View } from 'react-native'
import { studioColors as c } from '@/features/studio/data'
import { toStudioRelease, useStudioTracks } from '@/features/studio/use-studio-tracks'
import {
  StudioPage,
  ReleaseRow,
  SectionTitle,
  StudioButton,
  StudioCard,
  StudioCover,
  StudioStatus,
} from '@/features/studio/ui'

const filters = ['All', 'Published', 'In review', 'Drafts'] as const
type Filter = (typeof filters)[number]
export default function Content() {
  const router = useRouter()
  const { tracks, loading, error, refresh, account, signIn } = useStudioTracks()
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>()
  const [query, setQuery] = useState('')
  const filter: Filter = filters.includes(filterParam as Filter) ? (filterParam as Filter) : 'All'
  const shown = tracks.map(toStudioRelease).filter((release) => {
    const statusMatches =
      filter === 'All' ||
      (filter === 'Drafts'
        ? release.status === 'Draft'
        : filter === 'In review'
          ? release.status === 'In review' || release.status === 'Needs evidence'
          : release.status === 'Published')
    return statusMatches && `${release.title} ${release.kind}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  return (
    <StudioPage title="Content">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput
          accessibilityLabel="Search releases"
          value={query}
          onChangeText={setQuery}
          placeholder="Search catalog or title..."
          placeholderTextColor={c.muted}
          style={{
            flex: 1,
            minHeight: 48,
            backgroundColor: c.card,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: 14,
            paddingHorizontal: 14,
            color: c.ink,
          }}
        />
        <StudioButton title="+ New" href="/studio/upload" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {filters.map((item) => (
          <Pressable
            key={item}
            onPress={() => router.setParams({ filter: item })}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item }}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              borderRadius: 22,
              paddingHorizontal: 16,
              backgroundColor: filter === item ? c.berry : c.oat,
            }}
          >
            <Text style={{ color: filter === item ? c.berryDark : c.ink, fontWeight: '700' }}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <SectionTitle title={`${shown.length} releases`} />
      {!account && <Pressable onPress={() => void signIn()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: c.berry, fontWeight: '800' }}>Sign in to load your releases</Text></Pressable>}
      {account && error ? <Pressable onPress={() => void refresh()}><Text style={{ color: '#D4515B' }}>{error} · Tap to retry</Text></Pressable> : null}
      {loading ? <Text style={{ color: c.muted }}>Loading releases…</Text> : null}
      <View style={{ gap: 10 }}>
        {shown.map((release) =>
          release.status === 'Needs evidence' ? (
            <StudioCard key={release.id}>
              <Link href={`/studio/release/${release.id}`} asChild>
                <Pressable accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <StudioCover release={release} size={62} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: c.ink, fontSize: 18, fontWeight: '800' }}>{release.title}</Text>
                    <StudioStatus status={release.status} />
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      {release.kind} · {release.date}
                    </Text>
                  </View>
                  <Ionicons name="ellipsis-vertical" size={20} color={c.muted} />
                </Pressable>
              </Link>
              <View
                style={{
                  backgroundColor: c.bg,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 12,
                  flexDirection: 'row',
                  gap: 9,
                }}
              >
                <Ionicons name="chatbox-ellipses-outline" size={19} color="#F2BD4B" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: c.ink, fontWeight: '700' }}>Curator review note</Text>
                  <Text style={{ color: c.muted, lineHeight: 19 }}>{release.note}</Text>
                  <Link href={`/studio/release/${release.id}`} style={{ color: c.berry, fontWeight: '700' }}>
                    View review history →
                  </Link>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: c.bg,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 12,
                  gap: 10,
                }}
              >
                <Text style={{ color: c.berry, fontSize: 12, fontWeight: '800' }}>MUSIC PASSPORT</Text>
                <Info label="Creation origin" value={release.origin} />
                <Info label="Provenance evidence" value={release.evidence} />
                <Info label="Catalog rights" value={release.rights} />
              </View>
              <StudioButton title="Review evidence requirements" href={`/studio/release/${release.id}`} />
            </StudioCard>
          ) : (
            <ReleaseRow key={release.id} release={release} />
          ),
        )}
        {shown.length === 0 && (
          <Text style={{ color: c.muted, paddingVertical: 24 }}>No releases match. Try another title or status.</Text>
        )}
      </View>
      <StudioCard>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name="shield-checkmark-outline" size={26} color={c.berry} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.ink, fontWeight: '800' }}>Artist Music Passports</Text>
            <Text style={{ color: c.muted, lineHeight: 19 }}>
              Origin, evidence, and rights stay distinct for every release version.
            </Text>
          </View>
        </View>
      </StudioCard>
    </StudioPage>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: c.ink, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}
