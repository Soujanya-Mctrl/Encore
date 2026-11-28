import crypto from "node:crypto";
import type { UserRole } from "@encore/contracts";
import type { SessionTokenPort, SessionTransport } from "@encore/core";

const SESSION_VERSIONS = { browser: "v2", native: "v2n" } as const;

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
  ) {
    if (Buffer.byteLength(secret) < 32) throw new Error("Session secret must contain at least 32 bytes");
  }

  async issueSessionToken(payload: {
    userId: string;
    roles: readonly UserRole[];
    sessionId: string;
    transport?: SessionTransport;
  }): Promise<string> {
    const version = SESSION_VERSIONS[payload.transport ?? "browser"];
    const claims: SessionClaims = {
      sub: payload.userId,
      roles: payload.roles,
      sid: payload.sessionId,
      exp: Math.floor(Date.now() / 1000) + this.ttlSeconds
    };
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const sig = crypto
      .createHmac("sha256", this.secret)
      .update(`${version}.${body}`)
      .digest("base64url");
    return `${version}.${body}.${sig}`;
  }

  async verifySessionToken(token: string, transport: SessionTransport = "browser"): Promise<{
    userId: string;
    roles: readonly UserRole[];
    sessionId: string;
  } | null> {
    if (token.length > 4096) return null;
    const version = SESSION_VERSIONS[transport];
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== version) return null;
    const [, body, sig] = parts;
    if (!body || !sig) return null;

    const expectedSig = crypto
      .createHmac("sha256", this.secret)
      .update(`${version}.${body}`)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    try {
      const parsed = JSON.parse(
        Buffer.from(body, "base64url").toString("utf8")
      ) as SessionClaims;
      if (typeof parsed.exp !== "number" || parsed.exp <= Math.floor(Date.now() / 1000) ||
        typeof parsed.sub !== "string" || !parsed.sub || typeof parsed.sid !== "string" || !parsed.sid ||
        !Array.isArray(parsed.roles) || !parsed.roles.every((role) => ["listener", "artist", "commercial_buyer", "reviewer", "admin"].includes(role))) {
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
