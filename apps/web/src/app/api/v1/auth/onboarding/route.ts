import { authJson, guardBrowserAuthWrite } from "@/server/browser-auth-request";
import { getStudioChannel } from "@/server/onboarding-access";
import { OnboardingProfileSchema } from "@encore/contracts";
import { completeUserOnboarding } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardBrowserAuthWrite(req);
  if (blocked) return blocked;

  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = OnboardingProfileSchema.safeParse(body);
  if (!parsed.success) {
    return authJson(
      { error: "Invalid onboarding payload", details: parsed.error.flatten() },
      400
    );
  }

  const { users } = getServerContainer();
  const result = await completeUserOnboarding(users, auth.user.id, parsed.data);
  if (!result.ok) {
    return authJson({ error: result.error.message }, 403);
  }

  const wallets = await users.listWalletsForUser(auth.user.id);
  const studioChannel = await getStudioChannel(auth.user.id);
  return authJson({ user: result.value, wallets, studioChannel });
}
