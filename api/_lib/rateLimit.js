import { getSupabaseAdmin } from './supabaseAdmin.js';

// In-memory fast path — survives within a single Vercel instance.
// Supabase is the source of truth for cross-instance consistency.
const localCache = new Map();

/**
 * Check rate limit using Supabase as the shared store.
 * Falls back to in-memory if Supabase is unavailable.
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
  const resetAtIso = new Date(now + windowMs).toISOString();

  try {
    const supabase = getSupabaseAdmin();

    // Try to read existing bucket
    const { data: existing, error: readError } = await supabase
      .from('rate_limits')
      .select('count, reset_at')
      .eq('key', bucketKey)
      .maybeSingle();

    if (readError) throw readError;

    let count;
    let newResetAt;

    if (!existing || new Date(existing.reset_at).getTime() <= now) {
      // Expired or new — reset
      count = 1;
      newResetAt = resetAtIso;
    } else {
      // Not expired — increment
      count = existing.count + 1;
      newResetAt = existing.reset_at;
    }

    // Upsert the counter
    const { error: writeError } = await supabase
      .from('rate_limits')
      .upsert({ key: bucketKey, count, reset_at: newResetAt }, { onConflict: 'key' });

    if (writeError) throw writeError;

    // Sync local cache
    localCache.set(bucketKey, { count, resetAt: new Date(newResetAt).getTime() });

    return {
      ok: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: new Date(newResetAt).getTime(),
    };
  } catch {
    // Supabase unavailable — fall back to local in-memory
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
  localCache.set(bucketKey, bucket);

  return {
    ok: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}
