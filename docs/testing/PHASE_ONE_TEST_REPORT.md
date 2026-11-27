# Phase 1 verification — 27–28 November 2026

| Check | Result |
| --- | --- |
| Frozen lockfile installation | Passed with pinned pnpm 9.15.0 |
| Domain/client-server import boundaries (`pnpm lint`) | Passed |
| Workspace and root tooling TypeScript (`pnpm typecheck`) | Passed |
| Vitest (`pnpm test`) | 38 passed; four queue TODOs remain unimplemented, not counted as passes |
| Rust host tests (`pnpm test:rust`) | Four passed: program ID, fee flooring, integer conservation and overflow rejection |
| Playwright (`ENCORE_RUN_LIVE_TESTS=1 pnpm test:e2e`) | Four passed from a clean server, including real Pollar/Supabase login |
| Production build (`pnpm build`) | Passed; all 16 pages generated |
| Local toolchain executables | Anchor 0.30.1, Solana CLI 1.18.26 and rustc 1.94.0 verified |
| Configured credential scan | Passed across tracked files; no configured credential values or PEM private keys found |
| Live services and devnet spikes | Passed within the scope recorded in [sanitized results](PHASE_ONE_LIVE_RESULTS.json) |

Node 24.22.3; pnpm 9.15.0; Playwright 1.58.2. Browser binaries are installed locally; run `pnpm exec playwright install chromium` on a new machine. On this external-volume workspace, the launcher uses ignored `.local/ms-playwright` when present. Live browser tests require the configured local env and opt-in; ordinary CI skips that provider-dependent test.

The live browser scenario checks the official Pollar external-wallet UI, an HttpOnly Encore session, authenticated wallet binding, refresh persistence and denied admin-role onboarding. Unit tests also cover exact-message SIWS signatures, challenge expiry/replay, same-origin mutation protection, provider verification failures/network restrictions, and fresh DPoP proof generation after nonce/transient responses.

Early browser attempts failed because a long-running Next development process retained an earlier authentication verifier through hot reload. Restarting that process resolved the issue; the reported final four-test run passed from a clean server. Restart after changing provider code or environment. Retries use fresh proofs and do not relax authentication checks.

These results do not constitute a deployed Encore program or a complete payment-contract audit. The full contract/security suite is a later PDF gate. ElevenLabs conversation/tool execution is explicitly deferred; Pollar social login, hosted provisioning and embedded custom Anchor signing remain unexercised. Supabase CLI is not installed; identity migrations were applied through the authenticated dashboard and verified against the live database.

See [Phase 1 checklist and handoff](../planning/PHASE_ONE_REPORT.md) for open gate items and Phase 2 scope.
