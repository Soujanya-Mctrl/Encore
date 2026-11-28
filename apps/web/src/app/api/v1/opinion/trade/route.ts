import { NextResponse } from "next/server";
import { OpinionTradeInputSchema } from "@encore/contracts";
import { tradeOpinionMarketPair } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  if (process.env.ENABLE_OPINION_MARKET !== "true") {
    return NextResponse.json(
      { error: "Opinion markets are deferred outside the DeFi demo scope" },
      { status: 404 }
    );
  }

  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = OpinionTradeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid opinion trade payload" }, { status: 400 });
  }

  const { marketplace, clock } = getServerContainer();
  const result = await tradeOpinionMarketPair(marketplace, clock, {
    marketId: parsed.data.marketId,
    userId: auth.user.id,
    side: parsed.data.side,
    pairsCount: parsed.data.pairsCount
  });
  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json({ market: result.value, demoOnly: true });
}
