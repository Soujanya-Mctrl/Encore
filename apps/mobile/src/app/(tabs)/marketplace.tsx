import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { MarketplaceSnapshotDto } from "@encore/contracts";
import { CandlestickChart } from "../../components/CandlestickChart";
import { encoreApiFetch } from "../../lib/api-client";

export default function MarketplaceScreen() {
  const [data, setData] = useState<MarketplaceSnapshotDto | null>(null);

  useEffect(() => {
    void encoreApiFetch<MarketplaceSnapshotDto>("/api/v1/marketplace")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#151725", padding: 16 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "700" }}>
        Supporter Marketplace
      </Text>
      <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4, marginBottom: 14 }}>
        Solana Devnet · Direct Support (0% fee), Supporter Passes (5% primary / 10%+5% resale),
        and Demo Project Shares. Non-investment entitlements.
      </Text>

      {data && (
        <CandlestickChart
          title="Midnight Sessions EP"
          candles={data.candles}
          lastUpdatedAt={data.candlesLastUpdatedAt}
        />
      )}

      <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700", marginTop: 20 }}>
        Layer 1 · Finite Supporter Passes
      </Text>
      {data?.series.map((s) => (
        <View
          key={s.id}
          style={{
            backgroundColor: "#1B1E30",
            borderRadius: 12,
            padding: 14,
            marginTop: 8,
            borderWidth: 1,
            borderColor: "#2B304A"
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{s.title}</Text>
          <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>{s.benefitSummary}</Text>
          <Text style={{ color: "#4ED9C8", fontSize: 12, marginTop: 6 }}>
            Price: {(Number(s.primaryPriceSmallestUnits) / 1_000_000).toFixed(2)} test USDC ·{" "}
            {s.issued}/{s.cap} issued
          </Text>
        </View>
      ))}

      <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700", marginTop: 20 }}>
        Layer 2 · Campaign Escrow & Fixed-Price Spot Asks (Devnet Demo)
      </Text>
      {data?.campaigns.map((c) => (
        <View
          key={c.id}
          style={{
            backgroundColor: "#1B1E30",
            borderRadius: 12,
            padding: 14,
            marginTop: 8,
            borderWidth: 1,
            borderColor: "#2B304A"
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{c.title}</Text>
          <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>{c.useOfFunds}</Text>
          <Text style={{ color: "#7CB7FF", fontSize: 12, marginTop: 6 }}>
            Raised: {(Number(c.raisedSmallestUnits) / 1_000_000).toFixed(2)} /{" "}
            {(Number(c.goalSmallestUnits) / 1_000_000).toFixed(2)} test USDC · {c.status}
          </Text>
        </View>
      ))}

      {data?.spotListings.map((l) => (
        <View
          key={l.id}
          style={{
            backgroundColor: "#1B1E30",
            borderRadius: 12,
            padding: 14,
            marginTop: 8,
            borderWidth: 1,
            borderColor: "#2B304A"
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
            Spot Ask · {(Number(l.unitPriceSmallestUnits) / 1_000_000).toFixed(2)} test USDC /
            unit
          </Text>
          <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>
            Available: {l.remainingUnits} units · Fixed-price ask (no bid book / AMM)
          </Text>
        </View>
      ))}

      {process.env.EXPO_PUBLIC_ENABLE_OPINION_MARKET === "true" && (
        <>
          <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700", marginTop: 20 }}>
            Isolated Yes/No Prediction Vault (1 test USDC / Pair)
          </Text>
          {data?.opinionMarkets.map((m) => (
            <View
              key={m.id}
              style={{
                backgroundColor: "#1B1E30",
                borderRadius: 12,
                padding: 14,
                marginTop: 8,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: "#2B304A"
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{m.question}</Text>
              <Text style={{ color: "#A99BFF", fontSize: 12, marginTop: 6 }}>
                YES pairs: {m.yesPoolPairs} · NO pairs: {m.noPoolPairs} · Outcome: {m.resolvedOutcome}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
