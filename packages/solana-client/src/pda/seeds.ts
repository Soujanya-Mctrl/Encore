import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";

export const PDA_SEEDS = {
  ARTIST: "artist",
  TRACK: "track",
  PASSPORT: "passport",
  SERIES: "series",
  PASS: "pass",
  RECEIPT: "receipt",
  CAMPAIGN: "campaign",
  CAMPAIGN_VAULT: "campaign_vault",
  SPOT_LISTING: "spot_listing",
  DISTRIBUTION_CYCLE: "distribution_cycle",
  OPINION_MARKET: "opinion_market",
  OPINION_VAULT: "opinion_vault"
} as const;

export const DEFAULT_ENCORE_PROGRAM_ID = "11111111111111111111111111111111";

export function hashSeed(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

export function deriveTrackPda(
  programId: PublicKey,
  artist: PublicKey,
  trackId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.TRACK), artist.toBuffer(), hashSeed(trackId)],
    programId
  );
}

export function derivePassportVersionPda(
  programId: PublicKey,
  trackPda: PublicKey,
  version: number
): [PublicKey, number] {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(version, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.PASSPORT), trackPda.toBuffer(), buf],
    programId
  );
}

export function deriveSupportReceiptPda(
  programId: PublicKey,
  payer: PublicKey,
  nonce: bigint
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(nonce, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.RECEIPT), payer.toBuffer(), buf],
    programId
  );
}

export function derivePassSeriesPda(
  programId: PublicKey,
  artist: PublicKey,
  seriesId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.SERIES), artist.toBuffer(), hashSeed(seriesId)],
    programId
  );
}

export function deriveSupporterPassPda(
  programId: PublicKey,
  seriesPda: PublicKey,
  serial: number
): [PublicKey, number] {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(serial, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.PASS), seriesPda.toBuffer(), buf],
    programId
  );
}
