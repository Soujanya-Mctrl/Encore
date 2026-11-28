import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EnqueueOptions, QueueName, QueuePort } from "@encore/core";

export class PgmqAdapter implements QueuePort {
  private readonly client: SupabaseClient | null;

  constructor(supabaseUrl?: string, serviceRoleKey?: string) {
    this.client = supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        })
      : null;
  }

  async enqueue<TPayload extends Record<string, unknown>>(
    queue: QueueName,
    jobType: string,
    payload: TPayload,
    options: EnqueueOptions
  ): Promise<{ messageId: string }> {
    if (!this.client) throw new Error("A durable queue requires Supabase configuration");

    // The private pgmq schema is not exposed through the public API. This RPC
    // is available only to service_role and validates the full job envelope.
    const { data, error } = await this.client.rpc("encore_enqueue_job", {
      job_queue: queue,
      job_type: jobType,
      job_key: options.idempotencyKey,
      job_payload: payload,
      job_delay: options.delaySeconds ?? 0
    });
    if (error || typeof data !== "string" || !/^\d+$/.test(data)) {
      throw new Error("Could not durably enqueue the job");
    }
    return { messageId: data };
  }
}
