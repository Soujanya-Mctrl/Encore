import '../global.css'

import { Stack } from 'expo-router'
import { AppProviders } from '@/features/core/data-access/app-providers'

export default function RootLayout() {
  return <AppProviders><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /><Stack.Screen name="(tabs)" /><Stack.Screen name="track/[id]" /><Stack.Screen name="player/[id]" /><Stack.Screen name="support/[id]" /><Stack.Screen name="recommendations/[id]" /><Stack.Screen name="lyrics/[id]" /><Stack.Screen name="studio" /><Stack.Screen name="onboarding" /></Stack></AppProviders>
}
