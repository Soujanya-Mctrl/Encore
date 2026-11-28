import { NextResponse } from "next/server";
import { DistributionClaimInputSchema } from "@encore/contracts";
import { claimDistributionPayout } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = DistributionClaimInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid distribution claim payload" }, { status: 400 });
  }

  const { users, marketplace, chain } = getServerContainer();
  const wallets = await users.listWalletsForUser(auth.user.id);
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  if (!primaryWallet) {
    return NextResponse.json(
      { error: "Connect or provision a Solana wallet before claiming a payout" },
      { status: 400 }
    );
  }

  const result = await claimDistributionPayout(marketplace, chain, {
    cycleId: parsed.data.cycleId,
    userId: auth.user.id,
    claimerWallet: primaryWallet.address
  });
  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json({ ...result.value, demoOnly: true });
}
