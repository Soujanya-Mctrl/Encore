// Validates cron/service authorization header before processing jobs
export function verifyJobCaller(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader || !expectedSecret) return false;
  return authHeader === `Bearer ${expectedSecret}`;
}
