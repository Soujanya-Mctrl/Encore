# Pollar Integration and Devnet Feasibility

## Implemented SDK integration

Encore pins `@pollar/core`, `@pollar/react` and `@pollar/solana-wallet-standard-adapter` to `0.12.0`. Installed SDK declarations and the official source were inspected. Live external-wallet SIWS and device-bound backend verification passed on 27 November 2026 using the configured testnet application.

- Email OTP and Google/GitHub login use the official React provider.
- Configured external Solana wallets use Pollar's official Wallet Standard adapters and its login flow.
- A single injected WebCrypto key manager supplies the SDK and backend-exchange DPoP proofs.
- The backend sends device-signed proofs to fixed `/v3/auth/session/resume` and `/v3/wallet/state` endpoints. Only authenticated upstream responses supply identity and wallet claims.
- Provider nonce challenges are returned to the browser for fresh proofs. No raw profile fields are accepted as authentication.
- Only identified Solana devnet wallets are bound. Unknown/mainnet/Stellar/pending wallets do not become verified devnet wallets.
- Without Pollar configuration, the original direct Wallet Standard sign-in remains a development fallback, not proof of a real Pollar integration.

## Live evidence and limits

The real browser test passes through the official Pollar login UI, exchanges fresh DPoP proofs for an Encore HttpOnly session, binds the generated external wallet, survives reload and rejects admin-role onboarding. The separate Node spike independently verifies the provider session. See [sanitized results](../testing/PHASE_ONE_LIVE_RESULTS.json) and the [Phase 1 report](../planning/PHASE_ONE_REPORT.md).

The provider requires an Origin header. An authenticated external-only SIWS session returns HTTP 409 `SDK_WALLET_REQUIRED` from `/v3/wallet/state`. Encore accepts its authenticated profile wallet address only when application configuration confirms a Solana-only testnet app, with no conflicting wallet state. Provider nonce challenges cause fresh proofs; bounded transient retries also generate fresh proofs.

Email OTP, Google/GitHub login and hosted-wallet provisioning are wired but were not exercised live. Embedded custom Anchor instruction signing remains unverified. Keep the external signer fallback; its custom-transaction adapter unit test and real devnet signing passed. Those checks do not establish hosted-wallet custom Anchor support.

During development, restart Next.js after changing authentication verifier classes or provider environment settings: its process-wide container can retain the previous implementation through hot reload. Final live browser evidence was collected from a clean server, not that stale process.

## References

- [Official SDK](https://github.com/pollar-xyz/pollar)
- [Pollar dashboard](https://dashboard.pollar.xyz/)
