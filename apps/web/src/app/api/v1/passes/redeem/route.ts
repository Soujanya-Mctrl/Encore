import { NextResponse } from "next/server";
import { RedeemPassInputSchema } from "@encore/contracts";
import { redeemSupporterPass } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = RedeemPassInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid redeem-pass payload" }, { status: 400 });
  }

  const { marketplace, clock } = getServerContainer();
  const result = await redeemSupporterPass(marketplace, clock, {
    actorUserId: auth.user.id,
    passId: parsed.data.passId
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }

  return NextResponse.json(result.value);
}
