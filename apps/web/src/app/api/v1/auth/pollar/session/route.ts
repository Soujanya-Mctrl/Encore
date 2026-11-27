import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { PollarSessionExchangeSchema } from "@encore/contracts";
import { authenticateOrCreateUser } from "@encore/core";
import { PollarVerificationError } from "@encore/infrastructure";
import { getServerContainer } from "@/server/container";
import { attachSessionCookie } from "@/server/request-context";
import { rejectCrossOriginRequest } from "@/server/request-security";

export async function POST(req: Request) {
  const rejected = rejectCrossOriginRequest(req);
  if (rejected) return rejected;
  const body = await req.json().catch(() => null);
  const parsed = PollarSessionExchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Pollar session payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { users, sessions, externalIdentity } = getServerContainer();
  if (!externalIdentity) return NextResponse.json({ error: "Pollar is not configured" }, { status: 503 });
  let identity;
  try {
    identity = await externalIdentity.verify(parsed.data);
  } catch (error) {
    if (error instanceof PollarVerificationError) return NextResponse.json({
      error: error.message,
      ...(error.nonce ? { challenge: { endpoint: error.endpoint, nonce: error.nonce } } : {})
    }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: "Pollar verification is unavailable" }, { status: 503 });
  }
  const userResult = await authenticateOrCreateUser(users, identity);

  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 409 });
  }

  const token = await sessions.issueSessionToken({
    userId: userResult.value.id,
    roles: userResult.value.roles,
    sessionId: crypto.randomUUID()
  });

  const wallets = await users.listWalletsForUser(userResult.value.id);
  const res = NextResponse.json({ user: userResult.value, wallets }, { headers: { "Cache-Control": "no-store" } });
  attachSessionCookie(res, token);
  return res;
}
