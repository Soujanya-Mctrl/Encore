import { authJson, authUnavailable, guardSessionAuthWrite } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { clearSessionCookie, getSessionClaims } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardSessionAuthWrite(req, false);
  if (blocked) return blocked;

  const bearer = req.headers.has("authorization");
  try {
    const claims = await getSessionClaims(req);
    if (bearer && !claims) return authJson({ error: "Authentication required" }, 401);
    if (claims) await getServerContainer().activeSessions.revoke(claims.sessionId, claims.userId);
    const res = authJson({ ok: true });
    if (!bearer) clearSessionCookie(res);
    return res;
  } catch {
    return authUnavailable();
  }
}
