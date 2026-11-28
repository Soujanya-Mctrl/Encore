import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#151725" },
          headerTintColor: "#FFFFFF",
          contentStyle: { backgroundColor: "#151725" }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="studio/campaigns" options={{ title: "Artist Studio · Campaigns" }} />
      </Stack>
    </>
  );
}
