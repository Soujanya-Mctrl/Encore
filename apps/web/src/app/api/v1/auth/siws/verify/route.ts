import crypto from "node:crypto";
import { authJson, authUnavailable, guardBrowserAuthWrite } from "@/server/browser-auth-request";
import { SiwsVerifyRequestSchema } from "@encore/contracts";
import { authenticateOrCreateUser, verifyWalletChallenge } from "@encore/core";
import { getServerContainer } from "@/server/container";
import { attachSessionCookie, SESSION_TTL_SECONDS } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardBrowserAuthWrite(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const parsed = SiwsVerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return authJson(
      { error: "Invalid SIWS verification payload", details: parsed.error.flatten() },
      400
    );
  }

  try {
    const { challenges, verifier, clock, users, sessions, activeSessions } = getServerContainer();
    const challengeResult = await verifyWalletChallenge(challenges, verifier, clock, {
      address: parsed.data.address,
      nonce: parsed.data.nonce,
      message: parsed.data.message,
      messageDigest: crypto.createHash("sha256").update(parsed.data.message).digest("hex"),
      intendedAction: "login",
      signatureBase64: parsed.data.signatureBase64
    });

    if (!challengeResult.ok) {
      return authJson({ error: challengeResult.error.message }, 401);
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
      return authJson({ error: userResult.error.message }, 409);
    }

    const sessionId = crypto.randomUUID();
    const token = await sessions.issueSessionToken({
      userId: userResult.value.id,
      roles: userResult.value.roles,
      sessionId
    });

    const wallets = await users.listWalletsForUser(userResult.value.id);
    await activeSessions.create(sessionId, userResult.value.id, new Date(clock.now().getTime() + SESSION_TTL_SECONDS * 1000));
    const res = authJson({ user: userResult.value, wallets });
    attachSessionCookie(res, token);
    return res;
  } catch {
    return authUnavailable();
  }
}
