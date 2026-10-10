/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Browser-side image pipeline — the single upload path for question images.
 *
 * Flow: shrink in browser (canvas) → POST /api/teacher/images/upload-url
 * (teacher-authed, server mints a teacher-scoped key) → PUT bytes DIRECT to
 * the store (never through Vercel) → persist only the opaque storage key
 * (`<teacherUuid>/<uuid>.webp`) in the question body.
 *
 * Provider-agnostic by construction: the browser branches on `uploadToken`.
 * Supabase returns a token (upload via uploadToSignedUrl); S3-compatible
 * stores return a bare presigned PUT (raw fetch PUT). Same keys, same flow.
 */
import { teacherPost } from './teacherApi';
import { getSupabasePublicClient } from '../lib/supabasePublic';

export const IMAGE_STORE_KEY_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;

export function isImageStoreKey(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_STORE_KEY_PATTERN.test(value);
}

export function isLegacyImageValue(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (isImageStoreKey(value)) return false;
  const s: string = value;
  return s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://');
}

export const MAX_IMAGE_EDGE_PX = 1600;
export const TARGET_IMAGE_BYTES = 500 * 1024;
export const MAX_IMAGE_BYTES = 1024 * 1024;

const HEIC_TYPES = new Set(['image/heic', 'image/heif']);
const HEIC_EXT = /\.(heic|heif)$/i;

export class ImageUploadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ImageUploadError';
    this.code = code;
  }
}

function rejectHeic(file: File): void {
  if (HEIC_TYPES.has(file.type.toLowerCase()) || HEIC_EXT.test(file.name)) {
    throw new ImageUploadError(
      'heic_not_supported',
      'فرمت HEIC آیفون پشتیبانی نمی‌شود. لطفاً تصویر را به JPG تبدیل کنید.',
    );
  }
}

