import crypto from "node:crypto";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const PDA_SEEDS = {
  ARTIST: "artist",
  TRACK: "track",
  PASSPORT: "passport",
  SERIES: "series",
  PASS: "pass",
  RECEIPT: "receipt",
  CAMPAIGN: "campaign",
  CAMPAIGN_VAULT: "campaign_vault",
  CAMPAIGN_PLEDGE: "pledge",
  SPOT_LISTING: "spot_listing",
  DISTRIBUTION_CYCLE: "distribution_cycle",
  DISTRIBUTION_VAULT: "distribution_vault",
  DISTRIBUTION_CLAIM: "dist_claim",
  OPINION_MARKET: "opinion_market",
  OPINION_VAULT: "opinion_vault"
} as const;

export const DEFAULT_ENCORE_PROGRAM_ID = "5y78zJvy7hnz2XpBRFLeqVh4Urt4ZEFPsDJHCqotLUu8";
export const DEFAULT_TEST_USDC_MINT = "7H5EwCxRKPJ3rsdb88zsv3k8dEroYzYVguGUP9kjdZnP";
export const SPL_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const SPL_ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export function hashSeed(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

export function deriveArtistPda(
  programId: PublicKey,
  artistAuthority: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.ARTIST), artistAuthority.toBuffer()],
    programId
  );
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

export function deriveCampaignPda(
  programId: PublicKey,
  artistPda: PublicKey,
  campaignId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.CAMPAIGN), artistPda.toBuffer(), hashSeed(campaignId)],
    programId
  );
}

export function deriveCampaignVaultPda(
  programId: PublicKey,
  campaignPda: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.CAMPAIGN_VAULT), campaignPda.toBuffer()],
    programId
  );
}

export function deriveCampaignPledgePda(
  programId: PublicKey,
  campaignPda: PublicKey,
  payer: PublicKey,
  nonce: bigint
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(nonce, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.CAMPAIGN_PLEDGE), campaignPda.toBuffer(), payer.toBuffer(), buf],
    programId
  );
}

export function deriveSpotListingPda(
  programId: PublicKey,
  campaignPda: PublicKey,
  seller: PublicKey,
  listingId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PDA_SEEDS.SPOT_LISTING),
      campaignPda.toBuffer(),
      seller.toBuffer(),
      hashSeed(listingId)
    ],
    programId
  );
}

export function deriveDistributionCyclePda(
  programId: PublicKey,
  campaignPda: PublicKey,
  cycleId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.DISTRIBUTION_CYCLE), campaignPda.toBuffer(), hashSeed(cycleId)],
    programId
  );
}

export function deriveDistributionVaultPda(
  programId: PublicKey,
  cyclePda: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.DISTRIBUTION_VAULT), cyclePda.toBuffer()],
    programId
  );
}

export function deriveDistributionClaimPda(
  programId: PublicKey,
  cyclePda: PublicKey,
  claimer: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.DISTRIBUTION_CLAIM), cyclePda.toBuffer(), claimer.toBuffer()],
    programId
  );
}

export function deriveAssociatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgramId: PublicKey = SPL_TOKEN_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

export function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  tokenProgramId: PublicKey = SPL_TOKEN_PROGRAM_ID
): TransactionInstruction {
  const ata = deriveAssociatedTokenAddress(owner, mint, tokenProgramId);
  return new TransactionInstruction({
    programId: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false }
    ],
    data: Buffer.from([1]) // CreateIdempotent instruction in SPL Associated Token Account program
  });
}
