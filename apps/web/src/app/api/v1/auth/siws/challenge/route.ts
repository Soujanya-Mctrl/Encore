import crypto from "node:crypto";
import { authJson, getBrowserAuthOrigin, guardBrowserAuthWrite } from "@/server/browser-auth-request";
import { SiwsChallengeRequestSchema } from "@encore/contracts";
import { getServerContainer } from "@/server/container";

export async function POST(req: Request) {
  const blocked = guardBrowserAuthWrite(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const parsed = SiwsChallengeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return authJson(
      { error: "Invalid SIWS challenge request", details: parsed.error.flatten() },
      400
    );
  }

  if (parsed.data.intendedAction !== "login") {
    return authJson({ error: "Only login challenges are supported" }, 400);
  }
  const origin = getBrowserAuthOrigin(req);
  if (!origin) return authJson({ error: "Authentication origin is not configured" }, 503);
  const { challenges, clock, cluster } = getServerContainer();
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = clock.now();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);

  const message = [
    `${new URL(origin).host} wants you to sign in with your Solana account:`,
    parsed.data.address,
    "",
    `URI: ${origin}`,
    `Action: ${parsed.data.intendedAction}`,
    `Cluster: ${cluster}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`
  ].join("\n");

  await challenges.createChallenge({
    nonce,
    address: parsed.data.address,
    intendedAction: "login",
    expiresAt,
    messageDigest: crypto.createHash("sha256").update(message).digest("hex")
  });

  return authJson({
    nonce,
    message,
    expiresAt: expiresAt.toISOString()
  });
}
