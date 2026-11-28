# Encore development phases

This roadmap follows the 0–14 phase sequence agreed for the current build. The [PDF progress snapshot](docs/planning/PROGRESS_SNAPSHOT.md) records earlier work using the original build playbook's numbering.

| Phase | Status | Acceptance work |
| --- | --- | --- |
| 0. Feasibility & Setup | Complete | Toolchain, credentials, and Solana devnet setup. |
| 1. Authentication & Onboarding | Wallet path verified locally | Browser and Expo API sessions, revocation, and listener/artist onboarding verified. The hosted schema and live Pollar email, social, and embedded-wallet paths still need verification. |
| 2. Database & Infrastructure | Database and worker verified locally | Schema, access controls, private storage policy, real PGMQ delivery, retries, and dead-letter handling verified. Hosted migration and worker activation remain pending. |
| 3. Artist Studio | Next | Prior registry and upload work is available. Complete the contributor and creator dashboard workflows. |
| 4. Provenance Engine | Partial | The devnet registry and Music Passport history exist. Complete creation checkpoints, the contribution graph, and their publication workflow. |
| 5. Licensing & Rights Management | Pending | Permission checks, provider restrictions, and rights documentation. |
| 6. Music Discovery & Player | Partial | Catalog search and signed playback exist. Complete demo tracks, filters, and player state. |
| 7. Artist Monetization | Pending | Passport-bound settlement and reconciliation. |
| 8. Supporter Marketplace | Pending | Primary purchase, transfer, resale splits, and redemption. |
| 9. ElevenLabs Integration | Pending | API feasibility was verified. Complete catalog-aware voice tools and supervised payment intents. |
| 10. Firecrawl Integration | Pending | API feasibility was verified. Complete extraction, processing, and opportunity matching. |
| 11. Creative Fairness & Moderation | Pending | Evidence reviews, corrections, appeals, and notifications. |
| 12. Integration & Security Testing | Partial | Scoped workflow and queue checks exist. Complete cross-module, contract, and full-product end-to-end testing. |
| 13. Deployment & UI Polish | Pending | The devnet program is recorded. The project owner handles web staging. |
| 14. Documentation & Submission | Partial | Project and architecture docs exist. Complete the final demo, pitch, and submission. |

See the [Expo authentication and database handoff](docs/setup/EXPO_AUTH_AND_DATABASE.md) for the client API and acceptance checks, and the [devnet deployment log](docs/architecture/DEVNET_DEPLOYMENTS.md) for recorded program addresses.
