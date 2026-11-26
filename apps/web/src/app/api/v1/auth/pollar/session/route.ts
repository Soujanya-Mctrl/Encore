import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { PollarSessionExchangeSchema } from "@encore/contracts";
import { authenticateOrCreateUser } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { attachSessionCookie } from "@/server/request-context";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PollarSessionExchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Pollar session payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { users, sessions } = getServerContainer();
  const displayName =
    parsed.data.displayName ||
    parsed.data.email?.split("@")[0] ||
    `Encore ${parsed.data.provider} listener`;

  const userResult = await authenticateOrCreateUser(users, {
    provider: parsed.data.provider,
    providerSubject: parsed.data.providerSubject,
    displayName,
    avatarUrl: parsed.data.avatarUrl ?? null,
    walletAddress: parsed.data.embeddedWalletAddress,
    walletType: "embedded"
  });

  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 409 });
  }

  const token = await sessions.issueSessionToken({
    userId: userResult.value.id,
    roles: userResult.value.roles,
    sessionId: crypto.randomUUID()
  });

  const wallets = await users.listWalletsForUser(userResult.value.id);
  const res = NextResponse.json({ user: userResult.value, wallets });
  attachSessionCookie(res, token);
  return res;
}
