import { NextResponse } from "next/server";
import { getServerContainer } from "@/server/container";
import { getAuthenticatedUser } from "@/server/request-context";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { users } = getServerContainer();
  const wallets = await users.listWalletsForUser(user.id);
  return NextResponse.json({ user, wallets });
}
