import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EncoreUser } from "@encore/core";
import type { UserRole } from "@encore/contracts";
import { getServerContainer } from "./container";

export const ENCORE_SESSION_COOKIE = "encore_session";

export async function getAuthenticatedUser(): Promise<EncoreUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ENCORE_SESSION_COOKIE)?.value;
  if (!token) return null;

  const { sessions, users } = getServerContainer();
  const verified = await sessions.verifySessionToken(token);
  if (!verified) return null;

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
      errorResponse: NextResponse.json({ error: "Authentication required" }, { status: 401 })
    };
  }
  if (allowedRoles && !allowedRoles.some((r) => user.roles.includes(r))) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "Insufficient role permissions" }, { status: 403 })
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
    maxAge: 7200
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
