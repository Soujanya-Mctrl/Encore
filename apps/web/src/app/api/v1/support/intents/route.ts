import { NextResponse } from "next/server";
import { DirectSupportIntentInputSchema } from "@encore/contracts";
import { prepareDirectSupportIntent } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = DirectSupportIntentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid direct support payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { users, marketplace, chain } = getServerContainer();
  const wallets = await users.listWalletsForUser(auth.user.id);
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  if (!primaryWallet) {
    return NextResponse.json(
      { error: "Connect or provision a Solana wallet before creating a support intent" },
      { status: 400 }
    );
  }

  const result = await prepareDirectSupportIntent(marketplace, chain, {
    payerWallet: primaryWallet.address,
    trackId: parsed.data.trackId,
    expectedVersion: parsed.data.expectedVersion,
    expectedManifestHash: parsed.data.expectedManifestHash,
    amountSmallestUnits: parsed.data.amountSmallestUnits
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }

  return NextResponse.json({
    walletMode: parsed.data.walletMode,
    ...result.value
  });
}
