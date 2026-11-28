import { NextResponse } from "next/server";
import { BuySpotListingInputSchema } from "@encore/contracts";
import { buySpotShareUnits } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = BuySpotListingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid spot buy payload" }, { status: 400 });
  }

  const { users, marketplace, chain } = getServerContainer();
  const wallets = await users.listWalletsForUser(auth.user.id);
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  if (!primaryWallet) {
    return NextResponse.json(
      { error: "Connect or provision a Solana wallet before buying spot shares" },
      { status: 400 }
    );
  }

  const result = await buySpotShareUnits(marketplace, chain, {
    spotListingId: parsed.data.spotListingId,
    buyerUserId: auth.user.id,
    buyerWallet: primaryWallet.address,
    units: parsed.data.units
  });
  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json({ ...result.value, demoOnly: true });
}
