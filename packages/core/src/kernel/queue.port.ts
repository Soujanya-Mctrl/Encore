export type QueueName =
  | "provenance"
  | "settlement"
  | "licensing"
  | "opportunities"
  | "notifications"
  | "dead_letter";

export interface EnqueueOptions {
  readonly idempotencyKey: string;
  readonly delaySeconds?: number;
}

export interface QueuePort {
  enqueue<TPayload extends Record<string, unknown>>(
    queue: QueueName,
    jobType: string,
    payload: TPayload,
    options: EnqueueOptions
  ): Promise<{ messageId: string }>;
}
