import { NextResponse } from "next/server";
import { BuyPrimaryPassInputSchema } from "@encore/contracts";
import { preparePrimaryPassPurchase } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = BuyPrimaryPassInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid buy-primary payload" }, { status: 400 });
  }

  const { users, marketplace, chain, clock } = getServerContainer();
  const wallets = await users.listWalletsForUser(auth.user.id);
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  if (!primaryWallet) {
    return NextResponse.json({ error: "No verified Solana wallet found" }, { status: 400 });
  }

  const result = await preparePrimaryPassPurchase(marketplace, chain, clock, {
    buyerWallet: primaryWallet.address,
    seriesId: parsed.data.seriesId,
    expectedVersion: parsed.data.expectedVersion,
    expectedManifestHash: parsed.data.expectedManifestHash
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }

  return NextResponse.json(result.value);
}
