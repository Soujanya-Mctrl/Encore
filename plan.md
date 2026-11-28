# Encore development phases

This roadmap follows the 0–14 phase sequence agreed for the current build. The [PDF progress snapshot](docs/planning/PROGRESS_SNAPSHOT.md) records earlier work using the original build playbook's numbering.

| Phase | Status | Acceptance work |
| --- | --- | --- |
| 0. Feasibility & Setup | Complete | Toolchain, credentials, and Solana devnet setup. |
| 1. Authentication & Onboarding | Wallet path verified locally | Browser and Expo API sessions, revocation, and listener/artist onboarding verified. The hosted schema and live Pollar email, social, and embedded-wallet paths still need verification. |
| 2. Database & Infrastructure | Database and worker verified locally | Schema, access controls, private storage policy, real PGMQ delivery, retries, and dead-letter handling verified. Hosted migration and worker activation remain pending. |
| 3. Artist Studio | Backend implemented | Expo-facing owner APIs cover channel activation, private uploads, credits and metadata, revision submission, and catalog delisting. Expo screens and hosted rollout are pending. |
| 4. Provenance Engine | Scoped proof implemented | Demo and signed-instrumental proof paths create immutable Passport revisions. Production issuer integration and full-track coverage remain pending. |
| 5. Licensing & Rights Management | Implemented locally | Versioned rights intake, scoped review, provider restrictions, private inquiries and withdrawal on web and Expo. Hosted migration and actual rights files remain pending. |
| 6. Music Discovery & Player | Implemented locally | Live catalog, origin/evidence/genre filters and persistent preview players on web and Expo. Authorized demo audio and device verification remain pending. |
| 7. Artist Monetization | Partial | Campaign, milestone, and distribution APIs and database projections are integrated. Verify Passport-bound settlement and reconciliation on devnet. |
| 8. Supporter Marketplace | Partial | Marketplace screens and lifecycle APIs are integrated. Verify transfers, resale splits, and redemption on devnet. |
| 9. ElevenLabs Integration | Pending | API feasibility was verified. Complete catalog-aware voice tools and supervised payment intents. |
| 10. Firecrawl Integration | Pending | API feasibility was verified. Complete extraction, processing, and opportunity matching. |
| 11. Creative Fairness & Moderation | Pending | Evidence reviews, corrections, appeals, and notifications. |
| 12. Integration & Security Testing | Partial | Scoped workflow and queue checks exist. Complete cross-module, contract, and full-product end-to-end testing. |
| 13. Deployment & UI Polish | Pending | The devnet program is recorded. The project owner handles web staging. |
| 14. Documentation & Submission | Partial | Project and architecture docs exist. Complete the final demo, pitch, and submission. |

See the [Expo authentication and database handoff](docs/setup/EXPO_AUTH_AND_DATABASE.md) for the client API and acceptance checks, and the [devnet deployment log](docs/architecture/DEVNET_DEPLOYMENTS.md) for recorded program addresses.

[Phase 5–6 architecture and rollout](docs/architecture/RIGHTS_AND_PLAYER_IMPLEMENTATION.md) documents the rights and player integration.

## Planned feature details

### ElevenLabs Music Generation (`FR05b` — Studio integration design)

- **Scope:** Creators can generate original audio drafts directly inside **Artist Studio** via ElevenLabs Music API (`ELEVENLABS_API_KEY` server-side only), store the output + generation receipt in private Supabase Storage, and prefill a `PassportVersion` draft.
- **Provenance & Rights Invariants:** Platform-attested ElevenLabs generations set `OriginCategory` to `AI_GENERATED` (or `AI_ASSISTED` if mixed with human stems), `EvidenceStatus` to `CORROBORATED` (backed by the ElevenLabs generation receipt), and `RightsStatus` gated by the ElevenLabs plan/Music Terms (`PREVIEW_ALLOWED` / `COMMERCIAL_CLEARED` or `RESTRICTED` — never reselling ElevenLabs Music Marketplace licenses).
- **Architecture:** `MusicGenerationPort` in `packages/core` → `ElevenLabsMusicAdapter` in `packages/infrastructure` → `POST /api/v1/studio/generate-music` in `apps/web` → Artist Studio generation UI in `apps/mobile`.

