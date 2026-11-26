import { NextResponse } from "next/server";
import { OnboardingProfileSchema } from "@encore/contracts";
import { completeUserOnboarding } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = OnboardingProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid onboarding payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { users } = getServerContainer();
  const result = await completeUserOnboarding(users, auth.user.id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 403 });
  }

  const wallets = await users.listWalletsForUser(auth.user.id);
  return NextResponse.json({ user: result.value, wallets });
}
