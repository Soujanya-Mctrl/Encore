import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeyManager, PollarClient, PublicEcJwk } from "@pollar/core";
import { exchangePollarSession } from "./exchange-pollar-session";

afterEach(() => vi.unstubAllGlobals());
async function fixture() {
  const key = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const keys: KeyManager = {
    init: async () => {}, reset: async () => {}, getThumbprint: async () => "unused",
    getPublicJwk: async () => await crypto.subtle.exportKey("jwk", key.publicKey) as PublicEcJwk,
    sign: async (bytes) => new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new Uint8Array(bytes)))
  };
  const client = { getAuthState: () => ({ step: "authenticated", verified: true, session: { token: { accessToken: "test-token" } } }) } as unknown as PollarClient;
  return { keys, client };
}
describe("Device-bound Pollar session exchange", () => {
  it("recovers from transient unavailability using fresh signed proofs", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: "Temporarily unavailable" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ user: { id: "verified-user" }, wallets: [] }));
    vi.stubGlobal("fetch", fetcher);
    const { keys, client } = await fixture();
    expect((await exchangePollarSession(client, keys)).user.id).toBe("verified-user");
    const bodies = fetcher.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies[0].profileProof).not.toBe(bodies[1].profileProof);
    expect(Object.keys(bodies[1]).sort()).toEqual(["accessToken", "profileProof", "walletProof"]);
  });
  it("signs the provider nonce challenge into the next profile proof", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ challenge: { endpoint: "profile", nonce: "provider-nonce" } }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ user: { id: "verified-user" }, wallets: [] }));
    vi.stubGlobal("fetch", fetcher);
    const { keys, client } = await fixture();
    await exchangePollarSession(client, keys);
    const payload = JSON.parse(fetcher.mock.calls[1]![1].body);
    expect(JSON.parse(Buffer.from(payload.profileProof.split(".")[1], "base64url").toString()).nonce).toBe("provider-nonce");
  });
});