## Artist monetization delivery plan

**Status:** architecture draft for manual review. The hackathon target is one release, a working tips and passes lifecycle, and a devnet campaign that funds production, issues shares, settles a spot trade, and pays a holder from a synthetic revenue deposit. Review the [architecture and UI diagrams](docs/diagrams/architecture/drafts/artist-monetization.html) before implementation. The [economics spec](docs/economics/TOKENOMICS_AND_ECONOMICS.md) governs existing pass fees.

### Scope and economics

| Flow | Artist / holder economics | Encore economics |
| --- | --- | --- |
| Direct tip | Artist receives all test-USDC sent | 0% platform fee |
| Pass primary | Artist receives remainder after the platform fee | 5% floored |
| Pass resale | Artist receives 10% floored; seller receives the remainder | 5% floored |
| Project campaign | Artist receives approved milestone releases. Eligible pledgers receive project-specific units on success or principal refunds on failure | Propose 0% for demo |
| Project-unit spot trade | Seller receives test-USDC and buyer receives units in one atomic fill | Propose 0% for demo |
| Revenue cycle | Holders of record claim a share of a funded pool. Artist keeps the portion outside the committed pool | Propose 0% for demo |

Passes grant deliverable access. Project units carry a defined revenue participation right scoped to a campaign and confer no copyright ownership. Keep the project-unit lifecycle in the DeFi demo. Defer opinion markets and analytics subscriptions. Disclose network fees separately before signature. Use integer smallest units with checked wide intermediates, floor fees independently, and route pass rounding remainders as shown above. Track primary pass sales and cost per settled transaction before assuming resale or subscriptions can fund operations.

### Baseline and ownership

The workspace has marketplace routes, domain use cases, a Solana adapter, and a mobile marketplace screen. The server container uses the Supabase marketplace repository when database credentials are configured. The Anchor entry points include tips, primary pass purchases, and redemption. Pass resale and the project-unit lifecycle need full settlement integration. The merge preserves the existing catalog, support, and marketplace migration versions. Governance runs as version `202611280010`, after its marketplace tables. Treat named screens, routes, schema additions, and state transitions below as proposed until their acceptance checks pass.

| Boundary | Responsibility |
| --- | --- |
| Expo Router and Next.js UI | Browse, artist studio, reviews, wallet prompts, receipts, and portfolio. Use shared Zod contracts. Show test assets and synthetic revenue in the app and receipts. |
| Next.js API and composition root | Validate session, role, ownership, eligibility and request schema. Read projections, build unsigned transactions, and expose confirmation status. Use existing session and wallet binding. |
| TypeScript core | Campaign, pass, spot, and distribution state rules. Ports for projections, chain readers/builders, and evidence. Existing identity, catalog, provenance and rights modules supply public state through their interfaces. |
| Infrastructure and Supabase | Implement ports. Postgres stores campaign drafts, review decisions, private evidence references, and rebuildable projections with RLS. Storage holds protected evidence and deliverables. PGMQ workers reconcile finalized Anchor events into projections. |
| Solana Anchor program | Sole authority for settlement, holdings, vaults, listing state, receipts and claim consumption. Use a single program with distinct accounts for passes and project units. Use the configured devnet program and test mint. |

### Settlement and data contracts

