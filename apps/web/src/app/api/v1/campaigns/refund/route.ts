import { NextResponse } from "next/server";
import { RefundCampaignInputSchema } from "@encore/contracts";
import { refundCampaign } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = RefundCampaignInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign refund payload" }, { status: 400 });
  }

  const { marketplace, clock } = getServerContainer();
  const result = await refundCampaign(marketplace, clock, {
    campaignId: parsed.data.campaignId,
    userId: auth.user.id
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json(result.value);
}
