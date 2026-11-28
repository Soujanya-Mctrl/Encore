import { NextResponse } from "next/server";
import { ApproveMilestoneInputSchema, SubmitMilestoneInputSchema } from "@encore/contracts";
import { approveMilestone, submitMilestoneEvidence } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const { marketplace, clock } = getServerContainer();

  const submitParsed = SubmitMilestoneInputSchema.safeParse(body);
  if (submitParsed.success) {
    const result = await submitMilestoneEvidence(marketplace, clock, {
      milestoneId: submitParsed.data.milestoneId,
      artistUserId: auth.user.id,
      evidenceUri: submitParsed.data.evidenceUri
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 409 });
    }
    return NextResponse.json({ milestone: result.value });
  }

  const approveParsed = ApproveMilestoneInputSchema.safeParse(body);
  if (approveParsed.success) {
    if (!auth.user.roles.includes("reviewer") && !auth.user.roles.includes("admin")) {
      return NextResponse.json({ error: "Reviewer role required" }, { status: 403 });
    }
    const result = await approveMilestone(marketplace, clock, {
      milestoneId: approveParsed.data.milestoneId,
      reviewerUserId: auth.user.id,
      approved: approveParsed.data.approved
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 409 });
    }
    return NextResponse.json({ milestone: result.value });
  }

  return NextResponse.json({ error: "Invalid milestone payload" }, { status: 400 });
}
