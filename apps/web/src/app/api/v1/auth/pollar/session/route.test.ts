import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryIdentityRepository, HmacSessionTokenService, PollarVerificationError } from "@encore/infrastructure";
import { getServerContainer } from "@/server/container";
import { POST } from "./route";

vi.mock("@/server/container", () => ({ getServerContainer: vi.fn() }));
const proof = { accessToken: "token", profileProof: "profile-proof", walletProof: "wallet-proof" };
const request = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/v1/auth/pollar/session", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body)
});
let verify = vi.fn();
const registerSession = vi.fn();
beforeEach(() => {
  registerSession.mockReset();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  verify = vi.fn().mockResolvedValue({ provider: "google", providerSubject: "trusted-user", displayName: "Trusted Artist" });
  vi.mocked(getServerContainer).mockReturnValue({
    users: new InMemoryIdentityRepository(),
    sessions: new HmacSessionTokenService("test-secret-at-least-thirty-two-bytes-long"),
    activeSessions: { create: registerSession },
    clock: { now: () => new Date("2026-11-28T00:00:00Z") },
    externalIdentity: { verify }
  } as unknown as ReturnType<typeof getServerContainer>);
});

describe("Pollar session endpoint", () => {
  it("blocks cross-origin login requests", async () => {
    const response = await POST(request(proof, "https://other.example"));
    expect(response.status).toBe(403);
    expect(verify).not.toHaveBeenCalled();
  });
  it("refuses browser-asserted provider and wallet identities", async () => {
    const response = await POST(request({ provider: "google", providerSubject: "victim" }));
    expect(response.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("issues no cookie when upstream session verification fails", async () => {
    verify.mockRejectedValue(new PollarVerificationError(401));
    const response = await POST(request(proof));
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("creates an HttpOnly session only from the server-verified identity", async () => {
    const response = await POST(request(proof));
    expect(response.status).toBe(200);
    expect((await response.json()).user.displayName).toBe("Trusted Artist");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(verify).toHaveBeenCalledWith(proof);
    expect(registerSession).toHaveBeenCalledWith(expect.any(String), expect.any(String), new Date("2026-11-28T02:00:00Z"));
  });
});
