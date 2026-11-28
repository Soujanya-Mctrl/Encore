import { createPrivateKey, randomUUID, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Keypair } from "@solana/web3.js";

async function login(request: APIRequestContext, origin: string) {
  const wallet = Keypair.generate();
  const address = wallet.publicKey.toBase58();
  const key = createPrivateKey({ format: "der", type: "pkcs8",
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), wallet.secretKey.slice(0, 32)]) });
  const start = await request.post("/api/v1/auth/siws/challenge", { headers: { origin }, data: { address } });
  expect(start.status()).toBe(200);
  const { nonce, message } = await start.json();
  const verification = await request.post("/api/v1/auth/siws/verify", { headers: { origin }, data: {
    nonce, message, address, signatureBase64: sign(null, Buffer.from(message), key).toString("base64"),
  } });
  expect(verification.status()).toBe(200);
  return (await verification.json()).user.id as string;
}

test("private rights review gates catalog playback and version-bound licensing", async ({ page, playwright, baseURL }) => {
  test.skip(process.env.ENCORE_RUN_RIGHTS_E2E !== "1", "Requires an isolated local database, storage service and MP3 fixture");
  test.setTimeout(120_000);
  const service = process.env.SUPABASE_SECRET_KEY!;
  const database = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(database.hostname)) throw new Error("The rights E2E test requires a loopback database.");
  const origin = new URL(baseURL!).origin;
  const owner = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin } });
  const staff = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin } });
  const buyer = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin } });
  const privateAPI = await playwright.request.newContext({ baseURL: database.origin, extraHTTPHeaders: {
    authorization: `Bearer ${service}`, apikey: service, "content-type": "application/json",
  } });
  try {
    const ownerId = await login(owner, origin);
    const reviewerId = await login(staff, origin);
    await login(buyer, origin);
    expect((await privateAPI.post("/rest/v1/user_roles", { data: { user_id: reviewerId, role: "admin" } })).ok()).toBe(true);
    const onboard = await owner.post("/api/v1/studio/enable", { data: { displayName: "Local rights fixture artist" } });
    expect(onboard.status()).toBe(200);
    const file = await readFile(process.env.ENCORE_TEST_AUDIO!);
    const title = `Rights fixture ${randomUUID().slice(0, 8)}`;
    const upload = await owner.post("/api/v1/tracks", { multipart: {
      metadata: JSON.stringify({ title, artistName: "Fixture artist", genre: "Ambient", description: "",
        originCategory: "HUMAN_CREATED", previewConsent: true,
        contributions: [{ role: "Composer", mode: "human", creatorRef: "Fixture artist", consent: true }] }),
      audio: { name: "fixture.mp3", mimeType: "audio/mpeg", buffer: file },
    } });
    expect(upload.status()).toBe(200);
    const { track } = await upload.json();
    const target = { trackId: track.id, version: 1 };
    const play = `/api/v1/tracks/${track.id}/play?format=json`;
    expect((await page.request.get(play)).status()).toBe(404);
    const evidenceDocument = "Private rights-holder fixture document for the review";
    expect((await owner.post("/api/v1/rights", { data: { action: "submit", ...target, declaration: {
      provider: "original", masterAuthority: true, compositionAuthority: true, contributorsCleared: true, inputsCleared: true,
      worldwidePreview: true, evidenceDocument, validUntil: new Date(Date.now() + 3600_000).toISOString(),
      licenseUses: ["film"],
    } } })).status()).toBe(200);
    expect((await buyer.get(`/api/v1/rights?trackId=${track.id}`)).status()).toBe(404);
    expect((await (await staff.get(`/api/v1/rights?trackId=${track.id}`)).json()).records[0].declaration.evidenceDocument).toBe(evidenceDocument);
    const review = { action: "review", ...target, revision: 1, decision: "approved", reason: "Checked fixture authority and permissions." };
    expect((await owner.post("/api/v1/rights", { data: review })).status()).toBe(403);
    expect((await staff.post("/api/v1/rights", { data: review })).status()).toBe(200);
    expect((await owner.post(`/api/v1/tracks/${track.id}/submit`, { data: { expectedVersion: 1 } })).status()).toBe(200);
    expect((await staff.post(`/api/v1/tracks/${track.id}/review`, { data: { approve: true } })).status()).toBe(200);
    const publish = await privateAPI.post("/rest/v1/rpc/encore_publish_release", { data: {
      release_id: track.id, expected_hash: track.manifestHash, owner_id: ownerId, signature: "local-synthetic-receipt",
    } });
    expect(publish.ok()).toBe(true);

    const result = await page.request.get(`/api/v1/tracks?q=${encodeURIComponent(title)}&origin=HUMAN_CREATED&evidence=UNVERIFIED`);
    expect(result.status()).toBe(200);
    const discovery = await result.json();
    expect(discovery.tracks[0].rights).toEqual({ preview: true, licenseUses: ["film"], externalUrl: null });
    expect(JSON.stringify(discovery)).not.toContain(evidenceDocument);
    expect(JSON.stringify(discovery)).not.toContain("audioPath");
    await page.goto(`/discover?q=${encodeURIComponent(title)}`);
    await page.getByRole("button", { name: "Play preview", exact: true }).click();
    const player = page.getByRole("complementary", { name: "Preview player" });
    await expect(player.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
    await player.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(player.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    const beforeSeek = await page.locator("audio").evaluate((element: HTMLAudioElement) => element.currentTime);
    await player.getByRole("slider", { name: "Seek preview" }).press("ArrowRight");
    await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(beforeSeek);
    await page.getByRole("link", { name: "Music Passport", exact: true }).click();
    await expect(player).toBeVisible();

    if (process.env.ENCORE_TEST_EXPO_URL) {
      const expo = await page.context().newPage();
      try {
        await expo.goto(new URL("/discover", process.env.ENCORE_TEST_EXPO_URL).href);
        await expo.getByPlaceholder("Title, artist, or genre").fill(title, { timeout: 15000 });
        await expo.getByRole("button", { name: "Search catalog" }).click();
        await expect(expo.getByText(title, { exact: true })).toBeVisible();
        await expo.getByRole("button", { name: "Play preview", exact: true }).click();
        await expect(expo.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
      } finally { await expo.close(); }
    }

    const inquiry = { action: "request", ...target, requestId: randomUUID(), use: "film", territory: "UK", termMonths: 12, details: "Short film screening inquiry." };
    expect((await buyer.post("/api/v1/rights", { data: { ...inquiry, use: "marketing" } })).status()).toBe(409);
    for (let attempt = 0; attempt < 2; attempt++) expect((await buyer.post("/api/v1/rights", { data: inquiry })).status()).toBe(200);
    expect((await (await owner.get("/api/v1/rights")).json()).inquiries).toHaveLength(1);
    expect((await owner.post("/api/v1/rights", { data: { action: "respond", requestId: inquiry.requestId,
      decision: "accepted_for_discussion", note: "Please share the project schedule." } })).status()).toBe(200);
    expect((await (await buyer.get("/api/v1/rights")).json()).inquiries[0].status).toBe("accepted_for_discussion");
    expect((await owner.post("/api/v1/rights", { data: { action: "withdraw", ...target, revision: 1 } })).status()).toBe(200);
    expect((await page.request.get(play)).status()).toBe(404);
    expect((await (await buyer.get("/api/v1/rights")).json()).inquiries[0].status).toBe("closed");
  } finally {
    await Promise.all([owner.dispose(), staff.dispose(), buyer.dispose(), privateAPI.dispose()]);
  }
});
