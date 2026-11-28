import crypto from "node:crypto";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import {
  DEFAULT_ENCORE_PROGRAM_ID,
  DEFAULT_TEST_USDC_MINT,
  SPL_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  deriveArtistPda,
  deriveAssociatedTokenAddress,
  deriveCampaignPda,
  deriveCampaignPledgePda,
  deriveCampaignVaultPda,
  deriveDistributionClaimPda,
  deriveDistributionCyclePda,
  deriveDistributionVaultPda,
  derivePassSeriesPda,
  deriveSpotListingPda,
  deriveSupportReceiptPda,
  deriveSupporterPassPda,
  deriveTrackPda,
  hashSeed
} from "./pda/seeds.js";

function disc(prefix: "global" | "event" | "account", name: string): Buffer {
  return crypto.createHash("sha256").update(`${prefix}:${name}`).digest().subarray(0, 8);
}

function u32le(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value, 0);
  return b;
}

function u64le(value: bigint | number | string): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(value), 0);
  return b;
}

function i64le(value: bigint | number | string): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(value), 0);
  return b;
}

function hash32(hexOrSeed: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(hexOrSeed)) {
    return Buffer.from(hexOrSeed, "hex");
  }
  return hashSeed(hexOrSeed);
}

function meta(pubkey: PublicKey, isSigner = false, isWritable = true) {
  return { pubkey, isSigner, isWritable };
}

export function buildDirectSupportInstructions(params: {
  programId?: string;
  mint?: string;
  payerWallet: string;
  artistWallet: string;
  trackId: string;
  version: number;
  manifestHash: string;
  amountSmallestUnits: string;
  nonce: string;
  ensureAtas?: boolean;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const payer = new PublicKey(params.payerWallet);
  const artistAuthority = new PublicKey(params.artistWallet);
  const [artistPda] = deriveArtistPda(programId, artistAuthority);
  const [trackPda] = deriveTrackPda(programId, artistPda, params.trackId);
  const [receiptPda] = deriveSupportReceiptPda(programId, payer, BigInt(params.nonce));
  const payerAta = deriveAssociatedTokenAddress(payer, mint);
  const artistAta = deriveAssociatedTokenAddress(artistAuthority, mint);

  const instructions: TransactionInstruction[] = [];
  if (params.ensureAtas) {
    instructions.push(createAssociatedTokenAccountIdempotentInstruction(payer, artistAuthority, mint));
  }
  instructions.push(
    new TransactionInstruction({
      programId,
      keys: [
        meta(payer, true, true),
        meta(artistPda, false, false),
        meta(trackPda, false, false),
        meta(mint, false, false),
        meta(payerAta, false, true),
        meta(artistAta, false, true),
        meta(receiptPda, false, true),
        meta(SPL_TOKEN_PROGRAM_ID, false, false),
        meta(SystemProgram.programId, false, false)
      ],
      data: Buffer.concat([
        disc("global", "direct_support"),
        u64le(params.nonce),
        u32le(params.version),
        hash32(params.manifestHash),
        u64le(params.amountSmallestUnits)
      ])
    })
  );

  return { instructions, programId, mint, artistPda, trackPda, receiptPda, payerAta, artistAta };
}

export function buildCreateSeriesInstructions(params: {
  programId?: string;
  mint?: string;
  artistWallet: string;
  platformWallet: string;
  trackId: string;
  seriesId: string;
  termsHash: string;
  benefitHash: string;
  cap: number;
  primaryPriceSmallestUnits: string;
  expiryUnixSeconds: number;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const authority = new PublicKey(params.artistWallet);
  const platformWallet = new PublicKey(params.platformWallet);
  const [artistPda] = deriveArtistPda(programId, authority);
  const [trackPda] = deriveTrackPda(programId, artistPda, params.trackId);
  const [seriesPda] = derivePassSeriesPda(programId, artistPda, params.seriesId);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      meta(authority, true, true),
      meta(artistPda, false, false),
      meta(trackPda, false, false),
      meta(mint, false, false),
      meta(platformWallet, false, false),
      meta(seriesPda, false, true),
      meta(SystemProgram.programId, false, false)
    ],
    data: Buffer.concat([
      disc("global", "create_series"),
      hashSeed(params.seriesId),
      hash32(params.termsHash),
      hash32(params.benefitHash),
      u32le(params.cap),
      u64le(params.primaryPriceSmallestUnits),
      i64le(params.expiryUnixSeconds)
    ])
  });

  return { instructions: [ix], programId, mint, artistPda, trackPda, seriesPda };
}

