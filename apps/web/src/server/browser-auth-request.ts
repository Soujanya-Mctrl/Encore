import { NextResponse } from "next/server";

export function authJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function getBrowserAuthOrigin(request: Request): string | null {
  const configured = process.env.ENCORE_AUTH_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  try {
    if (configured) {
      const url = new URL(configured);
      const production = process.env.NODE_ENV === "production";
      if (
        url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (production ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol))
      ) return null;
      return url.origin;
    }
    return process.env.NODE_ENV === "production" ? null : new URL(request.url).origin;
  } catch {
    return null;
  }
}

export function guardBrowserAuthWrite(request: Request, requiresJson = true) {
  const origin = getBrowserAuthOrigin(request);
  if (!origin) return authJson({ error: "Authentication origin is not configured" }, 503);
  if (request.headers.get("origin") !== origin) {
    return authJson({ error: "Authentication requires a same-origin request" }, 403);
  }
  if (requiresJson && request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return authJson({ error: "Expected an application/json request" }, 415);
  }
  return null;
}
