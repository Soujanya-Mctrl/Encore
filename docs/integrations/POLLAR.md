# Pollar Integration and Devnet Feasibility

## Implemented SDK integration

Encore pins `@pollar/core`, `@pollar/react` and `@pollar/solana-wallet-standard-adapter` to `0.12.0`. Installed SDK declarations and the official source were inspected. Live Pollar verification remains pending the user's app key and dashboard setup.

- Email OTP and Google/GitHub login use the official React provider.
- Configured external Solana wallets use Pollar's official Wallet Standard adapters and its login flow.
- A single injected WebCrypto key manager supplies the SDK and backend-exchange DPoP proofs.
- The backend sends device-signed proofs to fixed `/v3/auth/session/resume` and `/v3/wallet/state` endpoints. Only authenticated upstream responses supply identity and wallet claims.
- Provider nonce challenges are returned to the browser for fresh proofs. No raw profile fields are accepted as authentication.
- Only identified Solana devnet wallets are bound. Unknown/mainnet/Stellar/pending wallets do not become verified devnet wallets.
- Without Pollar configuration, the original direct Wallet Standard sign-in remains a development fallback, not proof of a real Pollar integration.

## Pending live checks

Follow [the credential guide](../setup/CREDENTIALS.md). Verify email/social login, provisioning, the actual returned chain/network, backend profile exchange, and signing a devnet transaction. Embedded custom Anchor instruction signing is not yet established. Keep the external signer fallback until tested.

Local unit and endpoint tests use mocked upstream responses; they cannot establish provider deployment behavior or successful live provisioning.

## References

- [Official SDK](https://github.com/pollar-xyz/pollar)
- [Pollar dashboard](https://dashboard.pollar.xyz/)
