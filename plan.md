# Encore — 48-Hour Development Plan & Live Progress Tracker

> **Canonical planning source:** This file is the single source of truth for current status, scope, milestones and follow-on work. Other architecture and diagram documents describe design decisions or historical alternatives; they must not carry independent progress status.

> **Start Timestamp:** `2026-11-26 21:20:58 +05:30` (H00:00)  
> **Last Updated:** `2026-11-28 11:24:00 +05:30`
> **Tracking status:** The original H00–H48 clock is retained as a planning baseline; elapsed-hour values are no longer treated as live status.
> **Current Active Stage:** **Phase 1, 2 & 8 (Auth, Database/PGMQ, Anchor & Expo Supporter Marketplace)** *(code & unit/security tests implemented; live Supabase/devnet deployment pending credentials & Anchor CLI)*
> **Code Freeze Target:** `Hour 38` | **Submission Ready:** `Hour 43` | **Buffer:** `5 hours (H43–48)`

---

## 1. 48-Hour Phase Tracker

| Phase | Window | Deliverables | Status | Elapsed / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **0. Feasibility & Setup** | `H0–2` | Sponsor API testing, monorepo setup, environment config, devnet/Pollar SDK spike | `Done` | Monorepo (`pnpm` + Turborepo), Pollar `0.12.0` `.d.ts` verified, `pnpm typecheck` & `pnpm test` green |
| **1. Authentication & Onboarding** | `H2–5` | Pollar Auth, social login, wallet login, embedded wallets, user roles | `In Progress` | Identity contracts, core use cases, routes, provider, session service, UI and auth tests are present; live provider/database verification remains |
| **2. Database & Infrastructure** | `H2–6` | Supabase migrations, storage, access control, PGMQ queues, Edge Functions | `In Progress` | PGMQ migrations, queue adapters, Edge Function stubs and infrastructure adapters are present; applying and verifying the identity migration remains |
| **3. Artist Studio** | `H5–10` | Artist profiles, music uploads, creative disclosures, evidence submission | `Pending` | — |
| **4. Provenance Engine** | `H5–12` | Music Passports, creation checkpoints, contribution graph, on-chain registry | `Pending` | — |
| **5. Licensing & Rights Management** | `H10–14` | Rights verification, contributor consent, provider permissions, licensing records | `Pending` | — |
| **6. Music Discovery & Player** | `H10–16` | Music playback, search, origin-based segregation, listener preferences | `Pending` | — |
| **7. Artist Monetization** | `H12–20` | Direct support, USDC payments, provenance-bound settlement, earnings | `Pending` | — |
| **8. Supporter Marketplace** | `H16–24` | Universal Expo (`apps/mobile`) UI + 3 payment paths (`Support`/`Trade`/`Fund`), Supporter Passes, campaign escrow + refunds, fixed-price `SpotListing` shares (1h candlestick UI), distribution claims & isolated Yes/No market | `In Planning` | Aligned with `encore-support-marketplace-architecture.html` & `encore-artist-first-marketplace.html` (`/plan` artifact ready for approval). Layer 2 remains devnet/demo-only (`SYNTHETIC DATA`) until legal/rights gates pass. |
| **9. ElevenLabs Integration** | `H20–26` | Conversational music discovery, artist assistance, payment intent prep | `Pending` | — |
| **10. Firecrawl Integration** | `H24–28` | Commercial opportunity discovery and artist matching | `Pending` | — |
| **11. Creative Fairness & Moderation** | `H26–32` | Classification disputes, appeals, evidence corrections, artist notifications | `Pending` | — |
| **12. Integration & Security Testing** | `H32–36` | Contract tests, adversarial testing, authorization, queue reliability, E2E | `Pending` | — |
| **13. Deployment & UI Polish** | `H36–38` | Vercel deployment, Solana devnet, Supabase, responsive UI, performance | `Pending` | **Code Freeze at H38** |
| **14. Documentation & Submission** | `H38–43` | Technical docs, research, licensing policies, pitch, demo video | `Pending` | **Submission Ready at H43** |
| **15. Contingency Buffer** | `H43–48` | Critical bug fixes, rehearsals, final submission verification | `Pending` | `5h` safety buffer |

---

## 2. What Is Done So Far (`0h 00m – 0h 33m`)

- [x] Unpacked `PRD.md` (v1.0) and 6 conceptual diagrams into `docs/`.
- [x] Built categorized documentation wiki (`README.md`, `docs/WIKI.md`, product, taxonomy, architecture, Anchor spec, feasibility/ADRs, tokenomics, legal/privacy, security/audit log, test plan, 48h build plan, citations).
- [x] Initialized `pnpm Workspaces + Turborepo` modular monolith (`apps/web`, `packages/{core,infrastructure,contracts,solana-client,config}`, `programs/encore`, `supabase/`, `tests/`, `scripts/`, `.github/`).
- [x] Locked Supabase Queues (PGMQ) + Cron + Edge Functions (`supabase/functions/process-jobs/`, PGMQ SQL migrations, `tests/queues/`).
- [x] Installed `@pollar/core@0.12.0`, `@pollar/react@0.12.0`, `@pollar/solana-wallet-standard-adapter@0.12.0`, `@solana/web3.js@1.95.8`, `@supabase/supabase-js@2.47.10`, and verified SDK `.d.ts` capabilities.
- [x] Created `packages/contracts/src/auth/auth-schemas.ts` and `packages/core/src/modules/identity/` domain entities, policies, ports, and use cases.

---

## 3. What Is Left To Do (Immediate Next Steps)

### Phase 1 & 2 Remaining (Current Focus)
- [ ] Apply `supabase/migrations/202611270001_identity.sql` (`profiles`, `auth_identities`, `wallets`, `user_roles`, `user_preferences`, `auth_challenges` + RLS).
- [ ] Implement `packages/infrastructure` identity adapters (`SupabaseUserRepository`, `InMemoryUserRepository`, `NodeEd25519Verifier`, `HmacSessionTokenService`, `PollarServerVerifier`).
- [x] Implement Next.js API routes under `apps/web/src/app/api/v1/auth/` and `server/request-context.ts`.
- [x] Implement the `PollarProvider` client wrapper, `/login`, `/onboarding`, and protected route surfaces.
- [ ] Run and record the complete unit, integration, Playwright auth, typecheck and build verification; update the linked auth documentation with results.

### Phases 3–15 Remaining
- [ ] **Phase 3–5:** Artist Studio, Provenance Engine (`PassportVersion` Anchor instructions), and Rights/Licensing gates.
- [ ] **Phase 6–8 (Expo + Marketplace):** Build `apps/mobile` (Universal Expo Router for Android + Expo Web), Discovery & player, Direct Tips (`direct_support` / Pollar `sendPayment`), Supporter Pass Marketplace, Campaign Escrow + Refunds, Fixed-Price `SpotListing` Project Shares (1h candlestick screen), and Distribution-Cycle Holder Claims.
- [ ] **Opinion market:** Isolated Yes/No trading with a separate `1 test USDC`-backed prediction vault, earlier trading cutoff, immutable resolution and one-time winning claim. Keep it strictly separate from Supporter Passes, campaign escrow, and provenance status; devnet-only (`DEVNET / SYNTHETIC DATA`) until legal and market-integrity review.
- [ ] **Phase 9–11:** ElevenLabs Voice Agent, Firecrawl Opportunity matching, and Moderation/Appeal workflow.
- [ ] **Phase 12–15:** Adversarial/E2E/Anchor security tests, Vercel + Devnet deploy, final docs/pitch/video, and submission.
