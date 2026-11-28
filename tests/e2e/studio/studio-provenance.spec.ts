import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Keypair } from "@solana/web3.js";
import { signedFixture } from "../../../packages/infrastructure/src/provenance/fixture.test-helper.js";

test("Expo session enables Studio, stages audio, verifies evidence, and submits an immutable revision", async ({ request, baseURL }) => {
  test.skip(process.env.ENCORE_RUN_STUDIO_E2E !== "1", "Requires an isolated database and storage");
  test.setTimeout(120_000);
  const origin = new URL(baseURL!).origin;
  const wallet = Keypair.generate();
  const address = wallet.publicKey.toBase58();
  const key = createPrivateKey({ format: "der", type: "pkcs8",
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), wallet.secretKey.slice(0, 32)]) });
  const challenge = await request.post("/api/v1/auth/siws/challenge", { headers: { origin }, data: { address } });
  expect(challenge.status()).toBe(200);
  const { nonce, message } = await challenge.json();
  const signed = await request.post("/api/v1/auth/siws/verify", {
    headers: { origin }, data: { address, nonce, message, signatureBase64: sign(null, Buffer.from(message), key).toString("base64") }
  });
  expect(signed.status()).toBe(200);

  const redirectUri = "encore://auth/callback";
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const handoff = await request.post("/api/v1/auth/pkce/code", { headers: { origin }, data: { codeChallenge, redirectUri } });
  expect(handoff.status()).toBe(200);
  const { code } = await handoff.json();
  const exchange = await request.post("/api/v1/auth/pkce/exchange", { data: { code, codeVerifier, redirectUri } });
  expect(exchange.status()).toBe(200);
  const { accessToken } = await exchange.json();
  const native = { authorization: `Bearer ${accessToken}` };
  const enable = await request.post("/api/v1/studio/enable", { headers: native, data: { displayName: "Studio fixture" } });
  expect(enable.status()).toBe(200);
  const { channel } = await enable.json();
  expect(channel.role).toBe("owner");

  const frame = Buffer.alloc(417);
  frame.set([255, 251, 144, 0]);
  const mp3 = Buffer.concat([frame, frame, frame]);
  const init = await request.post("/api/v1/uploads/init", { headers: native, data: { size: mp3.length } });
  expect(init.status()).toBe(200);
  const { url, grant } = await init.json();
  expect((await request.put(url, { headers: { "content-type": "audio/mpeg" }, data: mp3 })).ok()).toBe(true);
  const metadata = {
    title: "Studio proof fixture", artistName: "Fixture", genre: "Ambient", description: "",
    originCategory: "AI_GENERATED", previewConsent: true,
    contributions: [{ role: "Instrumental", mode: "generative_ai", creatorRef: "Fixture", consent: true }]
  };
  const finalize = await request.post("/api/v1/uploads/finalize", { headers: native, data: { grant, metadata } });
  expect(finalize.status()).toBe(200);
  const { track } = await finalize.json();
  const path = `/api/v1/studio/tracks/${track.id}`;
  expect((await request.get("/api/v1/studio/tracks", { headers: native })).status()).toBe(200);
  expect((await request.patch(path, { headers: native, data: { expectedVersion: 1, metadata: { ...metadata, title: "Edited fixture" } } })).status()).toBe(200);
  const config = await request.get(`${path}/provenance`, { headers: native });
  expect(config.status()).toBe(200);
  const { mode, binding } = await config.json();
  const expectedOutcome = mode === "simulated" ? "simulated_supported" : "role_corroborated";
  const evidence = mode === "simulated"
    ? { expectedVersion: 2, demoScenario: "supported" }
    : { expectedVersion: 2, proof: signedFixture(binding, "a".repeat(64)) };
  const responses = await Promise.all([0, 1].map(() => request.post(`${path}/provenance`, { headers: native, data: evidence })));
  for (const response of responses) expect(response.status()).toBe(200);
  const [first, retry] = await Promise.all(responses.map((response) => response.json()));
  expect(first.manifestHash).toEqual(retry.manifestHash);
  expect(first.manifest.provenance.outcome).toBe(expectedOutcome);
  expect(first.manifest.version).toBe(3);
  expect(first.manifest.evidenceStatus).toBe("UNVERIFIED");
  expect(first.manifest.rightsStatus).toBe("PREVIEW_ALLOWED");
  expect((await request.post(`/api/v1/tracks/${track.id}/submit`, { headers: native, data: { expectedVersion: 2 } })).status()).toBe(409);
  expect((await request.post(`/api/v1/tracks/${track.id}/submit`, { headers: native, data: { expectedVersion: 3 } })).status()).toBe(200);
  const frozen = await (await request.get(path, { headers: native })).json();
  expect(frozen.track.status).toBe("submitted");
  expect(frozen.track.title).toBe("Edited fixture");
  expect(frozen.history).toHaveLength(3);
  expect(frozen.track.audioPath).toBeUndefined();
});
