import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { OnboardingPage } from '@/features/encore/onboarding/onboarding-ui'
import { getListenerPreferences, saveListenerPreferences } from '@/features/encore/onboarding/preferences'
import { encoreColors as c } from '@/features/encore/ui/tokens'

const languages = [
  { name: 'English', native: 'English', code: 'EN' },
  { name: 'Spanish', native: 'Español', code: 'ES' },
  { name: 'French', native: 'Français', code: 'FR' },
  { name: 'German', native: 'Deutsch', code: 'DE' },
  { name: 'Japanese', native: '日本語', code: 'JA' },
  { name: 'Korean', native: '한국어', code: 'KO' },
  { name: 'Hindi', native: 'हिन्दी', code: 'HI' },
] as const

export default function AppLanguage() {
  const router = useRouter()
  const [selected, setSelected] = useState(getListenerPreferences().appLanguage)
  function next() { saveListenerPreferences({ appLanguage: selected }); router.push('/onboarding/music-languages') }
  return <OnboardingPage step={1} title="APP LANGUAGE" eyebrow="LANGUAGE PREFERENCE" question="Which language should Encore use?" description="Select your preferred interface language. You can change this later in your profile." action="Continue" onContinue={next} onSkip={next}>
    <View style={{ gap: 10 }}>
      {languages.map((language) => {
        const isSelected = selected === language.name
        return (
          <Pressable key={language.code} onPress={() => setSelected(language.name)} accessibilityRole="radio" accessibilityState={{ checked: isSelected }} style={{ minHeight: 68, borderRadius: 18, backgroundColor: isSelected ? c.white : c.white, borderWidth: 1, borderColor: isSelected ? c.berry : c.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isSelected ? c.berry : c.oat, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: isSelected ? c.berryDark : c.muted, fontWeight: '700' }}>{language.code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700' }}>{language.name}</Text>
              <Text style={{ color: c.muted }}>{language.native}</Text>
            </View>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: isSelected ? c.berry : 'transparent', borderWidth: isSelected ? 0 : 2, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}>
              {isSelected && <Ionicons name="checkmark" size={16} color={c.berryDark} />}
            </View>
          </Pressable>
        )
      })}
    </View>
    <View style={{ backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, flexDirection: 'row', gap: 12 }}>
      <Ionicons name="musical-note" size={22} color={c.berry} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontWeight: '700' }}>Original liner notes stay intact</Text>
        <Text style={{ color: c.muted, lineHeight: 20 }}>Lyrics and artist essays remain in their original language. Interface translations are still in development.</Text>
      </View>
    </View>
  </OnboardingPage>
}
