import { NextResponse } from "next/server";
import { BuyListingInputSchema } from "@encore/contracts";
import { prepareBuyListedPass } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = BuyListingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid buy-listing payload" }, { status: 400 });
  }

  const { users, marketplace, chain, clock } = getServerContainer();
  const wallets = await users.listWalletsForUser(auth.user.id);
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  if (!primaryWallet) {
    return NextResponse.json({ error: "No verified Solana wallet found" }, { status: 400 });
  }

  const result = await prepareBuyListedPass(marketplace, chain, clock, {
    buyerUserId: auth.user.id,
    buyerWallet: primaryWallet.address,
    passId: parsed.data.passId,
    expectedNonce: parsed.data.expectedNonce,
    expectedVersion: parsed.data.expectedVersion,
    expectedManifestHash: parsed.data.expectedManifestHash
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }

  return NextResponse.json(result.value);
}
