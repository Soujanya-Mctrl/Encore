// PGMQ queue client wrapper for Supabase Edge Functions
export interface QueueMessage<T = Record<string, unknown>> {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: T;
}
