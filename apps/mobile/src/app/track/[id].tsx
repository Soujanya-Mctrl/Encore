import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, Text, View, Pressable } from 'react-native'
import { tracks, originLabel } from '@/features/encore/fixtures'
import { AlbumArt } from '@/features/encore/ui/album-art'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function TrackDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const track = tracks.find((item) => item.id === id)
  if (!track) return <View style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}><Text style={{ color: c.ink }}>Track not found</Text></View>
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 20 }}>
    <Pressable onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: c.berry, fontSize: 16, fontWeight: '700' }}>‹ Discover</Text>
    </Pressable>
    <View style={{ height: 270, borderRadius: 20, backgroundColor: track.color, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
      <AlbumArt track={track} size="100%" radius={20} />
      <View style={{ position: 'absolute', left: 20, bottom: 20, right: 20 }}>
        <Text style={{ color: '#fff', fontSize: 29, fontWeight: '800' }}>{track.title}</Text>
        <Text style={{ color: '#D4D4D8', fontSize: 17 }}>{track.artist}</Text>
      </View>
    </View>
    <Text style={{ color: c.muted, fontSize: 14 }}>{track.genre} · {track.duration} · Preview fixture</Text>
    <Link href={`/player/${track.id}`} asChild>
      <Pressable style={{ backgroundColor: c.berry, borderRadius: 16, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.berryDark, fontWeight: '800', fontSize: 16 }}>Open Player</Text>
      </Pressable>
    </Link>
    <Link href={`/support/${track.id}`} asChild>
      <Pressable style={{ borderColor: c.border, borderWidth: 1, backgroundColor: c.white, borderRadius: 16, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.berry, fontWeight: '700', fontSize: 16 }}>Support {track.artist}</Text>
      </Pressable>
    </Link>
    <View style={{ backgroundColor: c.white, borderColor: c.border, borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 }}>
      <Text style={{ color: c.ink, fontSize: 21, fontWeight: '700' }}>Music Passport</Text>
      <Text style={{ color: c.muted, fontSize: 14 }}>Creative context and permissions for this track.</Text>
      <View style={{ backgroundColor: c.paleTeal, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 }}>
        <Text style={{ color: c.berry, fontWeight: '700', fontSize: 12 }}>ORIGIN</Text>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600', marginTop: 2 }}>{originLabel(track.origin)}</Text>
      </View>
      <View style={{ backgroundColor: c.paleTeal, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 }}>
        <Text style={{ color: c.teal, fontWeight: '700', fontSize: 12 }}>EVIDENCE</Text>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600', marginTop: 2 }}>{track.evidence.replaceAll('_', ' ').toLowerCase()}</Text>
      </View>
      <View style={{ backgroundColor: c.paleBlue, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 }}>
        <Text style={{ color: c.lavender, fontWeight: '700', fontSize: 12 }}>RIGHTS</Text>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600', marginTop: 2 }}>{track.rights.replaceAll('_', ' ').toLowerCase()}</Text>
      </View>
    </View>
    <View style={{ backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 18, gap: 8 }}>
      <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700' }}>Contributor notes</Text>
      <Text style={{ color: c.muted, fontSize: 14 }}>Contributor details and version history will appear when a verified passport is available.</Text>
    </View>
    <View style={{ backgroundColor: c.oat, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16 }}>
      <Text style={{ color: c.berry, fontWeight: '700' }}>Sample passport</Text>
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>No manifest hash or signer is claimed for this fixture.</Text>
    </View>
  </ScrollView>
}
