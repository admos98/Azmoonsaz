/**
 * Supabase Storage driver for the image-store interface.
 *
 * Private `question-images` bucket, per-teacher folder layout
 * (`<teacherUuid>/...`) enforced by the existing RLS path-scoping policy.
 * Teacher uploads go through signed upload URLs; reads go through signed
 * download URLs. No public URLs anywhere on this path.
 */
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { isImageStoreKey } from './imageStore.js';

export const QUESTION_IMAGES_BUCKET = 'question-images';
const UPLOAD_TTL_SECONDS = 15 * 60;
const READ_TTL_SECONDS = 60 * 60;

function assertKeyOwnedByTeacher(key, teacherId) {
  if (!isImageStoreKey(key)) {
    const error = new Error('invalid_image_key');
    error.status = 400;
    throw error;
  }
  if (!key.startsWith(`${teacherId}/`)) {
    const error = new Error('image_not_owned');
    error.status = 403;
    throw error;
  }
}

/**
 * Only the teacher's own folder root may be listed — the cleanup scan must
 * never enumerate another tenant's prefix.
 */
function assertPrefixOwned(prefix, teacherId) {
  if (typeof prefix !== 'string' || prefix !== teacherId) {
    const error = new Error('image_not_owned');
    error.status = 403;
    throw error;
  }
}

export const supabaseImageStore = {
  name: 'supabase',

  /**
   * Mint a signed upload URL for one teacher-scoped key.
   * The browser PUTs the (already shrunk) WebP bytes directly.
   */
  async mintUploadUrl({ key, teacherId, contentType = 'image/webp' }) {
    assertKeyOwnedByTeacher(key, teacherId);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(QUESTION_IMAGES_BUCKET)
      .createSignedUploadUrl(key, { upsert: false });
    if (error || !data?.signedUrl || !data?.token) throw error || new Error('signed_upload_failed');
    // Bound the upload: signed PUT inherits the bucket's 5 MB cap and image
    // MIME allow-list enforced by Storage on every upload.
    // The browser completes the upload with uploadToSignedUrl(key, token, blob)
    // — the raw signedUrl alone is NOT a PUT target (it needs the token query).
    return {
      uploadUrl: data.signedUrl,
      uploadToken: data.token,
      bucket: QUESTION_IMAGES_BUCKET,
      key,
      expiresIn: UPLOAD_TTL_SECONDS,
      contentType,
    };
  },

  /**
   * Mint short-lived signed download URLs for teacher-owned keys.
   * Students get these inside exam-payload; keys never leave the server.
   */
  async mintReadUrl({ keys, teacherId, expiresIn = READ_TTL_SECONDS }) {
    const list = Array.isArray(keys) ? keys : [keys];
    const owned = list.filter((key) => {
      try {
        assertKeyOwnedByTeacher(key, teacherId);
        return true;
      } catch {
        return false;
      }
    });
    if (owned.length === 0) return {};
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(QUESTION_IMAGES_BUCKET)
      .createSignedUrls(owned, Math.max(60, Math.min(7 * 24 * 3600, Number(expiresIn) || READ_TTL_SECONDS)));
    if (error || !Array.isArray(data)) throw error || new Error('signed_read_failed');
    const urls = {};
    for (const row of data) {
      if (row?.path && row?.signedUrl) urls[row.path] = row.signedUrl;
    }
    return urls;
  },

  /** Mint one signed download URL without a teacher-ownership check (student path). */
  async mintReadUrlUnchecked({ keys, expiresIn = READ_TTL_SECONDS }) {
    const list = (Array.isArray(keys) ? keys : [keys]).filter(isImageStoreKey);
    if (list.length === 0) return {};
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(QUESTION_IMAGES_BUCKET)
      .createSignedUrls(list, Math.max(60, Math.min(7 * 24 * 3600, Number(expiresIn) || READ_TTL_SECONDS)));
    if (error || !Array.isArray(data)) throw error || new Error('signed_read_failed');
    const urls = {};
    for (const row of data) {
      if (row?.path && row?.signedUrl) urls[row.path] = row.signedUrl;
    }
    return urls;
  },

  /** Delete one teacher-owned object. Best-effort for callers. */
  async deleteObject({ key, teacherId }) {
    assertKeyOwnedByTeacher(key, teacherId);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(QUESTION_IMAGES_BUCKET).remove([key]);
    if (error) throw error;
    return { ok: true };
  },

  /**
   * Server-side object write (legacy migration only — browsers never use
   * this; they PUT direct to signed URLs). Bytes are decoded/fetched and
   * size-checked by the caller before reaching here.
   */
  async putObject({ key, teacherId, bytes, contentType = 'image/webp' }) {
    assertKeyOwnedByTeacher(key, teacherId);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(QUESTION_IMAGES_BUCKET)
      .upload(key, bytes, { contentType, upsert: false });
    if (error) throw error;
    return { ok: true, key };
  },

  /**
   * List owned object keys under the teacher's own folder (cleanup scans).
   * Bounded: at most 2000 keys — the free tier cannot hold more anyway.
   */
  async listObjects({ prefix, teacherId }) {
    assertPrefixOwned(prefix, teacherId);
    const supabase = getSupabaseAdmin();
    const keys = [];
    const PAGE = 1000;
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(QUESTION_IMAGES_BUCKET)
        .list(prefix, { limit: PAGE, offset });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        if (row?.name) keys.push(`${prefix}/${row.name}`);
        if (keys.length >= 2000) return keys;
      }
      if (rows.length < PAGE) return keys;
      offset += PAGE;
    }
  },
};
