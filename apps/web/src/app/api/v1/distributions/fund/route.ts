import { NextResponse } from "next/server";
import { FundDistributionInputSchema } from "@encore/contracts";
import { approveAndFundDistributionCycle } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;
  if (!auth.user.roles.includes("admin") && !auth.user.roles.includes("reviewer")) {
    return NextResponse.json({ error: "Approver or admin role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = FundDistributionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fund distribution payload" }, { status: 400 });
  }

  const { marketplace, chain, clock } = getServerContainer();
  const result = await approveAndFundDistributionCycle(marketplace, chain, clock, {
    cycleId: parsed.data.cycleId,
    approverUserId: auth.user.id,
    fundedTxSig: parsed.data.fundedTxSig
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json({ approval: result.value });
}
