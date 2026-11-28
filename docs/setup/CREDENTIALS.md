# Encore: Create Credentials and Configure Your Local Environment

This guide prepares the credentials for PDF Phase 1 (H00–02). Creating keys is one checkpoint; successful live login, voice, crawl, database, and devnet checks are still required before Phase 1 is complete. The user confirmed permission to use three demo tracks on 27 November 2026.

## 1. Prepare the local environment file

Use Node.js 22 or 24 LTS (`.nvmrc` pins 24.22.3) and pnpm 9.15.0. If you use nvm, run `nvm install` and `nvm use` in the Encore folder first. Otherwise install a supported LTS release from [Node.js](https://nodejs.org/en/download).

From the Encore repository root, run:

```sh
pnpm setup:local
```

This creates `apps/web/.env.local` from the root `.env.example`, generates `ENCORE_SESSION_SECRET`, and preserves any existing file. Next.js reads env files from `apps/web`, not the repository root. Edit `apps/web/.env.local` in your editor; never put real keys in `.env.example` or chat. Restart `pnpm dev` after changing values.

If your system's old Corepack fails, use Node from `.nvmrc` and a current Corepack, or run the pinned package manager without changing global tools:

```sh
npm exec --yes --package pnpm@9.15.0 -- pnpm run setup:local
```

The explicit `run` selects Encore's script rather than pnpm's own shell-setup command. If creating the file manually, copy `.env.example` to `apps/web/.env.local` only when the destination does not already exist; generate the session secret using Node's `crypto.randomBytes(48).toString('base64url')` and save it directly to that local file.

## 2. Pollar: Wallets and Login

1. Open [Pollar Dashboard](https://dashboard.pollar.xyz/) and sign in or register.
2. Create an application named **Encore**. Keep the app in its **Testnet/test environment**.
3. Open the app's **API Keys** section and generate a **publishable** key. Copy exactly the value Pollar shows; key prefixes can vary.
4. Open **Domains** and allow `http://localhost:3000`. Add `http://127.0.0.1:3000` only if you also use that address. For the guide's demos, open the app at `http://localhost:3000`.
5. If the dashboard exposes chain/wallet settings, enable **Solana** for the test environment. A Stellar wallet is not a Solana wallet. We will check the returned wallet's actual chain and network before accepting a devnet wallet.
6. Use the available email/social login configuration. Some dashboard sections may be marked upcoming; do not spend time looking for an OAuth toggle that is not exposed. Tell me if Solana provisioning or the desired login method is unavailable for your app.
7. Set this value in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=PASTE_YOUR_TEST_PUBLISHABLE_KEY
```

**Demo after configuration:** Start Encore, open `/login`, and try email OTP or Google. Confirm the Encore session is created and any linked wallet is a Solana devnet wallet. External Solana wallets use Pollar's Wallet Standard adapter when Pollar is configured. Embedded arbitrary Anchor transaction signing remains a separate feasibility check; no compatibility claim is made from merely generating a key.

**Not needed now:** A Pollar secret key, Google client secret, or GitHub client secret unless your Pollar dashboard explicitly requires custom provider setup. Leave `POLLAR_API_KEY` blank; the implemented backend exchange uses the publishable application key plus device-signed DPoP session proofs.

Reference: [Pollar SDK and Solana support](https://github.com/pollar-xyz/pollar).

## 3. Supabase: Database and Evidence Storage

1. Open [Supabase Dashboard](https://supabase.com/dashboard), sign in, and create a project named **Encore**.
2. Choose an organization/region and save the database password in your password manager. Wait for the project to finish provisioning.
3. Open **Connect** to find the project URL, or use the project's API settings. It normally looks like `https://YOUR_PROJECT_REF.supabase.co`.
4. Open **Settings → API Keys → Publishable and secret API keys**. Copy the publishable key and create/copy a secret key for the Encore backend.
5. Save:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PASTE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=PASTE_BACKEND_SECRET_KEY
```

The publishable key is browser-safe; the secret key stays server-only. Modern keys typically begin `sb_publishable_` and `sb_secret_`. If you already use legacy keys, put `anon` in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `service_role` in `SUPABASE_SERVICE_ROLE_KEY` instead. You do not need both key pairs.

Keep `ENCORE_IDENTITY_STORE=memory` until we apply and verify the identity migrations. Then change it to `supabase`. **Demo after migrations:** Sign in, finish onboarding, restart the app, and confirm your profile and wallet still exist in the database. We will also check that other users cannot access your private records.

Reference: [Supabase API keys](https://supabase.com/docs/guides/api/api-keys), [new key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

## 4. ElevenLabs: Conversational Discovery Assistant

1. Sign in to [ElevenLabs](https://elevenlabs.io/).
2. Open **Developers → API Keys**, create a key named **Encore Local**, and allow the Agents capabilities needed to read the agent and establish conversations. Use a usage limit if offered. Music-generation access is not required.
3. Open the **ElevenAgents** dashboard and create a new assistant using the **Blank template**, named **Encore Discovery Assistant**.
4. Set its first message to: **“Hi, I’m Encore. What kind of music would you like to discover?”**
5. Use this starter system prompt:

```text
You help listeners discover music on Encore. Explain origin, evidence status,
and usage rights separately. Never invent a track or verification result.
If catalog tools are unavailable, say so. You cannot execute payments, change
verification status, or grant a license. Fans review and sign payments themselves.
```

6. Select an available voice, save the agent, and copy its **agent ID** from the agent details/share or integration section.
7. Set:

```dotenv
ELEVENLABS_API_KEY=PASTE_YOUR_API_KEY
ELEVENLABS_AGENT_ID=PASTE_YOUR_AGENT_ID
```

**Demo:** Use **Test AI agent** in ElevenLabs and say “What is the difference between human-created and AI-assisted music?” Allow microphone access when prompted. This verifies a real conversation. We will wire and verify a read-only catalog tool separately; the starter prompt alone does not connect the catalog.

References: [Create an API key](https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key), [agent quickstart](https://elevenlabs.io/docs/eleven-agents/quickstart).

## 5. Firecrawl: One Authorized Brief

1. Sign in to [Firecrawl](https://www.firecrawl.dev/app).
2. Open **API Keys**, create a key named **Encore Local**, and copy it.
3. Set:

```dotenv
FIRECRAWL_API_KEY=PASTE_YOUR_API_KEY
```

**Demo:** Open the dashboard's **Scrape** playground and scrape one public page you own or have permission to process. A suitable demo brief is: “An indie game needs a 30-second ambient loop; budget and deadline to be agreed.” Record the actual source URL and returned output. A random scraped page is not a confirmed commission or sale.

Reference: [Firecrawl dashboard and API keys](https://docs.firecrawl.dev/dashboard).

## 6. Solana: Generated Devnet Values

Keep these defaults:

```dotenv
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

The verified spike sets `NEXT_PUBLIC_TEST_USDC_MINT` to the generated demo mint; see the Phase 1 report. Leave `NEXT_PUBLIC_ENCORE_PROGRAM_ID`, `REVIEWER_AUTHORITY_PUBKEY`, and `JOB_RUNNER_SECRET` blank until the corresponding later feature is implemented. These values are generated or assigned, not API credentials obtained from an account dashboard. No private key or seed phrase belongs in `NEXT_PUBLIC_*`.

## 7. Ready-to-Verify Checklist

- [x] Pollar test publishable key saved; localhost allowed; external Solana login verified (hosted provisioning remains untested).
- [x] Supabase project URL and backend secret saved; identity migrations and RLS verified.
- [x] ElevenLabs API key verified and existing Encore agent ID linked locally on 28 November 2026; live voice/read-only tool run remains pending.
- [x] Firecrawl API key saved; authorized project-page scrape verified.
- [x] Generated `ENCORE_SESSION_SECRET` retained.
- [x] Permission for three demo tracks confirmed by the user.

Run `pnpm check:setup` (or `npm exec --yes --package pnpm@9.15.0 -- pnpm run check:setup`). It prints only availability/configuration status, never key values. Live results and remaining limitations are recorded in the [Phase 1 report](../planning/PHASE_ONE_REPORT.md). The template stays blank for new installations; the completed checklist above describes this workspace on 27 November 2026.
