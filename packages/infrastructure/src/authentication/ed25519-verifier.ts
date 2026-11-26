import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import type { SignatureVerifierPort } from "@encore/core";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export class NodeEd25519Verifier implements SignatureVerifierPort {
  async verifyEd25519(params: {
    address: string;
    message: string;
    signatureBase64: string;
  }): Promise<boolean> {
    try {
      const pubkeyBytes = new PublicKey(params.address).toBytes();
      const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(pubkeyBytes)]);
      const keyObject = crypto.createPublicKey({
        key: spkiDer,
        format: "der",
        type: "spki"
      });
      const sigBytes = Buffer.from(params.signatureBase64, "base64");
      const msgBytes = Buffer.from(params.message, "utf8");
      return crypto.verify(null, msgBytes, keyObject, sigBytes);
    } catch {
      return false;
    }
  }
}