export function buildBuyPrimaryInstructions(params: {
  programId?: string;
  mint?: string;
  buyerWallet: string;
  artistWallet: string;
  platformWallet: string;
  trackId: string;
  seriesId: string;
  serial: number;
  version: number;
  manifestHash: string;
  ensureAtas?: boolean;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const buyer = new PublicKey(params.buyerWallet);
  const artistAuthority = new PublicKey(params.artistWallet);
  const platformWallet = new PublicKey(params.platformWallet);
  const [artistPda] = deriveArtistPda(programId, artistAuthority);
  const [trackPda] = deriveTrackPda(programId, artistPda, params.trackId);
  const [seriesPda] = derivePassSeriesPda(programId, artistPda, params.seriesId);
  const [passPda] = deriveSupporterPassPda(programId, seriesPda, params.serial);
  const buyerAta = deriveAssociatedTokenAddress(buyer, mint);
  const artistAta = deriveAssociatedTokenAddress(artistAuthority, mint);
  const platformAta = deriveAssociatedTokenAddress(platformWallet, mint);

  const instructions: TransactionInstruction[] = [];
  if (params.ensureAtas) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(buyer, artistAuthority, mint),
      createAssociatedTokenAccountIdempotentInstruction(buyer, platformWallet, mint)
    );
  }
  instructions.push(
    new TransactionInstruction({
      programId,
      keys: [
        meta(buyer, true, true),
        meta(artistPda, false, false),
        meta(trackPda, false, false),
        meta(seriesPda, false, true),
        meta(passPda, false, true),
        meta(buyerAta, false, true),
        meta(artistAta, false, true),
        meta(platformAta, false, true),
        meta(SPL_TOKEN_PROGRAM_ID, false, false),
        meta(SystemProgram.programId, false, false)
      ],
      data: Buffer.concat([
        disc("global", "buy_primary"),
        u32le(params.version),
        hash32(params.manifestHash)
      ])
    })
  );

  return { instructions, programId, mint, artistPda, trackPda, seriesPda, passPda };
}

export function buildListPassInstructions(params: {
  programId?: string;
  ownerWallet: string;
  artistWallet: string;
  trackId: string;
  seriesId: string;
  serial: number;
  listingPriceSmallestUnits: string;
  listingExpiryUnixSeconds: number;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const owner = new PublicKey(params.ownerWallet);
  const artistAuthority = new PublicKey(params.artistWallet);
  const [artistPda] = deriveArtistPda(programId, artistAuthority);
  const [trackPda] = deriveTrackPda(programId, artistPda, params.trackId);
  const [seriesPda] = derivePassSeriesPda(programId, artistPda, params.seriesId);
  const [passPda] = deriveSupporterPassPda(programId, seriesPda, params.serial);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      meta(owner, true, false),
      meta(trackPda, false, false),
      meta(seriesPda, false, false),
      meta(passPda, false, true)
    ],
    data: Buffer.concat([
      disc("global", "list_pass"),
      u64le(params.listingPriceSmallestUnits),
      i64le(params.listingExpiryUnixSeconds)
    ])
  });

  return { instructions: [ix], programId, seriesPda, passPda };
}

export function buildCancelPassListingInstructions(params: {
  programId?: string;
  ownerWallet: string;
  artistWallet: string;
  seriesId: string;
  serial: number;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const owner = new PublicKey(params.ownerWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [seriesPda] = derivePassSeriesPda(programId, artistPda, params.seriesId);
  const [passPda] = deriveSupporterPassPda(programId, seriesPda, params.serial);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      meta(owner, true, false),
      meta(seriesPda, false, false),
      meta(passPda, false, true)
    ],
    data: disc("global", "cancel_pass_listing")
  });

  return { instructions: [ix], programId, seriesPda, passPda };
}

