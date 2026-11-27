import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/request-context";
import { rejectCrossOriginRequest } from "@/server/request-security";

export async function POST(req: Request) {
  const rejected = rejectCrossOriginRequest(req);
  if (rejected) return rejected;
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
