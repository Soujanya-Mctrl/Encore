import { describe, expect, it, vi } from "vitest";
import { POLLAR_CONFIG_URL, POLLAR_PROFILE_URL, POLLAR_WALLET_URL, PollarSessionExchangeSchema } from "@encore/contracts";
import { PollarSessionVerifier, PollarVerificationError } from "./pollar-session-verifier.js";

const address = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const proof = { accessToken: "token", profileProof: "profile-proof", walletProof: "wallet-proof" };
const profile = { success: true, content: {
  mail: "artist@example.com", first_name: "Artist", last_name: "One", avatar: "",
  providers: { google: { id: "trusted-google-id" }, github: null, email: null, wallet: null }
} };
const config = { success: true, content: { application: { network: "testnet", chains: ["SOLANA"] } } };
const state = (chain = "SOLANA", network = "devnet") => ({ success: true, content: {
  wallets: [{ address, type: "internal", chain, network, provisioning: "READY" }]
} });

describe("Pollar server verification", () => {
  it("rejects the previous browser-asserted identity payload", () => {
    expect(PollarSessionExchangeSchema.safeParse({ provider: "google", providerSubject: "victim", embeddedWalletAddress: address }).success).toBe(false);
    expect(PollarSessionExchangeSchema.safeParse({ ...proof, providerSubject: "victim" }).success).toBe(false);
  });

  it("derives the identity and devnet wallet from fixed authenticated upstream targets", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(profile)).mockResolvedValueOnce(Response.json(state())).mockResolvedValueOnce(Response.json(config));
    const verifier = new PollarSessionVerifier("pk_test", fetcher);
    expect(await verifier.verify(proof)).toEqual({ provider: "google", providerSubject: "trusted-google-id", displayName: "Artist One", walletAddress: address, walletType: "embedded" });
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual([POLLAR_PROFILE_URL, POLLAR_WALLET_URL, POLLAR_CONFIG_URL]);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ headers: { "x-pollar-api-key": "pk_test", Origin: "http://localhost:3000", Authorization: "DPoP token", DPoP: "profile-proof" }, cache: "no-store", redirect: "error" });
  });

  it.each([["STELLAR", "testnet"], ["SOLANA", "mainnet"], ["SOLANA", ""]])("does not bind a wallet on %s/%s", async (chain, network) => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(profile)).mockResolvedValueOnce(Response.json(state(chain, network))).mockResolvedValueOnce(Response.json(config));
    expect((await new PollarSessionVerifier("pk_test", fetcher).verify(proof)).walletAddress).toBeUndefined();
  });

  it("rejects revoked/expired sessions without reading or binding wallets", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    await expect(new PollarSessionVerifier("pk_test", fetcher).verify(proof)).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns provider nonce challenges so the device can sign a fresh proof", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(profile)).mockResolvedValueOnce(new Response(null, { status: 401, headers: { "DPoP-Nonce": "fresh-nonce" } }));
    await expect(new PollarSessionVerifier("pk_test", fetcher).verify(proof)).rejects.toMatchObject({ status: 401, endpoint: "wallet", nonce: "fresh-nonce" });
  });

  it("fails closed on a network error or malformed response", async () => {
    for (const fetcher of [vi.fn().mockRejectedValue(new Error("offline")), vi.fn().mockResolvedValue(Response.json({ success: true }))]) {
      await expect(new PollarSessionVerifier("pk_test", fetcher).verify(proof)).rejects.toBeInstanceOf(PollarVerificationError);
    }
  });

  it("does not invent a wallet while provisioning is unfinished", async () => {
    const pending = state(); pending.content.wallets[0]!.provisioning = "CREATING";
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(profile)).mockResolvedValueOnce(Response.json(pending)).mockResolvedValueOnce(Response.json(config));
    expect((await new PollarSessionVerifier("pk_test", fetcher).verify(proof)).walletAddress).toBeUndefined();
  });

  it("accepts a provider-verified external SIWS address when wallet/state has no hosted wallet", async () => {
    const external = structuredClone(profile);
    external.content.providers = { google: null, github: null, email: null, wallet: { address } } as unknown as typeof external.content.providers;
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(external))
      .mockResolvedValueOnce(Response.json({ code: "SDK_WALLET_REQUIRED" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json(config));
    expect(await new PollarSessionVerifier("pk_test", fetcher).verify(proof)).toMatchObject({
      provider: "solana_siws", providerSubject: address, walletAddress: address, walletType: "external"
    });
  });

  it("refuses an external-wallet fallback on a multichain app", async () => {
    const external = { ...profile, content: { ...profile.content, providers: { google: null, github: null, email: null, wallet: { address } } } };
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(external))
      .mockResolvedValueOnce(Response.json({ code: "SDK_WALLET_REQUIRED" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ success: true, content: { application: { network: "testnet", chains: ["SOLANA", "STELLAR"] } } }));
    await expect(new PollarSessionVerifier("pk_test", fetcher).verify(proof)).rejects.toMatchObject({ status: 401 });
  });

  it("refuses mainnet application configuration", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(profile)).mockResolvedValueOnce(Response.json(state()))
      .mockResolvedValueOnce(Response.json({ success: true, content: { application: { network: "mainnet", chains: ["SOLANA"] } } }));
    await expect(new PollarSessionVerifier("pk_test", fetcher).verify(proof)).rejects.toBeInstanceOf(PollarVerificationError);
  });
});
