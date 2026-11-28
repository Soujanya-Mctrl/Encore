import { readFile } from "node:fs/promises";
import { schnorr } from "@noble/curves/secp256k1";
import { ProvenanceProofSchema } from "@encore/contracts";
import { provenanceMessages } from "./schnorr.js";

// The witness stays on the creator's machine. Use a fresh random scalar per credential.
const file = process.argv[2];
if (!file) throw new Error("Usage: prove.ts /private/path/credential.json");
const { credentialSecret, ...record } = JSON.parse(await readFile(file, "utf8"));
if (typeof credentialSecret !== "string" || !/^[0-9a-f]{64}$/.test(credentialSecret)) {
  throw new Error("Credential requires a 32-byte private scalar");
}
const credentialKey = Buffer.from(schnorr.getPublicKey(credentialSecret)).toString("hex");
const unsigned = ProvenanceProofSchema.parse({ ...record, credentialKey, possessionProof: "0".repeat(128) });
const { possession } = provenanceMessages(unsigned.binding, credentialKey, unsigned.graphHash);
const proof = { ...unsigned, possessionProof: Buffer.from(schnorr.sign(possession, credentialSecret)).toString("hex") };
process.stdout.write(JSON.stringify(proof) + "\n");
