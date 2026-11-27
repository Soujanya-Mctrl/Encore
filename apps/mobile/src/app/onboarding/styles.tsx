import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { OnboardingPage } from '@/features/encore/onboarding/onboarding-ui'
import { getListenerPreferences, saveListenerPreferences } from '@/features/encore/onboarding/preferences'
import { AlbumArt } from '@/features/encore/ui/album-art'
import { encoreColors as c } from '@/features/encore/ui/tokens'
import { tracks } from '@/features/encore/fixtures'

const styles = ['Indie', 'Hip-hop', 'Electronic', 'Pop', 'R&B', 'Rock', 'Classical', 'Folk', 'Lo-fi', 'Ambient', 'Neoclassical']

export default function MusicStyles() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(getListenerPreferences().musicStyles)
  function finish(skip = false) { saveListenerPreferences({ musicStyles: skip ? [] : selected, completed: true }); router.replace('/discover') }
  function toggle(name: string) { setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]) }
  return <OnboardingPage step={3} title="MUSIC STYLES" eyebrow={`TUNING PROFILE · ${selected.length} SELECTED`} question="What sounds like you?" description="Pick at least 3 styles to shape your discovery feed." action="Start listening" disabled={selected.length < 3} onContinue={() => finish()} onSkip={() => finish(true)}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
      {styles.map((style) => {
        const active = selected.includes(style)
        return (
          <Pressable key={style} onPress={() => toggle(style)} accessibilityRole="checkbox" accessibilityState={{ checked: active }} style={{ minHeight: 50, borderRadius: 16, paddingHorizontal: 16, backgroundColor: active ? c.berry : c.white, borderWidth: 1, borderColor: active ? c.berry : c.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {active && <Ionicons name="checkmark-circle" size={18} color={c.berryDark} />}
            <Text style={{ color: active ? c.berryDark : c.ink, fontSize: 15, fontWeight: active ? '700' : '600' }}>{style}</Text>
          </Pressable>
        )
      })}
    </View>
    <View style={{ backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, gap: 12 }}>
      <Text style={{ color: c.berry, fontWeight: '700', fontSize: 12 }}>A STARTING POINT FOR YOUR MIX</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AlbumArt track={tracks[0]} size={62} radius={12} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.muted, fontSize: 11 }}>SAMPLE TRACK</Text>
          <Text style={{ color: c.ink, fontWeight: '700', fontSize: 17 }}>Echoes of Stone</Text>
          <Text style={{ color: c.muted }}>Julian Vance · Classical</Text>
        </View>
        <Ionicons name="pulse" size={23} color={c.berry} />
      </View>
    </View>
    <Text style={{ color: c.muted, textAlign: 'center', fontSize: 12 }}>Discovery is a sample catalog today. Your choices are saved for future personalization.</Text>
  </OnboardingPage>
}
