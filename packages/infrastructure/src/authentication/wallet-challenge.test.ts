import { createHash, createPrivateKey, sign } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { verifyWalletChallenge } from "@encore/core";
import { InMemoryIdentityRepository } from "../persistence/repositories/in-memory-identity.repository.js";
import { NodeEd25519Verifier } from "./ed25519-verifier.js";

const now = new Date("2026-11-27T12:00:00Z");
async function fixture(expiresAt = new Date(now.getTime() + 60_000)) {
  const payer = Keypair.generate();
  const address = payer.publicKey.toBase58();
  const nonce = "nonce-for-encore-phase-one";
  const message = `localhost:3000 wants you to sign in with your Solana account:\n${address}\nAction: login\nCluster: devnet\nNonce: ${nonce}`;
  const repo = new InMemoryIdentityRepository();
  await repo.createChallenge({ nonce, address, message, intendedAction: "login", expiresAt, messageDigest: createHash("sha256").update(message).digest("hex") });
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(payer.secretKey.slice(0, 32))]), type: "pkcs8", format: "der" });
  const payload = (text = message) => ({ address, nonce, message: text, messageDigest: createHash("sha256").update(text).digest("hex"), intendedAction: "login" as const, signatureBase64: sign(null, Buffer.from(text), key).toString("base64") });
  const verify = (input = payload()) => verifyWalletChallenge(repo, new NodeEd25519Verifier(), { now: () => now }, input);
  return { verify, payload, message };
}
describe("Server-issued wallet challenges", () => {
  it("accepts a real signature exactly once", async () => {
    const { verify } = await fixture();
    expect((await verify()).ok).toBe(true);
    expect((await verify()).ok).toBe(false);
  });
  it("rejects a different signed message even if nonce and wallet match", async () => {
    const { verify, payload, message } = await fixture();
    expect((await verify(payload(message.replace("localhost:3000", "other.example")))).ok).toBe(false);
    expect((await verify()).ok).toBe(true);
  });
  it.each([-1, 0])("rejects challenges expired at the boundary (%i ms)", async (offset) => {
    const { verify } = await fixture(new Date(now.getTime() + offset));
    expect((await verify()).ok).toBe(false);
  });
  it("rejects a modified signature without consuming the valid challenge", async () => {
    const { verify, payload } = await fixture();
    expect((await verify({ ...payload(), signatureBase64: Buffer.alloc(64).toString("base64") })).ok).toBe(false);
    expect((await verify()).ok).toBe(true);
  });
});
