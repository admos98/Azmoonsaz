import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { safeError } from '../_lib/utils.js';
import {
  selectImageStore,
  mintImageKey,
  isImageStoreKey,
  isLegacyImageValue,
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

const MIGRATE_MAX_BYTES = 1024 * 1024;
const MIGRATE_MAX_PER_CALL = 10;
const MIGRATE_FETCH_TIMEOUT_MS = 15_000;

/** Decode a `data:image/...;base64,...` URL to bytes + content type. */
function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUrl || '').slice(0, 8 * 1024 * 1024),
  );
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length === 0 || bytes.length > MIGRATE_MAX_BYTES) return null;
    return { bytes, contentType: match[1] === 'image/jpeg' ? 'image/jpeg' : match[1] };
  } catch {
    return null;
  }
}

/** Fetch an external https image to bytes (SSRF-guarded, bounded). */
async function fetchExternalImage(url) {
  // SSRF guard: public https only — no localhost, LAN, metadata endpoints.
  // Applied per redirect hop below (not just the initial URL): a public host
  // that 302s to 169.254.169.254 or a resolved private IP is rejected.
  const isPublicHttpUrl = (parsed) => {
    if (!(parsed instanceof URL)) return false;
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const port = parsed.port ? Number(parsed.port) : 443;
    if (!Number.isFinite(port) || port < 1 || port > 65535) return false;
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (
      host.length === 0 ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === 'metadata.google.internal' ||
      host === 'metadata.google.com' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === '169.254.169.254' ||
      host === 'metadata' ||
      host === '[::1]' ||
      host === '::1' ||
      /^0\.0\.0\.0$/.test(host) ||
      /^127\./.test(host) ||
      /^0\./.test(host) ||
      // IPv6 loopback / link-local / unique-local / mapped-private ranges.
      /^(::1|fe80:|fc00:|fd00:|::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.))/.test(
        host.replace(/^\[|\]$/g, ''),
      )
    ) {
      return false;
    }
    return true;
  };
  // DNS-rebinding guard: the hostname must not resolve to a private,
  // loopback, or link-local IP. Checked on the initial host AND every
  // redirect target — resolving is the only thing a redirect check alone
  // cannot see.
  const resolvesPublic = async (hostname) => {
    try {
      const { lookup } = await import('node:dns/promises');
      const records = await lookup(hostname.replace(/^\[|\]$/g, ''), { all: true });
      if (!records || records.length === 0) return false;
      for (const record of records) {
        const ip = String(record.address || '');
        const fake = new URL(`https://${ip === '::1' ? '[::1]' : ip}/`);
        // Reuse the literal-IP denylist by stuffing the IP into a URL.
        const host = fake.hostname.toLowerCase().replace(/\.$/, '');
        if (
          host === 'localhost' ||
          /^10\./.test(host) ||
          /^192\.168\./.test(host) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
          host === '169.254.169.254' ||
          /^127\./.test(host) ||
          /^0\./.test(host) ||
          /^(::1|fe80:|fc00:|fd00:|::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.))/.test(
            host.replace(/^\[|\]$/g, ''),
          )
        ) {
          return false;
        }
      }
      return true;
    } catch {
      // Unresolvable host — fail closed.
      return false;
    }
  };
  let current;
  try {
    current = new URL(String(url));
  } catch {
    return null;
  }
  // Manual redirect chain (max 5): fetch with redirect:'manual' so EVERY hop
  // is validated before following — fetch's built-in 'follow' would chase a
  // 302 to an internal address without re-checking.
  for (let hop = 0; hop < 6; hop++) {
    if (!isPublicHttpUrl(current)) return null;
    if (!(await resolvesPublic(current.hostname))) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MIGRATE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: 'manual',
      });
      if (response.status >= 300 && response.status < 400) {
        if (hop === 5) return null;
        const location = response.headers.get('location');
        if (!location) return null;
        try {
          current = new URL(location, current.toString());
        } catch {
          return null;
        }
        continue;
      }
      if (!response.ok) return null;
      const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim();
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType))
        return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MIGRATE_MAX_BYTES) return null;
      return { bytes: buffer, contentType };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Collect every legacy image value in a body with its JSON path. */
