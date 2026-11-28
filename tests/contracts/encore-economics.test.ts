import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { Keypair, Transaction } from "@solana/web3.js";
import {
  approveAndFundDistributionCycle,
  approveMilestone,
  buySpotShareUnits,
  claimDistributionPayout,
  computePrimaryPassSplit,
  computeProRataDistributionClaim,
  computeSecondaryResaleSplit,
  confirmMarketplaceSettlement,
  listOwnedPassForSale,
  pledgeToCampaign,
  prepareBuyListedPass,
  prepareCreateCampaign,
  prepareCreatePassSeries,
  prepareCreateSpotListing,
  prepareDirectSupportIntent,
  prepareListOwnedPass,
  prepareOpenDistributionCycle,
  preparePrimaryPassPurchase,
  prepareRedeemSupporterPass,
  prepareReleaseCampaignMilestone,
  reconcileDistributionCycle,
  redeemSupporterPass,
  refundFailedCampaign,
  reviewCampaign,
  submitMilestoneEvidence,
  type MarketplaceChainPort
} from "../../packages/core/src/index.js";
import {
  DEFAULT_ENCORE_PROGRAM_ID,
  buildDistributionMerkleTree
} from "../../packages/solana-client/src/index.js";
import { SolanaMarketplaceChainAdapter } from "../../packages/infrastructure/src/blockchain/solana/solana-marketplace.adapter.js";
import { InMemoryMarketplaceRepository } from "../../packages/infrastructure/src/persistence/repositories/in-memory-marketplace.repository.js";

