/** Result of checking or hitting a rate limit bucket. */
export type RateLimitStatus = {
  /** Whether the requested operation is within allowable limits. */
  allowed: boolean;
  /** Number of remaining allowed attempts/invocations in the current window. */
  remaining: number;
  /** Timestamp when the current window expires and limit resets. */
  resetAt: Date;
};

/** Options for recording an attempt against a rate limit bucket. */
export type RateLimitOptions = {
  /** Maximum number of hits allowed within the window. */
  limit: number;
  /** Duration of the window in seconds. */
  windowSeconds: number;
};

/**
 * Tracks usage counters across serverless instances to prevent brute force and resource exhaustion (SEG-rate-limit).
 */
export interface RateLimiter {
  /** Checks whether the given key is currently blocked without recording an attempt. */
  check(key: string, limit: number): Promise<RateLimitStatus>;

  /** Atomically records one hit, creates or updates the bucket, and opportunistically purges stale records. */
  hit(key: string, options: RateLimitOptions): Promise<RateLimitStatus>;

  /** Resets or clears the bucket for a key (e.g. after a successful sign-in). */
  reset(key: string): Promise<void>;
}