1. **Catalog and passes.** Start from an eligible published Music Passport version and consented deliverable. Store artist payout wallet, track/version/hash, series cap, expiry, and pricing. Bind tips and buys to the expected version. Pass resale supports list, cancel, and atomic fill against seller, price, expiry and listing nonce. Redemption is terminal. The server issues a short-lived deliverable URL only after finalized redemption by the entitled holder.
2. **Campaign.** Artist drafts goal, hard cap, close time, supply, use of funds, payout wallet, milestones, dispute windows, and versioned revenue terms. Reviewer approves before an authorized launch freezes those terms on-chain by hash. Accept pledges until close, then settle from accepted totals. Below goal or cancelled before success, pledgers pull refunds once. On success, allocate units at a fixed integer test-USDC price so the maximum issued supply and funding cap agree. Units activate for trading after the final milestone is accepted. Release escrow by approved tranches. On irrecoverable milestone failure, block trading and future releases, invalidate unit eligibility, and refund each pledger their pro-rata share of the unreleased balance under a frozen refund snapshot. Display the amount already released and the cancellation terms in advance. Specify refund dust and unclaimed-funds handling in frozen terms.
3. **Spot.** Allow one fixed-price listing per identified escrow lot for the demo. Lock units when listing. Match the full lot, expected price, nonce, mint, expiry and eligible wallets. Atomically settle and emit the fill, or unlock through cancellation or expiry recovery. Keep exposure to a single verified campaign per unit type. Build OHLCV from finalized fills with a defined time bucket, empty-state UI for no fills, and a visible last-updated time.
4. **Distributions.** Use one named synthetic revenue source for the demo. Freeze eligible revenues, allowed deductions and holder share threshold/formula in the campaign terms. Reconcile statements against cash before approval. A distinct operator and approver bind the evidence hash, cycle ID, deposited amount, and finalized snapshot slot. Reconstruct the snapshot from finalized ownership events at that slot, attribute listed escrow units to their beneficial sellers, verify the eligible total, and commit an entitlement root. Fund the cycle vault before opening claims. Each holder’s capped entitlement uses floor math and the immutable snapshot, and each wallet claims at most once per cycle. Define the claim window, residual dust, and any unclaimed balance in the disclosed terms. Payouts are independent of subsequent trading.
5. **API and events.** Reuse existing `/api/v1` route families for support, passes, campaigns, spot, distributions, marketplace, and receipts. Add missing reads and write intents for lifecycle transitions. Every unsigned response includes network, program, mint, canonical accounts, expected version/nonce where applicable, amount/fees, expiry or block height, and intent ID. Index events by signature and instruction/event position. Validate the cluster, program, successful execution and finality before projecting. Make cursor advancement and projection writes atomic and replay-safe. Rebuild charts and portfolio from projections. Never mark a client-provided signature paid without reconciliation.

Use one fixture across UI, contract tests and the demo. For example, a campaign with a 100 test-USDC goal, a 150 test-USDC cap, and 150 maximum units at 1 test-USDC each issues 100 units if it closes at 100. Two approved milestones release 60 and 40. A later 50 test-USDC synthetic receipt with a 20% holder share funds a 10 test-USDC pool. The holder of 25 of the 100 issued units at the record slot can claim 2.50 test-USDC, even if they later sell. With 80 pledged and a missed goal, the full 80 remains refundable. The numbers are illustrative review defaults.

### UI flows

| Actor | Flow | Required fallback or failure state |
| --- | --- | --- |
| Fan | Discover → Passport → tip or pass details → review recipient, total and fees → wallet → receipt. Portfolio → owned pass → list or redeem. | Wrong network, cancelled signature, stale quote, sold/expired pass, already redeemed, receipt pending |
| Artist | Studio → publish eligible release → create pass series or draft campaign → submit → respond to review → launch → submit milestone evidence → see vault and release history. | Draft persistence, changes requested, frozen terms, stalled milestone, paused campaign |
| Reviewer / operator | Scoped queue → inspect privately → approve or reject version → collect milestone decisions → reconcile synthetic revenue → second approval → fund and open cycle. | Insufficient role, stale approval, evidence mismatch, insufficient pool, disputed or paused state |
| Backer | Campaign detail → review terms, deadline, refund conditions and network → pledge → receipt → portfolio shows pending allocation, issued units or refund action. | Goal missed, deadline passed, wallet rejected, partial escrow refund, delayed indexing |
| Holder / trader | Market → inspect fixed-price listings, actual fills and chart → review and sign trade → receipt → portfolio → check record-date entitlement → claim. | Empty/thin market, filled listing, price changed, ineligible wallet, no entitlement, already claimed |

