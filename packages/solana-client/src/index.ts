import crypto from "node:crypto";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  DEFAULT_ENCORE_PROGRAM_ID,
  derivePassSeriesPda,
  deriveSupportReceiptPda,
  deriveSupporterPassPda,
  deriveTrackPda,
  hashSeed
} from "./pda/seeds.js";

export * from "./pda/seeds.js";

export * from "./registry.js";

function anchorDiscriminator(ixName: string): Buffer {
  return crypto.createHash("sha256").update(`global:${ixName}`).digest().subarray(0, 8);
}

export function buildUnsignedMemoAnchorEnvelope(params: {
  payer: string;
  programId?: string;
  instructionName: string;
  accountMetas: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>;
  payloadJson: Record<string, unknown>;
}): string {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const payerPubkey = new PublicKey(params.payer);
  const data = Buffer.concat([
    anchorDiscriminator(params.instructionName),
    Buffer.from(JSON.stringify(params.payloadJson), "utf8")
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payerPubkey, isSigner: true, isWritable: true },
      ...params.accountMetas
    ],
    data
  });

  const tx = new Transaction();
  tx.feePayer = payerPubkey;
  tx.recentBlockhash = "11111111111111111111111111111111";
  tx.add(ix);
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

export function deriveMarketplaceAddresses(params: {
  programId?: string;
  payerWallet: string;
  artistWallet: string;
  trackId: string;
  nonce?: bigint;
  seriesId?: string;
  serial?: number;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const payer = new PublicKey(params.payerWallet);
  const artist = new PublicKey(params.artistWallet);
  const [trackPda] = deriveTrackPda(programId, artist, params.trackId);
  const [receiptPda] =
    params.nonce !== undefined
      ? deriveSupportReceiptPda(programId, payer, params.nonce)
      : [null];
  const [seriesPda] = params.seriesId
    ? derivePassSeriesPda(programId, artist, params.seriesId)
    : [null];
  const [passPda] =
    seriesPda && params.serial !== undefined
      ? deriveSupporterPassPda(programId, seriesPda, params.serial)
      : [null];

  return {
    programId,
    trackPda,
    receiptPda,
    seriesPda,
    passPda,
    trackIdHash: hashSeed(params.trackId).toString("hex")
  };
}
