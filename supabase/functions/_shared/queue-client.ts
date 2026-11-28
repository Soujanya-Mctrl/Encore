export const ACTIVE_QUEUES = ["provenance", "settlement", "licensing", "opportunities", "notifications"] as const;
export type ActiveQueue = (typeof ACTIVE_QUEUES)[number];
export type FailureReason = "handler_unavailable" | "invalid_payload" | "handler_failed";

export type ClaimResult =
  | { state: "empty" | "duplicate" | "deferred" | "dead_lettered" }
  | { state: "claimed"; key: string; jobType: string; token: string; attempt: number; payload: Record<string, unknown> };
export type ClaimedJob = Extract<ClaimResult, { state: "claimed" }>;
export type FinishResult = "completed" | "retrying" | "dead_lettered" | "lease_lost";

export interface QueueClient {
  claim(queue: ActiveQueue, leaseSeconds: number, signal: AbortSignal): Promise<ClaimResult>;
  finish(queue: ActiveQueue, job: ClaimedJob, failure: FailureReason | null, signal: AbortSignal): Promise<FinishResult>;
}

function parseClaim(value: unknown): ClaimResult {
  if (!value || typeof value !== "object" || !("state" in value)) throw new Error("Invalid queue claim result");
  const { state } = value;
  if (state === "empty" || state === "duplicate" || state === "deferred" || state === "dead_lettered") return { state };
  if (state === "claimed" && "key" in value && typeof value.key === "string" &&
      "token" in value && typeof value.token === "string" &&
      "jobType" in value && typeof value.jobType === "string" &&
      "attempt" in value && Number.isInteger(value.attempt) && typeof value.attempt === "number" &&
      "payload" in value && value.payload !== null && typeof value.payload === "object" && !Array.isArray(value.payload)) {
    return { state, key: value.key, token: value.token, jobType: value.jobType, attempt: value.attempt, payload: value.payload as Record<string, unknown> };
  }
  throw new Error("Invalid queue claim result");
}

export function createQueueClient(projectUrl: string, serviceRoleKey: string, request = fetch): QueueClient {
  async function rpc(name: string, body: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    const response = await request(new URL(`/rest/v1/rpc/${name}`, projectUrl), {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new Error(`${name} failed (HTTP ${response.status})`);
    return response.json();
  }

  return {
    async claim(queue, leaseSeconds, signal) {
      return parseClaim(await rpc("encore_claim_job", { job_queue: queue, lease_seconds: leaseSeconds }, signal));
    },
    async finish(queue, job, failure, signal) {
      const result = await rpc("encore_finish_job", {
        job_queue: queue,
        job_key: job.key,
        claim_token: job.token,
        succeeded: failure === null,
        failure_reason: failure,
      }, signal);
      if (result === "completed" || result === "retrying" || result === "dead_lettered" || result === "lease_lost") return result;
      throw new Error("Invalid queue finish result");
    },
  };
}
