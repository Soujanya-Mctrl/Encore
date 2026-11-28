import { describe, expect, it } from "vitest";
import { InvalidJobPayload, consumeJobs } from "../../supabase/functions/_shared/job-consumer.ts";
import { example, queueFixture } from "./fixture.ts";

describe("PGMQ Dead Letter Routing", () => {
  it("never acknowledges jobs for an unimplemented handler as successful", async () => {
    const client = queueFixture(example);
    client.finish.mockResolvedValue("dead_lettered");
    const result = await consumeJobs(client, new Map(), { queues: ["notifications"] });
    expect(client.finish).toHaveBeenCalledWith("notifications", example, "handler_unavailable", expect.any(AbortSignal));
    expect(result).toMatchObject({ dead_lettered: 1, completed: 0 });
  });

  it("does not retry an invalid payload as if it were a temporary failure", async () => {
    const client = queueFixture(example);
    client.finish.mockResolvedValue("dead_lettered");
    const handlers = new Map([[example.jobType, async () => { throw new InvalidJobPayload(); }]]);
    await consumeJobs(client, handlers, { queues: ["notifications"] });
    expect(client.finish).toHaveBeenCalledWith("notifications", example, "invalid_payload", expect.any(AbortSignal));
  });
});
