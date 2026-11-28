import Ionicons from '@expo/vector-icons/Ionicons'
import { Tabs } from 'expo-router/js-tabs'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function Layout() {
  const insets = useSafeAreaInsets()
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
