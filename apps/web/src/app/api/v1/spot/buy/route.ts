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

  const { marketplace } = getServerContainer();
  const result = await buySpotShareUnits(marketplace, {
    spotListingId: parsed.data.spotListingId,
    buyerUserId: auth.user.id,
    units: parsed.data.units
  });
  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json({ spotListing: result.value, demoOnly: true });
}
