import { randomBytes } from "node:crypto";
import { PkceCodeRequestSchema } from "@encore/contracts";
import { authJson, authUnavailable, guardBrowserAuthWrite } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { hashCode, permitsNativeRedirect, PKCE_TTL_SECONDS } from "@/server/pkce";
import { getAuthenticatedSession } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardBrowserAuthWrite(req);
  if (blocked) return blocked;

  const parsed = PkceCodeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !permitsNativeRedirect(parsed.data.redirectUri)) {
    return authJson({ error: "Invalid PKCE authorization request" }, 400);
  }

  try {
    const auth = await getAuthenticatedSession();
    if (!auth) return authJson({ error: "Authentication required" }, 401);

    const { clock, pkceCodes } = getServerContainer();
    const code = randomBytes(24).toString("base64url");
    await pkceCodes.create({
      codeHash: hashCode(code),
      userId: auth.user.id,
      sourceSessionId: auth.sessionId,
      codeChallenge: parsed.data.codeChallenge,
      redirectUri: parsed.data.redirectUri,
      expiresAt: new Date(clock.now().getTime() + PKCE_TTL_SECONDS * 1000)
    });
    return authJson({ code, expiresInSeconds: PKCE_TTL_SECONDS });
  } catch {
    return authUnavailable();
  }
}