export function buildBuyListingInstructions(params: {
  programId?: string;
  mint?: string;
  buyerWallet: string;
  sellerWallet: string;
  artistWallet: string;
  platformWallet: string;
  trackId: string;
  seriesId: string;
  serial: number;
  expectedNonce: number;
  expectedVersion: number;
  manifestHash: string;
  ensureAtas?: boolean;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const buyer = new PublicKey(params.buyerWallet);
  const seller = new PublicKey(params.sellerWallet);
  const artistAuthority = new PublicKey(params.artistWallet);
  const platformWallet = new PublicKey(params.platformWallet);
  const [artistPda] = deriveArtistPda(programId, artistAuthority);
  const [trackPda] = deriveTrackPda(programId, artistPda, params.trackId);
  const [seriesPda] = derivePassSeriesPda(programId, artistPda, params.seriesId);
  const [passPda] = deriveSupporterPassPda(programId, seriesPda, params.serial);

  const buyerAta = deriveAssociatedTokenAddress(buyer, mint);
  const sellerAta = deriveAssociatedTokenAddress(seller, mint);
  const artistAta = deriveAssociatedTokenAddress(artistAuthority, mint);
  const platformAta = deriveAssociatedTokenAddress(platformWallet, mint);

  const instructions: TransactionInstruction[] = [];
  if (params.ensureAtas) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(buyer, seller, mint),
      createAssociatedTokenAccountIdempotentInstruction(buyer, artistAuthority, mint),
      createAssociatedTokenAccountIdempotentInstruction(buyer, platformWallet, mint)
    );
  }
  instructions.push(
    new TransactionInstruction({
      programId,
      keys: [
        meta(buyer, true, true),
        meta(artistPda, false, false),
        meta(trackPda, false, false),
        meta(seriesPda, false, false),
        meta(passPda, false, true),
        meta(buyerAta, false, true),
        meta(sellerAta, false, true),
        meta(artistAta, false, true),
        meta(platformAta, false, true),
        meta(SPL_TOKEN_PROGRAM_ID, false, false)
      ],
      data: Buffer.concat([
        disc("global", "buy_listing"),
        u64le(params.expectedNonce),
        u32le(params.expectedVersion),
        hash32(params.manifestHash)
      ])
    })
  );

  return { instructions, programId, mint, artistPda, trackPda, seriesPda, passPda };
}

export function buildRedeemPassInstructions(params: {
  programId?: string;
  ownerWallet: string;
  artistWallet: string;
  seriesId: string;
  serial: number;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const owner = new PublicKey(params.ownerWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [seriesPda] = derivePassSeriesPda(programId, artistPda, params.seriesId);
  const [passPda] = deriveSupporterPassPda(programId, seriesPda, params.serial);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      meta(owner, true, false),
      meta(seriesPda, false, false),
      meta(passPda, false, true)
    ],
    data: disc("global", "redeem_pass")
  });

  return { instructions: [ix], programId, seriesPda, passPda };
}

export function buildExpirePassInstructions(params: {
  programId?: string;
  artistWallet: string;
  seriesId: string;
  serial: number;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [seriesPda] = derivePassSeriesPda(programId, artistPda, params.seriesId);
  const [passPda] = deriveSupporterPassPda(programId, seriesPda, params.serial);

  const ix = new TransactionInstruction({
    programId,
    keys: [meta(seriesPda, false, false), meta(passPda, false, true)],
    data: disc("global", "expire_pass")
  });

  return { instructions: [ix], programId, seriesPda, passPda };
}

export function buildCreateCampaignInstructions(params: {
  programId?: string;
  mint?: string;
  artistWallet: string;
  trackId: string;
  campaignId: string;
  termsHash: string;
  goalSmallestUnits: string;
  shareSupply: number;
  deadlineUnixSeconds: number;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const authority = new PublicKey(params.artistWallet);
  const [artistPda] = deriveArtistPda(programId, authority);
  const [trackPda] = deriveTrackPda(programId, artistPda, params.trackId);
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const [campaignVaultPda] = deriveCampaignVaultPda(programId, campaignPda);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      meta(authority, true, true),
      meta(artistPda, false, false),
      meta(trackPda, false, false),
      meta(mint, false, false),
      meta(campaignPda, false, true),
      meta(campaignVaultPda, false, true),
      meta(SPL_TOKEN_PROGRAM_ID, false, false),
      meta(SystemProgram.programId, false, false)
    ],
    data: Buffer.concat([
      disc("global", "create_campaign"),
      hashSeed(params.campaignId),
      hash32(params.termsHash),
      u64le(params.goalSmallestUnits),
      u64le(params.shareSupply),
      i64le(params.deadlineUnixSeconds)
    ])
  });

  return {
    instructions: [ix],
    programId,
    mint,
    artistPda,
    trackPda,
    campaignPda,
    campaignVaultPda
  };
}

