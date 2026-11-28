import { NextResponse } from "next/server";
import { RefundCampaignInputSchema } from "@encore/contracts";
import { refundCampaign } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = RefundCampaignInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign refund payload" }, { status: 400 });
  }

  const { users, marketplace, chain, clock } = getServerContainer();
  const wallets = await users.listWalletsForUser(auth.user.id);
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  if (!primaryWallet) {
    return NextResponse.json(
      { error: "Connect or provision a Solana wallet before claiming a refund" },
      { status: 400 }
    );
  }

  const result = await refundCampaign(marketplace, chain, clock, {
    campaignId: parsed.data.campaignId,
    userId: auth.user.id,
    claimerWallet: primaryWallet.address
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json(result.value);
}
