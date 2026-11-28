import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import type { TrackPassportSummary } from "@encore/contracts";
import { encoreApiFetch } from "../../lib/api-client";

export default function DiscoverScreen() {
  const [tracks, setTracks] = useState<TrackPassportSummary[]>([]);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    void encoreApiFetch<{ tracks: TrackPassportSummary[] }>("/api/v1/marketplace")
      .then((res) => setTracks(res.tracks))
      .catch(() => setTracks([]));
  }, []);

  const visible =
    filter === "ALL" ? tracks : tracks.filter((t) => t.originCategory === filter);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#151725", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "700" }}>
        Encore Discover
      </Text>
      <Text style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>
        Origin, evidence, and rights are displayed separately before support. No wallet required to
        browse.
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 14 }}>
        {["ALL", "HUMAN_CREATED", "AI_ASSISTED", "AI_GENERATED"].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={{
              backgroundColor: filter === f ? "#6954CF" : "#1B1E30",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {visible.map((t) => (
        <View
          key={t.trackId}
          style={{
            backgroundColor: "#1B1E30",
            borderRadius: 14,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "#2B304A"
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{t.title}</Text>
          <Text style={{ color: "#CBD5E1", fontSize: 13, marginTop: 2 }}>
            {t.artistName} · Passport v{t.currentVersion}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <Text style={{ color: "#A99BFF", fontSize: 11, fontWeight: "600" }}>
              {t.originCategory}
            </Text>
            <Text style={{ color: "#4ED9C8", fontSize: 11 }}>· {t.evidenceStatus}</Text>
            <Text style={{ color: "#7CB7FF", fontSize: 11 }}>· {t.rightsStatus}</Text>
          </View>
        </View>
      ))}

      <Link href="/studio/campaigns" asChild>
        <TouchableOpacity
          style={{
            marginTop: 8,
            backgroundColor: "#3275B9",
            padding: 12,
            borderRadius: 12,
            alignItems: "center"
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Open Artist Studio Campaigns</Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}
