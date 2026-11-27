import { NextResponse } from "next/server";

export function rejectCrossOriginRequest(request: Request): NextResponse | null {
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;
  if (request.headers.get("origin") !== expected ||
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Same-origin JSON request required" }, { status: 403 });
  }
  return null;
}
