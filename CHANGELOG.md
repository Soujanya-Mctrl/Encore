# Changelog

All notable changes to Encore are documented here and mirrored in [`docs/planning/COMPLETION_LOG.md`](docs/planning/COMPLETION_LOG.md).

## [Unreleased] - 2026-11-28
### Added
- Implemented Supporter Marketplace Layer 1 & Layer 2 across `packages/contracts`, `packages/core/src/modules/marketplace/`, `packages/solana-client`, `packages/infrastructure`, `programs/encore`, `supabase/migrations/202611280001..0003*.sql`, `apps/web/src/app/api/v1/`, and `apps/mobile` Expo Router screens (`f1aef71`).
- Added native Expo Android PKCE bearer exchange (`/api/v1/auth/pkce/{code,exchange}`) alongside Wallet Standard SIWS and Pollar session verification.

### Fixed
- Guarded `scripts/check-secrets.ts` with `existsSync("apps/web/.env.local")` so `pnpm check:secrets` passes in environments without a local `.env.local`.
- Consolidated dangling worktrees and branches onto `main` (`f1aef71`).

## [0.1.0-alpha] - 2026-11-26
### Added
- Initialized production-grade modular monolith repository structure (`apps/web`, `packages/{core,infrastructure,contracts,solana-client,config}`, `programs/encore`, `supabase/`, `tests/`, `scripts/`, `.github/`).
- Created categorized documentation wiki in `docs/` with `PRD.md`, stack diagrams, security audit log, test plan, and 48-hour build plan.
