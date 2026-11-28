import React from "react";
import { Text, View } from "react-native";

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function CandlestickChart({
  title,
  candles,
  lastUpdatedAt
}: {
  title: string;
  candles: Candle[];
  lastUpdatedAt?: string | null;
}) {
  const prices = candles.flatMap((c) => [c.low, c.high]);
  const rawMin = prices.length > 0 ? Math.min(...prices) : 0.95;
  const rawMax = prices.length > 0 ? Math.max(...prices) : 1.3;
  const pad = Math.max(0.02, (rawMax - rawMin) * 0.15);
  const minPrice = rawMin - pad;
  const maxPrice = rawMax + pad;
  const range = Math.max(0.01, maxPrice - minPrice);
  const chartHeight = 140;

  return (
    <View
      style={{
        backgroundColor: "#1B1E30",
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: "#2B304A"
      }}
    >
      <Text style={{ color: "#7CB7FF", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>
        FINALIZED FILLS · DEVNET PROJECTION
      </Text>
      <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 4 }}>
        {title}
      </Text>
      <Text style={{ color: "#94A3B8", fontSize: 12, marginBottom: 14 }}>
        Project shares · test USDC per unit · 1-hour candles
        {lastUpdatedAt ? ` · Updated ${lastUpdatedAt.slice(11, 19)} UTC` : ""}
      </Text>

      {candles.length === 0 ? (
        <View
          style={{
            height: chartHeight,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: "#2B304A",
            borderRadius: 10
          }}
        >
          <Text style={{ color: "#94A3B8", fontSize: 12 }}>
            No finalized spot fills yet. Candles appear after the first settled fill.
          </Text>
        </View>
      ) : (
        <View
          style={{
            height: chartHeight,
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-around",
            borderBottomWidth: 1,
            borderBottomColor: "#2B304A",
            paddingBottom: 8
          }}
        >
        {candles.map((c) => {
          const isUp = c.close >= c.open;
          const color = isUp ? "#168579" : "#D95F43";
          const bodyBottom = ((Math.min(c.open, c.close) - minPrice) / range) * (chartHeight - 24);
          const bodyTop = ((Math.max(c.open, c.close) - minPrice) / range) * (chartHeight - 24);
          const wickBottom = ((c.low - minPrice) / range) * (chartHeight - 24);
          const wickTop = ((c.high - minPrice) / range) * (chartHeight - 24);

          return (
            <View key={c.time} style={{ alignItems: "center", width: 32, height: chartHeight - 16 }}>
              <View
                style={{
                  position: "absolute",
                  bottom: wickBottom,
                  height: Math.max(2, wickTop - wickBottom),
                  width: 2,
                  backgroundColor: color
                }}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: bodyBottom,
                  height: Math.max(6, bodyTop - bodyBottom),
                  width: 14,
                  borderRadius: 3,
                  backgroundColor: color
                }}
              />
            </View>
          );
        })}
        </View>
      )}

      {candles.length > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ color: "#94A3B8", fontSize: 10 }}>{candles[0]!.time}</Text>
          <Text style={{ color: "#94A3B8", fontSize: 10 }}>
            {candles[candles.length - 1]!.time}
          </Text>
        </View>
      )}
    </View>
  );
}
