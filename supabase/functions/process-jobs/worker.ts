import { verifyJobCaller } from "../_shared/authorization.ts";
import { type JobHandler, InvalidJobPayload, consumeJobs } from "../_shared/job-consumer.ts";
import { logJobEvent } from "../_shared/logger.ts";
import { type QueueClient } from "../_shared/queue-client.ts";

// Keep unfinished product jobs unacknowledged as successes. The consumer
// preserves them in the dead-letter archive for operator recovery.
const handlers = new Map<string, JobHandler>([
  ["notifications.queue_check", (job) => {
    if (Object.keys(job.payload).length !== 0) throw new InvalidJobPayload("Queue checks take an empty payload");
  }],
]);

export function createJobWorker(environment: { secret: string; client: QueueClient | null }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    if (!verifyJobCaller(request.headers.get("authorization"), environment.secret)) {
      return new Response(null, { status: 401 });
    }
    if (!environment.client) return Response.json({ error: "Queue worker is not configured" }, { status: 503 });

    try {
      const summary = await consumeJobs(environment.client, handlers);
      logJobEvent("info", "Queue batch finished", summary);
      return Response.json(summary);
    } catch {
      // Database and handler errors can contain queue payloads or credentials.
      logJobEvent("error", "Queue batch interrupted");
      return Response.json({ error: "Queue processing interrupted; unfinished jobs remain queued" }, { status: 503 });
    }
  };
}
