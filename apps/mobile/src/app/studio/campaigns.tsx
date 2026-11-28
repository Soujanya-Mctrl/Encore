import React from "react";
import { ScrollView, Text, View } from "react-native";

export default function StudioCampaignsScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#151725", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700" }}>
        Artist Studio · Pass Series & Campaigns
      </Text>
      <View
        style={{
          marginTop: 14,
          backgroundColor: "#1B1E30",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#2B304A"
        }}
      >
        <Text style={{ color: "#CBD5E1", fontSize: 13 }}>
          Create finite Supporter Pass series (5% primary fee, 10% resale artist fee) or devnet
          campaign escrow goals bound to your active Music Passport version.
        </Text>
      </View>
    </ScrollView>
  );
}
