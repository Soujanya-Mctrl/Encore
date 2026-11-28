import { vi } from "vitest";
import type { ClaimedJob, ClaimResult, QueueClient } from "../../supabase/functions/_shared/queue-client.ts";

export const example: ClaimedJob = {
  state: "claimed", jobType: "notifications.queue_check", key: "test-check-1", token: "test-lease-1", payload: {}, attempt: 1
};

export function queueFixture(...claims: ClaimResult[]) {
  const incoming = [...claims];
  return {
    claim: vi.fn<QueueClient["claim"]>(async () => incoming.shift() ?? { state: "empty" }),
    finish: vi.fn<QueueClient["finish"]>(async () => "completed"),
  } satisfies QueueClient;
}
