import { describe, expect, it } from "vitest";
import { InMemoryPkceCodes } from "./pkce-codes.repository.js";

const now = new Date();
const code = {
  userId: "user", sourceSessionId: "session", codeHash: "hash", codeChallenge: "challenge",
  redirectUri: "encore://auth/callback", expiresAt: new Date(now.getTime() + 60_000)
};
const proof = { codeHash: code.codeHash, codeChallenge: code.codeChallenge, redirectUri: code.redirectUri, now };

describe("PKCE code storage", () => {
  it("consumes a matching code once under concurrent exchanges", async () => {
    const store = new InMemoryPkceCodes();
    await store.create(code);
    const results = await Promise.all([store.consume(proof), store.consume(proof)]);
    expect(results.filter(Boolean)).toEqual([{ userId: "user", sourceSessionId: "session" }]);
  });

  it("does not discard the code on a wrong verifier or redirect", async () => {
    const store = new InMemoryPkceCodes();
    await store.create(code);
    expect(await store.consume({ ...proof, codeChallenge: "wrong" })).toBeNull();
    expect(await store.consume({ ...proof, redirectUri: `${code.redirectUri}/other` })).toBeNull();
    expect(await store.consume(proof)).not.toBeNull();
  });

  it("rejects expiry at the exact deadline", async () => {
    const store = new InMemoryPkceCodes();
    await store.create(code);
    expect(await store.consume({ ...proof, now: code.expiresAt })).toBeNull();
  });
});
