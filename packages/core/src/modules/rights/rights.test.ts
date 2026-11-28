import { describe, expect, it } from "vitest";
import type { RightsDeclaration, RightsRecord } from "@encore/contracts";
import { effectiveRights, reviewRights } from "./index";

const now = new Date("2026-11-28T12:00:00Z");
const original: RightsDeclaration = {
  provider: "original", masterAuthority: true, compositionAuthority: true, contributorsCleared: true,
  inputsCleared: true, worldwidePreview: true, writtenHostingPermission: false,
  evidenceDocument: "Fixture rights-holder and collaborator authorization",
  validUntil: "2027-11-28T12:00:00Z", licenseUses: ["film", "film", "social"],
};
const provider = { providerPlan: "paid" as const, generatedAt: "2026-11-27T12:00:00Z", termsDigest: "a".repeat(64) };

describe("Versioned rights capabilities", () => {
  it("requires independent rights over the master, composition, collaborators and source inputs", () => {
    for (const field of ["masterAuthority", "compositionAuthority", "contributorsCleared", "inputsCleared"] as const) {
      expect(reviewRights({ ...original, [field]: false }, "HUMAN_CREATED", now)).toEqual({ preview: false, licenseUses: [], externalUrl: null });
    }
    expect(reviewRights(original, "UNKNOWN", now).licenseUses).toEqual([]);
    expect(reviewRights(original, "HUMAN_CREATED", now).licenseUses).toEqual(["film", "social"]);
    expect(reviewRights(original, "AI_ASSISTED", now).preview).toBe(false);
    expect(reviewRights(original, "HUMAN_CREATED", now, true).preview).toBe(false);
  });

  it("blocks missing plan evidence and free-plan Suno hosting", () => {
    expect(reviewRights({ ...original, provider: "suno" }, "AI_GENERATED", now).preview).toBe(false);
    expect(reviewRights({ ...original, ...provider, provider: "suno", providerPlan: "free" }, "AI_GENERATED", now).preview).toBe(false);
    expect(reviewRights({ ...original, ...provider, provider: "suno" }, "AI_ASSISTED", now)).toEqual({ preview: true, licenseUses: [], externalUrl: null });
  });

  it("handles official ElevenLabs links independently from hosting and license inquiries", () => {
    const source = { ...original, ...provider, provider: "elevenlabs" as const, providerListing: "https://elevenlabs.io/music/example-listing" };
    expect(reviewRights(source, "AI_GENERATED", now)).toEqual({ preview: false, licenseUses: [], externalUrl: source.providerListing });
    expect(reviewRights({ ...source, providerListing: "https://elevenlabs.io.evil.example/music/foo" }, "AI_GENERATED", now).externalUrl).toBeNull();
    expect(reviewRights({ ...source, providerListing: "https://elevenlabs.io/music/example?redirect=https://other.example" }, "AI_GENERATED", now).externalUrl).toBeNull();
    expect(reviewRights({ ...source, writtenHostingPermission: true }, "AI_GENERATED", now).preview).toBe(true);
  });

  it("fails closed on unreviewed, withdrawn and expired declarations", () => {
    const review: RightsRecord = { track_id: "fixture", passport_version: 1, revision: 1, status: "approved", declaration: original,
      capabilities: { preview: true, licenseUses: ["film"], externalUrl: null }, review_reason: null };
    expect(effectiveRights(review, now).preview).toBe(true);
    expect(effectiveRights({ ...review, status: "pending" }, now).preview).toBe(false);
    expect(effectiveRights({ ...review, status: "withdrawn" }, now).preview).toBe(false);
    expect(effectiveRights(review, new Date(original.validUntil)).preview).toBe(false);
  });
});
