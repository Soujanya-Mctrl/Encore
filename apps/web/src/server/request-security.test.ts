import { beforeEach, describe, expect, it, vi } from "vitest";
import { rejectCrossOriginRequest } from "./request-security";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"));
describe("Cookie-authenticated mutation requests", () => {
  it("accepts only same-origin JSON", () => {
    expect(rejectCrossOriginRequest(new Request("http://localhost:3000/api", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }
    }))).toBeNull();
  });
  it.each([
    { origin: "https://other.example", "content-type": "application/json" },
    { origin: "http://localhost:3000", "content-type": "text/plain" },
    { "content-type": "application/json" }
  ])("rejects missing/wrong origin or a form-compatible media type", (headers) => {
    expect(rejectCrossOriginRequest(new Request("http://localhost:3000/api", { method: "POST", headers }))?.status).toBe(403);
  });
});
