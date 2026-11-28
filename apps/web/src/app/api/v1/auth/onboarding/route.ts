import { authJson, authUnavailable, guardSessionAuthWrite } from "@/server/browser-auth-request";
import { getStudioChannel } from "@/server/onboarding-access";
import { OnboardingProfileSchema } from "@encore/contracts";
import { completeUserOnboarding } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardSessionAuthWrite(req);
  if (blocked) return blocked;

  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;

  const parsed = OnboardingProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return authJson(
      { error: "Invalid onboarding payload", details: parsed.error.flatten() },
      400
    );
  }

  try {
    const { users } = getServerContainer();
    const result = await completeUserOnboarding(users, auth.user.id, parsed.data);
    if (!result.ok) return authJson({ error: result.error.message }, 403);

    const [wallets, studioChannel] = await Promise.all([
      users.listWalletsForUser(auth.user.id),
      getStudioChannel(auth.user.id)
    ]);
    return authJson({ user: result.value, wallets, studioChannel });
  } catch {
    return authUnavailable();
  }
}
