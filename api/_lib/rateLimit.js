import { getSupabaseAdmin } from './supabaseAdmin.js';

// Per-instance fallback store — only consulted when Supabase is unreachable.
// Bounded: keys rotate (attacker-chosen IPs), so an unbounded Map would be a
// memory-exhaustion vector. Oldest entries are evicted at LOCAL_MAX_KEYS.
const localCache = new Map();
const LOCAL_MAX_KEYS = 5_000;

function cacheSet(bucketKey, bucket) {
  if (localCache.size >= LOCAL_MAX_KEYS && !localCache.has(bucketKey)) {
    const oldest = localCache.keys().next().value;
    if (oldest !== undefined) localCache.delete(oldest);
  }
  localCache.set(bucketKey, bucket);
}

/**
 * Check rate limit using a single atomic Postgres increment (bump_rate_limit
 * RPC) — race-free across concurrent serverless instances.
 * Falls back to a bounded per-instance counter if Supabase is unavailable.
 *
 * @param {string} key - Rate limit key (e.g. "start-session:192.168.1.1")
 * @param {{ limit?: number, windowMs?: number }} options
 * @returns {{ ok: boolean, limit: number, remaining: number, resetAt: number }}
 */
export async function checkRateLimit(key, options = {}) {
  const limit = options.limit || 20;
  const windowMs = options.windowMs || 60_000;
  const now = Date.now();
  const bucketKey = String(key || 'anonymous');

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('bump_rate_limit', {
      p_key: bucketKey,
      p_window_ms: windowMs,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.bumped_count !== 'number') throw new Error('empty bump result');

    const resetAt = new Date(row.reset_at).getTime();
    cacheSet(bucketKey, { count: row.bumped_count, resetAt });
    return {
      ok: row.bumped_count <= limit,
      limit,
      remaining: Math.max(0, limit - row.bumped_count),
      resetAt,
    };
  } catch {
    // Supabase unavailable — bounded per-instance fallback.
    return checkRateLimitLocal(bucketKey, limit, windowMs, now);
  }
}

/**
 * Local-only fallback when Supabase is unreachable.
 * Identical logic to the original in-memory rate limiter.
 */
function checkRateLimitLocal(bucketKey, limit, windowMs, now) {
  const bucket = localCache.get(bucketKey) || { count: 0, resetAt: now + windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  cacheSet(bucketKey, bucket);

  return {
    ok: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}
