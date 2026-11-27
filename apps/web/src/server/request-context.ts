import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { EncoreUser } from "@encore/core";
import type { UserRole } from "@encore/contracts";
import { authJson } from "./browser-auth-request";
import { getServerContainer } from "./container";

export const ENCORE_SESSION_COOKIE = "encore_session";

export const SESSION_TTL_SECONDS = 7200;

export async function getSessionClaims() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ENCORE_SESSION_COOKIE)?.value;
  if (!token) return null;
  return getServerContainer().sessions.verifySessionToken(token);
}

export async function getAuthenticatedUser(): Promise<EncoreUser | null> {
  const verified = await getSessionClaims();
  if (!verified) return null;

  const { activeSessions, clock, users } = getServerContainer();
  if (!(await activeSessions.isActive(verified.sessionId, verified.userId, clock.now()))) return null;
  return users.findUserById(verified.userId);
}

export async function requireAuthenticatedUser(
  allowedRoles?: readonly UserRole[]
): Promise<
  { user: EncoreUser; errorResponse: null } | { user: null; errorResponse: NextResponse }
> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      user: null,
      errorResponse: authJson({ error: "Authentication required" }, 401)
    };
  }
  if (allowedRoles && !allowedRoles.some((r) => user.roles.includes(r))) {
    return {
      user: null,
      errorResponse: authJson({ error: "Insufficient role permissions" }, 403)
    };
  }
  return { user, errorResponse: null };
}

export function attachSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(ENCORE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(ENCORE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
