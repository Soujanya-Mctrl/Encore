# Encore architecture diagrams

The HTML documents are self-contained. Download an HTML file and open it in a browser for the full annotated views. The PNG previews render directly on GitHub.

| Blueprint | Preview | Scope |
| --- | --- | --- |
| [Connected phase roadmap](phases/index.html) | [Light](phases/phase-roadmap.png) · [Dark](phases/phase-roadmap-dark.png) | P00–P15 dependencies, with [architecture](phases/architecture.html), [UI](phases/ui-flows.html), and [testing](phases/testing-flows.html) diagrams for each phase |
| [MVP system](encore-mvp-architecture.html) | [Light](encore-topology.png) · [Dark](encore-topology-dark.png) | Expo Android and web target, shared Next.js modular monolith, Music Passport, and original supporter pass model |
| [Expo and Artist Studio](Encore_Expo_Stack_Diagrams.html) | [Integration plan](../../architecture/Encore_Artist_Studio_Architecture.md) | Eight views covering sessions, scoped creator access, data, uploads, publication, and playback |
| [Project-share marketplace](encore-support-marketplace-architecture.html) | [Overview](encore-support-marketplace-overview.png) · [Sample trading screen](encore-sample-trading-screen.png) | Campaign escrow, project-specific shares, spot resale, and simulated revenue distribution |
| [Artist-first marketplace](encore-artist-first-marketplace.html) | [Light](encore-artist-first-marketplace-overview.png) · [Dark](encore-artist-first-marketplace-overview-dark.png) | Direct support, artist-token spot trades, and reward crowdfunding |
| [Yes/No prediction market](encore-artist-first-marketplace.html#view-6) | [Improvement scope](encore-yes-no-market-improvement.png) | Optional devnet follow-on using a separate payout vault and the campaign's on-chain outcome |

The marketplace blueprints are design alternatives. The diagrams describe proposed flows and do not change the repository's current implementation or establish a live offering. The sample chart uses synthetic data.

The Phase 2 implementation diagram follows the upload, review, devnet commitment and listener paths that were exercised in the live checks. [Offline HTML](encore-phase-two.html) · [Light PNG](encore-phase-two.png) · [Dark PNG](encore-phase-two-dark.png) · [Template](encore-phase-two.template.html). Built with [stack-diagram](https://github.com/caru-ini/stack-diagram/tree/1b375941783ff0b1503b91afa079cdf59a966523/skills/stack-diagram).

Expo Web export and the Android sign-in handoff are integration gates. Use the existing Next.js service as the shared API. The marketplace blueprints inherit this client boundary.
