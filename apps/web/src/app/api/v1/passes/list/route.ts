import { NextResponse } from "next/server";
import { ListPassInputSchema } from "@encore/contracts";
import { listOwnedPassForSale } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = ListPassInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid list-pass payload" }, { status: 400 });
  }

  const { marketplace, clock } = getServerContainer();
  const result = await listOwnedPassForSale(marketplace, clock, {
    actorUserId: auth.user.id,
    passId: parsed.data.passId,
    listingPriceSmallestUnits: parsed.data.listingPriceSmallestUnits,
    listingExpiry: new Date(parsed.data.listingExpiryIso)
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }

  return NextResponse.json({ pass: result.value });
}
