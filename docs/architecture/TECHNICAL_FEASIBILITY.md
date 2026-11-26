# Technical Feasibility, Stack Lock & ADRs

## 1. Locked Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Monorepo** | `pnpm Workspaces` + `Turborepo` | Fast workspace linking, build caching, strict package boundary enforcement. |
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, `shadcn/ui` | Rapid full-stack delivery; route groups separate public, platform, studio, and admin UIs. |
| **Backend** | Next.js Route Handlers + `packages/core` | Modular monolith deployment boundary; zero microservice network overhead. |
| **Validation & State** | `Zod` (`packages/contracts`), `Zustand` + `TanStack Query` | End-to-end type safety across API/forms; clean client audio & server cache state. |
| **Database & Auth** | PostgreSQL via Supabase + Supabase Auth + Wallet Binding | Built-in RLS, private/preview storage buckets, and SQL-backed outbox/jobs. |
| **Audio** | Web Audio API, MediaRecorder, `WaveSurfer.js` | Native browser playback/waveform without heavy server-side transcoding. |
| **Blockchain** | Solana, Anchor, Rust (`programs/encore`) | Atomic SPL transfers, PDA state machines, and low-fee versioned receipts. |
| **Wallets** | Pollar + Solana Wallet Standard fallback | Social/embedded onboarding if devnet custom Anchor signing passes `H00–02` spike. |
| **AI & Web Intel** | ElevenLabs Agents + Firecrawl | Conversational discovery & authorized commissioning brief extraction behind adapters. |
| **Testing & Ops** | `Vitest`, Anchor tests + `LiteSVM`, `Playwright`, `Pino`, GitHub Actions, Vercel | Fast unit/contract/E2E feedback loops and structured observability. |

---

## 2. Sponsor Stack Feasibility & Fallbacks

| Partner | Planned P0 Scope | Feasibility & Risks | Fallback Strategy |
| :--- | :--- | :--- | :--- |
| **Solana (Devnet)** | `PassportVersion`, `SupportReceipt`, `PassSeries`/`SupporterPass`, SPL test-USDC. | High feasibility with pinned versions; devnet RPC rate limits possible. | Use `LiteSVM` / local validator for CI tests + verified devnet deployment for demo. |
| **ElevenLabs** | Conversational discovery + read-only tools + unsigned support intent. | High feasibility for voice agent; Music API has strict terms `[10]`. | Manual catalog discovery + timestamped cached replay if previously recorded. |
| **Pollar SDK** | Embedded/social wallet onboarding on devnet `[24]`. | **Untested** for custom Anchor instruction signing on devnet. | Spike in `H00–02`. Fall back to Solana Wallet Standard / Wallet Adapter if custom signing fails. |
| **Firecrawl** | Crawl 1 authorized public brief via `OpportunityProvider` `[25]`. | High feasibility for allowlisted page; prompt injection risk from web text. | Domain allowlist + SSRF guard; untrusted data sanitization; static fixture if unreachable. |
| **Supabase** | Auth, 13+ migrations with RLS, private/preview Storage, **Queues (PGMQ) + Cron + Edge Functions**. | High feasibility; Edge Functions limited to `256 MB` RAM, `2s` CPU, `150s`/`400s` wall-clock. | Keep Edge Functions bounded (API/metadata/reconciliation); heavy FFmpeg/audio moves to dedicated PGMQ workers post-MVP. |

---

## 3. Architecture Decision Records (ADRs)

### ADR-001: Modular Monolith over Microservices
- **Context:** 48-hour hackathon delivery with 2 implementation builders cannot afford distributed tracing, inter-service RPC, or multi-deployment orchestration, yet needs clean post-hackathon scalability.
- **Decision:** Deploy one Next.js + Supabase modular monolith with 13 isolated DDD business modules in `packages/core` and PostgreSQL-backed outbox jobs (`packages/infrastructure/src/jobs/`).
- **Trade-offs:** Shared runtime process in MVP, but strict ESLint/export boundaries allow extracting workers (Stage 2) or subsystems (Stage 3) without rewriting domain logic.

### ADR-002: Versioned Off-Chain Manifest + On-Chain Hash Commitment
- **Context:** Storing full role disclosures, DAW logs, and legal terms on-chain is expensive and leaks private metadata; storing only in Postgres risks silent tampering.
- **Decision:** Store private evidence in Supabase private buckets with RLS, canonicalize public manifest JSON (RFC 8785), compute `SHA-256`, and anchor `(track, version, previous_hash, manifest_hash)` in `PassportVersion` PDAs.
- **Trade-offs:** Requires idempotent chain-event indexing into Postgres; guarantees tamper detection while permitting off-chain GDPR/takedown deletion.

### ADR-003: Program-Controlled `SupporterPass` PDAs vs. Freely Tradable NFTs
- **Context:** Standard wallet NFTs can be transferred on external marketplaces, bypassing expiry, dispute pauses, redemption locks, and creator resale splits.
- **Decision:** Model `SupporterPass` as a program-controlled PDA in MVP (`OFFERED` → `OWNED` → `LISTED` → `REDEEMED`/`EXPIRED`).
- **Trade-offs:** Less immediate composability with external NFT wallets in P0, but 100% enforcement of caps, expiry, dispute pauses, and fee conservation.

### ADR-004: Provider Abstraction Layer (`packages/infrastructure/src/integrations/`)
- **Context:** Hackathon sponsor SDKs (Pollar, ElevenLabs, Firecrawl) evolve rapidly and have distinct terms/limits.
- **Decision:** Isolate all external SDKs behind domain ports in `packages/core` (e.g., `OpportunityProvider`).
- **Trade-offs:** Slight upfront interface boilerplate; prevents vendor lock-in and enables offline unit testing with `Vitest`.
