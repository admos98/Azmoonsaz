/**
 * Image storage provider interface — the single seam between ExamForge and
 * any object store (Supabase Storage today, S3-compatible Parspack later).
 *
 * Every provider implements the same three operations, all keyed by an
 * opaque storage key of the form `<teacherUuid>/<uuid>.webp`. Keys are
 * provider-agnostic path strings: migrating providers means copying objects
 * with identical keys and flipping IMAGE_STORE_PROVIDER — zero database
 * writes, zero client changes.
 *
 * Byte flow never touches Vercel: the browser PUTs directly to the store via
 * a short-lived presigned URL, and students download via short-lived signed
 * GET URLs minted inside exam-payload.
 */

export const IMAGE_KEY_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;

/** True when `value` is a provider-agnostic storage key we minted. */
export function isImageStoreKey(value) {
  return typeof value === 'string' && IMAGE_KEY_PATTERN.test(value);
}

/**
 * True when `value` is legacy content the old form accepted (base64 data
 * URLs and arbitrary external https URLs). New writes must be rejected;
 * existing rows are grandfathered on read.
 */
export function isLegacyImageValue(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (isImageStoreKey(value)) return false;
  return value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://');
}

function missing(what) {
  return new Error(`image_store_not_configured: ${what}`);
}

/**
 * Select the active provider.
 *
 * `IMAGE_STORE_PROVIDER=s3` activates the S3-compatible driver ONLY when all
 * four S3_* variables are present; otherwise it logs once and falls back to
 * Supabase. No key in Vercel = zero behavior change.
 */
export async function selectImageStore() {
  const provider = String(process.env.IMAGE_STORE_PROVIDER || 'supabase').toLowerCase();
  if (provider === 's3') {
    const needed = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'];
    const absent = needed.filter((name) => !String(process.env[name] || '').trim());
    if (absent.length === 0) {
      const { s3ImageStore } = await import('./s3Store.js');
      return { name: 's3', store: s3ImageStore };
    }
    console.error(`image_store_s3_incomplete: missing ${absent.join(',')} — staying on supabase`);
  }
  const { supabaseImageStore } = await import('./supabaseStore.js');
  return { name: 'supabase', store: supabaseImageStore };
}

/** Mint a fresh object key scoped to the owning teacher. */
export function mintImageKey(teacherId) {
  const uuid =
    globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `xx-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return `${teacherId}/${uuid}.webp`;
}

/** Collect every storage key referenced by a question body (main/options/parts). */
export function collectImageKeys(body) {
  const keys = [];
  const push = (value) => {
    if (isImageStoreKey(value) && !keys.includes(value)) keys.push(value);
  };
  if (!body || typeof body !== 'object') return keys;
  push(body.imageUrl);
  for (const option of Array.isArray(body.options) ? body.options : []) push(option?.imageUrl);
  for (const part of Array.isArray(body.parts) ? body.parts : []) {
    push(part?.imageUrl);
    for (const option of Array.isArray(part?.options) ? part.options : []) push(option?.imageUrl);
  }
  return keys;
}

/**
 * Return a copy of a student-safe question with known keys swapped for
 * signed URLs. Unknown/legacy values pass through untouched.
 */
export function substituteImageUrls(question, urls) {
  if (!question || typeof question !== 'object' || !urls) return question;
  const swap = (value) => (typeof value === 'string' && urls[value] ? urls[value] : value);
  const swapOptions = (options) =>
    Array.isArray(options)
      ? options.map((option) =>
          option && typeof option === 'object' && typeof option.imageUrl === 'string'
            ? { ...option, imageUrl: swap(option.imageUrl) }
            : option,
        )
      : options;
  const body =
    question.body && typeof question.body === 'object' ? { ...question.body } : question.body;
  if (body && typeof body === 'object') {
    if (typeof body.imageUrl === 'string') body.imageUrl = swap(body.imageUrl);
    body.options = swapOptions(body.options);
    if (Array.isArray(body.parts)) {
      body.parts = body.parts.map((part) => {
        if (!part || typeof part !== 'object') return part;
        const next = { ...part };
        if (typeof next.imageUrl === 'string') next.imageUrl = swap(next.imageUrl);
        next.options = swapOptions(next.options);
        return next;
      });
    }
  }
  return { ...question, body };
}

/**
 * Return a copy of a question with key-shaped image values removed.
 * Used when signed-URL minting fails: serve the paper without images rather
 * than leaking opaque storage keys (whose first segment is a teacher UUID).
 * Legacy data:/https: values are preserved (grandfathered rows keep rendering).
 */
export function removeImageKeys(question) {
  if (!question || typeof question !== 'object') return question;
  const strip = (value) => (isImageStoreKey(value) ? undefined : value);
  const stripOptions = (options) =>
    Array.isArray(options)
      ? options.map((option) =>
          option && typeof option === 'object' && 'imageUrl' in option
            ? { ...option, imageUrl: strip(option.imageUrl) }
            : option,
        )
      : options;
  const body =
    question.body && typeof question.body === 'object' ? { ...question.body } : question.body;
  if (body && typeof body === 'object') {
    const next = { ...body };
    if ('imageUrl' in next) next.imageUrl = strip(next.imageUrl);
    if ('options' in next) next.options = stripOptions(next.options);
    if (Array.isArray(next.parts)) {
      next.parts = next.parts.map((part) => {
        if (!part || typeof part !== 'object') return part;
        const p = { ...part };
        if ('imageUrl' in p) p.imageUrl = strip(p.imageUrl);
        if ('options' in p) p.options = stripOptions(p.options);
        return p;
      });
    }
    return { ...question, body: next };
  }
  return question;
}
