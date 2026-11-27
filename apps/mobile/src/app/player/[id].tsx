import Ionicons from '@expo/vector-icons/Ionicons'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { originLabel, tracks } from '@/features/encore/fixtures'
import { AlbumArt } from '@/features/encore/ui/album-art'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function Player() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const track = tracks.find((item) => item.id === id)
  if (!track) return <View style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}><Text style={{ color: c.ink }}>Track not found.</Text></View>
  const next = tracks[(tracks.indexOf(track) + 1) % tracks.length]

  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 26 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable accessibilityLabel="Close player" onPress={() => router.back()} style={{ width: 44, height: 44, backgroundColor: c.oat, borderWidth: 1, borderColor: c.border, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="chevron-down" size={24} color={c.ink} />
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: c.muted, fontSize: 11, letterSpacing: 2, fontWeight: '700' }}>ENCORE PREVIEW</Text>
        <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700' }}>Now Playing</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>

    <View style={{ aspectRatio: 1, width: '100%', borderRadius: 24, backgroundColor: track.color, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
      <AlbumArt track={track} size="100%" radius={24} />
    </View>

    <View style={{ gap: 6 }}>
      <Text style={{ color: c.ink, fontSize: 29, fontWeight: '800' }}>{track.title}</Text>
      <Text style={{ color: c.muted, fontSize: 17 }}>{track.artist}</Text>
    </View>

    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <View style={{ backgroundColor: c.paleTeal, borderWidth: 1, borderColor: c.berry, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
        <Text style={{ color: c.berry, fontWeight: '700' }}>{originLabel(track.origin)}</Text>
      </View>
      <View style={{ backgroundColor: c.paleBlue, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
        <Text style={{ color: c.lavender, fontWeight: '600' }}>{track.rights.replaceAll('_', ' ').toLowerCase()}</Text>
      </View>
    </View>

    <View style={{ gap: 9 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden' }}>
        <View style={{ width: '35%', height: '100%', backgroundColor: c.berry, borderRadius: 3 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.muted, fontSize: 13 }}>1:12</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>{track.duration}</Text>
      </View>
    </View>

    <View style={{ alignItems: 'center', gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 36 }}>
        <Ionicons name="play-skip-back" size={26} color={c.muted} />
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.berry, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="pause" size={32} color={c.berryDark} />
        </View>
        <Ionicons name="play-skip-forward" size={26} color={c.muted} />
      </View>
      <Text style={{ color: c.muted, textAlign: 'center', fontSize: 13 }}>Audio preview will be available when the artist authorizes a playback URL.</Text>
    </View>

    <Link href={`/track/${track.id}`} asChild>
      <Pressable style={{ borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, minHeight: 52, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: c.ink, fontWeight: '700' }}>View Music Passport</Text>
      </Pressable>
    </Link>

    <Link href={`/support/${track.id}`} asChild>
      <Pressable style={{ borderRadius: 16, backgroundColor: c.berry, minHeight: 52, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: c.berryDark, fontWeight: '800', fontSize: 16 }}>Support {track.artist}</Text>
      </Pressable>
    </Link>

    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Link href={`/lyrics/${track.id}`} asChild>
        <Pressable style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, minHeight: 50, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: c.ink, fontWeight: '700' }}>Lyrics</Text>
        </Pressable>
      </Link>
      <Link href={`/recommendations/${track.id}`} asChild>
        <Pressable style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, minHeight: 50, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: c.ink, fontWeight: '700' }}>More music</Text>
        </Pressable>
      </Link>
    </View>

    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, padding: 16, gap: 10 }}>
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>UP NEXT</Text>
      <Link href={`/player/${next.id}`} asChild>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: next.color, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: '#fff', fontSize: 22 }}>♫</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: '700', fontSize: 15 }}>{next.title}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{next.artist}</Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 13 }}>{next.duration}</Text>
        </Pressable>
      </Link>
    </View>
  </ScrollView>
}
