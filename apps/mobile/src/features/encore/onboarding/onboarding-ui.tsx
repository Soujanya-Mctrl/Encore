import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import type { PropsWithChildren } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export function OnboardingPage({ step, title, eyebrow, question, description, onSkip, children, action, disabled = false, onContinue }: PropsWithChildren<{ step: 1 | 2 | 3; title: string; eyebrow: string; question: string; description: string; onSkip: () => void; action: string; disabled?: boolean; onContinue: () => void }>) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View style={{ height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Previous screen" style={{ width: 44, height: 44, justifyContent: 'center' }}>
        <Ionicons name="chevron-back" size={25} color={c.ink} />
      </Pressable>
      <Text style={{ color: c.ink, fontWeight: '700', letterSpacing: 1 }}>{title}</Text>
      <Pressable onPress={onSkip} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: c.muted, fontWeight: '700' }}>Skip</Text>
      </Pressable>
    </View>
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 22 }}>
      {[1, 2, 3].map((value) => (
        <View key={value} style={{ flex: 1, height: 5, borderRadius: 4, backgroundColor: value <= step ? c.berry : c.border }} />
      ))}
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 24 }}>
      <View style={{ gap: 10 }}>
        <Text style={{ color: c.berry, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{eyebrow}</Text>
        <Text style={{ color: c.ink, fontSize: 31, lineHeight: 38, fontWeight: '800' }}>{question}</Text>
        <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24 }}>{description}</Text>
      </View>
      {children}
    </ScrollView>
    <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: c.bg }}>
      <Pressable disabled={disabled} onPress={onContinue} accessibilityRole="button" accessibilityState={{ disabled }} style={{ minHeight: 56, borderRadius: 16, backgroundColor: disabled ? c.border : c.berry, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        <Text style={{ color: disabled ? c.muted : c.berryDark, fontSize: 17, fontWeight: '800' }}>{action}</Text>
        <Ionicons name="arrow-forward" size={20} color={disabled ? c.muted : c.berryDark} />
      </Pressable>
    </View>
  </View>
}
