import { ACTIVE_QUEUES, type ActiveQueue, type ClaimedJob, type FailureReason, type QueueClient } from "./queue-client.ts";

export type JobHandler = (job: ClaimedJob, signal: AbortSignal) => Promise<void> | void;
export class InvalidJobPayload extends Error {}

interface ConsumerOptions {
  limit?: number;
  leaseSeconds?: number;
  signal?: AbortSignal;
  queues?: readonly ActiveQueue[];
}

export async function consumeJobs(
  client: QueueClient,
  handlers: ReadonlyMap<string, JobHandler>,
  { limit = 20, leaseSeconds = 60, signal = AbortSignal.timeout(20_000), queues = ACTIVE_QUEUES }: ConsumerOptions = {},
) {
  const result = { claimed: 0, completed: 0, retrying: 0, duplicate: 0, deferred: 0, dead_lettered: 0, lease_lost: 0 };
  const activeQueues = [...new Set(queues)];
  let deliveries = 0;

  // Claim on demand so a slow job never wastes the leases of later jobs.
  while (!signal.aborted && deliveries < limit && activeQueues.length) {
    const queue = activeQueues.shift()!;
    const claim = await client.claim(queue, leaseSeconds, signal);
    if (claim.state === "empty") continue;

    deliveries++;
    activeQueues.push(queue);
    if (claim.state !== "claimed") {
      result[claim.state]++;
      continue;
    }

    result.claimed++;
    const handler = handlers.get(claim.jobType);
    let reason: FailureReason | null = handler ? null : "handler_unavailable";
    if (handler) {
      try {
        await handler(claim, signal);
      } catch (error) {
        reason = error instanceof InvalidJobPayload ? "invalid_payload" : "handler_failed";
      }
    }

    // If we run out of time, leave the message for visibility-timeout redelivery.
    if (signal.aborted) break;
    const outcome = await client.finish(queue, claim, reason, signal);
    result[outcome]++;
  }

  return result;
}
