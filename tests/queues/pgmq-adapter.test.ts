import { afterEach, describe, expect, it, vi } from "vitest";
import { JobPublisher, PgmqAdapter } from "../../packages/infrastructure/src/index.js";

const input = ["settlement", "settlement.index_tx", { signature: "sig-123" }, "idem-sig-123"] as const;

afterEach(() => vi.unstubAllGlobals());

describe("PGMQ Queue Adapter & Publisher", () => {
  it("writes through the service RPC and preserves bigint IDs exactly", async () => {
    const request = vi.fn((url: string | URL, options: RequestInit) => {
      expect(String(url)).toBe("https://queue.invalid/rest/v1/rpc/encore_enqueue_job");
      expect(JSON.parse(String(options.body))).toEqual({
        job_queue: "settlement", job_type: "settlement.index_tx", job_key: "idem-sig-123",
        job_payload: { signature: "sig-123" }, job_delay: 0
      });
      return Promise.resolve(Response.json("9007199254740993"));
    });
    vi.stubGlobal("fetch", request);
    const publisher = new JobPublisher(new PgmqAdapter("https://queue.invalid", "test-service-key"));
    await expect(publisher.publish(...input)).resolves.toEqual({ messageId: "9007199254740993" });
  });

  it("does not report success when persistence is unavailable", async () => {
    const publisher = new JobPublisher(new PgmqAdapter());
    await expect(publisher.publish(...input)).rejects.toThrow("requires Supabase");
  });

  it("redacts server failure details from caller errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "sensitive fields" }, { status: 503 })));
    const publisher = new JobPublisher(new PgmqAdapter("https://queue.invalid", "test-service-key"));
    await expect(publisher.publish(...input)).rejects.toThrow(/^Could not durably enqueue the job$/);
  });
});
