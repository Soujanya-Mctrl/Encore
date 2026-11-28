import { OnboardingProfileSchema } from "@encore/contracts";
import { CatalogError, completeUserOnboarding } from "@encore/core";
import { guardSessionAuthWrite } from "@/server/browser-auth-request";
import { catalogResponse } from "@/server/catalog-http";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";
import { requireStudioOwner } from "@/server/studio-auth";

export async function POST(req: Request) {
  const denied = guardSessionAuthWrite(req);
  if (denied) return denied;
  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;
  return catalogResponse(async () => {
    const { users } = getServerContainer();
    const existing = await users.findStudioChannelForUser(auth.user.id);
    if (existing?.role === "owner") return { channel: existing };
    const body = await req.json().catch(() => null);
    const profile = OnboardingProfileSchema.safeParse({ ...body, journey: "artist" });
    if (!profile.success) throw new CatalogError("Provide an artist onboarding profile");
    const result = await completeUserOnboarding(users, auth.user.id, profile.data);
    if (!result.ok) throw new CatalogError(result.error.message, 403);
    return { channel: await requireStudioOwner(auth.user.id) };
  });
}
