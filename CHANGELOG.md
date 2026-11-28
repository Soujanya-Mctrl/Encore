# Changelog

All notable changes to Encore are documented here and mirrored in [`docs/planning/COMPLETION_LOG.md`](docs/planning/COMPLETION_LOG.md).

## [Unreleased] - 2026-11-28
### Added
- Completed Artist Monetization Phases 1, 2, and 4:
  - Renumbered marketplace SQL migrations (`0003`–`0005`) and added `202611280006_governance_and_indexer.sql` (reviews, milestones, dual-approval revenue cycles, `spot_fills`, `chain_indexer_cursor`).
  - Implemented `SupabaseMarketplaceRepository` and wired it in `apps/web/src/server/container.ts` when Supabase credentials are configured.
  - Added cancel, refund, dual-approval governance, and `aggregateSpotCandles` use cases in `packages/core` + `/api/v1/{passes/cancel-listing,spot/cancel,campaigns/refund,reviews/campaigns,campaigns/milestones,distributions/reconcile,distributions/fund}`.
  - Added `useTransactionLifecycle()` reload-safe recovery hook, real OHLCV + empty state in `CandlestickChart.tsx`, `apps/mobile/src/app/admin/reviews.tsx`, and cancel/refund/milestone UI in `portfolio.tsx` & `studio/campaigns.tsx`.
- Implemented Supporter Marketplace Layer 1 & Layer 2 across `packages/contracts`, `packages/core/src/modules/marketplace/`, `packages/solana-client`, `packages/infrastructure`, `programs/encore`, `supabase/migrations/`, `apps/web/src/app/api/v1/`, and `apps/mobile` Expo Router screens (`f1aef71`).
- Added native Expo Android PKCE bearer exchange (`/api/v1/auth/pkce/{code,exchange}`) alongside Wallet Standard SIWS and Pollar session verification.

### Changed
- Gated `/api/v1/opinion/trade` and marketplace opinion UI behind `ENABLE_OPINION_MARKET=true` / `EXPO_PUBLIC_ENABLE_OPINION_MARKET=true` per `plan.md` DeFi demo scope.

### Fixed
- Guarded `scripts/check-secrets.ts` with `existsSync("apps/web/.env.local")` so `pnpm check:secrets` passes in environments without a local `.env.local`.
- Consolidated dangling worktrees and branches onto `main` (`f1aef71`).

## [0.1.0-alpha] - 2026-11-26
### Added
- Initialized production-grade modular monolith repository structure (`apps/web`, `packages/{core,infrastructure,contracts,solana-client,config}`, `programs/encore`, `supabase/`, `tests/`, `scripts/`, `.github/`).
- Created categorized documentation wiki in `docs/` with `PRD.md`, stack diagrams, security audit log, test plan, and 48-hour build plan.
