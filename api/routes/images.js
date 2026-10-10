import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { safeError } from '../_lib/utils.js';
import {
  selectImageStore,
  mintImageKey,
  isImageStoreKey,
  collectImageKeys,
} from '../_lib/imageStore.js';

const MAX_READ_KEYS = 50;

/** POST /api/teacher/images/upload-url — mint one teacher-scoped PUT URL. */
export async function handleTeacherImageUploadUrl(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const rate = await checkRateLimit(`teacher-images-upload:${teacher.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  try {
    const body = req.body || {};
    const contentType = String(body.contentType || 'image/webp').trim() || 'image/webp';
    if (!['image/webp', 'image/jpeg', 'image/png'].includes(contentType)) {
      return json(res, 400, { error: 'unsupported_image_type' });
    }
    const key = mintImageKey(teacher.id);
    const { store } = await selectImageStore();
    const minted = await store.mintUploadUrl({ key, teacherId: teacher.id, contentType });
    return json(res, 200, { ok: true, ...minted });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json(res, status, safeError(error, 'image_upload_url_failed'));
  }
}

/** POST /api/teacher/images/read — batch-resolve owned keys to signed URLs. */
export async function handleTeacherImageRead(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const rate = await checkRateLimit(`teacher-images-read:${teacher.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  try {
    const body = req.body || {};
    const keys = Array.isArray(body.keys) ? body.keys.slice(0, MAX_READ_KEYS) : [];
    const owned = keys.filter(
      (key) => isImageStoreKey(key) && String(key).startsWith(`${teacher.id}/`),
    );
    if (owned.length === 0) return json(res, 200, { ok: true, urls: {} });
    const { store } = await selectImageStore();
    const urls = await store.mintReadUrl({ keys: owned, teacherId: teacher.id });
    return json(res, 200, { ok: true, urls });
  } catch (error) {
    return json(res, 500, safeError(error, 'image_read_failed'));
  }
}

/**
 * POST /api/teacher/images/cleanup — delete orphaned image objects.
 *
 * Reaps mint-then-abandon strays (drawer canceled, upload succeeded but the
 * question was never saved). Compares the teacher's own store prefix against
 * every key referenced by their current questions and deletes the difference.
 * Bounded: at most 200 objects per call — the teacher re-runs until
 * `deleted` comes back empty. Object failures are reported, never thrown.
 */
export async function handleTeacherImageCleanup(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const rate = await checkRateLimit(`teacher-images-cleanup:${teacher.id}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  try {
    const { store } = await selectImageStore();
    const stored =
      typeof store.listObjects === 'function'
        ? await store.listObjects({ prefix: teacher.id, teacherId: teacher.id })
        : [];
    // One full scan of this teacher's bodies (question counts are small; the
    // 2000-row cap matches the question-delete path).
    const referenced = new Set();
    const { data: all, error: allError } = await teacher.admin
      .from('questions')
      .select('body')
      .eq('teacher_id', teacher.id)
      .limit(2000);
    if (allError) throw allError;
    for (const row of all || []) for (const key of collectImageKeys(row?.body)) referenced.add(key);
    const orphaned = (Array.isArray(stored) ? stored : [])
      .filter((key) => isImageStoreKey(key) && !referenced.has(key))
      .slice(0, 200);
    const deleted = [];
    const failed = [];
    for (const key of orphaned) {
      try {
        await store.deleteObject({ key, teacherId: teacher.id });
        deleted.push(key);
      } catch (error) {
        failed.push(key);
        console.error('image_cleanup_failed', key, error?.message || error);
      }
    }
    return json(res, 200, { ok: true, deleted, failed, scanned: (stored || []).length });
  } catch (error) {
    return json(res, 500, safeError(error, 'image_cleanup_failed'));
  }
}
