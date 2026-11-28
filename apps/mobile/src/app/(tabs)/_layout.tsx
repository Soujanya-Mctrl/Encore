import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#151725" },
        headerTintColor: "#FFFFFF",
        tabBarStyle: { backgroundColor: "#1B1E30", borderTopColor: "#2B304A" },
        tabBarActiveTintColor: "#A99BFF",
        tabBarInactiveTintColor: "#94A3B8"
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
      <Tabs.Screen name="marketplace" options={{ title: "Marketplace" }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio" }} />
    </Tabs>
  );
}
