import type { QueuePort, QueueName } from "@encore/core";

export class JobPublisher {
  constructor(private readonly queue: QueuePort) {}

  publish<TPayload extends Record<string, unknown>>(
    queue: QueueName,
    jobType: string,
    payload: TPayload,
    idempotencyKey: string
  ) {
    return this.queue.enqueue(queue, jobType, payload, { idempotencyKey });
  }
}
