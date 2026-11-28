# Connect Expo to Encore authentication

Use the Next.js API as the shared backend for Expo web and native. Both sessions resolve to the same Encore user and load current roles from Postgres. Deploy the backend on HTTPS and configure `ENCORE_AUTH_ORIGIN` as the exact browser origin. `NEXT_PUBLIC_APP_URL` can supply that origin when a separate auth origin is unnecessary.

| Client | API transport | Credential |
| --- | --- | --- |
| Expo web | Proxy `/api/v1/*` and `/login` to Next.js on the same public origin. Preserve the original Origin, and pass through response cookies. | Encore HttpOnly cookie |
| Expo native | Set `EXPO_PUBLIC_ENCORE_API_URL` to the HTTPS Next.js URL. A local Android emulator can reach the host at `http://10.0.2.2:3000`. | Native bearer token kept in platform secure storage |

For native sign-in, generate a random state and an RFC 7636 verifier. Keep both in app memory until the system browser returns. Set `codeChallenge` to the unpadded base64url SHA-256 digest of the verifier. `apps/mobile/src/lib/encore-auth.ts` provides the login URL, callback validation, code exchange, current session, onboarding, and logout methods. The exact default callback is `encore://auth/callback`, which uses the existing Expo scheme. `ENCORE_NATIVE_REDIRECT_URIS` accepts an explicit comma-separated list if the app uses a different registered callback.

1. Open `nativeBrowserLoginUrl({ codeChallenge, redirectUri, state })` in the system browser.
2. After the browser sign-in, the user chooses **Connect app**. Use `readNativeAuthCallback` to verify the redirect and the original state.
3. Call `exchangeNativeAuthorization({ code, codeVerifier, redirectUri })` once. The code expires after two minutes. If it expires or a successful exchange response is lost, begin a fresh sign-in. Store the returned token in Expo SecureStore and clear it after logout or a `401`.
4. Use `getEncoreSession` to restore the user. If onboarding is pending, call `saveEncoreOnboarding` with `journey: "listener"` or `"artist"` and the profile information. Artist onboarding preserves the listener role and returns the existing or newly created Studio channel. The client may continue to its own workspace when Studio screens are ready.

| API | Expected success | Expected denial or retry |
| --- | --- | --- |
| `POST /api/v1/auth/pkce/code` | `200` with a code for the signed-in browser session | `400` invalid redirect, `401` missing session, `403` invalid browser origin |
| `POST /api/v1/auth/pkce/exchange` | `200` with `accessToken`, `tokenType`, `expiresInSeconds`, `user`, and `wallets` | `401` expired or used code, mismatched verifier, redirect, or revoked source session |
| `GET /api/v1/auth/me` | `200` with current user and verified wallets | `401` invalid, expired, or revoked session |
| `POST /api/v1/auth/onboarding` | `200` with user, wallets, and Studio channel when applicable | `400` invalid profile or journey, `401` missing session |
| `POST /api/v1/auth/logout` | `200` after revoking the presented session | `401` for an invalid native bearer credential |

Pollar external-wallet sign-in is the verified provider route. `NEXT_PUBLIC_POLLAR_SOCIAL_ENABLED=1` exposes social and email sign-in in the configured test app. Verify each provider callback and embedded-wallet provisioning on the target environment before enabling that flag for users. Expo device integration still includes the screen and SecureStore wiring. The browser-to-native HTTP flow has its own test and can run before the screens are ready.

## Database and queue verification

Apply repository migrations in order on the target database. Set `ENCORE_IDENTITY_STORE=supabase` for a deployed API or a persistent integration test. The auth backend uses `auth_sessions`, the onboarding RPCs and channel tables, and `auth_pkce_codes`. The worker uses PGMQ and `job_execution_records`. For the tested SQL commands and hosted scheduling configuration, see the [queue worker notes](../../supabase/functions/process-jobs/README.md). The scoped auth and database checks are:

```sh
pnpm exec vitest run packages/core/src/modules/identity packages/infrastructure/src/authentication apps/web/src/app/api/v1/auth
pnpm exec vitest run tests/mobile/encore-auth.test.ts
pnpm exec vitest run tests/queues
psql "$LOCAL_DATABASE_URL" -f supabase/tests/identity_infrastructure.sql
psql "$LOCAL_DATABASE_URL" -f supabase/tests/queue_runtime.sql
ENCORE_RUN_AUTH_E2E=1 pnpm test:e2e tests/e2e/auth/siws-pkce.spec.ts --timeout=60000
```

Run the SQL and browser tests against a disposable database. The browser test signs with a generated wallet and creates a synthetic account. `ENCORE_RUN_LIVE_TESTS=1` also enables the Pollar test against the configured test application. The verified local run used PostgreSQL 17 with PostgREST and PGMQ 1.5.1. In that setup the storage check verified the private bucket configuration. The previous catalog run exercised hosted upload and signed playback.

The Phase 1–2 verification passed 74 Vitest checks, six Playwright checks, both SQL suites, TypeScript checks for Expo, web, shared packages, and the queue worker, plus the production web build. A running Deno worker processed a real PGMQ job, skipped its duplicate, and put an unavailable handler's message in the dead-letter queue. The configured hosted database still needs the auth and queue migrations, and hosted scheduling remains pending.
