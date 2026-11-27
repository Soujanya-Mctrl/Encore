import Ionicons from '@expo/vector-icons/Ionicons'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { originLabel, tracks } from '@/features/encore/fixtures'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function Recommendations() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const current = tracks.find((track) => track.id === id)
  const recommendations = tracks.filter((track) => track.id !== id)
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 24 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back to player" style={{ width: 44, height: 44, justifyContent: 'center' }}>
        <Ionicons name="arrow-back" size={24} color={c.ink} />
      </Pressable>
      <Text style={{ color: c.ink, fontSize: 22, fontWeight: '700' }}>More music</Text>
    </View>
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.ink, fontSize: 28, fontWeight: '800' }}>Keep listening</Text>
      <Text style={{ color: c.muted, lineHeight: 21 }}>Explore the sample catalog{current ? ` after ${current.title}` : ''}. Choose by sound and creative context.</Text>
    </View>
    <View style={{ gap: 10 }}>
      {recommendations.map((track) => (
        <Link href={`/track/${track.id}`} key={track.id} asChild>
          <Pressable style={{ backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 62, height: 62, backgroundColor: track.color, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }}>
              <Text style={{ color: '#fff', fontSize: 28 }}>♫</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>{track.title}</Text>
              <Text style={{ color: c.muted }}>{track.artist}</Text>
              <Text style={{ color: c.berry, fontSize: 12, fontWeight: '600' }}>{originLabel(track.origin)} · {track.evidence.replaceAll('_', ' ').toLowerCase()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.muted} />
          </Pressable>
        </Link>
      ))}
    </View>
    <Text style={{ color: c.muted, fontSize: 12 }}>Sample catalog. Matches and playback recommendations are not personalized yet.</Text>
  </ScrollView>
}
