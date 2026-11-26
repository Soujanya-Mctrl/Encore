export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly visibilityTimeoutSeconds: number;
  readonly baseBackoffSeconds: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  visibilityTimeoutSeconds: 60,
  baseBackoffSeconds: 15
};
