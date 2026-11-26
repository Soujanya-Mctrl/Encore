import type { EnqueueOptions, QueueName, QueuePort } from "@encore/core";

export class PgmqAdapter implements QueuePort {
  async enqueue<TPayload extends Record<string, unknown>>(
    _queue: QueueName,
    _jobType: string,
    _payload: TPayload,
    _options: EnqueueOptions
  ): Promise<{ messageId: string }> {
    // Implemented via Supabase RPC (pgmq.send) in H02-10
    throw new Error("PgmqAdapter.enqueue not wired to Supabase client yet");
  }
}
