import { z } from "zod";
import { QUEUE_NAMES } from "./job-types.js";

export const JobEnvelopeSchema = z.object({
  queue: z.enum(QUEUE_NAMES),
  jobType: z.string().min(1),
  idempotencyKey: z.string().min(1),
  attempt: z.number().int().nonnegative().default(0),
  payload: z.record(z.unknown())
});

export type JobEnvelope = z.infer<typeof JobEnvelopeSchema>;
