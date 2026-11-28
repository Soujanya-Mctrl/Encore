import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Keypair } from "@solana/web3.js";

const redirectUri = "encore://auth/callback";

// This flow persists a fresh synthetic identity. Only opt in with an isolated
// Encore database or the explicit in-memory local test backend.
const enabled = process.env.ENCORE_RUN_AUTH_E2E === "1";

test("Expo native handoff uses the same identity as browser wallet sign-in", async ({ page, playwright, baseURL }) => {
  test.skip(!enabled, "Enable with ENCORE_RUN_AUTH_E2E=1 on a disposable backend");
  test.setTimeout(120_000);
  const origin = new URL(baseURL!).origin;
  const wallet = Keypair.generate();
  const address = wallet.publicKey.toBase58();
  const signingKey = createPrivateKey({
    format: "der", type: "pkcs8",
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), wallet.secretKey.slice(0, 32)])
  });

  const browser = page.request;
  const native = await playwright.request.newContext({ baseURL });
  try {
    const challenge = await browser.post("/api/v1/auth/siws/challenge", { headers: { origin }, data: { address } });
    expect(challenge.status()).toBe(200);
    const { nonce, message } = await challenge.json();
    const signedPayload = {
      address, nonce, message,
      signatureBase64: sign(null, Buffer.from(message), signingKey).toString("base64")
    };
    const verified = await browser.post("/api/v1/auth/siws/verify", { headers: { origin }, data: signedPayload });
    expect(verified.status()).toBe(200);
    const browserToken = (await page.context().cookies()).find((cookie) => cookie.name === "encore_session");
    expect(browserToken?.httpOnly).toBe(true);
    const signedIn = await verified.json();
    expect(signedIn.wallets[0]?.address).toBe(address);
    expect((await browser.post("/api/v1/auth/siws/verify", { headers: { origin }, data: signedPayload })).status()).toBe(401);

    const browserTokenAsBearer = await native.get("/api/v1/auth/me", { headers: { authorization: `Bearer ${browserToken?.value}` } });
    expect(browserTokenAsBearer.status()).toBe(401);
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const state = randomBytes(24).toString("base64url");
    const invalidOrigin = await browser.post("/api/v1/auth/pkce/code", {
      headers: { origin: "https://other.example" }, data: { codeChallenge, redirectUri }
    });
    expect(invalidOrigin.status()).toBe(403);
    const invalidRedirect = await browser.post("/api/v1/auth/pkce/code", {
      headers: { origin }, data: { codeChallenge, redirectUri: `${redirectUri}/other` }
    });
    expect(invalidRedirect.status()).toBe(400);

    await page.goto(`/login?${new URLSearchParams({ codeChallenge, redirectUri, state })}`);
    await page.getByRole("button", { name: "Connect app" }).click({ timeout: 30_000 });
    const callbackLink = await page.getByRole("link", { name: "Return to Encore app" }).getAttribute("href");
    const callback = new URL(callbackLink!);
    expect(callback.protocol).toBe("encore:");
    expect(callback.host).toBe("auth");
    expect(callback.pathname).toBe("/callback");
    expect(callback.searchParams.get("state")).toBe(state);
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();

    const wrongVerifier = await native.post("/api/v1/auth/pkce/exchange", {
      data: { code, codeVerifier: randomBytes(32).toString("base64url"), redirectUri }
    });
    expect(wrongVerifier.status()).toBe(401);
    const results = await Promise.all([0, 1].map(() => native.post("/api/v1/auth/pkce/exchange", {
      data: { code, codeVerifier, redirectUri }
    })));
    expect(results.map((response) => response.status()).sort()).toEqual([200, 401]);
    const accepted = results.find((response) => response.status() === 200)!;
    expect(accepted.headers()["set-cookie"]).toBeUndefined();
    expect(accepted.headers()["cache-control"]).toBe("no-store");
    const session = await accepted.json();
    expect(session.user.id).toBe(signedIn.user.id);
    expect(session.tokenType).toBe("Bearer");
    const headers = { authorization: `Bearer ${session.accessToken}` };
    expect((await native.get("/api/v1/auth/me", { headers })).status()).toBe(200);

    const initial = await native.post("/api/v1/auth/onboarding", {
      headers, data: { journey: "listener", displayName: "Expo test listener", preferredGenres: ["Jazz"] }
    });
    expect(initial.status()).toBe(200);
    expect((await initial.json()).user.roles).toEqual(["listener"]);
    const upgraded = await native.post("/api/v1/auth/onboarding", {
      headers, data: { journey: "artist", displayName: "Expo test artist", preferredGenres: ["Jazz"] }
    });
    expect(upgraded.status()).toBe(200);
    expect((await upgraded.json()).studioChannel.role).toBe("owner");

    const current = await native.get("/api/v1/auth/me", { headers });
    expect((await current.json()).user.roles).toContain("artist");
    expect((await native.post("/api/v1/auth/logout", { headers })).status()).toBe(200);
    expect((await native.get("/api/v1/auth/me", { headers })).status()).toBe(401);
    expect((await browser.get("/api/v1/auth/me")).status()).toBe(200);
  } finally {
    await native.dispose();
  }
});
