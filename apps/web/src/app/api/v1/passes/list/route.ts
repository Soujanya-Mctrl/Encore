import { NextResponse } from "next/server";
import { ListPassInputSchema } from "@encore/contracts";
import { listOwnedPassForSale, prepareListOwnedPass } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser, resolvePrimaryWallet } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = ListPassInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid list-pass payload" }, { status: 400 });
  }

  const { marketplace, chain, clock } = getServerContainer();
  if (body?.mode === "anchor") {
    const wallet = await resolvePrimaryWallet(auth.user.id);
    if (wallet.errorResponse) return wallet.errorResponse;
    const prepared = await prepareListOwnedPass(marketplace, chain, clock, {
      actorUserId: auth.user.id,
      actorWallet: wallet.address,
      passId: parsed.data.passId,
      listingPriceSmallestUnits: parsed.data.listingPriceSmallestUnits,
      listingExpiry: new Date(parsed.data.listingExpiryIso)
    });
    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error.message }, { status: 409 });
    }
    return NextResponse.json({ ...prepared.value, mode: "anchor" });
  }

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
