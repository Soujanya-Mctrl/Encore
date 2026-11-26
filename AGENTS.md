# Encore Agent & Developer Instructions

1. **Architecture Style:** TypeScript monorepo (`pnpm` + `Turborepo`) with a modular monolith (`apps/web` + `packages/core` + `packages/infrastructure`) and a single Solana Anchor program (`programs/encore`).
2. **Strict Import Boundaries:**
   - `packages/core` is pure domain + application logic (zero imports of Supabase, Next.js, ElevenLabs, Firecrawl, Pollar, or Solana SDKs).
   - `packages/infrastructure` implements ports defined in `packages/core`.
   - Client components in `apps/web` must never import `@/server/container` or `SUPABASE_SERVICE_ROLE_KEY`.
3. **Provenance Invariants:** Keep `OriginCategory`, `EvidenceStatus`, and `RightsStatus` strictly separate. Missing evidence is `UNKNOWN` / `UNVERIFIED`, never auto-labeled AI.
4. **Economic Invariants:** Integer smallest-unit math only (`floor` fee splits). Never allow ElevenLabs agent tools to execute payments or mutate verification status.
