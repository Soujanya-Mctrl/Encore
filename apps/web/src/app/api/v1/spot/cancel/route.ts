import { NextResponse } from "next/server";
import { CancelSpotListingInputSchema } from "@encore/contracts";
import { cancelSpotListing, prepareCancelSpotListing } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser, resolvePrimaryWallet } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CancelSpotListingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cancel-spot payload" }, { status: 400 });
  }

  const { marketplace, chain } = getServerContainer();
  if (body?.mode === "anchor") {
    const wallet = await resolvePrimaryWallet(auth.user.id);
    if (wallet.errorResponse) return wallet.errorResponse;
    const prepared = await prepareCancelSpotListing(marketplace, chain, {
      sellerUserId: auth.user.id,
      sellerWallet: wallet.address,
      spotListingId: parsed.data.spotListingId
    });
    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error.message }, { status: 409 });
    }
    return NextResponse.json({ ...prepared.value, mode: "anchor" });
  }

  const result = await cancelSpotListing(marketplace, {
    spotListingId: parsed.data.spotListingId,
    userId: auth.user.id
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json({ spotListing: result.value });
}
