export interface RateLimitOptions {
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly maxKeys?: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
}

interface Bucket {
  count: number;
  resetAt: number;
  touchedAt: number;
}

const validateOptions = (options: RateLimitOptions): Required<RateLimitOptions> => {
  if (!Number.isInteger(options.maxRequests) || options.maxRequests < 1) {
    throw new Error('rate limit maxRequests must be a positive integer.');
  }
  if (!Number.isInteger(options.windowMs) || options.windowMs < 1_000) {
    throw new Error('rate limit windowMs must be at least one second.');
  }
  const maxKeys = options.maxKeys ?? 10_000;
  if (!Number.isInteger(maxKeys) || maxKeys < 1) {
    throw new Error('rate limit maxKeys must be a positive integer.');
  }
  return { ...options, maxKeys };
};

/** A bounded per-instance guard; the deployment ingress remains the shared limit. */
export const createFixedWindowRateLimiter = (options: RateLimitOptions) => {
  const config = validateOptions(options);
  const buckets = new Map<string, Bucket>();

  const evictIfNeeded = (now: number): void => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    while (buckets.size >= config.maxKeys) {
      const oldest = [...buckets.entries()].sort(
        ([, left], [, right]) => left.touchedAt - right.touchedAt,
      )[0];
      if (oldest === undefined) break;
      buckets.delete(oldest[0]);
    }
  };

  const consume = (key: string, now = Date.now()): RateLimitDecision => {
    const normalizedKey = key.trim().slice(0, 256) || 'anonymous';
    let bucket = buckets.get(normalizedKey);
    if (bucket === undefined || bucket.resetAt <= now) {
      evictIfNeeded(now);
      bucket = { count: 0, resetAt: now + config.windowMs, touchedAt: now };
      buckets.set(normalizedKey, bucket);
    }
    bucket.count += 1;
    bucket.touchedAt = now;
    return {
      allowed: bucket.count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - bucket.count),
      resetAt: bucket.resetAt,
    };
  };

  return { consume };
};

export type FixedWindowRateLimiter = ReturnType<typeof createFixedWindowRateLimiter>;
