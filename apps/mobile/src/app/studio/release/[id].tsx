import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { StudioTrack } from '@encore/contracts'
import { useEncoreAccount } from '@/features/music/account'
import { getStudioTrack } from '@/lib/encore-studio'
import { studioColors as c } from '@/features/studio/data'
import { toStudioRelease } from '@/features/studio/use-studio-tracks'
import { StudioPage, StudioCard, StudioCover, StudioStatus } from '@/features/studio/ui'

const sections = ['Overview', 'Music Passport', 'Review history'] as const
export default function ReleaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { token, account, signIn } = useEncoreAccount()
  const [track, setTrack] = useState<StudioTrack | null>(null)
  const [history, setHistory] = useState<{ manifest: StudioTrack['manifest']; manifest_hash: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [section, setSection] = useState<(typeof sections)[number]>('Overview')
  useEffect(() => {
    let active = true
    if (!account || !id) { setLoading(false); return }
    setLoading(true)
    void getStudioTrack(id, token).then((result) => {
      if (active) { setTrack(result.track); setHistory(result.history); setError('') }
    }).catch((failure) => {
      if (active) setError(failure instanceof Error ? failure.message : 'Could not load release')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [account, id, token])
  const release = track ? toStudioRelease(track) : null
  return (
    <StudioPage title="Release detail" back>
      {!account ? (
        <Pressable onPress={() => void signIn()}><Text style={{ color: c.berry }}>Sign in to view this release.</Text></Pressable>
      ) : loading ? <Text style={{ color: c.muted }}>Loading release…</Text> : error ? (
        <Text style={{ color: '#D4515B' }}>{error}</Text>
      ) : !release || !track ? (
        <Text style={{ color: c.muted }}>Release not found.</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <StudioCover release={release} size={80} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 22, fontWeight: '700' }}>{release.title}</Text>
              <Text style={{ color: c.muted }}>
                {release.kind} · {release.date}
              </Text>
              <StudioStatus status={release.status} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            {sections.map((item) => (
              <Pressable
                key={item}
                onPress={() => setSection(item)}
                accessibilityRole="tab"
                accessibilityState={{ selected: section === item }}
                style={{
                  flex: 1,
                  backgroundColor: section === item ? c.berry : c.oat,
                  minHeight: 48,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: section === item ? c.berryDark : c.ink,
                    fontSize: 12,
                    fontWeight: '700',
                    textAlign: 'center',
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          {section === 'Overview' ? (
            <StudioCard>
              <Row label="Status" value={release.status} />
              <Row label="Preview plays" value={release.plays?.toLocaleString() ?? 'Unavailable'} />
              <Row label="Listeners" value={release.listeners?.toLocaleString() ?? 'Unavailable'} />
              <Row label="Passport version" value={String(track.manifest.version)} />
              <Row label="Audio SHA-256" value={track.audioHash} />
              <Row label="Manifest SHA-256" value={track.manifestHash} />
            </StudioCard>
          ) : section === 'Music Passport' ? (
            <StudioCard>
              <Row label="Creative origin" value={release.origin} />
              <Row label="Evidence" value={release.evidence} />
              <Row label="Rights" value={release.rights} />
              <Text style={{ color: c.muted }}>
                The immutable Passport revision records creation origin, evidence and rights independently.
              </Text>
            </StudioCard>
          ) : (
            <StudioCard>
              <Text style={{ color: c.ink, fontWeight: '700' }}>Review history</Text>
              {history.length === 0 ? <Text style={{ color: c.muted }}>No earlier Passport revisions.</Text> : history.map((revision) => (
                <View key={revision.manifest_hash} style={{ gap: 3, paddingVertical: 6 }}>
                  <Text style={{ color: c.ink, fontWeight: '700' }}>Passport v{revision.manifest.version}</Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>{revision.manifest_hash}</Text>
                </View>
              ))}
            </StudioCard>
          )}
        </>
      )}
    </StudioPage>
  )
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 4, paddingVertical: 6 }}>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: c.ink, fontWeight: '700' }}>{value}</Text>
    </View>
  )
}
