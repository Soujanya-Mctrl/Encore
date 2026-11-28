import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  REGISTRY_PROGRAM_ID,
  registryAddresses,
  registryTransaction,
  discriminator,
} from "../packages/solana-client/src/index.ts";
const c = new Connection("https://api.devnet.solana.com", "confirmed"),
  payer = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(".local/phase-one/devnet-payer.json", "utf8")),
    ),
  ),
  id = randomUUID(),
  authority = payer.publicKey;
async function send(tx: Transaction) {
  return sendAndConfirmTransaction(c, tx, [payer], { commitment: "confirmed" });
}
async function rejects(tx: Transaction, reason: string, extra: Keypair[] = []) {
  tx.feePayer = authority;
  tx.recentBlockhash = (await c.getLatestBlockhash()).blockhash;
  const result = await c.simulateTransaction(tx, [payer, ...extra]);
  if (
    !result.value.err ||
    !result.value.logs?.some((line) => line.includes(reason))
  )
    throw new Error("Expected chain rejection: " + reason);
}
const a = registryAddresses(authority, id, 1),
  exists = await c.getAccountInfo(a.artist);
const first = await send(
  registryTransaction(authority, id, 1, "a".repeat(64), null, !exists),
);
const original = (await c.getAccountInfo(a.passport))!.data;
await rejects(
  registryTransaction(authority, id, 3, "b".repeat(64), "a".repeat(64), false),
  "StalePassportVersion",
);
await rejects(
  registryTransaction(authority, id, 2, "b".repeat(64), "c".repeat(64), false),
  "StalePassportVersion",
);
await rejects(
  registryTransaction(authority, id, 1, "a".repeat(64), null, false),
  "already in use",
);
function pause(signer = authority, paused = true) {
  return new Transaction().add(
    new TransactionInstruction({
      programId: REGISTRY_PROGRAM_ID,
      keys: [
        { pubkey: signer, isSigner: true, isWritable: false },
        { pubkey: a.artist, isSigner: false, isWritable: false },
        { pubkey: a.track, isSigner: false, isWritable: true },
      ],
      data: Buffer.concat([
        discriminator("global:set_paused"),
        Buffer.from([paused ? 1 : 0]),
      ]),
    }),
  );
}
const stranger = Keypair.generate();
await rejects(pause(stranger.publicKey), "ConstraintSeeds", [stranger]);
await send(pause());
await rejects(
  registryTransaction(authority, id, 2, "b".repeat(64), "a".repeat(64), false),
  "TrackPaused",
);
await send(pause(authority, false));
const second = await send(
  registryTransaction(authority, id, 2, "b".repeat(64), "a".repeat(64), false),
);
if (!(await c.getAccountInfo(a.passport))!.data.equals(original))
  throw new Error("Old Passport was modified");
const result = {
  checkedAt: new Date().toISOString(),
  status: "passed",
  programId: REGISTRY_PROGRAM_ID.toBase58(),
  firstVersionSignature: first,
  secondVersionSignature: second,
  checks: [
    "real devnet register v1 and append v2",
    "monotonic version rejection",
    "previous hash mismatch rejection",
    "duplicate version rejection",
    "unauthorized signer rejection",
    "paused track rejection",
    "old Passport bytes unchanged",
  ],
};
writeFileSync(
  ".local/phase-two/registry-security.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
