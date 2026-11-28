import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  DEFAULT_ENCORE_PROGRAM_ID,
  buildBuyListingInstructions,
  buildBuyPrimaryInstructions,
  buildBuySpotInstructions,
  buildCancelPassListingInstructions,
  buildCancelSpotListingInstructions,
  buildClaimDistributionInstructions,
  buildCreateCampaignInstructions,
  buildCreateSeriesInstructions,
  buildCreateSpotListingInstructions,
  buildDirectSupportInstructions,
  buildDistributionMerkleTree,
  buildExpirePassInstructions,
  buildListPassInstructions,
  buildOpenDistributionCycleInstructions,
  buildPledgeCampaignInstructions,
  buildRedeemPassInstructions,
  buildRefundCampaignInstructions,
  buildReleaseMilestoneInstructions,
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
  distributionLeaf,
  extractEncoreEventsFromLogs,
  serializeUnsignedTransaction,
  verifyDistributionMerkleProof
} from "./index.js";

function anchorDisc(prefix: "global" | "event", name: string): Buffer {
  return crypto.createHash("sha256").update(`${prefix}:${name}`).digest().subarray(0, 8);
}

describe("@encore/solana-client marketplace builders, PDAs & Merkle proofs", () => {
  const artist = Keypair.generate().publicKey.toBase58();
  const payer = Keypair.generate().publicKey.toBase58();
  const buyer = Keypair.generate().publicKey.toBase58();
  const platform = Keypair.generate().publicKey.toBase58();
  const manifestHash = "a".repeat(64);
  const termsHash = "b".repeat(64);
  const benefitHash = "c".repeat(64);
  const evidenceHash = "d".repeat(64);

  it("derives deterministic PDAs and ATAs matching Anchor seeds", () => {
    const programPk = new PublicKey(DEFAULT_ENCORE_PROGRAM_ID);
    const artistPk = new PublicKey(artist);
    const payerPk = new PublicKey(payer);
    const buyerPk = new PublicKey(buyer);

    const [artistPda, artistBump] = deriveArtistPda(programPk, artistPk);
    const [artistPda2] = deriveArtistPda(programPk, artistPk);
    expect(artistPda.equals(artistPda2)).toBe(true);
    expect(artistBump).toBeGreaterThanOrEqual(0);

    const [trackPda] = deriveTrackPda(programPk, artistPda, "track-1");
    const [seriesPda] = derivePassSeriesPda(programPk, artistPda, "series-1");
    const [passPda] = deriveSupporterPassPda(programPk, seriesPda, 1);
    const [receiptPda] = deriveSupportReceiptPda(programPk, payerPk, 1n);
    const [campaignPda] = deriveCampaignPda(programPk, artistPda, "camp-1");
    const [vaultPda] = deriveCampaignVaultPda(programPk, campaignPda);
    const [pledgePda] = deriveCampaignPledgePda(programPk, campaignPda, payerPk, 7n);
    const [spotPda] = deriveSpotListingPda(programPk, campaignPda, payerPk, "spot-1");
    const [cyclePda] = deriveDistributionCyclePda(programPk, campaignPda, "cycle-1");
    const [distVaultPda] = deriveDistributionVaultPda(programPk, cyclePda);
    const [claimPda] = deriveDistributionClaimPda(programPk, cyclePda, buyerPk);

    const unique = new Set([
      artistPda.toBase58(),
      trackPda.toBase58(),
      seriesPda.toBase58(),
      passPda.toBase58(),
      receiptPda.toBase58(),
      campaignPda.toBase58(),
      vaultPda.toBase58(),
      pledgePda.toBase58(),
      spotPda.toBase58(),
      cyclePda.toBase58(),
      distVaultPda.toBase58(),
      claimPda.toBase58()
    ]);
    expect(unique.size).toBe(12);

    const ata = deriveAssociatedTokenAddress(payerPk, programPk);
    expect(ata.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("builds Borsh Anchor instructions with exact discriminators for all 17 marketplace instructions", () => {
    const cases: Array<[string, { instructions: Array<{ data: Buffer; programId: { toBase58(): string } }> }]> = [
      [
        "direct_support",
        buildDirectSupportInstructions({
          payerWallet: payer,
          artistWallet: artist,
          trackId: "track-1",
          version: 1,
          manifestHash,
          amountSmallestUnits: "5000000",
          nonce: "1"
        })
      ],
      [
        "create_series",
        buildCreateSeriesInstructions({
          artistWallet: artist,
          platformWallet: platform,
          trackId: "track-1",
          seriesId: "series-1",
          termsHash,
          benefitHash,
          cap: 50,
          primaryPriceSmallestUnits: "10000000",
          expiryUnixSeconds: 1_900_000_000
        })
      ],
      [
        "buy_primary",
        buildBuyPrimaryInstructions({
          buyerWallet: buyer,
          artistWallet: artist,
          platformWallet: platform,
          trackId: "track-1",
          seriesId: "series-1",
          serial: 1,
          version: 1,
          manifestHash
        })
      ],
      [
        "list_pass",
        buildListPassInstructions({
          ownerWallet: buyer,
          artistWallet: artist,
          trackId: "track-1",
          seriesId: "series-1",
          serial: 1,
          listingPriceSmallestUnits: "15000000",
          listingExpiryUnixSeconds: 1_890_000_000
        })
      ],
      [
        "cancel_pass_listing",
        buildCancelPassListingInstructions({
          ownerWallet: buyer,
          artistWallet: artist,
          seriesId: "series-1",
          serial: 1
        })
      ],
      [
        "buy_listing",
        buildBuyListingInstructions({
          buyerWallet: payer,
          sellerWallet: buyer,
          artistWallet: artist,
          platformWallet: platform,
          trackId: "track-1",
          seriesId: "series-1",
          serial: 1,
          expectedNonce: 1,
          expectedVersion: 1,
          manifestHash
        })
      ],
      [
        "redeem_pass",
        buildRedeemPassInstructions({
          ownerWallet: payer,
          artistWallet: artist,
          seriesId: "series-1",
          serial: 1
        })
      ],
      [
        "expire_pass",
        buildExpirePassInstructions({
          artistWallet: artist,
          seriesId: "series-1",
          serial: 1
        })
      ],
      [
        "create_campaign",
        buildCreateCampaignInstructions({
          artistWallet: artist,
          trackId: "track-1",
          campaignId: "camp-1",
          termsHash,
          goalSmallestUnits: "500000000",
          shareSupply: 500,
          deadlineUnixSeconds: 1_900_000_000
        })
      ],
      [
        "pledge_campaign",
        buildPledgeCampaignInstructions({
          payerWallet: payer,
          artistWallet: artist,
          campaignId: "camp-1",
          nonce: "1",
          amountSmallestUnits: "25000000"
        })
      ],
      [
        "release_milestone",
        buildReleaseMilestoneInstructions({
          artistWallet: artist,
          campaignId: "camp-1",
          milestoneIndex: 0,
          amountSmallestUnits: "100000000"
        })
      ],
      [
        "refund_campaign",
        buildRefundCampaignInstructions({
          claimerWallet: payer,
          artistWallet: artist,
          campaignId: "camp-1",
          pledgeNonce: "1"
        })
      ],
      [
        "create_spot_listing",
        buildCreateSpotListingInstructions({
          sellerWallet: payer,
          artistWallet: artist,
          campaignId: "camp-1",
          spotListingId: "spot-1",
          units: 10,
          unitPriceSmallestUnits: "1200000"
        })
      ],
      [
        "cancel_spot_listing",
        buildCancelSpotListingInstructions({
          sellerWallet: payer,
          artistWallet: artist,
          campaignId: "camp-1",
          spotListingId: "spot-1"
        })
      ],
      [
        "buy_spot",
        buildBuySpotInstructions({
          buyerWallet: buyer,
          sellerWallet: payer,
          artistWallet: artist,
          campaignId: "camp-1",
          spotListingId: "spot-1",
          units: 5,
          expectedNonce: 0
        })
      ],
      [
        "open_distribution_cycle",
        buildOpenDistributionCycleInstructions({
          authorityWallet: platform,
          artistWallet: artist,
          campaignId: "camp-1",
          cycleId: "cycle-1",
          evidenceHash,
          merkleRootHex: "e".repeat(64),
          verifiedRevenueSmallestUnits: "100000000",
          totalSupplySnapshot: 500
        })
      ],
      [
        "claim_distribution",
        buildClaimDistributionInstructions({
          claimerWallet: buyer,
          artistWallet: artist,
          campaignId: "camp-1",
          cycleId: "cycle-1",
          payoutSmallestUnits: "20000000",
          merkleProof: [Buffer.alloc(32, 1)]
        })
      ]
    ];

    for (const [name, built] of cases) {
      const ix = built.instructions[built.instructions.length - 1]!;
      expect(ix.programId.toBase58()).toBe(DEFAULT_ENCORE_PROGRAM_ID);
      expect(ix.data.subarray(0, 8).equals(anchorDisc("global", name))).toBe(true);
    }

    const base64 = serializeUnsignedTransaction({
      payer,
      instructions: cases[0]![1].instructions as any,
      recentBlockhash: "11111111111111111111111111111111"
    });
    const decoded = Transaction.from(Buffer.from(base64, "base64"));
    expect(decoded.feePayer?.toBase58()).toBe(payer);
    expect(decoded.instructions.length).toBeGreaterThanOrEqual(1);
  });

  it("builds verifiable SHA-256 sorted Merkle proofs and rejects tampered leaves", () => {
    const entries = [
      { claimerWallet: payer, amountSmallestUnits: 25_000_000n },
      { claimerWallet: buyer, amountSmallestUnits: 50_000_000n },
      { claimerWallet: artist, amountSmallestUnits: 25_000_000n }
    ];
    const tree = buildDistributionMerkleTree(entries);
    for (const entry of entries) {
      const proof = tree.getProof(entry.claimerWallet, entry.amountSmallestUnits);
      const leaf = distributionLeaf(entry.claimerWallet, entry.amountSmallestUnits);
      expect(verifyDistributionMerkleProof(proof, tree.root, leaf)).toBe(true);

      const tamperedAmount = distributionLeaf(
        entry.claimerWallet,
        entry.amountSmallestUnits + 1n
      );
      expect(verifyDistributionMerkleProof(proof, tree.root, tamperedAmount)).toBe(false);
    }
  });

  it("extracts typed Encore Anchor events from transaction logs", () => {
    const payload = Buffer.concat([
      anchorDisc("event", "SupportReceiptEvent"),
      Buffer.from([1, 2, 3, 4])
    ]);
    const events = extractEncoreEventsFromLogs([
      "Program log: Instruction: DirectSupport",
      `Program data: ${payload.toString("base64")}`,
      "Program data: AAAAAAAAAAAA"
    ]);
    expect(events).toEqual([
      {
        name: "SupportReceiptEvent",
        dataBase64: Buffer.from([1, 2, 3, 4]).toString("base64")
      }
    ]);
  });
});
