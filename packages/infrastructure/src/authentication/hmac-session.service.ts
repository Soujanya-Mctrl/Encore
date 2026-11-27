import crypto from "node:crypto";
import type { UserRole } from "@encore/contracts";
import type { SessionTokenPort } from "@encore/core";

const SESSION_VERSION = "v2";

interface SessionClaims {
  sub: string;
  roles: readonly UserRole[];
  sid: string;
  exp: number;
}

export class HmacSessionTokenService implements SessionTokenPort {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds = 7200
  ) {}

  async issueSessionToken(payload: {
    userId: string;
    roles: readonly UserRole[];
    sessionId: string;
  }): Promise<string> {
    const claims: SessionClaims = {
      sub: payload.userId,
      roles: payload.roles,
      sid: payload.sessionId,
      exp: Math.floor(Date.now() / 1000) + this.ttlSeconds
    };
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const sig = crypto
      .createHmac("sha256", this.secret)
      .update(`${SESSION_VERSION}.${body}`)
      .digest("base64url");
    return `${SESSION_VERSION}.${body}.${sig}`;
  }

  async verifySessionToken(token: string): Promise<{
    userId: string;
    roles: readonly UserRole[];
    sessionId: string;
  } | null> {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== SESSION_VERSION) return null;
    const [, body, sig] = parts;
    if (!body || !sig) return null;

    const expectedSig = crypto
      .createHmac("sha256", this.secret)
      .update(`${SESSION_VERSION}.${body}`)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    try {
      const parsed = JSON.parse(
        Buffer.from(body, "base64url").toString("utf8")
      ) as SessionClaims;
      if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return {
        userId: parsed.sub,
        roles: parsed.roles,
        sessionId: parsed.sid
      };
    } catch {
      return null;
    }
  }
}
