# PDF Phase 1: Feasibility and Setup

Status: **In progress.** Local code and tests do not substitute for live service and devnet evidence. Credential setup is the immediate user action; see [the setup guide](../setup/CREDENTIALS.md).

## Current checkpoint

| Requirement | Status | Evidence / next action |
| --- | --- | --- |
| Monorepo and package configuration | Implemented; verification in progress | Pinned dependencies, Node/pnpm versions, repaired exports, boundary check, Vitest/Playwright configuration, reconciled lockfile |
| Local environment | Ready | `pnpm setup:local` creates ignored `apps/web/.env.local`, generates a random secret, preserves existing files; `pnpm check:setup` redacts values |
| Pollar social/email/external wallet integration | Implemented locally; live check pending | Device-signed DPoP exchange against authenticated Pollar profile and wallet responses; no browser-asserted identity accepted; live dashboard key required |
| Embedded custom Anchor signing | Unverified | SDK/source inspection does not establish live support; keep external signer fallback |
| Persistent Supabase | Pending | User will create credentials; then apply migrations and test persistence/access controls |
| Solana devnet funds, mint and sample signed transfer | Pending | Record real network/mint/transaction evidence; never use placeholder program ID as a deployment |
| ElevenLabs live session and read-only tool | Pending | User will create API key/agent; run a real conversation and tool check |
| Firecrawl authorized brief | Pending | User will create API key; run and record an actual authorized extraction |
| Permission for three demo tracks | Confirmed by user | User explicitly confirmed permission on 27 November 2026; track metadata/fixtures can be supplied at the catalog checkpoint |

## Authentication trust boundary

The session endpoint accepts only an access token and device-signed DPoP proofs for fixed Pollar endpoints. Pollar verifies signature, token binding, nonce, revocation and replay. Identity and wallet fields come from those authenticated responses. No tokens or proof values are logged or persisted by Encore. Only an explicitly identified Solana devnet wallet is bound. Mainnet, Stellar, unknown-network and unfinished wallets are not silently accepted as devnet wallets.

The original direct Wallet Standard login remains available when Pollar is not configured; it is not evidence of a live Pollar integration. Live testing may reveal additional provider-specific requirements, which must be documented before this gate is marked complete.

## Local verification

Verified on Node 24.22.3 / pnpm 9.15.0: **23 tests passed, 4 queue tests remain TODO**. This includes nine provider-verification cases and four session-endpoint tests with mocked upstream responses, not live Pollar calls. Import-boundary checks and all five package typechecks passed. The Next.js production build completed successfully (16 generated pages). The setup command passed its local environment checks and reported missing provider configuration. Playwright browser checks have not been run.

## Exit gate

Do not mark PDF Phase 1 complete until the live integration, test mint/funds/signing and asset permission checks above have evidence. Then continue with PDF Phase 2 (H02–10): artist submission, Music Passports, searchable categories and staging deployment.
