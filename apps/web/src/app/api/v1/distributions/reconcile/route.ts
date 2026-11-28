import { NextResponse } from "next/server";
import { ReconcileDistributionInputSchema } from "@encore/contracts";
import { reconcileDistributionCycle } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;
  if (!auth.user.roles.includes("admin") && !auth.user.roles.includes("reviewer")) {
    return NextResponse.json({ error: "Operator or admin role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ReconcileDistributionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reconcile payload" }, { status: 400 });
  }

  const { marketplace, clock } = getServerContainer();
  const result = await reconcileDistributionCycle(marketplace, clock, {
    cycleId: parsed.data.cycleId,
    operatorUserId: auth.user.id,
    evidenceHash: parsed.data.evidenceHash,
    verifiedRevenueSmallestUnits: parsed.data.verifiedRevenueSmallestUnits
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json({ approval: result.value });
}
