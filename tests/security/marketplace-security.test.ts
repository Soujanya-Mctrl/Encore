import { describe, expect, it } from "vitest";
import {
  claimDistributionPayout,
  prepareBuyListedPass,
  prepareDirectSupportIntent,
  preparePrimaryPassPurchase,
  redeemSupporterPass
} from "../../packages/core/src/index.js";
import {
  InMemoryMarketplaceRepository,
  SolanaMarketplaceChainAdapter
} from "../../packages/infrastructure/src/index.js";

describe("Marketplace Security & Adversarial Suite", () => {
  it("rejects stale passport version on direct support & primary pass buy", async () => {
    const repo = new InMemoryMarketplaceRepository();
    const chain = new SolanaMarketplaceChainAdapter();
    const track = await repo.getTrackPassport("h01-midnight-sessions");
    expect(track).not.toBeNull();

    const staleSupport = await prepareDirectSupportIntent(repo, chain, {
      payerWallet: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      trackId: "h01-midnight-sessions",
      expectedVersion: 99,
      expectedManifestHash: track!.manifestHash,
      amountSmallestUnits: "5000000"
    });
    expect(staleSupport.ok).toBe(false);

    const stalePass = await preparePrimaryPassPurchase(
      repo,
      chain,
      { now: () => new Date() },
      {
        buyerWallet: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        seriesId: "series-midnight-ep",
        expectedVersion: track!.currentVersion,
        expectedManifestHash: "f".repeat(64)
      }
    );
    expect(stalePass.ok).toBe(false);
  });

  it("blocks self-trade on listed supporter pass", async () => {
    const repo = new InMemoryMarketplaceRepository();
    const chain = new SolanaMarketplaceChainAdapter();
    const track = await repo.getTrackPassport("h01-midnight-sessions");

    const selfBuy = await prepareBuyListedPass(
      repo,
      chain,
      { now: () => new Date() },
      {
        buyerUserId: "seed-fan-1",
        buyerWallet: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        passId: "pass-demo-listed-1",
        expectedNonce: 1,
        expectedVersion: track!.currentVersion,
        expectedManifestHash: track!.manifestHash
      }
    );
    expect(selfBuy.ok).toBe(false);
  });

  it("blocks duplicate redemption and unauthorized distribution claims", async () => {
    const repo = new InMemoryMarketplaceRepository();
    const chain = new SolanaMarketplaceChainAdapter();
    const clock = { now: () => new Date() };

    const firstRedeem = await redeemSupporterPass(repo, clock, {
      actorUserId: "seed-fan-1",
      passId: "pass-demo-listed-1"
    });
    expect(firstRedeem.ok).toBe(true);

    const secondRedeem = await redeemSupporterPass(repo, clock, {
      actorUserId: "seed-fan-1",
      passId: "pass-demo-listed-1"
    });
    expect(secondRedeem.ok).toBe(false);

    // User with 0 share units (and unfunded cycle) cannot claim distribution payout
    const badClaim = await claimDistributionPayout(repo, chain, {
      cycleId: "cycle-q4-sim",
      userId: "non-holder-user",
      claimerWallet: "11111111111111111111111111111111"
    });
    expect(badClaim.ok).toBe(false);
  });
});
