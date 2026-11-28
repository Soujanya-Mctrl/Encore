import { NextResponse } from "next/server";
import { CancelPassListingInputSchema } from "@encore/contracts";
import { cancelPassListing } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = CancelPassListingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cancel-listing payload" }, { status: 400 });
  }

  const { marketplace } = getServerContainer();
  const result = await cancelPassListing(marketplace, {
    passId: parsed.data.passId,
    userId: auth.user.id
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json({ pass: result.value });
}
