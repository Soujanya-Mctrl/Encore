import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  HmacSessionTokenService,
  InMemoryIdentityRepository,
  NodeEd25519Verifier
} from "./index.js";

describe("Authentication Infrastructure", () => {
  it("issues and verifies HMAC session tokens and rejects tampering", async () => {
    const svc = new HmacSessionTokenService("test-secret-key-12345");
    const token = await svc.issueSessionToken({
      userId: "user-1",
      roles: ["listener", "artist"],
      sessionId: "sess-1"
    });

    const verified = await svc.verifySessionToken(token);
    expect(verified).toEqual({
      userId: "user-1",
      roles: ["listener", "artist"],
      sessionId: "sess-1"
    });

    const tampered = `${token.slice(0, -2)}xx`;
    expect(await svc.verifySessionToken(tampered)).toBeNull();
  });

  it("verifies real Ed25519 Solana signatures and rejects wrong messages", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const spki = publicKey.export({ format: "der", type: "spki" });
    const rawPubkey = spki.subarray(spki.length - 32);
    const solanaAddress = new PublicKey(rawPubkey).toBase58();

    const message = "Encore SIWS challenge nonce=abc123";
    const signature = crypto.sign(null, Buffer.from(message, "utf8"), privateKey);

    const verifier = new NodeEd25519Verifier();
    expect(
      await verifier.verifyEd25519({
        address: solanaAddress,
        message,
        signatureBase64: signature.toString("base64")
      })
    ).toBe(true);

    expect(
      await verifier.verifyEd25519({
        address: solanaAddress,
        message: "tampered message",
        signatureBase64: signature.toString("base64")
      })
    ).toBe(false);
  });

  it("persists users and wallets in InMemoryIdentityRepository", async () => {
    const repo = new InMemoryIdentityRepository();
    const { user } = await repo.createUserWithIdentity({
      displayName: "Test Listener",
      provider: "google",
      providerSubject: "sub-999"
    });
    await repo.upsertVerifiedWallet({
      userId: user.id,
      address: "11111111111111111111111111111111",
      walletType: "embedded",
      isPrimary: true
    });
    const wallets = await repo.listWalletsForUser(user.id);
    expect(wallets).toHaveLength(1);
    expect(wallets[0]?.walletType).toBe("embedded");
  });
});
