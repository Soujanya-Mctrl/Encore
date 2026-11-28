import { describe, it, expect, vi } from "vitest";
import {
  CatalogService,
  type CatalogRepositoryPort,
  type Release,
} from "./index";
const input = {
  title: "Demo",
  artistName: "Artist",
  genre: "Ambient",
  description: "",
  originCategory: "UNKNOWN" as const,
  previewConsent: true as const,
  contributions: [
    {
      role: "Creator",
      mode: "unknown" as const,
      creatorRef: "Artist",
      consent: true as const,
    },
  ],
};
function setup() {
  let release: Release | null = null;
  const repo: CatalogRepositoryPort = {
    create: vi.fn(async (r) => {
      release = r;
    }),
    get: async () => release,
    mine: async () => [],
    search: async () => ({ tracks: [], total: 0 }),
    transition: vi.fn(async () => {}),
    append: vi.fn(async () => {}),
  };
  const storage = {
    put: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    preview: async () => "",
  };
  const service = new CatalogService(
    repo,
    storage,
    { hash: () => "a".repeat(64), bytes: () => "b".repeat(64) },
    { inspect: () => ({ durationSeconds: 1 }) },
    () => "test-id",
  );
  return { repo, storage, service, release: () => release! };
}
describe("Registry use cases", () => {
  it("keeps unknown origin, unverified evidence and preview rights separate", async () => {
    const s = setup(),
      r = await s.service.upload("artist", input, new Uint8Array([1]));
    expect(r.status).toBe("draft");
    expect(r.manifest).toMatchObject({
      originCategory: "UNKNOWN",
      evidenceStatus: "UNVERIFIED",
      rightsStatus: "PREVIEW_ALLOWED",
      version: 1,
      previousHash: null,
    });
    expect(r.anchorSignature).toBeNull();
  });
  it("cleans up only the uploaded object if persistence fails", async () => {
    const s = setup();
    vi.mocked(s.repo.create).mockRejectedValueOnce(new Error("DB down"));
    await expect(
      s.service.upload("artist", input, new Uint8Array([1])),
    ).rejects.toThrow();
    expect(s.storage.remove).toHaveBeenCalledWith("artist/test-id/preview.mp3");
  });
  it("keeps media when the database commit succeeded but the response failed", async () => {
    const s = setup();
    const create = vi.mocked(s.repo.create).getMockImplementation()!;
    vi.mocked(s.repo.create).mockImplementationOnce(async (release) => {
      await create(release);
      throw new Error("Connection closed after commit");
    });
    const release = await s.service.upload("artist", input, new Uint8Array([1]));
    expect(release).toEqual(s.release());
    expect(s.storage.remove).not.toHaveBeenCalled();
  });
  it("rejects another artist and self-review", async () => {
    const s = setup();
    await s.service.upload("artist", input, new Uint8Array([1]));
    await expect(s.service.submit("test-id", "stranger")).rejects.toThrow(
      "another artist",
    );
    await expect(s.service.review("test-id", "artist", true)).rejects.toThrow(
      "own release",
    );
    expect(s.repo.transition).not.toHaveBeenCalled();
  });
  it("appends a hash-linked version and rejects stale revisions", async () => {
    const s = setup();
    await s.service.upload("artist", input, new Uint8Array([1]));
    await expect(
      s.service.revise("test-id", "artist", input, 9),
    ).rejects.toThrow("Version changed");
    await s.service.revise("test-id", "artist", input, 1);
    expect(s.repo.append).toHaveBeenCalledWith(
      "test-id",
      "artist",
      1,
      expect.objectContaining({ version: 2, previousHash: "a".repeat(64) }),
      "a".repeat(64),
      { title: "Demo", artistName: "Artist", genre: "Ambient", description: "" },
    );
  });
});
