import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { CatalogError } from "@encore/core";
function mac(body: string) {
  const key = process.env.ENCORE_SESSION_SECRET;
  if (!key || key.length < 32) throw new Error("Session secret required");
  return createHmac("sha256", key).update(`encore-upload:${body}`).digest();
}
export function uploadGrant(userId: string, id: string, size: number) {
  const body = Buffer.from(
    JSON.stringify({ userId, id, size, expires: Date.now() + 10 * 60 * 1000 }),
  ).toString("base64url");
  return `${body}.${mac(body).toString("base64url")}`;
}
export function verifyUploadGrant(
  token: unknown,
  userId: string,
): { id: string; path: string; size?: number } {
  try {
    if (typeof token !== "string" || token.length > 1024) throw new Error();
    const [body, sig, extra] = token.split(".");
    if (!body || !sig || extra !== undefined) throw new Error();
    const expected = mac(body!),
      got = Buffer.from(sig!, "base64url");
    if (got.length !== expected.length || !timingSafeEqual(got, expected))
      throw new Error();
    const claims = JSON.parse(Buffer.from(body!, "base64url").toString());
    if (
      claims.userId !== userId ||
      claims.expires < Date.now() ||
      !/^[-0-9a-f]{36}$/.test(claims.id)
    )
      throw new Error();
    return { id: claims.id, path: `quarantine/${userId}/${claims.id}.mp3`, size: claims.size };
  } catch {
    throw new CatalogError("Upload grant invalid or expired", 403);
  }
}
