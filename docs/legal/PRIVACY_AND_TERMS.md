# Privacy, Consent & Supporter Terms

## 1. Privacy Boundaries

- **Public vs. Private Split:** Only public artist aliases, role disclosures, and consented evidence summaries are exposed via public catalog views. Raw recordings, DAW logs, legal names, and provider receipts live in private Supabase storage with strict RLS and access logs.
- **On-Chain Minimalism:** No sensitive documents, legal names, or raw audio bytes are ever written on-chain. Evidence commitments use `SHA-256` (salted where hashes could identify predictable private files).
- **Deletion & Takedown (`D10`):** Creators can request deletion of private files and removal of audio previews where policy permits. **Immutable Ledger Notice:** Blockchain manifest hashes and settled `SupportReceipt` transactions cannot be erased from Solana.
- **Hackathon Data Hygiene:** Do not collect government ID documents during the hackathon; use demo accounts with explicit consent and keep testnet data strictly separate from real artist accounts.

---

## 2. Creator Declaration Template (Non-Legal MVP)

Every track submission (`FR01`) requires the creator to sign/accept:
1. Accurate disclosure of roles (`human`, `generative_ai`, `assisted`, `unknown`) and tools used.
2. Confirmation of authority/permissions for any hosted audio preview (`PREVIEW_ALLOWED`) or external link-out.
3. Consent to versioned `PassportVersion` anchoring and public display of non-private manifest metadata.
4. Commitment to deliver any Supporter Pass benefit (`D06`) already prepared prior to series creation.

---

## 3. Supporter Benefit Terms (`D06` Summary)

- **Nature of Pass:** A Supporter Pass is a finite, redeemable entitlement to a specific creator-defined deliverable (e.g., commentary or creative diary). It is **not** copyright ownership, a royalty share, equity, or an investment contract.
- **Immediacy & Refunds:** Support tips and primary pass purchases settle immediately on-chain (`test-USDC` in MVP). No automatic protocol refunds for tips; creator-defined remedies apply to non-delivery of pass benefits.
- **Expiry & Liquidity:** Passes expire at `series.expiry`. Resale on the secondary market is optional and has **no guaranteed liquidity**.
- **Voice Agent Privacy:** ElevenLabs voice interactions require user consent, prohibit celebrity impersonation, and do not store long-term transcripts by default.
