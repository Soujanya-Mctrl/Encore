import { NextResponse } from "next/server";
import { ReviewCampaignInputSchema } from "@encore/contracts";
import { reviewCampaign } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;
  if (!auth.user.roles.includes("reviewer") && !auth.user.roles.includes("admin")) {
    return NextResponse.json({ error: "Reviewer role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ReviewCampaignInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign review payload" }, { status: 400 });
  }

  const { marketplace, clock } = getServerContainer();
  const result = await reviewCampaign(marketplace, clock, {
    campaignId: parsed.data.campaignId,
    reviewerUserId: auth.user.id,
    decision: parsed.data.decision,
    notes: parsed.data.notes,
    termsHash: parsed.data.termsHash
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json({ review: result.value });
}
