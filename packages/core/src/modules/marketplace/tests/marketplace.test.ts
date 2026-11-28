import { describe, expect, it } from "vitest";
import {
  assertPassportEligibleForCommerce,
  computePrimaryPassSplit,
  computeProRataDistributionClaim,
  computeSecondaryResaleSplit,
  listOwnedPassForSale,
  redeemSupporterPass,
  tradeOpinionMarketPair
} from "../index.js";
import type {
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
});
