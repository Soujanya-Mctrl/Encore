# Music Studio verification

The ElevenLabs Music Studio is a loopback development prototype. Its source lives under [Studio](../../apps/web/src/app/%28studio%29/studio/music-test) and the [Studio API routes](../../apps/web/src/app/api/v1/studio/music-test). This page records development checks separately from catalog and devnet acceptance.

| Development check | Observed result |
| --- | --- |
| Live Music adapter | One requested 20-second beat returned a playable MP3. Encore's MP3 inspector measured 20.04 seconds. The request used a 100 BPM and A minor target. |
| Live arrangement endpoint | The local endpoint returned HTTP 200 and a 20-second proposal with Intro (4s), Chorus (12s), and Outro (4s). This used the composition-plan endpoint without rendering audio. |
| Lyric review fixtures | Tests covered match, likely variation, timestamp seeking data, and uncertainty when timestamps are missing. |
| Local audio matching | Decoding and Chromaprint passed on the test MP3. A re-encoded copy had a different SHA-256 file digest and still matched the original by fingerprint. |

The source for the first two checks is the development run output. The original MP3 was stored in a temporary directory and is outside the repository. The [lyric review tests](../../packages/core/src/modules/catalog/lyric-review.test.ts) are reproducible from source.

## Reproduce

Follow the [local setup](../../README.md#run-locally). From the Studio, submit a short arrangement request, review the result, and apply it. Render only when a paid test is intended. Download that render and upload it under **Check audio provenance** to exercise the exact-match path. To test fingerprinting, re-encode your own test render and compare it with the indexed take. The local index stores generated takes and reference data in a machine-local temporary directory. Uploaded audio is sent to ElevenLabs only when the watermark option is selected.

## Acceptance still open

- Verify word timestamps on a live lyric-song generation, including a case with missing or uncertain timestamps.
- Verify provider watermark permissions and the live check. A negative check supplies no evidence of human origin.
- Persist owner-scoped drafts and link the exact generated audio and reviewed evidence to the catalog release.
- Complete a reviewed release, finalized devnet Passport, and version-bound support receipt in one documented run.