function collectLegacyImagePaths(body, base = []) {
  const found = [];
  const push = (holder, field, path) => {
    const value = holder?.[field];
    if (isLegacyImageValue(value) && !isImageStoreKey(value)) found.push({ holder, field, path });
  };
  if (!body || typeof body !== 'object') return found;
  push(body, 'imageUrl', [...base, 'imageUrl']);
  for (const [oi, option] of (Array.isArray(body.options) ? body.options : []).entries()) {
    push(option, 'imageUrl', [...base, 'options', oi, 'imageUrl']);
  }
  for (const [pi, part] of (Array.isArray(body.parts) ? body.parts : []).entries()) {
    push(part, 'imageUrl', [...base, 'parts', pi, 'imageUrl']);
    for (const [oi, option] of (Array.isArray(part?.options) ? part.options : []).entries()) {
      push(option, 'imageUrl', [...base, 'parts', pi, 'options', oi, 'imageUrl']);
    }
  }
  return found;
}

/**
 * POST /api/teacher/images/migrate — move legacy images into the store.
 *
 * Grandfathered `data:`/external rows render remote pixels (IP/timing leak
 * to the image host). This endpoint fetches/decodes each legacy value
 * server-side (SSRF-guarded, 1 MB cap), stores it under a fresh teacher-scoped
 * key, and rewrites the question body to that key — so CSP `img-src` can
 * later drop bare `https:`/`data:` for question images.
 *
 * Bounded: 10 values per call, own questions only. Reports migrated/skipped
 * (with reasons) per value; failures never fail sibling migrations.
 */
export async function handleTeacherImageMigrate(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const rate = await checkRateLimit(`teacher-images-migrate:${teacher.id}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  try {
    const { store } = await selectImageStore();
    if (typeof store.putObject !== 'function') {
      return json(res, 500, { error: 'image_store_no_migrate' });
    }
    const { data: rows, error } = await teacher.admin
      .from('questions')
      .select('id, body')
      .eq('teacher_id', teacher.id)
      .limit(2000);
    if (error) throw error;
    const migrated = [];
    const skipped = [];
    let budget = MIGRATE_MAX_PER_CALL;
    for (const row of rows || []) {
      if (budget <= 0) break;
      const paths = collectLegacyImagePaths(row?.body);
      if (paths.length === 0) continue;
      let dirty = false;
      // Deep-clone the body once; rewrite keys in place as values migrate.
      const nextBody = JSON.parse(JSON.stringify(row.body));
      const locate = (path) => {
        let node = nextBody;
        for (let i = 0; i < path.length - 1; i++) node = node?.[path[i]];
        return node && typeof node === 'object' ? node : null;
      };
      for (const { path } of paths) {
        if (budget <= 0) break;
        const holder = locate(path);
        const legacyValue = holder?.[path[path.length - 1]];
        if (!isLegacyImageValue(legacyValue)) continue;
        budget--;
        const decoded = String(legacyValue).startsWith('data:')
          ? decodeDataUrl(legacyValue)
          : await fetchExternalImage(legacyValue);
        if (!decoded) {
          skipped.push({ questionId: row.id, path: path.join('.'), reason: 'unfetchable_or_too_large' });
          continue;
        }
        const key = mintImageKey(teacher.id);
        try {
          await store.putObject({
            key,
            teacherId: teacher.id,
            bytes: decoded.bytes,
            contentType: decoded.contentType,
          });
        } catch (storeError) {
          skipped.push({ questionId: row.id, path: path.join('.'), reason: 'store_write_failed' });
          console.error('image_migrate_store_failed', key, storeError?.message || storeError);
          continue;
        }
        holder[path[path.length - 1]] = key;
        dirty = true;
        migrated.push({ questionId: row.id, path: path.join('.'), key });
      }
      if (dirty) {
        const { error: updateError } = await teacher.admin
          .from('questions')
          .update({ body: nextBody })
          .eq('id', row.id)
          .eq('teacher_id', teacher.id);
        if (updateError) {
          // Body rewrite failed — the stored objects become orphans for the
          // cleanup sweep; report honestly rather than claiming migration.
          for (const m of migrated.filter((m) => m.questionId === row.id)) {
            try {
              await store.deleteObject({ key: m.key, teacherId: teacher.id });
            } catch {
              /* orphan sweep reaps it */
            }
          }
          skipped.push({ questionId: row.id, path: '(body)', reason: 'body_rewrite_failed' });
        }
      }
    }
    return json(res, 200, { ok: true, migrated, skipped });
  } catch (error) {
    return json(res, 500, safeError(error, 'image_migrate_failed'));
  }
}
