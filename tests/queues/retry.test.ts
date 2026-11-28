import { describe, expect, it } from "vitest";
import { consumeJobs } from "../../supabase/functions/_shared/job-consumer.ts";
import { example, queueFixture } from "./fixture.ts";

describe("PGMQ Retry Policy", () => {
  it("records a sanitized failure rather than acknowledging a failed job", async () => {
    const client = queueFixture(example);
    client.finish.mockResolvedValue("retrying");
    const handlers = new Map([[example.jobType, async () => { throw new Error("sensitive payload"); }]]);
    const outcome = await consumeJobs(client, handlers, { queues: ["notifications"] });
    expect(client.finish).toHaveBeenCalledWith("notifications", example, "handler_failed", expect.any(AbortSignal));
    expect(outcome).toMatchObject({ retrying: 1, completed: 0 });
  });

  it("leaves the lease in place if the worker's time budget expires", async () => {
    const client = queueFixture(example);
    const budget = new AbortController();
    const handlers = new Map([[example.jobType, async () => { budget.abort(); }]]);
    await consumeJobs(client, handlers, { queues: ["notifications"], signal: budget.signal });
    expect(client.finish).not.toHaveBeenCalled();
    expect(client.claim).toHaveBeenCalledTimes(1);
  });
});
