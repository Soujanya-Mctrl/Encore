import { describe, expect, it, vi } from "vitest";
import { consumeJobs } from "../../supabase/functions/_shared/job-consumer.ts";
import { example, queueFixture } from "./fixture.ts";

describe("PGMQ Idempotency", () => {
  it("does not run duplicate or leased deliveries returned by the database", async () => {
    const client = queueFixture({ state: "duplicate" }, { state: "deferred" }, example);
    const handler = vi.fn(async () => {});
    const result = await consumeJobs(client, new Map([[example.jobType, handler]]), { queues: ["notifications"] });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(example, expect.any(AbortSignal));
    expect(result).toMatchObject({ duplicate: 1, deferred: 1, completed: 1 });
  });
});
