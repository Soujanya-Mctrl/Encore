import { authJson } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { getAuthenticatedUser } from "@/server/request-context";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return authJson({ error: "Unauthenticated" }, 401);
  }

  const { users } = getServerContainer();
  const wallets = await users.listWalletsForUser(user.id);
  return authJson({ user, wallets });
}