All money screens share `review → wallet → submitted → pending → finalized / failed / expired`. Keep the pending signature visible after a reload and refresh by receipt lookup. Require a fresh review after quote expiry. Label proceeds, funded milestone amount, claimable balances and estimates distinctly.

### Security controls

| Risk | Control |
| --- | --- |
| Wallet or role spoofing | Verified server session, bound wallet, object-level authorization, scoped reviewer and operator roles, request limits, and origin/CSRF controls for cookie-authenticated writes. Privileged keys stay server-side. |
| Unauthorized settlement | Verify signer, account owner, campaign/series PDA, mint, vault authority, recipient and network on the authoritative path. Bind current state, quoted amount and nonce. Keep wallet signatures explicit. Voice tools have no settlement, approval or verification permissions. |
| Double spend or excess supply | Atomic settlement, terminal states, per-pledger/per-cycle receipts, checked arithmetic and balance conservation. Pause releases on reconciliation drift. Keep refunds and safe cancellations available under the documented pause policy. |
| Fraudulent milestones or revenue | Dual approval, scoped multisig authority, append-only attestations, unique revenue-source references, actual vault funding, reconciled snapshot totals and immutable record dates. Keep private evidence and identity documents off-chain. |
| Market abuse and misleading data | Block same-wallet self-trades, flag suspicious clusters for review, disclose thin liquidity, and use finalized fills with reproducible chart aggregation. Same-wallet checks alone cannot identify collusion. |
| Misconfiguration | Isolate demo RPC, mint, database and wallet fixtures. Enforce devnet at the server and deployment boundary and verify the configured program/mint in transaction construction and settlement. Disable real-money issuance and trading until launch approval. |

Real-money issuance, custody, resale and platform fees each require jurisdiction-specific review, confirmed rights and issuer eligibility, reviewed disclosures, approved transfer rules, and an accounting and reconciliation process. Determine the applicable intermediary and operator requirements for each intended market before deployment.

### Build and test gates

| Gate | Deliverable and acceptance |
| --- | --- |
| 0. Architecture review | Approve one reference campaign, unit price/supply rule, milestone and refund policy, revenue source, snapshot method and fee assumptions. Confirm the diagrams match the design. |
| 1. Registry and contracts | Seed one consented eligible release; validate Passport, roles and approvals. Verify a fresh reset and inspect the target's applied migration history before hosted upgrades. Verify RLS denies cross-user evidence reads. |
| 2. Tips and passes | Demonstrate tip, primary buy, list/cancel/resell, redeem, and authorized deliverable access with two wallets. Reject wrong mint/wallet, stale Passport, competing fills and duplicate redemption. |
| 3. Campaign escrow | Demonstrate both funded and missed-goal campaigns, issuance, milestone approvals, cancellation and residual refund. Test cap/close boundaries, duplicate pledge/refund, unauthorized releases and full vault reconciliation. |
| 4. Spot and charts | Demonstrate listing, cancellation, atomic buy and portfolio refresh. Test mismatched price/nonce, ownership transfer races, stale listing, wrong eligibility and duplicate events. Verify OHLCV against a known fixture with empty time buckets. |
| 5. Revenue and claims | Fund one synthetic cycle and claim from a record-date wallet. Test seller treatment while escrowed, transfers across the cutoff, wrong proof, duplicate claim, rounding dust, zero balance, funding shortfall and expiry. |
| 6. Integrated demo | Execute all flows on devnet, verify vaults and explorer receipts, and exercise disconnect/retry/pause recovery. Record commit, cluster, program, mint, test outputs and skipped checks. |

Run Vitest for domain math, permissions, schemas and indexer replay. Run Anchor tests against a local validator for account constraints, state races and payout conservation. Run Supabase migration/RLS tests locally. Use Playwright for web and an Expo device smoke for mobile, including wrong network, rejected signatures, reload during pending and eventual receipt reconciliation. Capture one devnet success path and one refund path with independently reconciled balances. Record local, CI and devnet results separately.
