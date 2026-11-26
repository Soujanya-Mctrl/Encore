# Contributing to Encore

1. **Architecture:** Follow the modular monolith boundaries documented in [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).
2. **Module Rules:**
   - `packages/core` must **never** import Next.js, Supabase, Solana SDKs, or external provider SDKs.
   - Cross-module calls use public module interfaces or domain events, never direct repository imports.
3. **Branching & PRs:** Use short feature branches, run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening a PR.
4. **Documentation:** Update [`docs/planning/COMPLETION_LOG.md`](docs/planning/COMPLETION_LOG.md) when completing phase gates or `FR01`–`FR11` milestones.
