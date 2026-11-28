import { NextResponse } from "next/server";
import { CampaignPledgeInputSchema } from "@encore/contracts";
import { pledgeToCampaign } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CampaignPledgeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign pledge payload" }, { status: 400 });
  }

  const { users, marketplace, chain, clock } = getServerContainer();
  const wallets = await users.listWalletsForUser(auth.user.id);
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  if (!primaryWallet) {
    return NextResponse.json(
      { error: "Connect or provision a Solana wallet before pledging" },
      { status: 400 }
    );
  }

  const result = await pledgeToCampaign(marketplace, chain, clock, {
    campaignId: parsed.data.campaignId,
    userId: auth.user.id,
    payerWallet: primaryWallet.address,
    amountSmallestUnits: parsed.data.amountSmallestUnits
  });
  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json({ ...result.value, demoOnly: true });
}
