# Authentication & Wallet Onboarding Architecture

## 1. Dual-Path Authentication Sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Browser)
    participant P as Pollar SDK / Wallet Standard
    participant API as Encore Next.js API (/api/v1/auth)
    participant DB as Supabase Postgres

    alt Web2 Social / Email OTP (Pollar)
        U->>P: Login (Google / GitHub / Email OTP)
        P-->>U: Verified DPoP Session + Embedded Solana Wallet
        U->>API: POST /api/v1/auth/pollar/session
        API->>DB: Upsert profile + auth_identities + embedded wallet
        API-->>U: Set HttpOnly encore_session cookie
    else Web3 External Wallet (SIWS)
        U->>P: Connect Phantom / Solflare / Backpack
        U->>API: POST /api/v1/auth/siws/challenge (address)
        API->>DB: Store single-use nonce (5m TTL)
        API-->>U: SIWS Challenge Message
        U->>P: signMessage(challenge)
        U->>API: POST /api/v1/auth/siws/verify (sig)
        API->>API: Verify Ed25519 signature + consume nonce
        API->>DB: Upsert profile + auth_identities + external wallet
        API-->>U: Set HttpOnly encore_session cookie
    end
```

---

## 2. Session Verification & Trust Boundaries

- Pollar tokens are DPoP-bound to a non-extractable browser WebCrypto keypair; Encore's Next.js backend **never** trusts raw client-side Pollar flags as backend authorization.
- After verified Web3 SIWS or Pollar session exchange, Encore issues an **HMAC-SHA256 signed `HttpOnly`, `SameSite=Lax` cookie** (`encore_session`, `2h` TTL).
- All protected routes (`/studio/*`, `/admin/*`, `/api/v1/auth/onboarding`) verify `encore_session` server-side via `requireAuthenticatedUser()`.

---

## 3. Database Schema (`supabase/migrations/202611270001_identity.sql`)

Six RLS-enabled tables: `profiles`, `auth_identities` (`unique(provider, provider_subject)`), `wallets` (`unique(address)` with Solana base58 regex check), `user_roles`, `user_preferences`, and `auth_challenges`.
