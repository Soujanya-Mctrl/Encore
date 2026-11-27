import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { OnboardingPage } from '@/features/encore/onboarding/onboarding-ui'
import { getListenerPreferences, saveListenerPreferences } from '@/features/encore/onboarding/preferences'
import { encoreColors as c } from '@/features/encore/ui/tokens'

const languages = [
  { name: 'English', native: 'English' }, { name: 'Hindi', native: 'हिन्दी' }, { name: 'Tamil', native: 'தமிழ்' }, { name: 'Telugu', native: 'తెలుగు' }, { name: 'Punjabi', native: 'ਪੰਜਾਬੀ' }, { name: 'Malayalam', native: 'മലയാളം' }, { name: 'Korean', native: '한국어' }, { name: 'Spanish', native: 'Español' }, { name: 'Japanese', native: '日本語' }, { name: 'French', native: 'Français' },
]

export default function MusicLanguages() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(getListenerPreferences().musicLanguages)
  function next() { saveListenerPreferences({ musicLanguages: selected }); router.push('/onboarding/styles') }
  function toggle(name: string) { setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]) }
  return <OnboardingPage step={2} title="MUSIC LANGUAGES" eyebrow="ACOUSTIC PALETTE" question="What languages do you listen in?" description="Select all that speak to you. Your choices will guide music discovery as the catalog grows." action="Continue to styles" onContinue={next} onSkip={next}>
    <Pressable onPress={() => setSelected([])} accessibilityRole="checkbox" accessibilityState={{ checked: selected.length === 0 }} style={{ backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: selected.length === 0 ? c.berry : c.border, padding: 16, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Ionicons name="globe-outline" size={26} color={selected.length === 0 ? c.berry : c.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700' }}>Any language</Text>
        <Text style={{ color: c.muted, lineHeight: 19 }}>Explore recordings worldwide</Text>
      </View>
      <Ionicons name={selected.length === 0 ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected.length === 0 ? c.berry : c.border} />
    </Pressable>
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.muted, fontWeight: '700', fontSize: 12 }}>REGIONAL & GLOBAL TONGUES</Text>
        <Text style={{ color: c.berry, fontSize: 12, fontWeight: '700' }}>{selected.length} selected</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {languages.map((language) => {
          const active = selected.includes(language.name)
          return (
            <Pressable key={language.name} onPress={() => toggle(language.name)} accessibilityRole="checkbox" accessibilityState={{ checked: active }} style={{ minHeight: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: active ? c.berry : c.white, borderWidth: 1, borderColor: active ? c.berry : c.border, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Ionicons name={active ? 'checkmark-circle' : 'add'} size={18} color={active ? c.berryDark : c.muted} />
              <View>
                <Text style={{ color: active ? c.berryDark : c.ink, fontWeight: '700', fontSize: 14 }}>{language.name}</Text>
                <Text style={{ color: active ? 'rgba(11, 11, 15, 0.7)' : c.muted, fontSize: 11 }}>{language.native}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
    <View style={{ backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, flexDirection: 'row', gap: 12 }}>
      <Ionicons name="disc-outline" size={24} color={c.berry} />
      <Text style={{ flex: 1, color: c.muted, lineHeight: 20 }}>Your language mix is saved on this device. You can adjust it later from your profile.</Text>
    </View>
  </OnboardingPage>
}
