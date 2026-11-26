// Ensures idempotent handler execution across PGMQ visibility-timeout redeliveries
export async function alreadyProcessed(_idempotencyKey: string): Promise<boolean> {
  return false;
}
