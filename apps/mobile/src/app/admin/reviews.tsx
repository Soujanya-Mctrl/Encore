import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { encoreApiFetch } from "../../lib/api-client";

type GovernanceTab = "terms" | "milestones" | "revenue";

export default function AdminReviewsScreen() {
  const [tab, setTab] = useState<GovernanceTab>("terms");
  const [targetId, setTargetId] = useState("");
  const [secondaryInput, setSecondaryInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function postGovernance(path: string, body: Record<string, unknown>) {
    try {
      setStatus(null);
      await encoreApiFetch(path, { method: "POST", body: JSON.stringify(body) });
      setStatus(`Completed ${path}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Governance action failed");
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#151725", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700" }}>
        Reviewer & Operator Queue
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        {(["terms", "milestones", "revenue"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              backgroundColor: tab === t ? "#2563EB" : "#1B1E30",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 12 }}>
              {t === "terms" ? "Campaign Terms" : t === "milestones" ? "Milestones" : "Revenue Cycle"}
            </Text>
          </Pressable>
        ))}
      </View>

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
        <TextInput
          value={targetId}
          onChangeText={setTargetId}
          placeholder={tab === "terms" ? "Campaign ID" : tab === "milestones" ? "Milestone ID" : "Cycle ID"}
          placeholderTextColor="#64748B"
          style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
        />

        {tab === "terms" && (
          <>
            <TextInput
              value={secondaryInput}
              onChangeText={setSecondaryInput}
              placeholder="Review notes"
              placeholderTextColor="#64748B"
              style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
            />
            <Pressable
              onPress={() =>
                void postGovernance("/api/v1/reviews/campaigns", {
                  campaignId: targetId,
                  decision: "APPROVED",
                  notes: secondaryInput
                })
              }
              style={{ backgroundColor: "#0F766E", borderRadius: 8, padding: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Approve Campaign Terms</Text>
            </Pressable>
          </>
        )}

        {tab === "milestones" && (
          <Pressable
            onPress={() =>
              void postGovernance("/api/v1/campaigns/milestones", {
                milestoneId: targetId,
                approved: true
              })
            }
            style={{ backgroundColor: "#0F766E", borderRadius: 8, padding: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Approve Milestone Tranche</Text>
          </Pressable>
        )}

        {tab === "revenue" && (
          <>
            <TextInput
              value={secondaryInput}
              onChangeText={setSecondaryInput}
              placeholder="Evidence SHA-256 hash (64 hex) or Funded Tx Sig"
              placeholderTextColor="#64748B"
              style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
            />
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder="Verified revenue (smallest units)"
              placeholderTextColor="#64748B"
              style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#2B304A", borderRadius: 8, padding: 10 }}
            />
            <Pressable
              onPress={() =>
                void postGovernance("/api/v1/distributions/reconcile", {
                  cycleId: targetId,
                  evidenceHash: secondaryInput,
                  verifiedRevenueSmallestUnits: amountInput
                })
              }
              style={{ backgroundColor: "#2563EB", borderRadius: 8, padding: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>1. Operator Reconcile</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                void postGovernance("/api/v1/distributions/fund", {
                  cycleId: targetId,
                  fundedTxSig: secondaryInput
                })
              }
              style={{ backgroundColor: "#0F766E", borderRadius: 8, padding: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>2. Approver Fund & Open</Text>
            </Pressable>
          </>
        )}

        {status ? <Text style={{ color: "#4ED9C8", fontSize: 12 }}>{status}</Text> : null}
      </View>
    </ScrollView>
  );
}
