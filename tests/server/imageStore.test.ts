/**
 * Image store interface: key validation, selection fallback, URL substitution.
 * No network, no Supabase — pure function coverage plus selectImageStore
 * fallback behavior (dynamic imports resolved against real drivers).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  IMAGE_KEY_PATTERN,
  isImageStoreKey,
  isLegacyImageValue,
  mintImageKey,
  collectImageKeys,
  substituteImageUrls,
  removeImageKeys,
  selectImageStore,
} from '../../api/_lib/imageStore.js';

const TEACHER_A = '11111111-1111-4111-8111-111111111111';
const TEACHER_B = '22222222-2222-4222-8222-222222222222';
const KEY_A = `${TEACHER_A}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;

beforeEach(() => {
  vi.resetModules();
  delete process.env.IMAGE_STORE_PROVIDER;
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_ACCESS_KEY;
  delete process.env.S3_SECRET_KEY;
  delete process.env.S3_BUCKET;
});

afterEach(() => {
  delete process.env.IMAGE_STORE_PROVIDER;
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_ACCESS_KEY;
  delete process.env.S3_SECRET_KEY;
  delete process.env.S3_BUCKET;
});

describe('isImageStoreKey', () => {
  it('accepts minted keys', () => {
    expect(isImageStoreKey(mintImageKey(TEACHER_A))).toBe(true);
    expect(isImageStoreKey(KEY_A)).toBe(true);
  });

  it('rejects URLs, base64, and path tricks', () => {
    expect(isImageStoreKey('')).toBe(false);
    expect(isImageStoreKey(undefined)).toBe(false);
    expect(isImageStoreKey('https://example.com/x.webp')).toBe(false);
    expect(isImageStoreKey('data:image/png;base64,AAA')).toBe(false);
    expect(isImageStoreKey(`${TEACHER_A}/img.png`)).toBe(false);
    expect(isImageStoreKey(`${TEACHER_A}/../x.webp`)).toBe(false);
    expect(isImageStoreKey(`${TEACHER_B}/${KEY_A.split('/')[1]}`)).toBe(true); // shape ok, owner checked elsewhere
    expect(IMAGE_KEY_PATTERN.test(`${TEACHER_A}/short.webp`)).toBe(false);
  });
});

describe('isLegacyImageValue', () => {
  it('flags base64 and external URLs, ignores keys and blanks', () => {
    expect(isLegacyImageValue('data:image/png;base64,AAA')).toBe(true);
    expect(isLegacyImageValue('https://images.unsplash.com/x')).toBe(true);
    expect(isLegacyImageValue('http://example.com/x.png')).toBe(true);
    expect(isLegacyImageValue(KEY_A)).toBe(false);
    expect(isLegacyImageValue('')).toBe(false);
    expect(isLegacyImageValue(undefined)).toBe(false);
  });
});

describe('mintImageKey', () => {
  it('scopes keys to the teacher with a .webp suffix', () => {
    const key = mintImageKey(TEACHER_A);
    expect(key.startsWith(`${TEACHER_A}/`)).toBe(true);
    expect(key.endsWith('.webp')).toBe(true);
    expect(mintImageKey(TEACHER_A)).not.toBe(mintImageKey(TEACHER_A));
  });
});

describe('collectImageKeys', () => {
  it('collects main, option, and part keys without duplicates', () => {
    const optKey = `${TEACHER_A}/11111111-1111-4111-8111-111111111111.webp`;
    const partKey = `${TEACHER_A}/22222222-2222-4222-8222-222222222222.webp`;
    const partOptKey = `${TEACHER_A}/33333333-3333-4333-8333-333333333333.webp`;
    const body = {
      imageUrl: KEY_A,
      options: [{ id: 'o1', imageUrl: optKey }, { id: 'o2', imageUrl: optKey }, { id: 'o3' }],
      parts: [
        { id: 'p1', imageUrl: partKey, options: [{ id: 'po1', imageUrl: partOptKey }] },
        { id: 'p2' },
      ],
    };
    expect(collectImageKeys(body)).toEqual([KEY_A, optKey, partKey, partOptKey]);
  });

  it('ignores legacy URLs and non-objects', () => {
    expect(
      collectImageKeys({
        imageUrl: 'https://example.com/x.png',
        options: [{ imageUrl: 'data:image/png;base64,A' }],
      }),
    ).toEqual([]);
    expect(collectImageKeys(null)).toEqual([]);
    expect(collectImageKeys('nope')).toEqual([]);
  });
});

describe('substituteImageUrls', () => {
  it('swaps known keys, passes legacy values through untouched', () => {
    const legacy = 'https://example.com/legacy.png';
    const question = {
      id: 'q1',
      body: {
        text: 't',
        imageUrl: KEY_A,
        options: [{ id: 'o1', imageUrl: KEY_A }, { id: 'o2', imageUrl: legacy }],
        parts: [{ id: 'p1', imageUrl: KEY_A, options: [] }],
      },
    };
    const out = substituteImageUrls(question, { [KEY_A]: 'https://signed/x' });
    expect(out.body.imageUrl).toBe('https://signed/x');
    expect(out.body.options[0].imageUrl).toBe('https://signed/x');
    expect(out.body.options[1].imageUrl).toBe(legacy);
    expect(out.body.parts[0].imageUrl).toBe('https://signed/x');
    // Input not mutated.
    expect(question.body.imageUrl).toBe(KEY_A);
  });
});

describe('removeImageKeys', () => {
  it('strips keys at every level while preserving legacy URLs', () => {
    const legacy = 'https://example.com/legacy.png';
    const out = removeImageKeys({
      id: 'q1',
      body: {
        text: 't',
        imageUrl: KEY_A,
        options: [{ id: 'o1', imageUrl: KEY_A }, { id: 'o2', imageUrl: legacy }, { id: 'o3' }],
        parts: [
          { id: 'p1', imageUrl: KEY_A, options: [{ id: 'po1', imageUrl: KEY_A }] },
          { id: 'p2', text: 'no image key at all' },
        ],
      },
    });
    expect(out.body.imageUrl).toBeUndefined();
    expect(out.body.options[0].imageUrl).toBeUndefined();
    expect(out.body.options[1].imageUrl).toBe(legacy);
    expect(out.body.options[2].imageUrl).toBeUndefined();
    expect(out.body.parts[0].imageUrl).toBeUndefined();
    expect(out.body.parts[0].options[0].imageUrl).toBeUndefined();
    expect(out.body.parts[1].text).toBe('no image key at all');
  });

  it('handles bodies without any imageUrl field', () => {
    const out = removeImageKeys({
      id: 'q1',
      body: { text: 't', options: [{ id: 'o1', text: 'a' }] },
    });
    expect(out.body.options).toEqual([{ id: 'o1', text: 'a' }]);
  });
});

describe('selectImageStore', () => {
  it('defaults to supabase with no env', async () => {
    const { name } = await selectImageStore();
    expect(name).toBe('supabase');
  });

  it('falls back to supabase when s3 is requested but incomplete', async () => {
    process.env.IMAGE_STORE_PROVIDER = 's3';
    process.env.S3_ENDPOINT = 'https://s3.example.com';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { name } = await selectImageStore();
      expect(name).toBe('supabase');
      expect(err).toHaveBeenCalledTimes(1);
    } finally {
      err.mockRestore();
    }
  });

  it('stays on supabase for unknown provider names', async () => {
    process.env.IMAGE_STORE_PROVIDER = 'gcs';
    const { name } = await selectImageStore();
    expect(name).toBe('supabase');
  });

  it('selects s3 when fully configured (ownership still enforced before signing)', async () => {
    process.env.IMAGE_STORE_PROVIDER = 's3';
    process.env.S3_ENDPOINT = 'https://s3.example.com';
    process.env.S3_ACCESS_KEY = 'AKID';
    process.env.S3_SECRET_KEY = 'SECRET';
    process.env.S3_BUCKET = 'examforge-images';
    const { name, store } = await selectImageStore();
    expect(name).toBe('s3');
    // Ownership gate fires before any network: wrong-teacher key rejected.
    await expect(
      store.mintUploadUrl({ key: `${TEACHER_B}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`, teacherId: TEACHER_A }),
    ).rejects.toThrow('image_not_owned');
  });

  it('supabase driver enforces shape and ownership before touching the network', async () => {
    const { store } = await selectImageStore();
    await expect(store.mintUploadUrl({ key: 'https://evil/x', teacherId: TEACHER_A })).rejects.toThrow(
      'invalid_image_key',
    );
    await expect(
      store.mintUploadUrl({ key: `${TEACHER_B}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`, teacherId: TEACHER_A }),
    ).rejects.toThrow('image_not_owned');
    // Unowned keys are filtered, never signed.
    expect(await store.mintReadUrl({ keys: ['https://evil/x'], teacherId: TEACHER_A })).toEqual({});
  });
});

describe('questionToBody image gate', () => {
  it('accepts storage keys on create, rejects base64 and external URLs', async () => {
    const { questionToBody } = await import('../../api/_lib/utils.js');
    const withKey = questionToBody({ text: 't', imageUrl: KEY_A, options: [] }, null);
    expect(withKey.imageUrl).toBe(KEY_A);
    expect(() => questionToBody({ text: 't', imageUrl: 'data:image/png;base64,A' }, null)).toThrow(
      'image_must_be_uploaded',
    );
    expect(() => questionToBody({ text: 't', imageUrl: 'https://example.com/x.png' }, null)).toThrow(
      'image_must_be_uploaded',
    );
  });

  it('rejects foreign storage keys with image_not_owned', async () => {
    const { questionToBody } = await import('../../api/_lib/utils.js');
    const foreign = '22222222-2222-4222-8222-222222222222/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp';
    expect(() => questionToBody({ text: 't', imageUrl: foreign }, null, 'teacher-a')).toThrow(
      'image_not_owned',
    );
    // A well-formed key with no teacher scope keeps shape-only behavior:
    // any syntactically valid key passes (ownership binds at the handler).
    const anyKey = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp';
    expect(questionToBody({ text: 't', imageUrl: anyKey }, null).imageUrl).toBe(anyKey);
  });

  it('persists blankCount for fill-blank without leaking the key', async () => {
    const { questionToBody } = await import('../../api/_lib/utils.js');
    const body = questionToBody(
      { type: 'fill_blank', text: 't', correctFillBlanks: ['a', 'b', 'c'] },
      null,
    );
    expect(body.blankCount).toBe(3);
    expect(JSON.stringify(body)).not.toContain('correctFillBlanks');
  });

  it('grandfathers byte-identical legacy values on update', async () => {
    const { questionToBody } = await import('../../api/_lib/utils.js');
    const legacy = 'https://example.com/kept.png';
    const kept = questionToBody({ text: 't', imageUrl: legacy }, { imageUrl: legacy });
    expect(kept.imageUrl).toBe(legacy);
    expect(() =>
      questionToBody({ text: 't', imageUrl: 'https://example.com/changed.png' }, { imageUrl: legacy }),
    ).toThrow('image_must_be_uploaded');
  });

  it('validates option and part images per id', async () => {
    const { questionToBody } = await import('../../api/_lib/utils.js');
    const prev = {
      options: [{ id: 'o1', imageUrl: 'https://example.com/kept.png' }],
      parts: [{ id: 'p1', imageUrl: KEY_A, options: [] }],
    };
    const kept = questionToBody(
      {
        text: 't',
        options: [{ id: 'o1', text: 'a', imageUrl: 'https://example.com/kept.png' }],
        parts: [{ id: 'p1', text: 'p', imageUrl: KEY_A, options: [] }],
      },
      prev,
    );
    expect(kept.options[0].imageUrl).toBe('https://example.com/kept.png');
    expect(() =>
      questionToBody(
        { text: 't', options: [{ id: 'o1', text: 'a', imageUrl: 'data:image/png;base64,A' }] },
        prev,
      ),
    ).toThrow('image_must_be_uploaded');
  });
});
