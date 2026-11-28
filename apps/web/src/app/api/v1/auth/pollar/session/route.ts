import { randomUUID } from "node:crypto";
import { PollarSessionExchangeSchema } from "@encore/contracts";
import { authenticateOrCreateUser } from "@encore/core";
import { PollarVerificationError } from "@encore/infrastructure";
import { authJson, authUnavailable, guardBrowserAuthWrite } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { attachSessionCookie, SESSION_TTL_SECONDS } from "@/server/request-context";

export async function POST(req: Request) {
  const rejected = guardBrowserAuthWrite(req);
  if (rejected) return rejected;
  const parsed = PollarSessionExchangeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return authJson({ error: "Invalid Pollar session payload", details: parsed.error.flatten() }, 400);
  }

  try {
    const { users, sessions, externalIdentity, activeSessions, clock } = getServerContainer();
    if (!externalIdentity) return authJson({ error: "Pollar is not configured" }, 503);
    const identity = await externalIdentity.verify(parsed.data);
    const userResult = await authenticateOrCreateUser(users, identity);
    if (!userResult.ok) return authJson({ error: userResult.error.message }, 409);

    const sessionId = randomUUID();
    const user = userResult.value;
    const wallets = await users.listWalletsForUser(user.id);
    const token = await sessions.issueSessionToken({ userId: user.id, roles: user.roles, sessionId });
    await activeSessions.create(sessionId, user.id, new Date(clock.now().getTime() + SESSION_TTL_SECONDS * 1000));
    const response = authJson({ user, wallets });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof PollarVerificationError) {
      return authJson({
        error: error.message,
        ...(error.nonce ? { challenge: { endpoint: error.endpoint, nonce: error.nonce } } : {})
      }, error.status);
    }
    return authUnavailable();
  }
}
