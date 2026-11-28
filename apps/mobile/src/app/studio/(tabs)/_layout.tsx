import Ionicons from '@expo/vector-icons/Ionicons'
import { Tabs } from 'expo-router/js-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable, Text, View } from 'react-native'
import { studioColors as c } from '@/features/studio/data'

export default function StudioTabs() {
  const insets = useSafeAreaInsets()
  const tabs = [
    { name: 'dashboard', label: 'Dashboard', icon: 'grid-outline', active: 'grid' },
    { name: 'content', label: 'Content', icon: 'disc-outline', active: 'disc' },
    { name: 'analytics', label: 'Analytics', icon: 'stats-chart-outline', active: 'stats-chart' },
    { name: 'earn', label: 'Earn', icon: 'wallet-outline', active: 'wallet' },
  ] as const
  return (
    <Tabs
      tabBar={({ state, navigateToTab }) => (
        <View
          style={{
            backgroundColor: c.bg,
            paddingBottom: Math.max(insets.bottom, 8),
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          <View
            style={{
              height: 64,
              marginHorizontal: 16,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 6,
            }}
          >
            {tabs.map((tab) => {
              const selected = state.routes[state.index]?.name === tab.name
              return (
                <Pressable
                  key={tab.name}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    const route = state.routes.find((item) => item.name === tab.name)
                    if (route) navigateToTab(route.key)
                  }}
                  style={{ flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 2 }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: selected ? c.berry : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={(selected ? tab.active : tab.icon) as React.ComponentProps<typeof Ionicons>['name']}
                      size={22}
                      color={selected ? c.berryDark : c.muted}
                    />
                  </View>
                  <Text style={{ color: selected ? c.berry : c.muted, fontSize: 11, fontWeight: '700' }}>
                    {tab.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, tabBarHideOnKeyboard: true }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="content" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="earn" />
    </Tabs>
  )
}
