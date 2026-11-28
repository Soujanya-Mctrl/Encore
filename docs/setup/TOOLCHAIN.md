# Verified local toolchain

Application checks use Node **24.22.3** (`.nvmrc`) and pnpm **9.15.0** (`packageManager`). The CLI shell must select those versions before running commands. A frozen lockfile install, TypeScript checks, Vitest, Playwright and production build passed. `pnpm lint` checks architecture/import boundaries; it is not a general style linter.

Rust host tests passed on **rustc 1.94.0**. Solana CLI **1.18.26** is installed in ignored `.local/toolchain/solana-release/bin`. Anchor CLI is pinned to **0.30.1** in `Anchor.toml`; its local install path is `.local/toolchain/anchor/bin`. Add those directories to PATH when running chain commands. The redacted `pnpm check:setup` also detects these project-local executables.

## Anchor CLI compatibility

The published 0.30.1 CLI lockfile selects `time 0.3.29`, which fails type inference on newer Rust. [Rust's release notes](https://doc.rust-lang.org/releases.html#version-1800-2024-07-25) document this compatibility issue. The local CLI build uses the unmodified official 0.30.1 crate source in ignored `.local/toolchain/anchor-cli-source`, with an empty `[workspace]` table to isolate it from Encore's workspace and this dependency-only update:

```sh
cargo update --manifest-path .local/toolchain/anchor-cli-source/Cargo.toml -p time --precise 0.3.36
cargo install --path .local/toolchain/anchor-cli-source --locked --root .local/toolchain/anchor
```

The project's Cargo.lock and Anchor program dependencies were not changed by that CLI workaround. On an exFAT volume, ignore/remove AppleDouble `._*` metadata only inside this generated dependency cache: old ring build scripts otherwise try to compile those metadata files. An interrupted external drive also caused one installation attempt to fail with an I/O error; the cached build was resumed after the volume became available.

Build caches use `.local/cargo-home` and `.local/anchor-cli-target` to avoid filling the laptop's internal disk. Set `CARGO_HOME` and `CARGO_TARGET_DIR` to those absolute paths when resuming this local build. They are ignored and must never be committed.

## Reproducible checks

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rust
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

The real provider browser check requires `ENCORE_RUN_LIVE_TESTS=1` and the configured local environment. It creates a random test identity and removes that test's profile afterward. Never commit its traces, environment values or generated payer key. Service/devnet spikes have separate `spike:*` commands and write sanitized summaries only to ignored `.local/phase-one`; publishing evidence requires selecting public fields deliberately.

`pnpm test:rust` is host testing. It does not establish an SBF build, an Anchor local validator test, a deployed program, or a production security audit. The current program remains a registry scaffold with a placeholder address; implementation and deployment are Phase 2 work. Supabase's six identity tables were initialized through its authenticated dashboard; a Supabase CLI is not installed on this machine.
