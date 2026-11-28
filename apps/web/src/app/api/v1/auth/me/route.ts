import { authJson, authUnavailable } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { requireAuthenticatedUser } from "@/server/request-context";

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser(undefined, req);
  if (auth.errorResponse) return auth.errorResponse;
  try {
    const wallets = await getServerContainer().users.listWalletsForUser(auth.user.id);
    return authJson({ user: auth.user, wallets });
  } catch {
    return authUnavailable();
  }
}
