# Test Plan, Verification Matrix & Execution Report

> **Rule:** Never report a test as passed until actual command output exists. Keep test targets separate from measured results.

---

## 1. Testing Strategy & Tooling

| Suite | Tooling | Scope |
| :--- | :--- | :--- |
| **Unit** | `Vitest` | `packages/core` domain rules (classification, fee math, versioning, canonical hashing) with zero DB/RPC dependencies. |
| **Contract** | Anchor tests + `LiteSVM` | `programs/encore` ownership, payment conservation, replay protection, PDA seeds, state machine. |
| **Integration & Queues** | `Vitest` + Supabase CLI | `supabase/tests/` (`rls.test.sql`, `constraints.test.sql`), `tests/queues/` (`delivery`, `retry`, `idempotency`, `dead-letter`), RPC & provider adapters. |
| **E2E** | `Playwright` | Artist registration & passport creation through fan voice discovery, tip, pass buy/resale, and redemption. |
| **Adversarial & Security** | `tests/security/` | Tampering, stale passports, unauthorized agent actions, private evidence leaks, recipient substitution. |
| **Benchmarks** | `tests/benchmarks/` | Confirmed tx latency (`p50`/`p95`), catalog search latency, voice tool success rate. |

---

## 2. Priority Security & Adversarial Test Suite (`tests/security/`)

- `tampered-manifest.test.ts` — Altered off-chain manifest fails `SHA-256` verification against on-chain `PassportVersion`.
- `stale-passport-payment.test.ts` — Checkout using an outdated `expected_version` or `manifest_hash` is rejected on-chain.
- `duplicate-redemption.test.ts` — Second `redeem_pass` or post-redemption `list_pass` fails.
- `unauthorized-reviewer.test.ts` — Non-reviewer wallet cannot call `set_review_status` or `pause_track`.
- `payment-recipient-substitution.test.ts` — Client-supplied payout ATA not matching `artist.payout_wallet` / `platform_wallet` is rejected.
- `private-evidence-access.test.ts` — Supabase RLS denies access to private evidence buckets/tables from other accounts.
- `ai-agent-payment-injection.test.ts` — Adversarial voice prompts or Firecrawl text cannot invoke payments or mutate verification status.
- `rights-restriction-bypass.test.ts` — Missing master/provider permission blocks hosted preview and local license checkout.

---

## 3. Anchor Contract Test Matrix (Target: >=20 Automated Cases)

- **Authorization & Accounts:** wrong owner/wallet/artist recipient, unauthorized reviewer, bad PDA seeds, wrong mint or token program.
- **Supply & Math:** amount zero, arithmetic overflow, cap exhaustion (`issued == cap`), rounding & exact payout conservation (`inflow == outflows`).
- **Pass Lifecycle & Concurrency:** wrong listing nonce/price, cancellation race, double primary purchase, concurrent list/redeem, expired pass trade/redeem, double redemption.
- **Provenance & Safety:** duplicate `SupportReceipt` nonce, stale `PassportVersion` checkout, paused track purchase, immutable `previous_hash` enforcement.

---

## 4. P0 Functional & Pilot UX Targets

- **Functional:** Register `H01`/`A01`/`G01` + `UNKNOWN` fixture; create successor `PassportVersion`; filter all combinations; 1 real ElevenLabs voice call; 1 real Firecrawl extraction; 1 confirmed tip, primary sale, resale, redemption; dashboard totals match chain receipts; 1 appeal + versioned correction.
- **UX Pilot (5 listeners, 3 artists):** Target `4/5` identify correct origin/uncertainty from UI; `4/5` complete support flow unaided (no generalization from small sample).

---

## 5. Test Execution Log

| Date (UTC) | Suite / Command | Environment | Pass / Fail | Tx Signatures / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `2026-11-26` | *Pre-implementation baseline* | `N/A` | `Not Run` | Awaiting `H02–10` Anchor & web scaffolding |
| `2026-11-28` | `pnpm lint` (`scripts/check-boundaries.ts`) | `Windows / Node v22.21.1` | `PASS` | Domain and client/server import boundaries passed (`main` @ `f1aef71` + local fix). |
| `2026-11-28` | `pnpm check:secrets` (`scripts/check-secrets.ts`) | `Windows / Node v22.21.1` | `PASS` | Passed for 0 staged files after guarding missing `apps/web/.env.local`. |
| `2026-11-28` | `pnpm typecheck` (`turbo run typecheck && tsc -p tsconfig.tools.json`) | `Windows / pnpm 9.15.0` | `PASS` | `6 successful, 6 total` (`contracts`, `solana-client`, `core`, `mobile`, `infrastructure`, `web`). |
| `2026-11-28` | `pnpm test` (`vitest run`) | `Windows / Vitest 2.1.9` | `PASS (4 skipped)` | `13 passed \| 4 skipped (17)` files; `49 passed \| 4 todo (53)` tests (`tests/queues/` has 4 `todo` specs). |
| `2026-11-28` | `pnpm --filter @encore/web build` (`next build`) | `Windows / Next.js 15.5.29` | `PASS` | `28/28` pages and `/api/v1/*` routes compiled cleanly. |
| `2026-11-28` | `pnpm test:rust` (`cargo test`) / Anchor / Supabase CLI | `Windows` | `Not Run` | `cargo`, `rustc`, `solana`, `anchor`, and `supabase` CLIs are not installed in `PATH`. |
