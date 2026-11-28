import { NextResponse } from "next/server";
import { CampaignPledgeInputSchema } from "@encore/contracts";
import { pledgeToCampaign } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CampaignPledgeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign pledge payload" }, { status: 400 });
  }

  const { marketplace, clock } = getServerContainer();
  const result = await pledgeToCampaign(marketplace, clock, {
    campaignId: parsed.data.campaignId,
    userId: auth.user.id,
    amountSmallestUnits: parsed.data.amountSmallestUnits
  });
  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json({ campaign: result.value, demoOnly: true });
}
