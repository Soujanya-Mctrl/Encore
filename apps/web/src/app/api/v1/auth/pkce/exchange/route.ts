import { randomUUID } from "node:crypto";
import { PkceExchangeRequestSchema } from "@encore/contracts";
import { authJson, authUnavailable, requireAuthJson } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { hashCode, permitsNativeRedirect, s256 } from "@/server/pkce";
import { SESSION_TTL_SECONDS } from "@/server/request-context";

const invalidGrant = () => authJson({ error: "Invalid or expired authorization code" }, 401);

export async function POST(req: Request) {
  const blocked = requireAuthJson(req);
  if (blocked) return blocked;
  const parsed = PkceExchangeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return authJson({ error: "Invalid PKCE exchange payload" }, 400);
  if (!permitsNativeRedirect(parsed.data.redirectUri)) return invalidGrant();

  try {
    const { users, sessions, activeSessions, pkceCodes, clock } = getServerContainer();
    const entry = await pkceCodes.consume({
      codeHash: hashCode(parsed.data.code),
      codeChallenge: s256(parsed.data.codeVerifier),
      redirectUri: parsed.data.redirectUri,
      now: clock.now()
    });
    if (!entry || !(await activeSessions.isActive(entry.sourceSessionId, entry.userId, clock.now()))) {
      return invalidGrant();
    }

    const user = await users.findUserById(entry.userId);
    if (!user) return invalidGrant();
    const wallets = await users.listWalletsForUser(user.id);
    const sessionId = randomUUID();
    const accessToken = await sessions.issueSessionToken({
      userId: user.id,
      roles: user.roles,
      sessionId,
      transport: "native"
    });
    await activeSessions.create(sessionId, user.id, new Date(clock.now().getTime() + SESSION_TTL_SECONDS * 1000));
    return authJson({ accessToken, tokenType: "Bearer", expiresInSeconds: SESSION_TTL_SECONDS, user, wallets });
  } catch {
    return authUnavailable();
  }
}
