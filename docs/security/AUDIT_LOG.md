# Security & Smart Contract Audit Log

> **Status:** Pre-Implementation Baseline (`H00`)  
> **Scope:** `programs/encore` (Anchor/Rust), `apps/web` API routes, Supabase RLS, ElevenLabs agent tools, and `workers/firecrawl`.  
> **Note:** No production/mainnet audit has been performed yet. Live mainnet launch requires a formal third-party audit.

---

## 1. Pre-Build Security Checklist (Must Pass Before `H38` Code Freeze)

| Check ID | Area | Requirement | Owner | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Anchor | Checked arithmetic (`checked_add/mul/div`) on all fee & supply math; outgoing == incoming | Builder A | `Pending` |
| **SEC-02** | Anchor | Canonical SPL Token program ID + ATA `owner` and `mint` verified on all token CPIs | Builder A | `Pending` |
| **SEC-03** | Anchor | `expected_version`, `expected_manifest_hash`, and `!track.paused` enforced on support/pass buys | Builder A | `Pending` |
| **SEC-04** | Anchor | Terminal states (`REDEEMED`, `EXPIRED`) block all transfers/listings; `Pass.nonce` replay-safe | Builder A | `Pending` |
| **SEC-05** | Supabase | RLS enabled on all 12 tables; private evidence bucket inaccessible to non-owner/non-reviewer | Builder B | `Pending` |
| **SEC-06** | API/Auth | `service_role` key absent from `apps/web` client bundle; wallet binding uses nonce + expiry | Builder B | `Pending` |
| **SEC-07** | AI Agent | ElevenLabs tools strictly read-only + `prepare_support_intent`; no payment/verify tools | Builder B | `Pending` |
| **SEC-08** | Firecrawl | Domain allowlist + SSRF guard active; crawled text sanitized and treated as untrusted data | Builder B | `Pending` |

---

## 2. Audit & Vulnerability Log

*Record every security review, adversarial test, or bugbot finding here with severity, commit/PR reference, and verification.*

| Date (UTC) | Finding ID | Severity | Component | Description & Impact | Remediation / Commit | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `2026-11-26` | `BASE-001` | `Info` | `All` | Initial PRD v1.0 threat model and invariant baseline established. | See `SECURITY_AND_THREAT_MODEL.md` | `Open (Baseline)` |
| — | — | — | — | *Add new findings during H20–H38 integration & adversarial testing* | — | — |
