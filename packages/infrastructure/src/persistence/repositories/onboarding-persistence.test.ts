import { describe, expect, it } from "vitest";
import { InMemoryIdentityRepository } from "./in-memory-identity.repository.js";

async function newUser(repo: InMemoryIdentityRepository, subject: string) {
  const { user } = await repo.createUserWithIdentity({
    displayName: subject,
    provider: "solana_siws",
    providerSubject: subject
  });
  return user;
}

const profile = {
  displayName: "Encore Artist",
  preferredGenres: ["Ambient"],
  creativeOriginPreferences: { humanCreated: true, aiAssisted: true, aiGenerated: true, exploreAll: true }
};

describe("Onboarding persistence", () => {
  it("creates one owner channel on artist onboarding, with no channel for another listener", async () => {
    const repo = new InMemoryIdentityRepository();
    const artist = await newUser(repo, "artist");
    const listener = await newUser(repo, "listener");
    await repo.updateOnboardingProfile(listener.id, { ...profile, journey: "listener" });
    await repo.updateOnboardingProfile(artist.id, { ...profile, journey: "artist" });
    const first = await repo.findStudioChannelForUser(artist.id);
    expect(first).toMatchObject({ displayName: profile.displayName, role: "owner" });
    await repo.updateOnboardingProfile(artist.id, { ...profile, displayName: "New name", journey: "artist" });
    expect(await repo.findStudioChannelForUser(artist.id)).toEqual(first);
    expect(await repo.findStudioChannelForUser(listener.id)).toBeNull();
    expect(await repo.listReviewAssignmentsForUser(listener.id)).toEqual([]);
  });

  it("rejects a different digest or intent without consuming a valid challenge", async () => {
    const repo = new InMemoryIdentityRepository();
    const expiresAt = new Date(Date.now() + 60_000);
    const digest = "a".repeat(64);
    await repo.createChallenge({ nonce: "n", address: "wallet", intendedAction: "login", expiresAt, messageDigest: digest });
    const now = new Date();
    expect(await repo.consumeChallenge("n", "wallet", now, "b".repeat(64), "login")).toBeNull();
    expect(await repo.consumeChallenge("n", "wallet", now, digest, "link_wallet")).toBeNull();
    expect(await repo.consumeChallenge("n", "wallet", now, digest, "login")).toMatchObject({ consumedAt: now });
    expect(await repo.consumeChallenge("n", "wallet", now, digest, "login")).toBeNull();
  });
});

