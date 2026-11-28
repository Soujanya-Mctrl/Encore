import { NextResponse } from "next/server";
import { CancelSpotListingInputSchema } from "@encore/contracts";
import { cancelSpotListing } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CancelSpotListingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cancel-spot payload" }, { status: 400 });
  }

  const { marketplace } = getServerContainer();
  const result = await cancelSpotListing(marketplace, {
    spotListingId: parsed.data.spotListingId,
    userId: auth.user.id
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json({ spotListing: result.value });
}
