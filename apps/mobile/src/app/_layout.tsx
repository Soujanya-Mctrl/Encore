import '../global.css'

import { MusicProvider, MiniPlayer } from '@/features/music/player'
import { EncoreAccountProvider } from '@/features/music/account'
import { Stack } from 'expo-router'
import { AppProviders } from '@/features/core/data-access/app-providers'

export default function RootLayout() {
  return <AppProviders><EncoreAccountProvider><MusicProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /><Stack.Screen name="(tabs)" /><Stack.Screen name="track/[id]" /><Stack.Screen name="player/[id]" /><Stack.Screen name="support/[id]" /><Stack.Screen name="recommendations/[id]" /><Stack.Screen name="lyrics/[id]" /><Stack.Screen name="studio" /><Stack.Screen name="onboarding" /></Stack><MiniPlayer /></MusicProvider></EncoreAccountProvider></AppProviders>
}
