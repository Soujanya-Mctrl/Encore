import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { encoreApiFetch } from "../../lib/api-client";
import { useTransactionLifecycle } from "../../features/marketplace/useTransactionLifecycle";

export default function PortfolioScreen() {
  const { txRecord, clear } = useTransactionLifecycle();
  const [passId, setPassId] = useState("");
  const [spotListingId, setSpotListingId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleAction(path: string, payload: Record<string, string>) {
    try {
      setStatusMessage(null);
      await encoreApiFetch(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setStatusMessage(`Submitted ${path}`);
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#151725", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "700" }}>Your Portfolio</Text>
      <Text style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>
        Owned Supporter Passes, fixed-price resale listings, campaign pledges, distribution claims,
        and Solana Explorer receipts.
      </Text>

      {txRecord && (
        <View
          style={{
            marginTop: 14,
            backgroundColor: "#1E293B",
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: "#38BDF8"
          }}
        >
          <Text style={{ color: "#38BDF8", fontWeight: "700", fontSize: 12 }}>
            TRANSACTION LIFECYCLE · {txRecord.state.toUpperCase()}
          </Text>
          <Text style={{ color: "#E2E8F0", fontSize: 12, marginTop: 4 }}>
            Kind: {txRecord.kind} · Intent: {txRecord.intentId}
          </Text>
          {txRecord.signature ? (
            <Text style={{ color: "#94A3B8", fontSize: 11, marginTop: 2 }}>
              Signature: {txRecord.signature}
            </Text>
          ) : null}
          <Pressable onPress={clear} style={{ marginTop: 8 }}>
            <Text style={{ color: "#7CB7FF", fontSize: 12, fontWeight: "600" }}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      <View
        style={{
          marginTop: 16,
          backgroundColor: "#1B1E30",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#2B304A",
          gap: 10
        }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
          Cancel Listings & Claim Refunds
        </Text>
        <TextInput
          value={passId}
          onChangeText={setPassId}
          placeholder="Pass ID to cancel listing"
          placeholderTextColor="#64748B"
          style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          onPress={() => void handleAction("/api/v1/passes/cancel-listing", { passId })}
          style={{ backgroundColor: "#2563EB", borderRadius: 8, padding: 10, alignItems: "center" }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Cancel Pass Listing</Text>
        </Pressable>

        <TextInput
          value={spotListingId}
          onChangeText={setSpotListingId}
          placeholder="Spot Listing ID to cancel"
          placeholderTextColor="#64748B"
          style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          onPress={() => void handleAction("/api/v1/spot/cancel", { spotListingId })}
          style={{ backgroundColor: "#2563EB", borderRadius: 8, padding: 10, alignItems: "center" }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Cancel Spot Listing</Text>
        </Pressable>

        <TextInput
          value={campaignId}
          onChangeText={setCampaignId}
          placeholder="Missed/Failed Campaign ID to refund"
          placeholderTextColor="#64748B"
          style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          onPress={() => void handleAction("/api/v1/campaigns/refund", { campaignId })}
          style={{ backgroundColor: "#0F766E", borderRadius: 8, padding: 10, alignItems: "center" }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Claim Campaign Refund</Text>
        </Pressable>

        {statusMessage ? (
          <Text style={{ color: "#4ED9C8", fontSize: 12 }}>{statusMessage}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
