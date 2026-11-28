import { NextResponse } from "next/server";
import { CreateSpotListingInputSchema } from "@encore/contracts";
import { prepareCreateSpotListing } from "@encore/core";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser, resolvePrimaryWallet } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardSessionAuthWrite(req);
  if (blocked) return blocked;

  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;

  const wallet = await resolvePrimaryWallet(auth.user.id);
  if (wallet.errorResponse) return wallet.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CreateSpotListingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid create-spot-listing payload" }, { status: 400 });
  }

  const { marketplace, chain } = getServerContainer();
  const result = await prepareCreateSpotListing(marketplace, chain, {
    sellerUserId: auth.user.id,
    sellerWallet: wallet.address,
    campaignId: parsed.data.campaignId,
    units: parsed.data.units,
    unitPriceSmallestUnits: parsed.data.unitPriceSmallestUnits
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
