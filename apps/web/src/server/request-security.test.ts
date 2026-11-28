import { beforeEach, describe, expect, it, vi } from "vitest";
import { rejectCrossOriginRequest } from "./request-security";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"));
describe("Cookie-authenticated mutation requests", () => {
  it("accepts only same-origin JSON", () => {
    expect(rejectCrossOriginRequest(new Request("http://localhost:3000/api", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }
    }))).toBeNull();
  });
  it("accepts an explicitly configured Expo web origin", () => {
    vi.stubEnv("ENCORE_WEB_CLIENT_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081");
    expect(rejectCrossOriginRequest(new Request("http://localhost:3000/api", {
      method: "POST", headers: { origin: "http://localhost:8081", "content-type": "application/json" }
    }))).toBeNull();
  });
  const invalidHeaders: Record<string, string>[] = [
    { origin: "https://other.example", "content-type": "application/json" },
    { origin: "http://localhost:3000", "content-type": "text/plain" },
    { "content-type": "application/json" }
  ];

  it.each(invalidHeaders)("rejects missing/wrong origin or a form-compatible media type", (headers) => {
    expect(rejectCrossOriginRequest(new Request("http://localhost:3000/api", { method: "POST", headers }))?.status).toBe(403);
  });
});
