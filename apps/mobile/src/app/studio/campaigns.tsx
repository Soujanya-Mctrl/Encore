import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { encoreApiFetch } from "../../lib/api-client";

export default function StudioCampaignsScreen() {
  const [milestoneId, setMilestoneId] = useState("");
  const [evidenceUri, setEvidenceUri] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submitMilestone() {
    try {
      setMessage(null);
      await encoreApiFetch("/api/v1/campaigns/milestones", {
        method: "POST",
        body: JSON.stringify({ milestoneId, evidenceUri })
      });
      setMessage("Milestone evidence submitted for review");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to submit milestone evidence");
    }
  }

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
          borderColor: "#2B304A",
          gap: 10
        }}
      >
        <Text style={{ color: "#CBD5E1", fontSize: 13 }}>
          Create finite Supporter Pass series (5% primary fee, 10% resale artist fee) or devnet
          campaign escrow goals bound to your active Music Passport version.
        </Text>
        <Text style={{ color: "#FFFFFF", fontWeight: "700", marginTop: 8 }}>
          Submit Milestone Evidence
        </Text>
        <TextInput
          value={milestoneId}
          onChangeText={setMilestoneId}
          placeholder="Milestone ID"
          placeholderTextColor="#64748B"
          style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
        />
        <TextInput
          value={evidenceUri}
          onChangeText={setEvidenceUri}
          placeholder="https://... evidence URL"
          placeholderTextColor="#64748B"
          style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          onPress={() => void submitMilestone()}
          style={{ backgroundColor: "#2563EB", borderRadius: 8, padding: 10, alignItems: "center" }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Submit Evidence</Text>
        </Pressable>
        {message ? <Text style={{ color: "#4ED9C8", fontSize: 12 }}>{message}</Text> : null}
      </View>
    </ScrollView>
  );
}
