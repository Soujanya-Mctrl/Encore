# Authentication & Wallet Onboarding Architecture

## 1. Current Authentication Sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Browser)
    participant P as Pollar SDK / Wallet Standard
    participant API as Encore Next.js API (/api/v1/auth)
    participant DB as Supabase Postgres

    alt Legacy Pollar exchange request
        U->>API: POST /api/v1/auth/pollar/session
        API-->>U: 503; no identity writes or session cookie
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

- Social and email sign-in is paused. Re-enable it only when Encore has a verified server-side Pollar exchange that derives the provider identity and wallet from trusted evidence.
- After wallet verification, Encore issues a v2 HMAC-SHA256 signed HttpOnly cookie with SameSite=Lax, a two-hour lifetime and Secure in production. Tokens issued before v2 require a new sign-in.
- Production requires an environment-specific random session secret of at least 32 characters. Development can use an in-process random fallback.
- Onboarding requires a valid session and allows listener or artist. The Studio page requires artist or admin. The review page requires reviewer or admin. These are page-level role gates. Channel membership, scoped writes and reviewer assignment are separate planned controls.

---

## 3. Database Schema (`supabase/migrations/202611270001_identity.sql`)

Six RLS-enabled tables: `profiles`, `auth_identities` (`unique(provider, provider_subject)`), `wallets` (`unique(address)` with Solana base58 regex check), `user_roles`, `user_preferences`, and `auth_challenges`.