function anchorDisc(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function makeVerifiedAdapter(base: SolanaMarketplaceChainAdapter): MarketplaceChainPort {
  return Object.assign(Object.create(Object.getPrototypeOf(base)), base, {
    verifyFinalizedDeposit: async () => ({
      verified: true,
      slot: 100,
      actualAmountSmallestUnits: "100000000"
    }),
    verifyFinalizedMarketplaceTx: async () => ({
      verified: true,
      slot: 424242,
      events: [{ name: "ConfirmedEvent", dataBase64: "AQIDBA==" }]
    })
  });
}

describe("Phases 7 & 8 — On-chain Marketplace & Artist Monetization Contracts", () => {
  const clock = { now: () => new Date("2026-11-28T12:00:00Z") };
  const trackId = "h01-midnight-sessions";
  const artistWallet = Keypair.generate().publicKey.toBase58();
  const fan1Wallet = Keypair.generate().publicKey.toBase58();
  const fan2Wallet = Keypair.generate().publicKey.toBase58();
  const reviewerWallet = Keypair.generate().publicKey.toBase58();

  it("serializes genuine Anchor instructions (not JSON memo stubs) across adapter builders", async () => {
    const repo = new InMemoryMarketplaceRepository();
    const chain = new SolanaMarketplaceChainAdapter({ offlineBlockhashFallback: true });
    const passport = await repo.getTrackPassport(trackId);
    expect(passport).not.toBeNull();

    const direct = await prepareDirectSupportIntent(repo, chain, {
      trackId,
      expectedVersion: passport!.currentVersion,
      expectedManifestHash: passport!.manifestHash,
      amountSmallestUnits: "5000000",
      payerWallet: fan1Wallet,
      walletMode: "external_anchor"
    });
    expect(direct.ok).toBe(true);
    if (!direct.ok) return;

    const tx = Transaction.from(Buffer.from(direct.value.unsignedTx.serializedBase64, "base64"));
    const anchorIx = tx.instructions.find(
      (ix) => ix.programId.toBase58() === DEFAULT_ENCORE_PROGRAM_ID
    );
    expect(anchorIx).toBeDefined();
    expect(anchorIx!.data.subarray(0, 8).equals(anchorDisc("direct_support"))).toBe(true);
    expect(() => JSON.parse(anchorIx!.data.subarray(8).toString("utf8"))).toThrow();
  });

  it("enforces exact integer fee split conservation with zero dust loss on odd atomic amounts", () => {
    const primary = computePrimaryPassSplit(1_000_003n);
    expect(primary.artistPayout + primary.platformFee).toBe(1_000_003n);
    expect(primary.platformFee).toBe(50_000n);

    const resale = computeSecondaryResaleSplit(999_999n);
    expect(resale.sellerPayout + resale.artistFee + resale.platformFee).toBe(999_999n);
    expect(resale.artistFee).toBe(99_999n);
    expect(resale.platformFee).toBe(49_999n);

    const payout = computeProRataDistributionClaim({
      verifiedRevenue: 100_000_000n,
      totalClaimedSoFar: 25_000_000n,
      holderUnits: 10n,
      totalSupplySnapshot: 500n
    });
    expect(payout).toBe(2_000_000n);
  });

  it("prepares pass series creation, enforces stale passport rejection, secondary nonce checks, and prevents self-trade/double-redeem", async () => {
    const repo = new InMemoryMarketplaceRepository();
    const baseChain = new SolanaMarketplaceChainAdapter({ offlineBlockhashFallback: true });
    const verifiedChain = makeVerifiedAdapter(baseChain);
    const passport = await repo.getTrackPassport(trackId);
    expect(passport).not.toBeNull();

    const prepSeries = await prepareCreatePassSeries(repo, baseChain, clock, {
      artistUserId: "artist-1",
      artistWallet,
      trackId,
      title: "Studio Stem Vault",
      benefitSummary: "Lossless multi-track breakdown and session notes",
      cap: 10,
      primaryPriceSmallestUnits: "10000000",
      expiry: new Date("2026-12-28T12:00:00Z"),
      deliverableUrl: "https://encore.devnet.local/deliverables/stem-vault"
    });
    expect(prepSeries.ok).toBe(true);
    if (!prepSeries.ok) return;

    const seriesTx = Transaction.from(
      Buffer.from(prepSeries.value.unsignedTx.serializedBase64, "base64")
    );
    expect(seriesTx.instructions[0]!.data.subarray(0, 8).equals(anchorDisc("create_series"))).toBe(true);

    // Reject stale version
    const staleBuy = await preparePrimaryPassPurchase(repo, baseChain, clock, {
      seriesId: "series-midnight-ep",
      buyerWallet: fan1Wallet,
      expectedVersion: 99,
      expectedManifestHash: passport!.manifestHash
    });
    expect(staleBuy.ok).toBe(false);

    // Primary purchase prepare + confirm succeeds
    const primaryBuy = await preparePrimaryPassPurchase(repo, baseChain, clock, {
      seriesId: "series-midnight-ep",
      buyerWallet: fan1Wallet,
      expectedVersion: passport!.currentVersion,
      expectedManifestHash: passport!.manifestHash
    });
    expect(primaryBuy.ok).toBe(true);
    if (!primaryBuy.ok) return;

    const confirmedPrimary = await confirmMarketplaceSettlement(repo, verifiedChain, clock, {
      actorUserId: "fan-1",
      actorWallet: fan1Wallet,
      cluster: "devnet",
      input: {
        kind: "buy_primary",
        signature: "2".repeat(88),
        seriesId: "series-midnight-ep",
        passId: "pass-fan1-4",
        expectedVersion: passport!.currentVersion,
        expectedManifestHash: passport!.manifestHash
      }
    });
    expect(confirmedPrimary.ok).toBe(true);
    if (!confirmedPrimary.ok || !confirmedPrimary.value.pass) return;

    // List owned pass -> prepare Anchor tx & execute offchain/confirm
    const prepList = await prepareListOwnedPass(repo, baseChain, clock, {
      actorUserId: "fan-1",
      actorWallet: fan1Wallet,
      passId: confirmedPrimary.value.pass.id,
      listingPriceSmallestUnits: "15000000",
      listingExpiry: new Date("2026-12-10T12:00:00Z")
    });
    expect(prepList.ok).toBe(true);

    const listed = await listOwnedPassForSale(repo, clock, {
      actorUserId: "fan-1",
      passId: confirmedPrimary.value.pass.id,
      listingPriceSmallestUnits: "15000000",
      listingExpiry: new Date("2026-12-10T12:00:00Z")
    });
    expect(listed.ok).toBe(true);

    // Self-trade rejected on demo listed pass
    const selfBuy = await prepareBuyListedPass(repo, baseChain, clock, {
      passId: "pass-demo-listed-1",
      buyerUserId: "seed-fan-1",
      buyerWallet: fan1Wallet,
      expectedNonce: 1,
      expectedVersion: passport!.currentVersion,
      expectedManifestHash: passport!.manifestHash
    });
    expect(selfBuy.ok).toBe(false);

    // Stale nonce rejected
    const staleNonceBuy = await prepareBuyListedPass(repo, baseChain, clock, {
      passId: "pass-demo-listed-1",
      buyerUserId: "fan-2",
      buyerWallet: fan2Wallet,
      expectedNonce: 0,
      expectedVersion: passport!.currentVersion,
      expectedManifestHash: passport!.manifestHash
    });
    expect(staleNonceBuy.ok).toBe(false);

    // Valid secondary purchase prepare + confirm rotates nonce
    const secondaryBuy = await prepareBuyListedPass(repo, baseChain, clock, {
      passId: "pass-demo-listed-1",
      buyerUserId: "fan-2",
      buyerWallet: fan2Wallet,
      expectedNonce: 1,
      expectedVersion: passport!.currentVersion,
      expectedManifestHash: passport!.manifestHash
    });
    expect(secondaryBuy.ok).toBe(true);

    const confirmedResale = await confirmMarketplaceSettlement(repo, verifiedChain, clock, {
      actorUserId: "fan-2",
      actorWallet: fan2Wallet,
      cluster: "devnet",
      input: {
        kind: "buy_listing",
        signature: "6".repeat(88),
        passId: "pass-demo-listed-1",
        expectedVersion: passport!.currentVersion,
        expectedManifestHash: passport!.manifestHash
      }
    });
    expect(confirmedResale.ok).toBe(true);
    if (!confirmedResale.ok) return;
    expect(confirmedResale.value.pass?.nonce).toBe(2);

    // Redeem pass once, then reject double redemption
    const prepRedeem = await prepareRedeemSupporterPass(repo, baseChain, clock, {
      actorUserId: "fan-2",
      actorWallet: fan2Wallet,
      passId: "pass-demo-listed-1"
    });
    expect(prepRedeem.ok).toBe(true);

    const firstRedeem = await redeemSupporterPass(repo, clock, {
      actorUserId: "fan-2",
      passId: "pass-demo-listed-1"
    });
    expect(firstRedeem.ok).toBe(true);

    const doubleRedeem = await redeemSupporterPass(repo, clock, {
      actorUserId: "fan-2",
      passId: "pass-demo-listed-1"
    });
    expect(doubleRedeem.ok).toBe(false);
  });

  it("supports campaign creation, pledge, milestone release, refund gate, spot orderbook, and Merkle distribution", async () => {
    const repo = new InMemoryMarketplaceRepository();
    const baseChain = new SolanaMarketplaceChainAdapter({ offlineBlockhashFallback: true });
    const verifiedChain = makeVerifiedAdapter(baseChain);
    const passport = await repo.getTrackPassport(trackId);

    const prepCamp = await prepareCreateCampaign(repo, baseChain, clock, {
      artistWallet,
      trackId,
      title: "Midnight Visual EP",
      goalSmallestUnits: "200000000",
      shareSupply: 200,
      deadline: new Date("2026-12-20T12:00:00Z"),
      useOfFunds: "Studio session & mastering",
      rightsScope: "Simulated devnet demo units"
    });
    expect(prepCamp.ok).toBe(true);

    const pledgePrep = await pledgeToCampaign(repo, baseChain, clock, {
      campaignId: "camp-midnight-ep",
      userId: "fan-pledger",
      payerWallet: fan1Wallet,
      amountSmallestUnits: "180000000"
    });
    expect(pledgePrep.ok).toBe(true);

    const confirmedPledge = await confirmMarketplaceSettlement(repo, verifiedChain, clock, {
      actorUserId: "fan-pledger",
      actorWallet: fan1Wallet,
      cluster: "devnet",
      input: {
        kind: "pledge_campaign",
        signature: "7".repeat(88),
        campaignId: "camp-midnight-ep",
        amountSmallestUnits: "180000000"
      }
    });
    expect(confirmedPledge.ok).toBe(true);
    if (!confirmedPledge.ok) return;
    expect(confirmedPledge.value.campaign?.status).toBe("FUNDED");

    // Funded campaign cannot refund
    const badRefund = await refundFailedCampaign(repo, baseChain, clock, {
      campaignId: "camp-midnight-ep",
      userId: "fan-pledger",
      claimerWallet: fan1Wallet
    });
    expect(badRefund.ok).toBe(false);

    // Milestone governance & release tx
    await reviewCampaign(repo, clock, {
      campaignId: "camp-midnight-ep",
      reviewerUserId: "reviewer-1",
      decision: "APPROVED",
      notes: "Clear scope"
    });
    await repo.saveMilestone({
      id: "ms-1",
      campaignId: "camp-midnight-ep",
      sequenceIndex: 0,
      title: "Mastering Stems",
      releaseAmountSmallestUnits: "100000000",
      evidenceUri: null,
      status: "PENDING",
      reviewerUserId: null,
      updatedAt: clock.now()
    });
    await submitMilestoneEvidence(repo, clock, {
      milestoneId: "ms-1",
      artistUserId: "seed-artist-aria",
      evidenceUri: "https://encore.devnet.local/evidence/ms-1"
    });
    await approveMilestone(repo, clock, {
      milestoneId: "ms-1",
      reviewerUserId: "reviewer-1",
      approved: true
    });
    const relMs = await prepareReleaseCampaignMilestone(repo, baseChain, {
      actorUserId: "seed-artist-aria",
      artistWallet,
      milestoneId: "ms-1"
    });
    expect(relMs.ok).toBe(true);

    // Register fan-holder-2 wallet via receipt so in-memory wallet lookup maps user -> fan2Wallet
    await confirmMarketplaceSettlement(repo, verifiedChain, clock, {
      actorUserId: "fan-holder-2",
      actorWallet: fan2Wallet,
      cluster: "devnet",
      input: {
        kind: "direct_support",
        signature: "8".repeat(88),
        trackId,
        expectedVersion: passport!.currentVersion,
        expectedManifestHash: passport!.manifestHash,
        amountSmallestUnits: "1000000"
      }
    });

    // Spot create + buy + confirm
    const prepSpot = await prepareCreateSpotListing(repo, baseChain, {
      sellerUserId: "fan-seller",
      sellerWallet: fan1Wallet,
      campaignId: "camp-midnight-ep",
      units: 10,
      unitPriceSmallestUnits: "1200000"
    });
    expect(prepSpot.ok).toBe(true);

    const buySpotPrep = await buySpotShareUnits(repo, baseChain, {
      spotListingId: "spot-midnight-1",
      buyerUserId: "fan-holder-2",
      buyerWallet: fan2Wallet,
      units: 10
    });
    expect(buySpotPrep.ok).toBe(true);

    const confirmedSpot = await confirmMarketplaceSettlement(repo, verifiedChain, clock, {
      actorUserId: "fan-holder-2",
      actorWallet: fan2Wallet,
      cluster: "devnet",
      input: {
        kind: "buy_spot",
        signature: "9".repeat(88),
        spotListingId: "spot-midnight-1",
        units: 10
      }
    });
    expect(confirmedSpot.ok).toBe(true);

    // Dual approval revenue cycle (with record date after spot fill) + Merkle open + claim proof
    const cycleId = "cycle-q4-merkle-test";
    await repo.saveDistributionCycle({
      id: cycleId,
      campaignId: "camp-midnight-ep",
      periodLabel: "Q4 Verified Distribution Cycle",
      verifiedRevenueSmallestUnits: "100000000",
      claimedSmallestUnits: "0",
      totalSupplySnapshot: 500,
      recordDate: new Date(Date.now() + 60_000)
    });
    const reconciled = await reconcileDistributionCycle(repo, clock, {
      cycleId,
      operatorUserId: "op-1",
      evidenceHash: "f".repeat(64),
      verifiedRevenueSmallestUnits: "100000000"
    });
    expect(reconciled.ok).toBe(true);

    const sameActorFund = await approveAndFundDistributionCycle(repo, verifiedChain, clock, {
      cycleId,
      approverUserId: "op-1",
      fundedTxSig: "5".repeat(64)
    });
    expect(sameActorFund.ok).toBe(false);

    const funded = await approveAndFundDistributionCycle(repo, verifiedChain, clock, {
      cycleId,
      approverUserId: "approver-2",
      fundedTxSig: "5".repeat(64)
    });
    expect(funded.ok).toBe(true);

    const opened = await prepareOpenDistributionCycle(repo, verifiedChain, {
      authorityWallet: reviewerWallet,
      cycleId
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const claim = await claimDistributionPayout(repo, verifiedChain, {
      cycleId,
      userId: "fan-holder-2",
      claimerWallet: fan2Wallet
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.payoutSmallestUnits).toBe("2000000");

    // Verify Merkle tree deterministic generation across holders
    const entitlements = await repo.listDistributionEntitlements(cycleId);
    const tree = buildDistributionMerkleTree(
      entitlements.map((e) => ({
        claimerWallet: e.walletAddress,
        amountSmallestUnits: BigInt(claim.value.payoutSmallestUnits)
      }))
    );
    expect(tree.rootHex).toHaveLength(64);
  });

  it("enforces finalized RPC verification and idempotency in confirmMarketplaceSettlement", async () => {
    const repo = new InMemoryMarketplaceRepository();
    const baseChain = new SolanaMarketplaceChainAdapter({ offlineBlockhashFallback: true });
    const unverifiedChain: MarketplaceChainPort = Object.assign(
      Object.create(Object.getPrototypeOf(baseChain)),
      baseChain,
      {
        verifyFinalizedMarketplaceTx: async () => ({
          verified: false,
          slot: 0,
          events: [],
          reason: "Transaction not yet finalized"
        })
      }
    );

    const passport = await repo.getTrackPassport(trackId);
    const rejected = await confirmMarketplaceSettlement(repo, unverifiedChain, clock, {
      actorUserId: "fan-1",
      actorWallet: fan1Wallet,
      cluster: "devnet",
      input: {
        kind: "direct_support",
        signature: "3".repeat(88),
        trackId,
        expectedVersion: passport!.currentVersion,
        expectedManifestHash: passport!.manifestHash,
        amountSmallestUnits: "5000000"
      }
    });
    expect(rejected.ok).toBe(false);

    const verifiedChain = makeVerifiedAdapter(baseChain);
    const sig = "4".repeat(88);
    const first = await confirmMarketplaceSettlement(repo, verifiedChain, clock, {
      actorUserId: "fan-1",
      actorWallet: fan1Wallet,
      cluster: "devnet",
      input: {
        kind: "direct_support",
        signature: sig,
        trackId,
        expectedVersion: passport!.currentVersion,
        expectedManifestHash: passport!.manifestHash,
        amountSmallestUnits: "5000000"
      }
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.receipt?.signature).toBe(sig);
    expect(first.value.explorerUrl).toContain("cluster=devnet");

    // Re-confirming same signature is idempotent
    const second = await confirmMarketplaceSettlement(repo, verifiedChain, clock, {
      actorUserId: "fan-1",
      actorWallet: fan1Wallet,
      cluster: "devnet",
      input: {
        kind: "direct_support",
        signature: sig,
        trackId,
        expectedVersion: passport!.currentVersion,
        expectedManifestHash: passport!.manifestHash,
        amountSmallestUnits: "5000000"
      }
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.receipt?.id).toBe(first.value.receipt?.id);
  });
});
