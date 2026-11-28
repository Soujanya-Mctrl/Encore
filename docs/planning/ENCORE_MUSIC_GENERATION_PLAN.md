# Encore Music Generation Plan

## Scope

Add ElevenLabs Music to Encore Artist Studio. Prove the complete flow through an authenticated Next.js test page, then hand the shared API and verified workflows to the Expo mobile/web developer.

| Mode | Inputs | Output |
| --- | --- | --- |
| Beat | Prompt, duration, target BPM, key and scale | Percussion-focused instrumental MP3 |
| Instrumental | Same controls, with arrangement described in the prompt | Full instrumental MP3 |
| Song with lyrics | Same controls plus original verse and chorus lyrics | Full mix with sung or rapped vocals |

Use Music v2.5, with instrumental mode enforced for the first two modes and structured composition chunks for supplied lyrics. BPM and key are model targets. Start with 20–30 second clips and major/minor scales. Section regeneration, audio references, and stems follow the MVP subject to provider access.

## Architecture and API

1. Put request schemas, response schemas, and stable error codes in `packages/contracts`. Put generation policy and orchestration in `packages/core`, behind ports for jobs, audio storage, and the provider. Use the official ElevenLabs TypeScript SDK in `packages/infrastructure`.
2. Add authenticated Studio endpoints in `apps/web`. Reuse Encore's web session and Expo bearer authentication. Load the Music credential server-side and confirm the app runtime can resolve it before enabling live calls. The CLI key and Music composition-plan request already passed. Paid music rendering remains to be tested.
3. Persist a generation row and durable job together. Use Encore's Supabase queue where it fits the worker runtime. A server worker claims the job, calls ElevenLabs, validates and hashes the MP3, stores it privately, and records evidence before marking the generation ready. Keep generated drafts separate from public catalog entries until conversion to a release.

| Endpoint | Contract |
| --- | --- |
| `POST /api/v1/studio/music/generations` | Accept mode, prompt, duration, BPM, key/scale, and lyrics where applicable. Require an idempotency key and return `202` with a generation ID. |
| `GET /api/v1/studio/music/generations/:id` | Return owner-only status, draft reference when ready, or a safe error code. |
| `GET /api/v1/studio/music/generations/:id/playback` | Check ownership and issue a short-lived signed URL. |
| `POST /api/v1/studio/music/generations/:id/release-draft` | Idempotently create an editable catalog release draft from a ready generation owned by the caller. Attach evidence server-side. |

## Provenance and Passport minting

1. Capture the provider, model, Encore generation ID, request or song reference when supplied, generation time, and SHA-256 digest of the stored audio. Create a versioned canonical evidence record and hash it. Retain prompts, lyrics, and detailed provider metadata privately. Record evidence as a server-observed provider result.
2. On conversion to a release, require the generated audio hash to match the evidence record. Populate `OriginCategory = AI_GENERATED` and `EvidenceStatus = CORROBORATED` for a verified match. Evaluate `RightsStatus` independently through the existing review process. Replacement audio invalidates the association unless its bytes still match. Metadata-only edits retain the association.
3. Include the public origin, evidence status, and evidence commitment in the versioned Passport manifest. Use Encore's existing canonicalization and hashing rules. Review the submitted version, have the linked artist wallet sign the Solana registry transaction, and verify finalized account state before publication. The on-chain Passport version commits to the manifest hash. Earlier versions retain their original commitments.

## Test interface and Expo flow

Build `/studio/music-test` as a small authenticated page using the shared API. The flow is mode and settings → generation → preview and reopen private draft → create release draft → review → sign → finalized Passport.

Show queued, generating, ready, failed, and uncertain outcomes. Preserve inputs after an error and restore generation status after refresh using the job ID. Refresh expired playback URLs on demand. Show when generation evidence is attached and distinguish review, wallet signing, and finalized anchoring.

## Security and credit controls

- Enable paid calls for a designated test cohort. Enforce server-side duration limits, quotas, and concurrency limits. Store idempotency by owner and input fingerprint. Reject reuse of a key with different inputs.
- Guard worker claims and finalize storage and evidence idempotently. If a provider timeout leaves the billing outcome uncertain, stop automatic paid retries and report that state. Keep prompts, lyrics, signing URLs, and credentials out of logs.
- Use private storage, object-level ownership, and short-lived playback grants. Validate output format, size, and playable duration. Apply the existing web request protections and validate Expo bearer sessions. Clients cannot set evidence status or rights.
- Use a temporary test release and funded devnet wallet for anchoring. Generation consumes provider credits only within an explicitly approved cap. Passport signing uses the linked wallet; generation never authorizes a transaction.

## Verification and execution order

1. **Backend and contracts.** Build the adapter, job lifecycle, private storage, and API. Test mode validation, provider payload mapping, lyrics preservation, duplicate submissions, uncertain timeouts, storage failure, and cross-account denials with a fake provider.
2. **Test page and evidence.** Exercise all three modes, refresh and reopen, refresh expired playback URLs, and confirm evidence attaches on release conversion. Test that changing audio invalidates evidence and changing metadata preserves it. Verify canonical hashes and continuity for existing Passport versions.
3. **Live acceptance.** Once the credit cap is approved, submit one short beat, instrumental, and lyric song from the test page. Confirm all three play from private storage. Review and anchor the generated song on Solana devnet and verify the finalized Passport commitment against the evidence-bearing manifest. Record sanitized results and the devnet proof.
4. **Expo handoff.** Provide the review PR, test-page run instructions, shared contract types, sample payloads, auth and error behavior, playback lifecycle, and evidence-to-Passport states. The Expo developer implements the production mobile/web screens against the proven API.

Use Encore's feature delivery workflow for implementation on an isolated feature branch or worktree. Independently verify the final diff before opening the review PR.

## Definition of done

- Three playable private drafts generated through Encore, including a song with supplied lyrics.
- Automatic evidence bound to the generated audio and carried into a reviewed, finalized devnet Passport.
- Owner-only playback, duplicate submission protection, and evidence invalidation verified.
- The Expo developer can implement the UI from the shared contracts and verified reference flow.
