import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerContainer } from "@/server/container";
import { pkceStore } from "@/server/pkce-store";

const PkceExchangeSchema = z.object({
  code: z.string().min(16),
  codeVerifier: z.string().min(43).max(128),
  redirectUri: z.string().url()
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PkceExchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid PKCE exchange payload" }, { status: 400 });
  }

  const entry = pkceStore.get(parsed.data.code);
  pkceStore.delete(parsed.data.code); // Single-use enforcement

  if (!entry || entry.expiresAt < Date.now() || entry.redirectUri !== parsed.data.redirectUri) {
    return NextResponse.json({ error: "Invalid or expired authorization code" }, { status: 401 });
  }

  const expectedChallenge = crypto
    .createHash("sha256")
    .update(parsed.data.codeVerifier)
    .digest("base64url");

  if (expectedChallenge !== entry.codeChallenge) {
    return NextResponse.json({ error: "PKCE verifier mismatch" }, { status: 401 });
  }

  const { users, sessions } = getServerContainer();
  const user = await users.findUserById(entry.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const accessToken = await sessions.issueSessionToken({
    userId: user.id,
    roles: user.roles,
    sessionId: crypto.randomUUID()
  });
  const wallets = await users.listWalletsForUser(user.id);

  return NextResponse.json({ accessToken, user, wallets });
}
