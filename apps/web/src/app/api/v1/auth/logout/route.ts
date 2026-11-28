import { authJson, guardBrowserAuthWrite } from "@/server/browser-auth-request";
import { getServerContainer } from "@/server/container";
import { clearSessionCookie, getSessionClaims } from "@/server/request-context";

export async function POST(req: Request) {
  const blocked = guardBrowserAuthWrite(req, false);
  if (blocked) return blocked;

  const claims = await getSessionClaims();
  if (claims) {
    await getServerContainer().activeSessions.revoke(claims.sessionId, claims.userId);
  }
  const res = authJson({ ok: true });
  clearSessionCookie(res);
  return res;
}
