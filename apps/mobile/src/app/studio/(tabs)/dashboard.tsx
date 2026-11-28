import Ionicons from '@expo/vector-icons/Ionicons'
import { Link } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { studioColors as c } from '@/features/studio/data'
import { useStudioTracks } from '@/features/studio/use-studio-tracks'
import { ArtistAvatar, ReleaseRow, SectionTitle, StudioButton, StudioCard, StudioPage } from '@/features/studio/ui'

export default function Dashboard() {
  const { account, releases, loading, error, refresh, signIn } = useStudioTracks()
  const published = releases.filter((item) => item.status === 'Published')
  const needsEvidence = releases.find((item) => item.status === 'Needs evidence')
  return (
    <StudioPage title="Dashboard">
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.muted, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>
          CREATOR WORKSPACE
        </Text>
        <Text style={{ color: c.ink, fontSize: 30, fontWeight: '800' }}>Artist Studio</Text>
      </View>
      <StudioCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <ArtistAvatar size={68} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: c.ink, fontSize: 21, fontWeight: '800' }}>{account?.user.displayName ?? 'Artist Studio'}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {account ? `${account.user.roles.join(', ')} · Encore account` : 'Sign in to load your artist workspace'}
            </Text>
          </View>
          <Ionicons name="ribbon-outline" size={21} color={c.berry} />
        </View>
        {!account && <Pressable onPress={() => void signIn()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.berry, fontWeight: '800' }}>Sign in to Encore</Text></Pressable>}
      </StudioCard>
      {error ? <Pressable onPress={() => void refresh()}><Text style={{ color: '#D4515B' }}>{error} · Tap to retry</Text></Pressable> : null}
      {loading ? <Text style={{ color: c.muted }}>Loading your releases…</Text> : null}
      {needsEvidence && (
        <Link href={`/studio/release/${needsEvidence.id}`} asChild>
          <Pressable
            accessibilityRole="button"
            style={{
              backgroundColor: c.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#5B4520',
              padding: 16,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <Ionicons name="warning-outline" size={24} color="#F2BD4B" />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: c.ink, lineHeight: 21 }}>
                <Text style={{ color: '#F2BD4B', fontWeight: '800' }}>Attention needed: </Text>
                {needsEvidence.title} needs source evidence for review.
              </Text>
              <Text style={{ color: '#F2BD4B', fontWeight: '700', fontSize: 13 }}>View release →</Text>
            </View>
          </Pressable>
        </Link>
      )}
      <StudioCard>
        <Text style={{ color: c.ink, fontSize: 21, fontWeight: '800' }}>Release overview</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Overview label="Total releases" value={releases.length} />
          <Overview label="Published" value={published.length} />
          <Overview label="In review" value={releases.filter((item) => item.status === 'In review').length} />
        </View>
        <Text style={{ color: c.muted, fontSize: 12 }}>Playback and earnings analytics will appear when those projections are available.</Text>
      </StudioCard>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Latest published" action="View all content" href="/studio/content?filter=Published" />
        {published.slice(0, 3).map((release) => (
          <ReleaseRow key={release.id} release={release} />
        ))}
        {!published.length && !loading ? <Text style={{ color: c.muted }}>No published releases yet.</Text> : null}
      </View>
      <StudioButton title="Upload new release" href="/studio/upload" />
    </StudioPage>
  )
}

function Overview({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        padding: 13,
        gap: 6,
      }}
    >
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: c.ink, fontSize: 27, fontWeight: '800' }}>{value.toLocaleString()}</Text>
    </View>
  )
}
