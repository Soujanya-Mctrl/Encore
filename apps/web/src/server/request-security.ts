import { NextResponse } from "next/server";
import { getAllowedBrowserAuthOrigins } from "./browser-auth-request";

export function rejectCrossOriginRequest(request: Request): NextResponse | null {
  if (!getAllowedBrowserAuthOrigins(request).has(request.headers.get("origin") ?? "") ||
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Allowed browser origin and JSON request required" }, { status: 403 });
  }
  return null;
}
