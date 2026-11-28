# PDF Phase 1: Feasibility and Setup

Status: **Approximately 85% complete.** On 28 November 2026 (Asia/Kolkata), the new ElevenLabs key passed account, agent-list, agent-detail and signed-session-URL authorization checks (HTTP 200). The unique existing Encore agent was linked in the ignored local env. A live voice conversation/read-only tool run and the other gate limitations below remain unverified. Phase 2 is now active. See the [Phase 2 handoff](PHASE_TWO_REPORT.md).

## Checklist and evidence

| Requirement | Result | Evidence / remaining work |
| --- | --- | --- |
| Monorepo and package configuration | Passed | Node 24.22.3, pnpm 9.15.0, exact package versions, frozen lockfile, import-boundary checks, package and tool TypeScript checks |
| Local environment | Passed | Ignored local env, generated session secret, redacted setup check; Supabase persistence selected |
| Pollar SDK integration | Passed for external wallet | Real SIWS login and device-bound DPoP backend exchange; live browser verifies HttpOnly cookie, wallet binding, refresh persistence and rejected admin onboarding |
| Pollar email/social and hosted wallet provisioning | Not exercised | Official UI is wired; live external-wallet evidence does not prove these paths |
| Custom transaction signer fallback | Available | External wallet adapter custom-transaction unit test and real devnet transaction signing; hosted custom Anchor signing remains unverified, so retain external fallback |
| Supabase initialization | Passed | Identity migrations 001 and 002 applied; six tables with RLS; persistence across independent clients; anonymous reads hide records and inserts return 401 |
| Devnet funds, test mint and signed sample transfer | Passed | User funded 0.5 test SOL; created six-decimal test mint and confirmed SOL/token transfers; public evidence below |
| ElevenLabs live session and read-only tool | Credentials and session authorization verified; live execution pending | API key and existing Encore agent verified; agent ID linked locally. No live conversation, audio exchange or read-only tool execution was run during this credential check |
| Firecrawl crawl test | Passed | Real v2 scrape of the user's public Encore repository; API feasibility only. Commissioning brief extraction/matching belongs to later work |
| Three demo-track permissions | Confirmed by user | No further permission question required. Track audio, metadata and evidence fixtures remain Phase 2 catalog inputs |
| Event rules and sponsor criteria | Partially checked | Official site confirms November 27–29, 2026. Exact cutoff, prebuild rules and sponsor criteria were not independently established; no eligibility claim |
| Rust/Solana toolchain | See validation record | Anchor CLI 0.30.1 and Solana CLI 1.18.26 verified; Rust host tests pass. SBF build/deployment is separate from host testing |

## Public devnet evidence

- Test payer: `2VXLffNhejZKNgeN9dNjG4s7pe8T6bGihQBmVGbTn2vM`.
- Test mint: `7H5EwCxRKPJ3rsdb88zsv3k8dEroYzYVguGUP9kjdZnP`, six decimals. This is an Encore demo token, not real USDC.
- [Confirmed transfer of 1,000,000 smallest units](https://explorer.solana.com/tx/2yuWScZY8ipAhiPStBsLw2oAd1ZQvUbtSpQscyLpjeNV2DDa2kRnYPRneMtMY2xFEzMDCHAbWEoCxGByuk8ZZEmW?cluster=devnet).
- Sanitized service and transaction results: [live evidence](../testing/PHASE_ONE_LIVE_RESULTS.json).

Phase 1 sample transfers exercised the test token. Phase 2 later deployed the registry and recorded the address and binary history in the [devnet deployment log](../architecture/DEVNET_DEPLOYMENTS.md).

## Authentication trust boundary

Only a provider access token and fresh device-signed proofs are accepted. Identity comes from authenticated fixed Pollar endpoints. The backend supplies the configured application Origin and handles bounded nonce challenges. Transient retries generate new proofs rather than replaying consumed signatures. The live external-only session returns `SDK_WALLET_REQUIRED` from wallet state; the authenticated profile address is accepted only for a confirmed Solana-only testnet app with no conflicting wallet state. Unknown or mainnet wallets are never silently treated as devnet wallets.

Native SIWS fallback verifies the exact server-issued message, nonce, address and expiry, consumes challenges once, and rejects altered origins/replay. Browser identity fields cannot create sessions. Production requires persistent storage and a strong session secret. Client mutation endpoints enforce same-origin JSON requests.

## Validation record

See [test results](../testing/PHASE_ONE_TEST_REPORT.md) and [local toolchain notes](../setup/TOOLCHAIN.md). The reported pass counts exclude four queue TODOs and all deferred provider paths.

## Handoff

The next PDF phase is **Phase 2, H02–10: registry, catalog and first deployment**. Implement Artist/Track/PassportVersion accounts and authorization/hash/version tests, then artist submission, three authorized categorized tracks, manifest/discovery UI and staging deployment. Queue TODO tests and the full economic/security acceptance suite remain later-phase work. Finish the live voice/read-only tool spike before claiming the original Phase 1 exit gate is closed.
