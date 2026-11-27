import Ionicons from '@expo/vector-icons/Ionicons'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { tracks } from '@/features/encore/fixtures'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function Lyrics() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const track = tracks.find((item) => item.id === id)
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 18, paddingBottom: 60, gap: 28 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back to player" style={{ width: 44, height: 44, justifyContent: 'center' }}>
        <Ionicons name="chevron-down" size={24} color={c.ink} />
      </Pressable>
      <View>
        <Text style={{ color: c.muted, fontSize: 12 }}>NOW PLAYING</Text>
        <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700' }}>{track?.title ?? 'Track'}</Text>
      </View>
    </View>
    <View style={{ minHeight: 360, borderRadius: 24, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, padding: 26, justifyContent: 'center', gap: 16 }}>
      <Ionicons name="document-text-outline" size={36} color={c.berry} />
      <Text style={{ color: c.ink, fontSize: 27, fontWeight: '800' }}>Lyrics are not available yet.</Text>
      <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24 }}>Artist supplied lyrics and synchronized lines will appear here when they are licensed for display. This sample has no lyrics attached.</Text>
    </View>
    {track && (
      <Link href={`/track/${track.id}`} asChild>
        <Pressable style={{ borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.oat, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.ink, fontWeight: '700' }}>View Music Passport</Text>
        </Pressable>
      </Link>
    )}
  </ScrollView>
}