async function decodeToBitmap(file: File): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  // createImageBitmap is the fast path (worker-safe, EXIF-applied).
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { bitmap, width: bitmap.width, height: bitmap.height };
  }
  // Fallback: <img> + object URL.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode_failed'));
      el.src = url;
    });
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    // Draw through canvas once so EXIF orientation is normalized.
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('decode_failed');
    ctx.drawImage(img, 0, 0);
    const out = await createImageBitmap(canvas);
    return { bitmap: out, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Shrink an image file to a web-ready blob. Canvas redraw strips EXIF/GPS
 * (privacy win). Returns the blob plus its content type.
 */
export async function shrinkImageForUpload(file: File): Promise<{ blob: Blob; contentType: string }> {
  if (!file || !(file instanceof Blob)) {
    throw new ImageUploadError('invalid_file', 'فایل تصویر معتبر نیست.');
  }
  rejectHeic(file);
  if (!String(file.type || '').startsWith('image/')) {
    throw new ImageUploadError('not_an_image', 'فقط فایل تصویری انتخاب کنید.');
  }

  let decoded;
  try {
    decoded = await decodeToBitmap(file);
  } catch {
    throw new ImageUploadError('decode_failed', 'خواندن تصویر ممکن نشد. فرمت دیگری امتحان کنید.');
  }

  const { bitmap, width, height } = decoded;
  const scale = Math.min(1, MAX_IMAGE_EDGE_PX / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new ImageUploadError('decode_failed', 'خواندن تصویر ممکن نشد.');
  }
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close?.();

  // WebP first (smallest), quality stepdown to the target size.
  const qualities = [0.82, 0.65, 0.5];
  for (const q of qualities) {
    const blob = await canvasToBlob(canvas, 'image/webp', q);
    if (blob && blob.size > 0) {
      if (blob.size <= TARGET_IMAGE_BYTES || q === qualities[qualities.length - 1]) {
        if (blob.size > MAX_IMAGE_BYTES) {
          throw new ImageUploadError(
            'too_large',
            'تصویر حتی بعد از فشرده‌سازی بزرگ است. تصویر کوچک‌تری انتخاب کنید.',
          );
        }
        return { blob, contentType: 'image/webp' };
      }
    }
  }
  // WebP unsupported or empty — JPEG fallback.
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  if (jpeg && jpeg.size > 0) {
    if (jpeg.size > MAX_IMAGE_BYTES) {
      throw new ImageUploadError(
        'too_large',
        'تصویر حتی بعد از فشرده‌سازی بزرگ است. تصویر کوچک‌تری انتخاب کنید.',
      );
    }
    return { blob: jpeg, contentType: 'image/jpeg' };
  }
  const png = await canvasToBlob(canvas, 'image/png', 1);
  if (png && png.size > 0) {
    if (png.size > MAX_IMAGE_BYTES) {
      throw new ImageUploadError(
        'too_large',
        'تصویر حتی بعد از فشرده‌سازی بزرگ است. تصویر کوچک‌تری انتخاب کنید.',
      );
    }
    return { blob: png, contentType: 'image/png' };
  }
  throw new ImageUploadError('decode_failed', 'خواندن تصویر ممکن نشد.');
}

interface MintedUpload {
  ok: boolean;
  uploadUrl: string;
  uploadToken?: string | null;
  bucket?: string;
  key: string;
  expiresIn: number;
  contentType: string;
}

/**
 * Full pipeline: shrink → mint → direct PUT → return the storage key.
 * The caller persists ONLY the returned key in the question body.
 */
export async function uploadQuestionImageFile(file: File): Promise<string> {
  const { blob, contentType } = await shrinkImageForUpload(file);
  const minted = await teacherPost<MintedUpload>('/api/teacher/images/upload-url', {
    contentType,
  });
  if (!minted?.uploadUrl || !minted?.key) {
    throw new ImageUploadError('mint_failed', 'دریافت مجوز بارگذاری ممکن نشد. دوباره تلاش کنید.');
  }
  if (minted.uploadToken) {
    // Supabase branch: complete via the SDK's signed-upload endpoint.
    const supabase = getSupabasePublicClient();
    const bucket = minted.bucket || 'question-images';
    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(minted.key, minted.uploadToken, blob, { contentType });
    if (error) {
      throw new ImageUploadError('upload_failed', 'بارگذاری تصویر ممکن نشد. دوباره تلاش کنید.');
    }
    return minted.key;
  }
  // S3-compatible branch: bare presigned PUT.
  const res = await fetch(minted.uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });
  if (!res.ok) {
    throw new ImageUploadError('upload_failed', 'بارگذاری تصویر ممکن نشد. دوباره تلاش کنید.');
  }
  return minted.key;
}

interface ReadResponse {
  ok: boolean;
  urls: Record<string, string>;
}

/** Batch-resolve teacher-owned keys to short-lived signed URLs. */
export async function resolveTeacherImageUrls(keys: string[]): Promise<Record<string, string>> {
  const owned = (Array.isArray(keys) ? keys : []).filter(isImageStoreKey).slice(0, 50);
  if (owned.length === 0) return {};
  const response = await teacherPost<ReadResponse>('/api/teacher/images/read', { keys: owned });
  return response?.urls || {};
}

/** Collect every storage key referenced by a client-side question shape. */
export function collectClientImageKeys(body: unknown): string[] {
  const keys: string[] = [];
  const push = (value: unknown) => {
    if (isImageStoreKey(value) && !keys.includes(value as string)) keys.push(value as string);
  };
  if (!body || typeof body !== 'object') return keys;
  const b = body as Record<string, unknown>;
  push(b.imageUrl);
  for (const option of Array.isArray(b.options) ? (b.options as unknown[]) : []) {
    push((option as Record<string, unknown>)?.imageUrl);
  }
  for (const part of Array.isArray(b.parts) ? (b.parts as unknown[]) : []) {
    push((part as Record<string, unknown>)?.imageUrl);
    for (const option of Array.isArray((part as Record<string, unknown>)?.options)
      ? ((part as Record<string, unknown>).options as unknown[])
      : []) {
      push((option as Record<string, unknown>)?.imageUrl);
    }
  }
  // Also accept a bare Question shape (imageUrl at top level).
  push((body as Record<string, unknown>).imageUrl);
  return keys;
}
