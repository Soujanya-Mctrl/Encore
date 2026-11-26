# Security Policy

Please review [`docs/security/SECURITY_AND_THREAT_MODEL.md`](docs/security/SECURITY_AND_THREAT_MODEL.md) and [`docs/security/AUDIT_LOG.md`](docs/security/AUDIT_LOG.md).

- **Never commit** `.env`, private keys, seed phrases, `SUPABASE_SERVICE_ROLE_KEY`, or signed artist contracts.
- **Testnet only:** Encore MVP targets Solana devnet with a single test-USDC mint. Do not use mainnet funds.
- **Reporting:** Log security findings and invariant checks in `docs/security/AUDIT_LOG.md` prior to `H38` code freeze.
