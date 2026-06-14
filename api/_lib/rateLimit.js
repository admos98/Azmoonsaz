const buckets = new Map();

export function checkRateLimit(key, options = {}) {
  const limit = options.limit || 20;
  const windowMs = options.windowMs || 60_000;
  const now = Date.now();
  const bucketKey = String(key || 'anonymous');
  const bucket = buckets.get(bucketKey) || { count: 0, resetAt: now + windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  buckets.set(bucketKey, bucket);

  return {
    ok: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}
