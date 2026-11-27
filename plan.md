# Encore — Development Progress (PDF Phase Numbering)

The PDF's Section 12 is the authoritative phase sequence. The earlier 0–15 task breakdown is superseded by this mapping; authentication and database tasks belong to the initial setup/registry work rather than separate numbered PDF phases.

| PDF phase | Window | State |
| --- | --- | --- |
| 1. Feasibility and setup | H00–02 | In progress: local workspace and Pollar code; live credentials and integration/devnet checks pending |
| 2. Registry, catalog and first deployment | H02–10 | Partially started: identity/onboarding code; passports/catalog/upload/staging unfinished |
| 3. Economic lifecycle | H10–20 | Pending |
| 4. Voice, rights and opportunities | H20–30 | Pending; integration scaffolding only |
| 5. Integration and code freeze | H30–38 | Pending |
| 6. Documentation and submission | H38–43 | Pending |
| 7. Buffer | H43–48 | Pending |

Hours are planned elapsed build windows, not an automatically updated countdown or proof of completion.

## Immediate next action

The user will create service credentials and save them in `apps/web/.env.local`, following [the credential guide](docs/setup/CREDENTIALS.md). The user confirmed permission to use three demo tracks. No additional track-permission confirmation is needed.

Then complete the live Phase 1 checks in [the Phase 1 report](docs/planning/PHASE_ONE_REPORT.md), record real results in [the completion log](docs/planning/COMPLETION_LOG.md), and proceed to Phase 2.
