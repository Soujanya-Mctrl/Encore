import { NextResponse } from "next/server";
import { ConfirmMarketplaceTxInputSchema } from "@encore/contracts";
import { confirmMarketplaceSettlement } from "@encore/core";
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
  const parsed = ConfirmMarketplaceTxInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid marketplace confirm payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { marketplace, chain, clock, cluster } = getServerContainer();
  const result = await confirmMarketplaceSettlement(marketplace, chain, clock, {
    actorUserId: auth.user.id,
    actorWallet: wallet.address,
    cluster,
    input: parsed.data
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json(result.value);
}
