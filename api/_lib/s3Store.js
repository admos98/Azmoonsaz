/**
 * S3-compatible driver for the image-store interface (Parspack, ArvanCloud,
 * or any SigV4 S3 endpoint).
 *
 * DORMANT until fully configured: selectImageStore() only reaches this
 * driver when IMAGE_STORE_PROVIDER=s3 AND all four S3_* variables are set.
 * No key in Vercel = this file never executes.
 *
 * Same contract as the Supabase driver: opaque `<teacherUuid>/<uuid>.webp`
 * keys, presigned PUT for upload, presigned GET for download, teacher-scoped
 * keys enforced before signing anything.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isImageStoreKey } from './imageStore.js';

const UPLOAD_TTL_SECONDS = 15 * 60;
const READ_TTL_SECONDS = 60 * 60;

let client = null;

function config() {
  const endpoint = String(process.env.S3_ENDPOINT || '').trim().replace(/\/+$/, '');
  const accessKeyId = String(process.env.S3_ACCESS_KEY || '').trim();
  const secretAccessKey = String(process.env.S3_SECRET_KEY || '').trim();
  const bucket = String(process.env.S3_BUCKET || '').trim();
  const region = String(process.env.S3_REGION || 'default').trim() || 'default';
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false';
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('image_store_not_configured: S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET');
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket, region, forcePathStyle };
}

function getClient() {
  if (client) return { client, bucket: config().bucket };
  const { endpoint, accessKeyId, secretAccessKey, bucket, region, forcePathStyle } = config();
  client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

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

export const s3ImageStore = {
  name: 's3',

  async mintUploadUrl({ key, teacherId, contentType = 'image/webp' }) {
    assertKeyOwnedByTeacher(key, teacherId);
    const { client: s3, bucket } = getClient();
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_TTL_SECONDS },
    );
    // S3 presigned PUT is complete in the URL — raw PUT with Content-Type.
    // uploadToken stays null so the browser takes the raw-PUT branch.
    return { uploadUrl, uploadToken: null, key, expiresIn: UPLOAD_TTL_SECONDS, contentType };
  },

  async mintReadUrl({ keys, teacherId, expiresIn = READ_TTL_SECONDS }) {
    const list = (Array.isArray(keys) ? keys : [keys]).filter((key) => {
      try {
        assertKeyOwnedByTeacher(key, teacherId);
        return true;
      } catch {
        return false;
      }
    });
    if (list.length === 0) return {};
    const { client: s3, bucket } = getClient();
    const ttl = Math.max(60, Math.min(7 * 24 * 3600, Number(expiresIn) || READ_TTL_SECONDS));
    const urls = {};
    for (const key of list) {
      urls[key] = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: ttl,
      });
    }
    return urls;
  },

  async mintReadUrlUnchecked({ keys, expiresIn = READ_TTL_SECONDS }) {
    const list = (Array.isArray(keys) ? keys : [keys]).filter(isImageStoreKey);
    if (list.length === 0) return {};
    const { client: s3, bucket } = getClient();
    const ttl = Math.max(60, Math.min(7 * 24 * 3600, Number(expiresIn) || READ_TTL_SECONDS));
    const urls = {};
    for (const key of list) {
      urls[key] = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: ttl,
      });
    }
    return urls;
  },

  async deleteObject({ key, teacherId }) {
    assertKeyOwnedByTeacher(key, teacherId);
    const { client: s3, bucket } = getClient();
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return { ok: true };
  },

  /**
   * Server-side object write (legacy migration only — browsers never use
   * this; they PUT direct to signed URLs).
   */
  async putObject({ key, teacherId, bytes, contentType = 'image/webp' }) {
    assertKeyOwnedByTeacher(key, teacherId);
    const { client: s3, bucket } = getClient();
    await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
    return { ok: true, key };
  },

  /**
   * List owned object keys under the teacher's own folder (cleanup scans).
   * Bounded: at most 2000 keys.
   */
  async listObjects({ prefix, teacherId }) {
    assertPrefixOwned(prefix, teacherId);
    const { client: s3, bucket } = getClient();
    const keys = [];
    let token;
    for (;;) {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `${prefix}/`,
          MaxKeys: 1000,
          ContinuationToken: token,
        }),
      );
      for (const obj of page?.Contents || []) {
        if (obj?.Key) keys.push(obj.Key);
        if (keys.length >= 2000) return keys;
      }
      if (!page?.IsTruncated) return keys;
      token = page.NextContinuationToken;
    }
  },
};
