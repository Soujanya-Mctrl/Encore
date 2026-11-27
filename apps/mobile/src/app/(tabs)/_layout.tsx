import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { encoreColors as c } from '@/features/encore/ui/tokens'
import { tracks } from '@/features/encore/fixtures'
import { AlbumArt } from '@/features/encore/ui/album-art'

export default function Layout() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  return <Tabs tabBar={({ state, navigateToTab }) => {
    const active = state.routes[state.index]?.name
    const items = [
      { name: 'discover', icon: 'home-outline', selected: 'home' },
      { name: 'wallet', icon: 'disc-outline', selected: 'disc' },
      { name: 'search', icon: 'search', selected: 'search' },
      { name: 'passes', icon: 'heart-outline', selected: 'heart' },
      { name: 'profile', icon: 'person-outline', selected: 'person' },
    ] as const
    return <View style={{ backgroundColor: c.bg, paddingBottom: Math.max(insets.bottom, 8) }}>
      <Pressable onPress={() => router.push('/player/solar')} accessibilityLabel="Open sample player" style={{ height: 66, marginHorizontal: 16, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 }}>
        <AlbumArt track={tracks[3]} size={44} radius={10} />
        <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '700', fontSize: 15 }}>Solar Drift</Text><Text style={{ color: c.muted, fontSize: 13 }}>Maya Lin · Sample preview</Text></View>
        <Ionicons name="play-circle" size={36} color={c.berry} />
      </Pressable>
      <View style={{ height: 64, marginHorizontal: 16, borderRadius: 32, borderWidth: 1, borderColor: c.border, backgroundColor: '#16161D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6 }}>
        {items.map((item) => {
          const selected = active === item.name
          return <Pressable key={item.name} accessibilityRole="tab" accessibilityLabel={item.name === 'wallet' ? 'Wallet' : item.name} accessibilityState={{ selected }} onPress={() => { const route = state.routes.find((entry) => entry.name === item.name); if (route) navigateToTab(route.key) }} style={{ flex: 1, height: 50, justifyContent: 'center', alignItems: 'center' }}>
            <View style={selected ? { width: 44, height: 44, borderRadius: 22, backgroundColor: c.berry, justifyContent: 'center', alignItems: 'center' } : { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name={(selected ? item.selected : item.icon) as React.ComponentProps<typeof Ionicons>['name']} size={22} color={selected ? c.berryDark : c.muted} />
            </View>
          </Pressable>
        })}
      </View>
    </View>
  }} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, tabBarHideOnKeyboard: true }}>
    <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
    <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
    <Tabs.Screen name="search" options={{ title: 'Search' }} />
    <Tabs.Screen name="passes" options={{ title: 'Passes' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    <Tabs.Screen name="tools" options={{ href: null }} />
    <Tabs.Screen name="settings" options={{ href: null }} />
  </Tabs>
}
