# Encore Marketplace Architecture Review

**Review date:** 28 November 2026  
**Decision status:** Approved as the planned marketplace architecture; implementation, legal review and live-chain verification remain outstanding.

## Executive decision

Encore's planned marketplace includes two layers: a bounded supporter-commerce layer and a project-financing/trading layer. The second layer must remain devnet/demo scope until legal, rights, issuer, accounting and market-integrity gates are passed.

The base supporter-commerce flow is:

```text
consented track → active Music Passport version → direct test-USDC support
OR finite Supporter Pass → version-bound receipt → creator-defined redemption
```

The expanded marketplace additionally supports:

```text
artist project → campaign escrow → project shares → secondary trading
              → verified receipts → eligible-holder payout claim
```

The product must clearly distinguish a redeemable supporter benefit from a project-linked financial entitlement. Neither resale nor payouts may be presented as guaranteed profit or liquidity.

## Architecture choice

| Area | MVP decision | Not in MVP |
| --- | --- | --- |
| Primary purchase | Artist-created `PassSeries` with fixed cap, price, benefit, expiry and terms hash | Open-ended campaigns or pooled funding |
| Payment | Atomic test-USDC transfer with integer smallest-unit math | Fiat checkout, royalties, yield or passive revenue share |
| Ownership | Program-owned `SupporterPass` PDA with explicit state transitions | Freely tradable wallet-native NFT semantics |
| Secondary market | Fixed-price listing and atomic purchase of an eligible unused pass | Order books, bids, AMMs, margin or price guarantees |
| Project funding | Campaign goal, deadline, escrow vault, funded/failed state and individual refund path | Unbounded pooled funding or operator withdrawal of unsettled funds |
| Project shares | Fixed supply, project-specific terms, controlled transfer and holder record | Unrestricted token trading or undisclosed financial rights |
| Royalty pool | Explicit revenue sources, deductions, record dates, snapshots, rounding and claim proofs | Unverified off-chain revenue or automatic entitlement assumptions |
| Opinion market | Separate Yes/No prediction vault, cutoff, immutable outcome and one-time claim | Mixing prediction collateral with campaign funds or artist payouts |
| Redemption | One-time creator-defined benefit | DRM or unlimited service |
| Provenance binding | Purchase includes expected passport version and manifest hash | Purchases against stale or paused track metadata |
| Rights | Preview or external-license link-out according to rights status | Encore issuing or reselling third-party licenses |
| Disputes | Append-only review/appeal history; pause new commerce when required | Silent rewrites or retroactive payment reversal |

## Trust boundaries

- The artist signs origin disclosure, benefit terms and rights declarations.
- The reviewer may append review metadata and pause new commerce under policy, but cannot rewrite historical receipts.
- The web/API layer prepares transactions and indexes state; it cannot authorize payments or mutate provenance status on behalf of an agent.
- The Anchor program validates signer authority, passport version, manifest hash, mint, caps, deadlines, ownership, listing nonce and terminal states.
- Supabase stores private evidence and delivery metadata. Solana stores commitments, settlement state and receipts.
- ElevenLabs may search catalog data and prepare an unsigned support intent only. It cannot execute payment, create or redeem a pass, or change review status.

## Required state model

```text
PassSeries: ACTIVE → PAUSED / CLOSED
SupporterPass: OFFERED → OWNED → LISTED → OWNED → REDEEMED
                                      ↘ EXPIRED
SupportReceipt: created once per payer nonce
```

Commerce must require the currently published, commerce-eligible passport version at execution time. A stale version or manifest hash must fail and require refresh and re-consent.

## Review findings

1. The Anchor specification, product design and economics documents align with the bounded Supporter Pass/direct-support model.
2. The `encore-support-marketplace-architecture.html` diagram describes the expanded campaign, project-share, spot-trading and payout layer and is part of the planned architecture, not a live offering.
3. Marketplace implementation remains pending. Authentication/onboarding is the current implementation focus; no live marketplace deployment or buyer evidence is claimed.
4. Remaining risks are rights and benefit permissions, redemption delivery, stale-version handling, replay/concurrency protection, campaign refunds, off-chain revenue verification, transfer restrictions, dispute policy and legal review before any real-money or investment-like feature.

## Completion gate

- One permitted fixture has an active passport and finite pass series.
- Primary purchase records the exact passport version and manifest hash.
- Stale-version, paused-track, expired-listing, duplicate-redemption and replay attempts fail.
- Resale atomically transfers payment and pass ownership with bounded integer fee splits.
- Redemption closes further transfer and produces benefit-delivery proof.
- A rights dispute pauses new commerce without altering settled receipts.
- Campaign failure returns each eligible contribution from the campaign vault without using prediction collateral.
- Share and payout claims use published terms, verified receipts, a record-date snapshot and deterministic integer math.
- Opinion-market collateral is isolated from campaign escrow, supporter payments and artist earnings.
- Tests and a reproducible demo log are committed before calling the marketplace complete.

Before production or real-money launch, require creator interviews, buyer validation, legal review, enforceable issuer agreements, rights documentation and an independently tested settlement/reporting model. The current demo remains devnet-only with synthetic or explicitly simulated revenue data.
