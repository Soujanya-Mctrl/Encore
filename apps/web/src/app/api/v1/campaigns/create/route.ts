import { NextResponse } from "next/server";
import { CreateCampaignInputSchema } from "@encore/contracts";
import { prepareCreateCampaign } from "@encore/core";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser, resolvePrimaryWallet } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardSessionAuthWrite(req);
  if (blocked) return blocked;

  const auth = await requireAuthenticatedUser(["artist", "admin"], req);
  if (auth.errorResponse) return auth.errorResponse;

  const wallet = await resolvePrimaryWallet(auth.user.id);
  if (wallet.errorResponse) return wallet.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CreateCampaignInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid create-campaign payload" }, { status: 400 });
  }

  const { marketplace, chain, clock } = getServerContainer();
  const result = await prepareCreateCampaign(marketplace, chain, clock, {
    artistWallet: wallet.address,
    trackId: parsed.data.trackId,
    title: parsed.data.title,
    goalSmallestUnits: parsed.data.goalSmallestUnits,
    shareSupply: parsed.data.shareSupply,
    deadline: new Date(parsed.data.deadlineIso),
    useOfFunds: parsed.data.useOfFunds,
    rightsScope: parsed.data.rightsScope
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
