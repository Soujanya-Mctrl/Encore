import { test, expect as playwrightExpect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { HmacSessionTokenService } from "../../../packages/infrastructure/src/index.ts";
const expect = playwrightExpect.configure({ timeout: 30000 });
const live = process.env.ENCORE_RUN_LIVE_TESTS === "1";
if (live) process.loadEnvFile("apps/web/.env.local");
test("artist upload → corrected passport → independent review → wallet signature → public search", async ({
  page,
  context,
}) => {
  test.skip(!live, "Explicit live opt-in required");
  test.setTimeout(240000);
  const owner = randomUUID(),
    reviewer = randomUUID(),
    wallet = Keypair.generate();
  let id: string | undefined, path: string | undefined;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  async function rest(path: string, method: string, body?: unknown) {
    const r = await fetch(url + "/rest/v1/" + path, {
      method,
      headers: { apikey: key, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) throw new Error(`Fixture ${method} ${path.split("?")[0]} failed: HTTP ${r.status}`);
    return method === "GET" ? await r.json() : null;
  }
  const sessions = new HmacSessionTokenService(
    process.env.ENCORE_SESSION_SECRET!,
  );
  const token = await sessions.issueSessionToken({
      userId: owner,
      roles: ["artist"],
      sessionId: randomUUID(),
    }),
    reviewToken = await sessions.issueSessionToken({
      userId: reviewer,
      roles: ["reviewer"],
      sessionId: randomUUID(),
    });
  async function session(value: string) {
    await context.clearCookies();
    await context.addCookies([
      {
        name: "encore_session",
        value,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }
  try {
    await rest("profiles", "POST", [
      {
        id: owner,
        display_name: "Browser fixture artist",
        onboarding_status: "completed",
      },
      {
        id: reviewer,
        display_name: "Browser fixture reviewer",
        onboarding_status: "completed",
      },
    ]);
    await rest("user_roles", "POST", [
      { user_id: owner, role: "artist" },
      { user_id: reviewer, role: "reviewer" },
    ]);
    await rest("wallets", "POST", {
      user_id: owner,
      address: wallet.publicKey.toBase58(),
      chain: "solana",
      wallet_type: "external",
      verified_at: new Date().toISOString(),
    });
    const payer = Keypair.fromSecretKey(
      Uint8Array.from(
        JSON.parse(readFileSync(".local/phase-one/devnet-payer.json", "utf8")),
      ),
    );
    await sendAndConfirmTransaction(
      new Connection("https://api.devnet.solana.com"),
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: wallet.publicKey,
          lamports: 20000000,
        }),
      ),
      [payer],
    );
    await page.addInitScript(
      ({ address, publicKey, seed }) => {
        const account = {
          address,
          publicKey: new Uint8Array(publicKey),
          chains: ["solana:devnet"],
          features: ["solana:signMessage", "solana:signTransaction"],
        };
        const privateKey = crypto.subtle.importKey(
          "pkcs8",
          new Uint8Array([
            48,
            46,
            2,
            1,
            0,
            48,
            5,
            6,
            3,
            43,
            101,
            112,
            4,
            34,
            4,
            32,
            ...seed,
          ]),
          { name: "Ed25519" },
          false,
          ["sign"],
        );
        const sign = async (bytes: Uint8Array) =>
          new Uint8Array(
            await crypto.subtle.sign(
              "Ed25519",
              await privateKey,
              new Uint8Array(bytes),
            ),
          );
        const wallet = {
          version: "1.0.0",
          name: "Registry Test Wallet",
          icon: "data:image/svg+xml;base64,PHN2Zy8+",
          accounts: [account],
          chains: ["solana:devnet"],
          features: {
            "standard:connect": {
              version: "1.0.0",
              connect: async () => ({ accounts: [account] }),
            },
            "standard:disconnect": {
              version: "1.0.0",
              disconnect: async () => {},
            },
            "standard:events": { version: "1.0.0", on: () => () => {} },
            "solana:signMessage": {
              version: "1.0.0",
              signMessage: async (...inputs: { message: Uint8Array }[]) =>
                Promise.all(
                  inputs.map(async ({ message }) => ({
                    signedMessage: message,
                    signature: await sign(message),
                  })),
                ),
            },
            "solana:signTransaction": {
              version: "1.0.0",
              supportedTransactionVersions: ["legacy"],
              signTransaction: async (
                ...inputs: { transaction: Uint8Array }[]
              ) =>
                Promise.all(
                  inputs.map(async ({ transaction }) => {
                    const bytes = new Uint8Array(transaction);
                    if (bytes[0] !== 1)
                      throw new Error("Fixture expects one signer");
                    bytes.set(await sign(bytes.subarray(65)), 1);
                    return { signedTransaction: bytes };
                  }),
                ),
            },
          },
        };
        const register = (api: { register: (w: unknown) => void }) =>
          api.register(wallet);
        window.addEventListener("wallet-standard:app-ready", ((
          e: CustomEvent,
        ) => register(e.detail)) as EventListener);
        window.dispatchEvent(
          new CustomEvent("wallet-standard:register-wallet", {
            detail: register,
          }),
        );
      },
      {
        address: wallet.publicKey.toBase58(),
        publicKey: Array.from(wallet.publicKey.toBytes()),
        seed: Array.from(wallet.secretKey.subarray(0, 32)),
      },
    );
    await session(token);
    await page.goto("/studio/create");
    await page
      .getByLabel("Track title")
      .fill("Browser synthetic " + owner.slice(0, 8));
    await page.getByLabel("Artist name").fill("Browser test fixture");
    await page.getByLabel("Genre", { exact: true }).fill("Ambient");
    await page
      .getByLabel("Description")
      .fill("Disposable synthetic test audio, not a user demo track.");
    await page
      .getByLabel("MP3 preview")
      .setInputFiles(".local/phase-two/fixtures/test-tone.mp3");
    await page.getByRole("checkbox").check();
    const uploadResponse = page.waitForResponse(
      (res) => res.url().endsWith("/api/v1/uploads/finalize"),
      { timeout: 60000 },
    );
    await page.getByRole("button", { name: "Save private draft" }).click();
    const upload = await uploadResponse;
    expect(upload.ok()).toBe(true);
    const { track } = await upload.json();
    id = track.id;
    path = track.audioPath;
    await expect(page).toHaveURL(/\/tracks\//, { timeout: 60000 });
    await page.getByText("Append a corrected Passport version").click();
    await page.getByLabel("Revised origin").selectOption("AI_ASSISTED");
    await page
      .getByRole("button", { name: "Confirm consent & append version" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Music Passport · Version 2" }),
    ).toBeVisible({ timeout: 20000 });
    await page
      .getByRole("button", { name: "Submit for independent review" })
      .click();
    await expect(page.getByText("Release: submitted")).toBeVisible({timeout: 30000});
    await session(reviewToken);
    await page.reload();
    await page.getByRole("button", { name: "Approve preview claims" }).click();
    await expect(page.getByText("Release: approved")).toBeVisible({timeout: 30000});
    await session(token);
    await page.reload();
    await expect(
      page.getByRole("option", { name: "Registry Test Wallet" }),
    ).toBeAttached();
    await page.getByRole("button", { name: "Sign Passport & publish" }).click();
    await expect(page.getByText("Release: published")).toBeVisible({
      timeout: 90000,
    });
    await context.clearCookies();
    await page.goto(
      "/discover?q=" +
        encodeURIComponent("Browser synthetic " + owner.slice(0, 8)) + "&origin=AI_ASSISTED&genre=Ambient",
    );
    await expect(
      page.getByRole("link", {
        name: "Browser synthetic " + owner.slice(0, 8),
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Listen & view Music Passport →" })
      .click();
    const audio=page.locator("audio");
    await expect(audio).toBeVisible();
    await audio.evaluate(el => (el as HTMLAudioElement).load());
    await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).duration), {timeout:15000}).toBeGreaterThan(1);
    await expect(
      page.getByText("View finalized devnet commitment"),
    ).toBeVisible();
    await page.screenshot({
      path: ".local/phase-two/passport-browser.png",
      fullPage: true,
    });
  } finally {
    if (!id) {
      const releases = await rest(
        `catalog_releases?artist_id=eq.${owner}&select=id,payload`, "GET",
      );
      if (releases?.length === 1) {
        id = releases[0].id;
        path = releases[0].payload.audioPath;
      }
    }
    if (path) {
      await fetch(url + "/storage/v1/object/encore-previews", {
        method: "DELETE",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ prefixes: [path] }),
      });
    }
    if (id) {
      await rest("catalog_audit?release_id=eq." + id, "DELETE");
      await rest("catalog_passports?release_id=eq." + id, "DELETE");
      await rest("catalog_releases?id=eq." + id, "DELETE");
    }
    await rest("wallets?user_id=eq." + owner, "DELETE");
    await rest(`user_roles?user_id=in.(${owner},${reviewer})`, "DELETE");
    await rest(`profiles?id=in.(${owner},${reviewer})`, "DELETE");
  }
});
