import { NextResponse } from "next/server";
import { OpenDistributionInputSchema } from "@encore/contracts";
import { prepareOpenDistributionCycle } from "@encore/core";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser, resolvePrimaryWallet } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardSessionAuthWrite(req);
  if (blocked) return blocked;

  const auth = await requireAuthenticatedUser(["reviewer", "admin"], req);
  if (auth.errorResponse) return auth.errorResponse;

  const wallet = await resolvePrimaryWallet(auth.user.id);
  if (wallet.errorResponse) return wallet.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = OpenDistributionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid open-distribution payload" }, { status: 400 });
  }

  const { marketplace, chain } = getServerContainer();
  const result = await prepareOpenDistributionCycle(marketplace, chain, {
    authorityWallet: wallet.address,
    cycleId: parsed.data.cycleId
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json(result.value);
}
