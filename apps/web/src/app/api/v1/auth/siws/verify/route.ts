import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { SiwsVerifyRequestSchema } from "@encore/contracts";
import { authenticateOrCreateUser, verifyWalletChallenge } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { attachSessionCookie } from "@/server/request-context";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SiwsVerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid SIWS verification payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { challenges, verifier, clock, users, sessions } = getServerContainer();
  const challengeResult = await verifyWalletChallenge(challenges, verifier, clock, {
    address: parsed.data.address,
    nonce: parsed.data.nonce,
    message: parsed.data.message,
    signatureBase64: parsed.data.signatureBase64
  });

  if (!challengeResult.ok) {
    return NextResponse.json({ error: challengeResult.error.message }, { status: 401 });
  }

  const shortAddr = `${parsed.data.address.slice(0, 4)}...${parsed.data.address.slice(-4)}`;
  const userResult = await authenticateOrCreateUser(users, {
    provider: "solana_siws",
    providerSubject: parsed.data.address,
    displayName: `Solana ${shortAddr}`,
    walletAddress: parsed.data.address,
    walletType: "external"
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
