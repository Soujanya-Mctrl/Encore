import { NextResponse } from "next/server";
import { RedeemPassInputSchema } from "@encore/contracts";
import { prepareRedeemSupporterPass, redeemSupporterPass } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser, resolvePrimaryWallet } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = RedeemPassInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid redeem-pass payload" }, { status: 400 });
  }

  const { marketplace, chain, clock } = getServerContainer();
  if (body?.mode === "anchor") {
    const wallet = await resolvePrimaryWallet(auth.user.id);
    if (wallet.errorResponse) return wallet.errorResponse;
    const prepared = await prepareRedeemSupporterPass(marketplace, chain, clock, {
      actorUserId: auth.user.id,
      actorWallet: wallet.address,
      passId: parsed.data.passId
    });
    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error.message }, { status: 409 });
    }
    return NextResponse.json({ ...prepared.value, mode: "anchor" });
  }

  const result = await redeemSupporterPass(marketplace, clock, {
    actorUserId: auth.user.id,
    passId: parsed.data.passId
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }

  return NextResponse.json(result.value);
}
