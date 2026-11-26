# Pollar Integration & Devnet Feasibility Report

> **Verified SDK Versions:** `@pollar/core@0.12.0`, `@pollar/react@0.12.0`, `@pollar/solana-wallet-standard-adapter@0.12.0`

## 1. Verified Capabilities (From Installed `.d.ts`)

| Capability | Status in `@pollar/*@0.12.0` | Encore Implementation |
| :--- | :--- | :--- |
| **Google & GitHub Social Auth** | Supported (`login({ provider: 'google' \| 'github' })`) | Wired in `EncorePollarProvider` |
| **Email OTP Auth** | Supported (`beginEmailLogin()`, `sendEmailCode(email)`, `verifyEmailCode(code)`) | Wired in `LoginPanel` |
| **Embedded Solana Wallet** | Supported (`custody: 'internal'`, `wallets` array) | Retrieved via `usePollar().wallets` |
| **DPoP Session Security** | RFC 9449 DPoP-bound tokens (`<=10 min` TTL) with non-extractable WebCrypto keypair | Browser-side session managed by `PollarProvider` |
| **External Wallet Discovery** | Supported via `@pollar/solana-wallet-standard-adapter` (`solanaWalletStandardAdapters()`) | Discovers Phantom, Solflare, Backpack |
| **SIWS in `PollarClientConfig.walletAdapters`** | **Not yet chain-aware in `0.12.0`** (`.d.ts` notes `walletAdapters` is currently Stellar SEP-10) | Encore runs native Solana Ed25519 SIWS challenge-verify directly via `SolanaWalletStandardAdapter` |
| **SOL / SPL Transfers (Embedded)** | Supported via `sendPayment()` (`/v2/tx/build-sign-submit`) | Transfer-only for embedded wallets |
| **Custom Anchor Instructions** | **External wallets only** via `SolanaWalletStandardAdapter.signSolanaTransaction()` | Embedded wallets cannot sign arbitrary Anchor instructions; fallback to external Wallet Standard signer |

---

## 2. Dashboard & Environment Setup

1. Create a Pollar application at `https://dashboard.pollar.xyz/`.
2. Enable **Solana Devnet** in Test Mode and copy your publishable key (`NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`).
3. Enable **Google**, **GitHub**, and **Email OTP** authentication methods and embedded Solana wallet provisioning.
4. Add allowed origins and OAuth redirect URLs (`http://localhost:3000` for local dev; your Vercel URL for staging).
5. Set `ENCORE_SESSION_SECRET` (32+ random bytes) in `.env.local` and Vercel environment variables.
