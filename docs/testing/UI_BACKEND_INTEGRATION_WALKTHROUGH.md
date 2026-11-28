# UI and backend integration walkthrough

This guide exercises the Next.js API with the Expo app on Android and in a browser. The Next.js app at port 3000 is the shared backend. Expo native uses a bearer session; Expo Web uses the Encore session cookie and calls the API at the configured web origin.

Run these steps against a development/test Supabase project and Solana devnet. Studio upload creates persistent private storage/database records. Do not use production credentials or real user audio for this walkthrough.

## 1. Prerequisites and local configuration

- Use the Node version in `.nvmrc` and pnpm 9.15.0.
- Install dependencies from the repository root:

  ```sh
  pnpm install --frozen-lockfile
  ```

- Keep `apps/web/.env.local` and `apps/mobile/.env.local` local and uncommitted. Never print or copy secret values into logs, screenshots, or this guide.
- The local Expo configuration should have these origins (other existing env entries remain as provided):

  ```dotenv
  # apps/mobile/.env.local
  EXPO_PUBLIC_ENCORE_API_URL=http://10.0.2.2:3000
  EXPO_PUBLIC_ENCORE_WEB_API_URL=http://localhost:3000
  ```

  `10.0.2.2` is the Android emulator's route to the host machine. For a physical phone, use the host's reachable LAN address and HTTPS where required. For an iOS simulator, use the host address reachable from that simulator.

  ```dotenv
  # apps/web/.env.local
  ENCORE_WEB_CLIENT_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
  ```

  Keep `ENCORE_AUTH_ORIGIN` / `NEXT_PUBLIC_APP_URL` set to the Next.js browser origin (`http://localhost:3000` for local work). Production should route Expo Web and `/api/v1/*` through one HTTPS origin; if separate origins are required, list only the exact HTTPS Expo origins in `ENCORE_WEB_CLIENT_ORIGINS`.

## 2. Start the backend and confirm its API

From the repository root, start Next.js:

```sh
pnpm --filter @encore/web dev
```

It should be available at `http://localhost:3000`. In another terminal, check the public API routes:

```sh
curl -i http://localhost:3000/api/v1/health
curl -i 'http://localhost:3000/api/v1/tracks?page=1'
curl -i http://localhost:3000/api/v1/marketplace
curl -i http://localhost:3000/api/v1/auth/me
```

Expected: health, tracks, and marketplace return `200`; `/auth/me` returns `401` until a session is established. An empty catalog is a valid response when no release has been published.

Check the Expo Web CORS preflight:

```sh
curl -i -X OPTIONS http://localhost:3000/api/v1/rights \
  -H 'Origin: http://localhost:8081' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Expected: `204`, `Access-Control-Allow-Origin: http://localhost:8081`, and `Access-Control-Allow-Credentials: true`. An origin that is not in the allowlist must not receive an allow-origin header.

## 3. Run the Next.js web UI

Open `http://localhost:3000/login` and sign in using a configured test wallet/provider. Complete listener onboarding, then artist onboarding when testing Studio. A browser session is an HttpOnly cookie; the UI should not read or store the cookie itself.

Verify:

1. `/discover` loads the same catalog served by `/api/v1/tracks`.
2. Search and filter by origin, evidence, and genre. An empty result should show an empty state.
3. Open a published release and play its authorized preview. A track without current preview permission must stay metadata-only.
4. Open `/rights` and confirm the workspace only shows records allowed for the signed-in account and role.
5. Open `/studio/dashboard` and `/studio/create`. Studio data and uploads use the authenticated Next.js APIs.

## 4. Run Expo Web

In another terminal:

```sh
pnpm --filter @encore/mobile web
```

Open the Expo Web address, normally `http://localhost:8081`. The Expo Web API base comes from `EXPO_PUBLIC_ENCORE_WEB_API_URL`; it must point to Next.js on port 3000. Browser API calls include cookies, and the API only grants credentialed CORS to configured origins.

Verify:

1. Discover loads tracks from `/api/v1/tracks`; search and filters update the results.
2. Select a playable track. Playback should use the preview API and show an error if authorization has expired or been withdrawn.
3. Open the rights workspace and verify signed-in data is fetched from `/api/v1/rights`.
4. Sign in from Expo Web. The browser opens the Next.js login page; return to the Expo tab after authentication. The account provider refreshes its session when the tab regains focus.
5. Inspect the browser Network panel: API requests go to `localhost:3000`, successful cookie-authenticated requests include credentials, and no service-role key is present in client bundles.

