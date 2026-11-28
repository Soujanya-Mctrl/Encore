import { NextResponse } from "next/server";
import { z } from "zod";
import { CreatePassSeriesInputSchema } from "@encore/contracts";
import { prepareCreatePassSeries } from "@encore/core";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser, resolvePrimaryWallet } from "@/server/request-context";

const CreateSeriesRequestSchema = CreatePassSeriesInputSchema.extend({
  deliverableUrl: z.string().url().optional()
});

export async function POST(req: Request) {
  const blocked = guardSessionAuthWrite(req);
  if (blocked) return blocked;

  const auth = await requireAuthenticatedUser(["artist", "admin"], req);
  if (auth.errorResponse) return auth.errorResponse;

  const wallet = await resolvePrimaryWallet(auth.user.id);
  if (wallet.errorResponse) return wallet.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CreateSeriesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid create-series payload" }, { status: 400 });
  }

  const { marketplace, chain, clock } = getServerContainer();
  const result = await prepareCreatePassSeries(marketplace, chain, clock, {
    artistUserId: auth.user.id,
    artistWallet: wallet.address,
    trackId: parsed.data.trackId,
    title: parsed.data.title,
    benefitSummary: parsed.data.benefitSummary,
    cap: parsed.data.cap,
    primaryPriceSmallestUnits: parsed.data.primaryPriceSmallestUnits,
    expiry: new Date(parsed.data.expiryIso),
    deliverableUrl:
      parsed.data.deliverableUrl ??
      `https://encore.devnet.local/deliverables/${parsed.data.trackId}`
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
