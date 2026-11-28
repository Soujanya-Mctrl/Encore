import { NextResponse } from "next/server";
import { DistributionClaimInputSchema } from "@encore/contracts";
import { claimDistributionPayout } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = DistributionClaimInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid distribution claim payload" }, { status: 400 });
  }

  const { marketplace } = getServerContainer();
  const result = await claimDistributionPayout(marketplace, {
    cycleId: parsed.data.cycleId,
    userId: auth.user.id
  });
  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json({ ...result.value, demoOnly: true });
}
