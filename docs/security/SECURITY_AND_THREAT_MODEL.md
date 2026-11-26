# Security Architecture & Threat Model

## 1. Core Security Principle

> **Blockchain integrity != real-world truth.** Solana guarantees state-transition, fee-conservation, and version-history integrity after commitment; it cannot independently prove offline authorship or copyright title.

---

## 2. Threat Model & Mitigations

| Threat Vector | Impact | P0 Mitigation |
| :--- | :--- | :--- |
| **Impersonation / Fabricated Evidence** | Uploader claims another artist's work or invents origin proof. | Wallet-authenticated authority, signed manifests, manual reviewer corroboration (`CORROBORATED` scope), and `DISPUTED` appeal workflow. |
| **Duplicate Payout / Double Redemption** | Fan replays a tip intent or redeems/sells the same pass twice. | Replay-safe `SupportReceipt` PDA (`payer + nonce`), `Pass.nonce` increment on state changes, terminal `REDEEMED`/`EXPIRED` locks. |
| **Stale Disclosure Checkout** | Fan pays under an outdated passport version after a rights/origin update. | `expected_version` and `expected_manifest_hash` enforced in Anchor instruction; rejects if `track.paused` or version mismatch. |
| **Unauthorized Agent Spending** | Prompt injection tricks ElevenLabs agent into sending funds or verifying a track. | Agent has **zero** payment, verification, or license-granting tools; only `prepare_support_intent` (unsigned) + explicit UI wallet signature. |
| **Crawled Web Prompt Injection / SSRF** | Malicious web brief injects instructions or probes internal services. | Strict Firecrawl domain allowlist, URL validation, SSRF rejection, rate limits; crawled text treated strictly as untrusted data. |
| **Private Evidence Leak** | Unauthorized user accesses raw stems, legal names, or provider receipts. | Supabase private bucket, strict RLS, short-lived signed URLs, access logs; `service_role` keys never in client bundle. |
| **Wash Trading / Fake Engagement** | Bots inflate pass volume or discovery rank. | No ranking by resale volume; no rewards for views/likes; same-wallet self-trade blocked (note: insufficient against Sybils). |
| **Manifest Tampering** | Off-chain Postgres row modified after on-chain commitment. | Canonical RFC 8785-style `SHA-256` hash verified against `PassportVersion.manifest_hash` on read and checkout. |

---

## 3. Operational & Upload Guardrails

- **Upload Limits:** Enforce file size/count rate limits, MIME type validation, and avoid unsafe direct parsing of untrusted media metadata.
- **Reviewer Authority:** Clearly disclosed trusted admin/reviewer role on devnet; reviewer can update review metadata and pause/unpause tracks with a reason hash, but **cannot** withdraw fan funds or silently overwrite historical `PassportVersion` records.
- **No Mainnet Secrets:** Testnet/devnet RPCs and a single test-USDC mint only; never commit `.env`, API keys, or seed phrases.
