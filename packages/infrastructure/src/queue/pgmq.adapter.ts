import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EnqueueOptions, QueueName, QueuePort } from "@encore/core";

export class PgmqAdapter implements QueuePort {
  private readonly client: SupabaseClient | null;

  constructor(supabaseUrl?: string, serviceRoleKey?: string) {
    this.client =
      supabaseUrl && serviceRoleKey
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
    if (!this.client) {
      return { messageId: `local-${options.idempotencyKey}` };
    }

    const { data, error } = await this.client.schema("pgmq").rpc("send", {
      queue_name: queue,
      msg: {
        jobType,
        idempotencyKey: options.idempotencyKey,
        payload
      },
      delay: options.delaySeconds ?? 0
    });

    if (error) throw new Error(`PGMQ enqueue failed: ${error.message}`);
    return { messageId: String(data) };
  }
}
