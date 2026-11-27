import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tracks } from '@/features/encore/fixtures'
import { AlbumArt } from '@/features/encore/ui/album-art'
import { encoreColors as c } from '@/features/encore/ui/tokens'
import { saveListenerPreferences } from '@/features/encore/onboarding/preferences'

export default function Welcome() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const spotlight = tracks[1]
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 20, gap: 28 }}>
    <Text style={{ color: c.berry, fontSize: 28, fontWeight: '800' }}>Encore</Text>
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ borderRadius: 22, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, padding: 10, width: '100%', height: 290, overflow: 'hidden' }}>
        <View style={{ flex: 1, borderRadius: 15, overflow: 'hidden' }}>
          <AlbumArt track={spotlight} size="100%" radius={15} />
          <View style={{ position: 'absolute', left: 18, bottom: 16 }}>
            <Text style={{ color: c.lavender, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>FEATURED SAMPLE</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800' }}>Cosmic Resonance</Text>
          </View>
        </View>
      </View>
      <Text style={{ color: c.muted, fontSize: 13 }}>Aura Spectra · AI-assisted · Ambient</Text>
    </View>
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Text style={{ color: c.berry, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>PROVENANCE & DISCOVERY</Text>
      <Text style={{ color: c.ink, fontSize: 32, lineHeight: 39, textAlign: 'center', fontWeight: '800' }}>Find music worth coming back to.</Text>
      <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>Independent artists, clear creative context, and direct support. Make listening your own.</Text>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Benefit icon="finger-print-outline" title="Provenance" />
      <Benefit icon="disc-outline" title="Liner notes" />
      <Benefit icon="heart-outline" title="Direct support" />
    </View>
    <View style={{ gap: 10 }}>
      <Pressable onPress={() => router.push('/onboarding/language')} style={{ minHeight: 56, backgroundColor: c.berry, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
        <Text style={{ color: c.berryDark, fontWeight: '800', fontSize: 17 }}>Get started</Text>
        <Ionicons name="arrow-forward" size={20} color={c.berryDark} />
      </Pressable>
      <Pressable onPress={() => { saveListenerPreferences({ completed: true }); router.replace('/discover') }} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.muted, fontWeight: '600' }}>Browse as guest</Text>
      </Pressable>
    </View>
  </ScrollView>
}

function Benefit({ icon, title }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string }) {
  return (
    <View style={{ flex: 1, minHeight: 78, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <Ionicons name={icon} size={22} color={c.berry} />
      <Text style={{ color: c.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
    </View>
  )
}