export function buildPledgeCampaignInstructions(params: {
  programId?: string;
  mint?: string;
  payerWallet: string;
  artistWallet: string;
  campaignId: string;
  vaultAddress?: string;
  nonce: string;
  amountSmallestUnits: string;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const payer = new PublicKey(params.payerWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const vaultPda = params.vaultAddress
    ? new PublicKey(params.vaultAddress)
    : deriveCampaignVaultPda(programId, campaignPda)[0];
  const [pledgePda] = deriveCampaignPledgePda(programId, campaignPda, payer, BigInt(params.nonce));
  const payerAta = deriveAssociatedTokenAddress(payer, mint);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      meta(payer, true, true),
      meta(campaignPda, false, true),
      meta(pledgePda, false, true),
      meta(payerAta, false, true),
      meta(vaultPda, false, true),
      meta(SPL_TOKEN_PROGRAM_ID, false, false),
      meta(SystemProgram.programId, false, false)
    ],
    data: Buffer.concat([
      disc("global", "pledge_campaign"),
      u64le(params.nonce),
      u64le(params.amountSmallestUnits)
    ])
  });

  return { instructions: [ix], programId, mint, campaignPda, pledgePda, vaultPda };
}

export function buildReleaseMilestoneInstructions(params: {
  programId?: string;
  mint?: string;
  artistWallet: string;
  campaignId: string;
  vaultAddress?: string;
  milestoneIndex: number;
  amountSmallestUnits: string;
  ensureAtas?: boolean;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const authority = new PublicKey(params.artistWallet);
  const [artistPda] = deriveArtistPda(programId, authority);
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const vaultPda = params.vaultAddress
    ? new PublicKey(params.vaultAddress)
    : deriveCampaignVaultPda(programId, campaignPda)[0];
  const artistAta = deriveAssociatedTokenAddress(authority, mint);

  const instructions: TransactionInstruction[] = [];
  if (params.ensureAtas) {
    instructions.push(createAssociatedTokenAccountIdempotentInstruction(authority, authority, mint));
  }
  instructions.push(
    new TransactionInstruction({
      programId,
      keys: [
        meta(authority, true, false),
        meta(artistPda, false, false),
        meta(campaignPda, false, true),
        meta(vaultPda, false, true),
        meta(artistAta, false, true),
        meta(SPL_TOKEN_PROGRAM_ID, false, false)
      ],
      data: Buffer.concat([
        disc("global", "release_milestone"),
        u32le(params.milestoneIndex),
        u64le(params.amountSmallestUnits)
      ])
    })
  );

  return { instructions, programId, mint, campaignPda, vaultPda };
}

export function buildRefundCampaignInstructions(params: {
  programId?: string;
  mint?: string;
  claimerWallet: string;
  artistWallet: string;
  campaignId: string;
  vaultAddress?: string;
  pledgeNonce: string;
  ensureAtas?: boolean;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const claimer = new PublicKey(params.claimerWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const vaultPda = params.vaultAddress
    ? new PublicKey(params.vaultAddress)
    : deriveCampaignVaultPda(programId, campaignPda)[0];
  const [pledgePda] = deriveCampaignPledgePda(
    programId,
    campaignPda,
    claimer,
    BigInt(params.pledgeNonce)
  );
  const claimerAta = deriveAssociatedTokenAddress(claimer, mint);

  const instructions: TransactionInstruction[] = [];
  if (params.ensureAtas) {
    instructions.push(createAssociatedTokenAccountIdempotentInstruction(claimer, claimer, mint));
  }
  instructions.push(
    new TransactionInstruction({
      programId,
      keys: [
        meta(claimer, true, false),
        meta(campaignPda, false, true),
        meta(pledgePda, false, true),
        meta(vaultPda, false, true),
        meta(claimerAta, false, true),
        meta(SPL_TOKEN_PROGRAM_ID, false, false)
      ],
      data: disc("global", "refund_campaign")
    })
  );

  return { instructions, programId, mint, campaignPda, pledgePda, vaultPda };
}

export function buildCreateSpotListingInstructions(params: {
  programId?: string;
  sellerWallet: string;
  artistWallet: string;
  campaignId: string;
  spotListingId: string;
  units: number;
  unitPriceSmallestUnits: string;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const seller = new PublicKey(params.sellerWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const [spotListingPda] = deriveSpotListingPda(
    programId,
    campaignPda,
    seller,
    params.spotListingId
  );

  const ix = new TransactionInstruction({
    programId,
    keys: [
      meta(seller, true, true),
      meta(campaignPda, false, false),
      meta(spotListingPda, false, true),
      meta(SystemProgram.programId, false, false)
    ],
    data: Buffer.concat([
      disc("global", "create_spot_listing"),
      hashSeed(params.spotListingId),
      u32le(params.units),
      u64le(params.unitPriceSmallestUnits)
    ])
  });

  return { instructions: [ix], programId, campaignPda, spotListingPda };
}

export function buildCancelSpotListingInstructions(params: {
  programId?: string;
  sellerWallet: string;
  artistWallet: string;
  campaignId: string;
  spotListingId: string;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const seller = new PublicKey(params.sellerWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const [spotListingPda] = deriveSpotListingPda(
    programId,
    campaignPda,
    seller,
    params.spotListingId
  );

  const ix = new TransactionInstruction({
    programId,
    keys: [meta(seller, true, false), meta(spotListingPda, false, true)],
    data: disc("global", "cancel_spot_listing")
  });

  return { instructions: [ix], programId, campaignPda, spotListingPda };
}

export function buildBuySpotInstructions(params: {
  programId?: string;
  mint?: string;
  buyerWallet: string;
  sellerWallet: string;
  artistWallet: string;
  campaignId: string;
  spotListingId: string;
  units: number;
  expectedNonce: number;
  ensureAtas?: boolean;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const buyer = new PublicKey(params.buyerWallet);
  const seller = new PublicKey(params.sellerWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const [spotListingPda] = deriveSpotListingPda(
    programId,
    campaignPda,
    seller,
    params.spotListingId
  );
  const buyerAta = deriveAssociatedTokenAddress(buyer, mint);
  const sellerAta = deriveAssociatedTokenAddress(seller, mint);

  const instructions: TransactionInstruction[] = [];
  if (params.ensureAtas) {
    instructions.push(createAssociatedTokenAccountIdempotentInstruction(buyer, seller, mint));
  }
  instructions.push(
    new TransactionInstruction({
      programId,
      keys: [
        meta(buyer, true, true),
        meta(spotListingPda, false, true),
        meta(buyerAta, false, true),
        meta(sellerAta, false, true),
        meta(SPL_TOKEN_PROGRAM_ID, false, false)
      ],
      data: Buffer.concat([
        disc("global", "buy_spot"),
        u32le(params.units),
        u64le(params.expectedNonce)
      ])
    })
  );

  return { instructions, programId, mint, campaignPda, spotListingPda };
}

export function buildOpenDistributionCycleInstructions(params: {
  programId?: string;
  mint?: string;
  authorityWallet: string;
  artistWallet: string;
  campaignId: string;
  cycleId: string;
  evidenceHash: string;
  merkleRootHex: string;
  verifiedRevenueSmallestUnits: string;
  totalSupplySnapshot: number;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const authority = new PublicKey(params.authorityWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const [cyclePda] = deriveDistributionCyclePda(programId, campaignPda, params.cycleId);
  const [distributionVaultPda] = deriveDistributionVaultPda(programId, cyclePda);
  const funderAta = deriveAssociatedTokenAddress(authority, mint);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      meta(authority, true, true),
      meta(campaignPda, false, false),
      meta(mint, false, false),
      meta(funderAta, false, true),
      meta(cyclePda, false, true),
      meta(distributionVaultPda, false, true),
      meta(SPL_TOKEN_PROGRAM_ID, false, false),
      meta(SystemProgram.programId, false, false)
    ],
    data: Buffer.concat([
      disc("global", "open_distribution_cycle"),
      hashSeed(params.cycleId),
      hash32(params.evidenceHash),
      hash32(params.merkleRootHex),
      u64le(params.verifiedRevenueSmallestUnits),
      u64le(params.totalSupplySnapshot)
    ])
  });

  return { instructions: [ix], programId, mint, campaignPda, cyclePda, distributionVaultPda };
}

export function buildClaimDistributionInstructions(params: {
  programId?: string;
  mint?: string;
  claimerWallet: string;
  artistWallet: string;
  campaignId: string;
  cycleId: string;
  payoutSmallestUnits: string;
  merkleProof: readonly Buffer[];
  ensureAtas?: boolean;
}) {
  const programId = new PublicKey(params.programId ?? DEFAULT_ENCORE_PROGRAM_ID);
  const mint = new PublicKey(params.mint ?? DEFAULT_TEST_USDC_MINT);
  const claimer = new PublicKey(params.claimerWallet);
  const [artistPda] = deriveArtistPda(programId, new PublicKey(params.artistWallet));
  const [campaignPda] = deriveCampaignPda(programId, artistPda, params.campaignId);
  const [cyclePda] = deriveDistributionCyclePda(programId, campaignPda, params.cycleId);
  const [distributionVaultPda] = deriveDistributionVaultPda(programId, cyclePda);
  const [claimPda] = deriveDistributionClaimPda(programId, cyclePda, claimer);
  const claimerAta = deriveAssociatedTokenAddress(claimer, mint);

  const instructions: TransactionInstruction[] = [];
  if (params.ensureAtas) {
    instructions.push(createAssociatedTokenAccountIdempotentInstruction(claimer, claimer, mint));
  }
  instructions.push(
    new TransactionInstruction({
      programId,
      keys: [
        meta(claimer, true, true),
        meta(cyclePda, false, true),
        meta(distributionVaultPda, false, true),
        meta(claimerAta, false, true),
        meta(claimPda, false, true),
        meta(SPL_TOKEN_PROGRAM_ID, false, false),
        meta(SystemProgram.programId, false, false)
      ],
      data: Buffer.concat([
        disc("global", "claim_distribution"),
        u64le(params.payoutSmallestUnits),
        u32le(params.merkleProof.length),
        ...params.merkleProof
      ])
    })
  );

  return { instructions, programId, mint, campaignPda, cyclePda, distributionVaultPda, claimPda };
}

export function serializeUnsignedTransaction(params: {
  payer: string;
  instructions: readonly TransactionInstruction[];
  recentBlockhash: string;
}): string {
  const tx = new Transaction();
  tx.feePayer = new PublicKey(params.payer);
  tx.recentBlockhash = params.recentBlockhash;
  tx.add(...params.instructions);
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

const KNOWN_EVENTS = [
  "SupportReceiptEvent",
  "SeriesCreatedEvent",
  "PassPurchasedEvent",
  "PassListedEvent",
  "PassListingCancelledEvent",
  "PassResoldEvent",
  "PassRedeemedEvent",
  "PassExpiredEvent",
  "CampaignCreatedEvent",
  "CampaignPledgedEvent",
  "CampaignMilestoneReleasedEvent",
  "CampaignRefundedEvent",
  "SpotListingCreatedEvent",
  "SpotListingCancelledEvent",
  "SpotFilledEvent",
  "DistributionCycleOpenedEvent",
  "DistributionClaimedEvent"
] as const;

export type EncoreEventName = (typeof KNOWN_EVENTS)[number];

const EVENT_DISCS = new Map<string, EncoreEventName>(
  KNOWN_EVENTS.map((name) => [disc("event", name).toString("hex"), name])
);

export function extractEncoreEventsFromLogs(
  logMessages: readonly string[]
): Array<{ name: EncoreEventName; dataBase64: string }> {
  const events: Array<{ name: EncoreEventName; dataBase64: string }> = [];
  for (const line of logMessages) {
    if (!line.startsWith("Program data: ")) continue;
    const raw = Buffer.from(line.slice("Program data: ".length).trim(), "base64");
    if (raw.length < 8) continue;
    const name = EVENT_DISCS.get(raw.subarray(0, 8).toString("hex"));
    if (name) {
      events.push({ name, dataBase64: raw.subarray(8).toString("base64") });
    }
  }
  return events;
}