## 5. Run Expo on Android

Start the Expo development client:

```sh
pnpm --filter @encore/mobile start
```

Use an Android emulator with `EXPO_PUBLIC_ENCORE_API_URL=http://10.0.2.2:3000`, or use a rebuilt dev client on a device with a reachable API address. Native sign-in opens the system browser, returns through `encore://auth/callback`, exchanges an S256 PKCE code, and stores the bearer token using SecureStore.

Verify:

1. Sign in and complete listener/artist onboarding.
2. Discover, search, filter, open a track, and play an authorized preview.
3. Open Rights and confirm the authenticated API response is displayed.
4. Open Studio → Content. Confirm the screen loads the signed-in artist's releases rather than sample records.
5. Open Studio → New release. Select one MP3 (up to 20 MB), enter title and genre, set origin, and confirm contributor consent and preview permission. Save the private draft. The UI uploads through `/api/v1/uploads/init`, the signed storage URL, and `/api/v1/uploads/finalize`.
6. Confirm the new draft appears in Content and Release detail. Check its status, Passport version, audio hash, manifest hash, origin, evidence, and rights as separate fields.
7. Open Passes and Portfolio. Their collections should reflect `/api/v1/portfolio`; an account with no indexed transactions should see an empty state.
8. Sign out and confirm protected data no longer loads. Sign in again and confirm the session restores.

Upload tests create persistent private records. Use an authorized test MP3 and an account in the development project. A WAV renamed to `.mp3` should fail server-side MP3 validation; an invalid file must not become a published release.

## 6. Current transaction acceptance boundary

Marketplace and portfolio read paths are connected to the backend, and the server exposes transaction-intent and settlement APIs. A successful API response alone does not prove a transaction was signed, finalized, reconciled, or reflected on-chain. Do not mark a payment complete from a client response.

Before calling phases 7–8 fully accepted, run the separate two-wallet devnet scenarios for tips, primary pass purchase, list/cancel/resale, redemption, campaign pledge/refund, spot trade, distribution claim, receipt reload, rejected signatures, wrong network, and duplicate/replayed events. Record signatures and independently reconciled balances. Campaign review and distribution operations also require the intended operator/reviewer roles.

Voice-agent tools, Firecrawl opportunity matching, moderation appeals, hosted migrations, and production deployment are not covered by this UI smoke walkthrough; check the phase tracker before claiming those phases complete.

## 7. Automated checks

Run from the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @encore/web build
pnpm --filter @encore/mobile build
pnpm --filter @encore/mobile exec expo export --platform web
```

The mobile build exports Android. The final command separately builds Expo Web. These are compile/export checks, not emulator or browser interaction tests. For database, browser, and chain acceptance commands, see [Studio and provenance verification](../setup/STUDIO_AND_PROVENANCE.md), [Expo auth and database checks](../setup/EXPO_AUTH_AND_DATABASE.md), and the [test plan](TEST_PLAN_AND_REPORT.md). `pnpm test:rust` and `pnpm test:contracts` additionally require the Rust, Solana, and Anchor toolchains.

## 8. Troubleshooting

- **Expo Web reports CORS:** Check the browser's exact origin and port against `ENCORE_WEB_CLIENT_ORIGINS`, then restart Next.js after editing `.env.local`.
- **Native app cannot connect:** Check `EXPO_PUBLIC_ENCORE_API_URL`; Android emulator uses `10.0.2.2`, while a physical phone cannot use the host's `localhost`.
- **`/auth/me` returns 401:** Sign in again. Native sessions are bearer tokens; Expo Web depends on the Next.js cookie and browser credentials.
- **Studio list returns 403:** The signed-in user must have the artist role and an active Studio channel.
- **Upload fails:** Confirm one MP3 was selected, it is at most 20 MB, preview permission and contributor consent were confirmed, storage is available, and the signed upload request used `PUT` with `Content-Type: audio/mpeg`.
- **Preview is unavailable:** The track needs a current publication and an active rights permission. Existing signed preview URLs expire; retry to request a fresh authorization.
