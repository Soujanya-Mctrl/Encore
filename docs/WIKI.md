# Encore Documentation Wiki

Start with the [project overview](../README.md) for the pitch, current implementation, and verification evidence. The [PRD](PRD.md) describes product intent, and the [current roadmap](../plan.md) tracks acceptance work. Historical reports preserve the conditions and numbering of their original runs.

---

## Navigation by Role

### For Builders (Contracts, Backend & Frontend)
1. Start with [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) for the monorepo layout, Postgres schema, API routes, and agent tool boundaries.
2. Read [`architecture/ANCHOR_PROGRAM_SPEC.md`](architecture/ANCHOR_PROGRAM_SPEC.md) for exact PDA seeds, instruction signatures, and invariants.
3. Check [`architecture/TECHNICAL_FEASIBILITY.md`](architecture/TECHNICAL_FEASIBILITY.md) for sponsor SDK caveats (Pollar, ElevenLabs, Firecrawl) and fallback rules.
4. Read the [Expo identity and database handoff](setup/EXPO_AUTH_AND_DATABASE.md), [Pollar integration](integrations/POLLAR.md), and [Artist Studio and provenance handoff](setup/STUDIO_AND_PROVENANCE.md).
5. Read the [Music generation plan](planning/ENCORE_MUSIC_GENERATION_PLAN.md) and [Studio verification notes](testing/MUSIC_STUDIO_VERIFICATION.md) for the local ElevenLabs prototype and the remaining generation-to-Passport work. The [original integration spec](integrations/ELEVENLABS_MUSIC_GENERATION.md) describes the target design.
6. Use the [current roadmap](../plan.md) alongside the [original 48-hour plan](planning/BUILD_PLAN_48H.md) and [completion log](planning/COMPLETION_LOG.md).

### For Research, QA, Legal & Design
1. Read [`product/PRODUCT_DESIGN.md`](product/PRODUCT_DESIGN.md) for personas, `FR01`–`FR11` acceptance criteria, visual identity, and the 3-minute demo script.
2. Read [`product/TAXONOMY_AND_FAIRNESS.md`](product/TAXONOMY_AND_FAIRNESS.md) for the 3-axis classification model and appeal workflow.
3. Use [`legal/RIGHTS_AND_LICENSING.md`](legal/RIGHTS_AND_LICENSING.md) and [`legal/PRIVACY_AND_TERMS.md`](legal/PRIVACY_AND_TERMS.md) to assemble creator documentation packs (`D01`–`D10`) and demo fixtures (`H01`, `A01`, `G01`).
4. Track verification in [`testing/TEST_PLAN_AND_REPORT.md`](testing/TEST_PLAN_AND_REPORT.md) and [`security/AUDIT_LOG.md`](security/AUDIT_LOG.md).

### For Judges & Reviewers
- **Executive PRD:** [`PRD.md`](PRD.md)
- **Market Evidence & Citations:** [`research/MARKET_RESEARCH_AND_CITATIONS.md`](research/MARKET_RESEARCH_AND_CITATIONS.md)
- **Supporter Economy & Math:** [`economics/TOKENOMICS_AND_ECONOMICS.md`](economics/TOKENOMICS_AND_ECONOMICS.md)
- **Security & Threat Model:** [`security/SECURITY_AND_THREAT_MODEL.md`](security/SECURITY_AND_THREAT_MODEL.md)
- **Live registry evidence:** [Phase 2 handoff](planning/PHASE_TWO_REPORT.md) and [devnet deployment records](architecture/DEVNET_DEPLOYMENTS.md)
- **Rights and playback evidence:** [Cross-client implementation and local verification](architecture/RIGHTS_AND_PLAYER_IMPLEMENTATION.md)

---

## Visual Diagrams Index

| Diagram | File | Referenced In |
| :--- | :--- | :--- |
| Product System | [`diagrams/01_product.png`](diagrams/01_product.png) | `PRODUCT_DESIGN.md` |
| Evidence & Verification | [`diagrams/02_evidence.png`](diagrams/02_evidence.png) | `TAXONOMY_AND_FAIRNESS.md` |
| System Architecture | [`diagrams/03_architecture.png`](diagrams/03_architecture.png) | `ARCHITECTURE.md` |
| Supporter Economy | [`diagrams/04_economy.png`](diagrams/04_economy.png) | `TOKENOMICS_AND_ECONOMICS.md` |
| Rights & Moderation | [`diagrams/05_rights.png`](diagrams/05_rights.png) | `RIGHTS_AND_LICENSING.md` |
| 48-Hour Delivery Plan | [`diagrams/06_timeline.png`](diagrams/06_timeline.png) | `BUILD_PLAN_48H.md` |

The [architecture gallery](diagrams/architecture/README.md) contains the detailed system, phase, and marketplace diagrams. The [README architecture](../README.md#technical-architecture) gives a compact system and release-flow view.

---

## Core Glossary

- **Music Passport:** A versioned, track-specific provenance and rights manifest (`PassportVersion`) anchored on Solana via a canonical SHA-256 hash and signed disclosure.
- **Origin Claim:** What the creator/evidence states about how a track was made (`HUMAN_CREATED`, `AI_ASSISTED`, `AI_GENERATED`, `UNKNOWN`).
- **Evidence Status:** How strongly the origin claim is supported (`SELF_DECLARED`, `CORROBORATED`, `UNVERIFIED`, `DISPUTED`).
- **Rights Status:** What usage is legally/contractually permitted (`PREVIEW_ALLOWED`, `EXTERNAL_LICENSE_ONLY`, `COMMERCIAL_CLEARED`, `RESTRICTED`, `DISPUTED`).
- **Supporter Pass:** A finite, program-owned PDA entitlement granting access to a pre-prepared, creator-owned non-music/commentary deliverable; transferable under strict on-chain rules, never a royalty share or investment contract.
- **Support Receipt:** An on-chain `SupportReceipt` PDA + event binding a fan's payment to the exact `track` and `PassportVersion` shown at checkout.
