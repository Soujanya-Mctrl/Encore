import React from "react";
import { ScrollView, Text, View } from "react-native";

export default function PortfolioScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#151725", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "700" }}>Your Portfolio</Text>
      <Text style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>
        Owned Supporter Passes, fixed-price resale listings, campaign pledges, distribution claims,
        and Solana Explorer receipts.
      </Text>
      <View
        style={{
          marginTop: 16,
          backgroundColor: "#1B1E30",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#2B304A"
        }}
      >
        <Text style={{ color: "#CBD5E1", fontSize: 13 }}>
          Sign in via Pollar or connect a Solana Wallet Standard / Mobile Wallet Adapter wallet to
          manage passes and redeem creator deliverables.
        </Text>
      </View>
    </ScrollView>
  );
}
