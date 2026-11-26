# Authentication & Onboarding Test Report

> **Executed:** `2026-11-26` | **Environment:** Local Node `v22.21.1` + `pnpm@9.15.0` + `Next.js 15.5.29`

## 1. Automated Verification Results

| Command | Scope | Result | Details |
| :--- | :--- | :--- | :--- |
| `pnpm typecheck` | All 5 TS packages (`contracts`, `solana-client`, `core`, `infrastructure`, `web`) | **PASS** (`0` errors) | `5 successful, 5 total` in `4.646s` |
| `pnpm test` | `@encore/core` + `@encore/infrastructure` (`Vitest 2.1.9`) | **PASS** (`10/10` tests) | `result.test.ts` (2), `identity.test.ts` (5), `auth-infra.test.ts` (3) |
| `pnpm build` | `@encore/web` (`next build`) | **PASS** (`16/16` pages) | All routes (`/`, `/login`, `/onboarding`, `/discover`, `/studio/dashboard`, `/admin/reviews`, `/api/v1/auth/*`) built in `53.621s` |
| `pnpm test:e2e` | `tests/e2e/auth/onboarding.spec.ts` | `Not Run` | Playwright browser binary/run requires `playwright install` & live server |

## 2. Live Pollar & Devnet Smoke Test Status

- **Code & SDK Verification:** `@pollar/core@0.12.0`, `@pollar/react@0.12.0`, `@pollar/solana-wallet-standard-adapter@0.12.0` installed and `.d.ts` verified.
- **Pending Manual Credentials:** Live Google OAuth, GitHub OAuth, Email OTP, and Pollar embedded wallet provisioning require `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` from `https://dashboard.pollar.xyz/` and Supabase `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
