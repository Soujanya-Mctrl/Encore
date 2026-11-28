import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/server/request-context";
import { pkceStore } from "@/server/pkce-store";

const PkceCodeRequestSchema = z.object({
  codeChallenge: z.string().min(43).max(128),
  redirectUri: z.string().url()
});

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = PkceCodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid PKCE code request" }, { status: 400 });
  }

  // Validate allowed Expo redirect schemes
  const allowedPrefixes = [
    "encore://",
    "exp://",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ];
  if (!allowedPrefixes.some((p) => parsed.data.redirectUri.startsWith(p))) {
    return NextResponse.json({ error: "Disallowed redirectUri" }, { status: 400 });
  }

  const code = crypto.randomBytes(24).toString("base64url");
  pkceStore.set(code, {
    userId: auth.user.id,
    roles: auth.user.roles,
    codeChallenge: parsed.data.codeChallenge,
    redirectUri: parsed.data.redirectUri,
    expiresAt: Date.now() + 120_000 // 2-minute single-use TTL
  });

  return NextResponse.json({ code, expiresInSeconds: 120 });
}
