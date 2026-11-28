import { describe, expect, it, vi } from "vitest";
import { consumeJobs } from "../../supabase/functions/_shared/job-consumer.ts";
import { createJobWorker } from "../../supabase/functions/process-jobs/worker.ts";
import { example, queueFixture } from "./fixture.ts";

const queues = ["notifications", "settlement"] as const;

describe("PGMQ Queue Delivery", () => {
  it("dispatches sequentially and limits total deliveries across queues", async () => {
    const client = queueFixture(example, { ...example, key: "second" }, { ...example, key: "third" });
    const handler = vi.fn(async () => {});
    const summary = await consumeJobs(client, new Map([[example.jobType, handler]]), { queues, limit: 2 });
    expect(client.claim.mock.calls.map(([queue]) => queue)).toEqual(queues);
    expect(client.finish.mock.calls.map(([, job, failure]) => [job.key, failure])).toEqual([[example.key, null], ["second", null]]);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ claimed: 2, completed: 2 });
  });

  it("permits only authorized POST callers and gives a job-run summary", async () => {
    const client = queueFixture(example);
    const worker = createJobWorker({ secret: "test-worker-secret", client });
    const invoke = (method: string, authorization: string) => worker(new Request("https://queue.invalid", { method, headers: { authorization } }));
    expect((await invoke("GET", "Bearer test-worker-secret")).status).toBe(405);
    expect((await invoke("POST", "Bearer wrong")).status).toBe(401);
    expect(client.claim).not.toHaveBeenCalled();
    const response = await invoke("POST", "Bearer test-worker-secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ claimed: 1, completed: 1 });
  });
});
