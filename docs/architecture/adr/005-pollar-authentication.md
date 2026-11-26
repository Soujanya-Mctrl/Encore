# ADR-005: Pollar Authentication & Encore Backend Session Exchange

- **Status:** Accepted (`2026-11-26`)
- **Context:** Pollar (`@pollar/core@0.12.0`) uses RFC 9449 DPoP-bound tokens tied to a non-extractable browser WebCrypto keypair and does not yet expose chain-aware Solana SIWS in `PollarClientConfig.walletAdapters`. Additionally, Supabase Auth is excluded for MVP so Pollar remains the primary auth & embedded-wallet provider.
- **Decision:**
  1. Use `@pollar/react` + `@pollar/core` for Web2 social/email OTP and embedded Solana wallet provisioning.
  2. Use `@pollar/solana-wallet-standard-adapter` for external wallet discovery + Encore's Ed25519 SIWS challenge-verify endpoints (`auth_challenges` table).
  3. Issue an Encore-managed `HttpOnly`, `SameSite=Lax`, HMAC-SHA256 signed `encore_session` cookie (`HmacSessionTokenService`) for all backend API and SSR route authorization.
- **Consequences:** Works cleanly in SSR + React Strict Mode, enforces single-use SIWS replay protection, and isolates Pollar behind `apps/web/src/providers/pollar-provider.tsx` and `packages/infrastructure/`.
