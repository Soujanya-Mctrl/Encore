import { NextResponse } from "next/server";
import { getServerContainer } from "@/server/container";

export async function GET() {
  const { marketplace, cluster } = getServerContainer();
  const snapshot = await marketplace.getMarketplaceSnapshot();
  return NextResponse.json({
    cluster,
    syntheticNotice: "Layer 2 market candles and simulated distribution figures are devnet demo data only.",
    ...snapshot
  });
}
