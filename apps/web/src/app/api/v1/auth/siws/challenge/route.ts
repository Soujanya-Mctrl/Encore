import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { SiwsChallengeRequestSchema } from "@encore/contracts";
import { getServerContainer } from "@/server/container";
import { rejectCrossOriginRequest } from "@/server/request-security";

export async function POST(req: Request) {
  const rejected = rejectCrossOriginRequest(req);
  if (rejected) return rejected;
  const body = await req.json().catch(() => null);
  const parsed = SiwsChallengeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid SIWS challenge request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { challenges, clock, cluster } = getServerContainer();
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = clock.now();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);

  const message = [
    `${new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host} wants you to sign in with your Solana account:`,
    parsed.data.address,
    "",
    `Action: ${parsed.data.intendedAction}`,
    `Cluster: ${cluster}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`
  ].join("\n");

  await challenges.createChallenge({ nonce, message, address: parsed.data.address,
    intendedAction: parsed.data.intendedAction, expiresAt });

  return NextResponse.json({
    nonce,
    message,
    expiresAt: expiresAt.toISOString()
  });
}
