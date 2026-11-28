import { describe, expect, it } from "vitest";
import {
  aggregateSpotCandles,
  approveAndFundDistributionCycle,
  assertPassportEligibleForCommerce,
  buySpotShareUnits,
  cancelPassListing,
  cancelSpotListing,
  claimDistributionPayout,
  computePrimaryPassSplit,
  computeProRataDistributionClaim,
  computeSecondaryResaleSplit,
  listOwnedPassForSale,
  pledgeToCampaign,
  reconcileDistributionCycle,
  redeemSupporterPass,
  refundCampaign,
  tradeOpinionMarketPair
} from "../index.js";
import type {
  MarketplaceChainPort,
  MarketplaceRepositoryPort,
  OpinionMarketEntity,
  PassSeriesEntity,
  SupporterPassEntity
} from "../index.js";

const HASH = "a".repeat(64);
const NOW = new Date("2026-11-28T12:00:00Z");
const FUTURE = new Date("2026-12-28T12:00:00Z");
const PAST = new Date("2026-11-27T12:00:00Z");

describe("Marketplace Integer Math & Invariants", () => {
  it("conserves primary pass and secondary resale integer splits", () => {
    const primary = computePrimaryPassSplit(10_000_000n); // 10 USDC
    expect(primary.artistPayout).toBe(9_500_000n);
    expect(primary.platformFee).toBe(500_000n);
    expect(primary.artistPayout + primary.platformFee).toBe(10_000_000n);

    const resale = computeSecondaryResaleSplit(20_000_000n); // 20 USDC
    expect(resale.sellerPayout).toBe(17_000_000n);
    expect(resale.artistFee).toBe(2_000_000n);
    expect(resale.platformFee).toBe(1_000_000n);
    expect(resale.sellerPayout + resale.artistFee + resale.platformFee).toBe(20_000_000n);

    // Odd-unit floor rounding conservation
    const odd = computeSecondaryResaleSplit(333n);
    expect(odd.sellerPayout + odd.artistFee + odd.platformFee).toBe(333n);
  });

  it("caps pro-rata distribution claims at remaining verified revenue", () => {
    const claim = computeProRataDistributionClaim({
      verifiedRevenue: 1_000_000n,
      totalClaimedSoFar: 900_000n,
      holderUnits: 25n,
      totalSupplySnapshot: 100n
    });
    expect(claim).toBe(100_000n);
  });

  it("rejects stale passport version, tampered hash, paused tracks, and disputed rights", () => {
    const base = {
      trackId: "h01",
      title: "Midnight Acoustic",
      artistName: "Aria",
      artistWallet: "11111111111111111111111111111111",
      currentVersion: 2,
      manifestHash: HASH,
      paused: false,
      originCategory: "HUMAN_CREATED" as const,
      evidenceStatus: "CORROBORATED" as const,
      rightsStatus: "PREVIEW_ALLOWED" as const
    };

    expect(assertPassportEligibleForCommerce(base, 2, HASH).ok).toBe(true);
    expect(assertPassportEligibleForCommerce(base, 1, HASH).ok).toBe(false);
    expect(assertPassportEligibleForCommerce(base, 2, "b".repeat(64)).ok).toBe(false);
    expect(assertPassportEligibleForCommerce({ ...base, paused: true }, 2, HASH).ok).toBe(false);
    expect(
      assertPassportEligibleForCommerce({ ...base, rightsStatus: "DISPUTED" }, 2, HASH).ok
    ).toBe(false);
  });

  it("prevents non-owner listing and duplicate pass redemption", async () => {
    let passState: SupporterPassEntity = {
      id: "pass-1",
      seriesId: "ser-1",
      trackId: "h01",
      serial: 1,
      ownerUserId: "user-a",
      ownerWallet: "11111111111111111111111111111111",
      status: "OWNED",
      nonce: 0,
      listingPriceSmallestUnits: null,
      listingExpiry: null
    };
    const series: PassSeriesEntity = {
      id: "ser-1",
      trackId: "h01",
      artistUserId: "artist-1",
      artistWallet: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      title: "Commentary Pass",
      benefitSummary: "Studio notes",
      cap: 10,
      issued: 1,
      primaryPriceSmallestUnits: "10000000",
      expiry: FUTURE,
      status: "ACTIVE",
      deliverableUrl: "https://example.com/signed-diary"
    };

    const repo = {
      async getPassById() {
        return passState;
      },
      async getSeriesById() {
        return series;
      },
      async savePass(p: SupporterPassEntity) {
        passState = p;
        return p;
      }
    } as unknown as MarketplaceRepositoryPort;

    const clock = { now: () => NOW };

    // Non-owner cannot list
    const badList = await listOwnedPassForSale(repo, clock, {
      actorUserId: "user-b",
      passId: "pass-1",
      listingPriceSmallestUnits: "20000000",
      listingExpiry: FUTURE
    });
    expect(badList.ok).toBe(false);

    // Owner redeems once
    const firstRedeem = await redeemSupporterPass(repo, clock, {
      actorUserId: "user-a",
      passId: "pass-1"
    });
    expect(firstRedeem.ok).toBe(true);

    // Duplicate redemption rejected
    const secondRedeem = await redeemSupporterPass(repo, clock, {
      actorUserId: "user-a",
      passId: "pass-1"
    });
    expect(secondRedeem.ok).toBe(false);
  });

  it("enforces opinion market trading_cutoff strictly before campaign deadline", async () => {
    const market: OpinionMarketEntity = {
      id: "om-1",
      campaignId: "camp-1",
      question: "Will Midnight Sessions EP reach 500 USDC?",
      tradingCutoff: PAST,
      campaignDeadline: FUTURE,
      vaultAddress: "11111111111111111111111111111111",
      yesPoolPairs: 10,
      noPoolPairs: 5,
      resolvedOutcome: "UNRESOLVED"
    };
    const repo = {
      async getOpinionMarketById() {
        return market;
      }
    } as unknown as MarketplaceRepositoryPort;

    const res = await tradeOpinionMarketPair(
      repo,
      { now: () => NOW },
      { marketId: "om-1", userId: "u1", side: "YES", pairsCount: 2 }
    );
    expect(res.ok).toBe(false);
  });

  it("enforces owner-only listing cancel, missed-goal campaign refund, dual approval, and OHLCV candles", async () => {
    let passState: SupporterPassEntity = {
      id: "pass-2",
      seriesId: "ser-1",
      trackId: "h01",
      serial: 2,
      ownerUserId: "seller-1",
      ownerWallet: "11111111111111111111111111111111",
      status: "LISTED",
      nonce: 1,
      listingPriceSmallestUnits: "12000000",
      listingExpiry: FUTURE
    };
    let spotState = {
      id: "spot-1",
      campaignId: "camp-1",
      sellerUserId: "seller-1",
      sellerWallet: "11111111111111111111111111111111",
      remainingUnits: 10,
      unitPriceSmallestUnits: "1000000",
      active: true
    };
    let approvalState: any = null;
    const refunded = new Set<string>();

    const repo = {
      async getPassById() {
        return passState;
      },
      async savePass(next: SupporterPassEntity) {
        passState = next;
        return next;
      },
      async getSpotListingById() {
        return spotState;
      },
      async saveSpotListing(next: typeof spotState) {
        spotState = next;
        return next;
      },
      async getCampaignById() {
        return {
          id: "camp-1",
          trackId: "h01",
          artistUserId: "artist-1",
          artistWallet: "11111111111111111111111111111111",
          title: "EP Campaign",
          goalSmallestUnits: "100000000",
          raisedSmallestUnits: "80000000",
          shareSupply: 100,
          deadline: PAST,
          useOfFunds: "Studio",
          rightsScope: "Demo",
          status: "FUNDING" as const,
          vaultAddress: "11111111111111111111111111111111"
        };
      },
      async getCampaignPledgeAmount() {
        return "25000000";
      },
      async markCampaignRefundClaimed(campaignId: string, userId: string) {
        const key = `${campaignId}:${userId}`;
        if (refunded.has(key)) return false;
        refunded.add(key);
        return true;
      },
      async getDistributionCycleById() {
        return {
          id: "cyc-1",
          campaignId: "camp-1",
          periodLabel: "2026-11",
          verifiedRevenueSmallestUnits: "10000000",
          claimedSmallestUnits: "0",
          totalSupplySnapshot: 100,
          recordDate: NOW
        };
      },
      async saveDistributionCycle(c: any) {
        return c;
      },
      async getDistributionApproval() {
        return approvalState;
      },
      async saveDistributionApproval(a: any) {
        approvalState = a;
        return a;
      },
      async snapshotCycleHolders() {
        return;
      },
      async getHolderShareUnitsAtRecordDate() {
        return 25;
      }
    } as unknown as MarketplaceRepositoryPort;

    const chain = {
      async buildCampaignPledgeTx(p: any) {
        return { instructionName: "pledge_campaign", serializedBase64: "tx-pledge", expectedSigners: [p.payerWallet], programId: "prog" };
      },
      async buildCampaignRefundTx(p: any) {
        return { instructionName: "refund_campaign", serializedBase64: "tx-refund", expectedSigners: [p.claimerWallet], programId: "prog" };
      },
      async buildSpotBuyTx(p: any) {
        return { instructionName: "buy_spot", serializedBase64: "tx-spot", expectedSigners: [p.buyerWallet], programId: "prog" };
      },
      async buildDistributionClaimTx(p: any) {
        return { instructionName: "claim_distribution", serializedBase64: "tx-claim", expectedSigners: [p.claimerWallet], programId: "prog" };
      },
      async verifyFinalizedDeposit(p: any) {
        if (p.signature === "bad-sig") {
          return { verified: false, slot: 0, actualAmountSmallestUnits: "0", reason: "Not finalized" };
        }
        return { verified: true, slot: 123, actualAmountSmallestUnits: p.minimumAmountSmallestUnits };
      }
    } as unknown as MarketplaceChainPort;

    expect((await cancelPassListing(repo, { passId: "pass-2", userId: "other" })).ok).toBe(false);
    const cancelledPass = await cancelPassListing(repo, { passId: "pass-2", userId: "seller-1" });
    expect(cancelledPass.ok && cancelledPass.value.status === "OWNED").toBe(true);

    expect((await cancelSpotListing(repo, { spotListingId: "spot-1", userId: "other" })).ok).toBe(false);
    const cancelledSpot = await cancelSpotListing(repo, { spotListingId: "spot-1", userId: "seller-1" });
    expect(cancelledSpot.ok && cancelledSpot.value.active === false).toBe(true);

    // Refund builds unsigned wallet tx instead of mutating DB only
    const refundIntent = await refundCampaign(repo, chain, { now: () => NOW }, {
      campaignId: "camp-1",
      userId: "backer-1",
      claimerWallet: "11111111111111111111111111111111"
    });
    expect(
      refundIntent.ok &&
        refundIntent.value.refundSmallestUnits === "25000000" &&
        refundIntent.value.settlementStatus === "pending_signature" &&
        refundIntent.value.unsignedTx.instructionName === "refund_campaign"
    ).toBe(true);

    // Spot buy builds unsigned wallet tx instead of mutating DB only
    spotState.active = true;
    const spotIntent = await buySpotShareUnits(repo, chain, {
      spotListingId: "spot-1",
      buyerUserId: "buyer-1",
      buyerWallet: "11111111111111111111111111111111",
      units: 4
    });
    expect(
      spotIntent.ok &&
        spotIntent.value.totalSmallestUnits === "4000000" &&
        spotIntent.value.unsignedTx.instructionName === "buy_spot"
    ).toBe(true);

    await reconcileDistributionCycle(repo, { now: () => NOW }, {
      cycleId: "cyc-1",
      operatorUserId: "op-1",
      evidenceHash: HASH,
      verifiedRevenueSmallestUnits: "10000000"
    });

    // Claim rejected before cycle is funded and verified on-chain
    const unfundedClaim = await claimDistributionPayout(repo, chain, {
      cycleId: "cyc-1",
      userId: "holder-1",
      claimerWallet: "11111111111111111111111111111111"
    });
    expect(unfundedClaim.ok).toBe(false);

    const sameApprover = await approveAndFundDistributionCycle(repo, chain, { now: () => NOW }, {
      cycleId: "cyc-1",
      approverUserId: "op-1",
      fundedTxSig: "sig-1"
    });
    expect(sameApprover.ok).toBe(false);

    const unverifiedDeposit = await approveAndFundDistributionCycle(repo, chain, { now: () => NOW }, {
      cycleId: "cyc-1",
      approverUserId: "app-2",
      fundedTxSig: "bad-sig"
    });
    expect(unverifiedDeposit.ok).toBe(false);

    const distinctApprover = await approveAndFundDistributionCycle(repo, chain, { now: () => NOW }, {
      cycleId: "cyc-1",
      approverUserId: "app-2",
      fundedTxSig: "sig-1"
    });
    expect(distinctApprover.ok && distinctApprover.value.status === "FUNDED_AND_OPEN").toBe(true);

    const claimIntent = await claimDistributionPayout(repo, chain, {
      cycleId: "cyc-1",
      userId: "holder-1",
      claimerWallet: "11111111111111111111111111111111"
    });
    expect(
      claimIntent.ok &&
        claimIntent.value.payoutSmallestUnits === "2500000" &&
        claimIntent.value.unsignedTx.instructionName === "claim_distribution"
    ).toBe(true);

    // Unused helper reference check
    expect(typeof pledgeToCampaign).toBe("function");

    const ohlcv = aggregateSpotCandles([
      {
        id: "f1",
        spotListingId: "s1",
        campaignId: "camp-1",
        buyerUserId: "b1",
        sellerUserId: "s1",
        units: 5,
        unitPriceSmallestUnits: "1000000",
        txSignature: "tx1",
        filledAt: new Date("2026-11-28T12:10:00Z")
      },
      {
        id: "f2",
        spotListingId: "s1",
        campaignId: "camp-1",
        buyerUserId: "b2",
        sellerUserId: "s1",
        units: 3,
        unitPriceSmallestUnits: "1250000",
        txSignature: "tx2",
        filledAt: new Date("2026-11-28T12:40:00Z")
      }
    ]);
    expect(ohlcv.candles).toHaveLength(1);
    expect(ohlcv.candles[0]).toMatchObject({ open: 1, high: 1.25, low: 1, close: 1.25 });
  });
});
