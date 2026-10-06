/**
 * BE-1 — bulk student import endpoint, plus its BE-6 guards (per-teacher rate
 * limit, bounded batch, every row accounted for).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { handleTeacherStudentsBulk } from '../../api/routes/teacher.js';
import { createAdmin, createReq, createRes, type TableConfig } from './helpers.js';

vi.mock('../../api/_lib/teacherAuth.js', () => ({
  requireTeacher: vi.fn(),
}));
vi.mock('../../api/_lib/rateLimit.js', () => ({
  checkRateLimit: vi.fn(),
}));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = 'a1b2c3d4-1111-4222-9a44-445555666666';

/** Valid Iranian national IDs (checksum-correct). */
const ID_1 = '0000000019';
const ID_2 = '1234567891';
const ID_3 = '9876543210';

interface InsertedRow {
  full_name: string;
  grade: string;
  national_id_hash: string;
  national_id_last4: string;
  class_group_id: string;
}

const inserted: InsertedRow[] = [];

function studentsTable(duplicateNames: string[] = []): TableConfig {
  return {
    onResult: (ctx) => {
      if (ctx.op !== 'insert') return undefined;
      const payload = ctx.payload as unknown as InsertedRow & { id?: string };
      if (duplicateNames.includes(payload.full_name)) {
        return { error: { code: '23505', message: 'duplicate key value' } };
      }
      inserted.push(payload);
      return {
        data: {
          id: `student-${inserted.length}`,
          full_name: payload.full_name,
          grade: payload.grade,
          class_group_id: payload.class_group_id,
          national_id_last4: payload.national_id_last4,
          status: 'active',
          created_at: '2026-06-15T00:00:00.000Z',
        },
        error: null,
      };
    },
  };
}

function makeAdmin(options: { duplicateNames?: string[]; classLookupFails?: boolean } = {}) {
  const classConfig: TableConfig = options.classLookupFails
    ? {
        onResult: () => ({ error: { message: 'class lookup failed' } }),
      }
    : { single: { id: CLASS_ID } };

  return createAdmin({
    students: studentsTable(options.duplicateNames || []),
    class_groups: classConfig,
  });
}

function setTeacher(admin: ReturnType<typeof createAdmin>) {
  vi.mocked(requireTeacher).mockResolvedValue({
    id: TEACHER_ID,
    email: 'teacher@example.com',
    admin,
  } as unknown as Teacher);
}

async function call(body: unknown, admin = makeAdmin()) {
  setTeacher(admin);
  const res = createRes();
  await handleTeacherStudentsBulk(
    createReq({ method: 'POST', body }) as never,
    res as never,
  );
  return { res, body: res.body as Record<string, never>, admin };
}

const row = (over: Record<string, unknown> = {}) => ({
  name: 'سارا محمدی',
  nationalId: ID_1,
  grade: 'هفتم',
  classGroupId: CLASS_ID,
  ...over,
});

beforeEach(() => {
  vi.mocked(requireTeacher).mockReset();
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({
    ok: true,
    limit: 10,
    remaining: 9,
    resetAt: Date.now() + 60_000,
  });
  inserted.length = 0;
  // Deterministic hashing regardless of what the developer's .env.local has.
  process.env.STUDENT_ID_PEPPER = 'test-pepper-'.padEnd(64, '0');
});

describe('POST /api/teacher/students/bulk', () => {
  it('imports every valid row in one request', async () => {
    const { res, body } = await call({
      students: [
        { row: 2, ...row() },
        { row: 3, ...row({ name: 'علی رضایی', nationalId: ID_2 }) },
      ],
    });

    expect(res.statusCode).toBe(200);
    expect((body as unknown as { importedCount: number }).importedCount).toBe(2);
    expect((body as unknown as { failed: unknown[] }).failed).toEqual([]);
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({ class_group_id: CLASS_ID, grade: 'هفتم' });
  });

  it('stores only the hash and last four digits — never the plain national ID', async () => {
    const { body } = await call({ students: [{ row: 2, ...row({ nationalId: ID_3 }) }] });
    const payload = JSON.stringify(body);
    // The full ID must exist nowhere in the response…
    expect(payload).not.toContain(ID_3);
    const result = body as unknown as {
      imported: { nationalId: string; maskedNationalId: string }[];
    };
    // …and the canonical student shape keeps it empty behind a masked value.
    expect(result.imported[0].nationalId).toBe('');
    expect(result.imported[0].maskedNationalId).toBe('***3210');
    expect(inserted[0].national_id_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(inserted[0].national_id_last4).toBe(ID_3.slice(-4));
  });

  it('accounts for every rejected row with its number and reason', async () => {
    const { res, body } = await call({
      students: [
        { row: 2, ...row({ name: '' }) },
        { row: 3, ...row({ nationalId: '123' }) },
        { row: 4, ...row({ name: 'مریم' }) },
      ],
    });
    const result = body as unknown as {
      importedCount: number;
      failedCount: number;
      failed: { row: number; reason: string }[];
    };

    expect(res.statusCode).toBe(200);
    expect(result.importedCount).toBe(1);
    expect(result.failedCount).toBe(2);
    expect(result.failed).toEqual([
      { row: 2, reason: 'missing_student_name' },
      { row: 3, reason: 'invalid_national_id' },
    ]);
    // Nothing is silently dropped: successes + failures = rows sent.
    expect(result.importedCount + result.failedCount).toBe(3);
  });

  it('reports a duplicate as duplicate_student instead of failing the batch', async () => {
    const admin = makeAdmin({ duplicateNames: ['سارا محمدی'] });
    const { res, body } = await call(
      { students: [{ row: 2, ...row() }, { row: 3, ...row({ name: 'علی', nationalId: ID_2 }) }] },
      admin,
    );
    const result = body as unknown as {
      importedCount: number;
      failed: { row: number; reason: string }[];
    };

    expect(res.statusCode).toBe(200);
    expect(result.importedCount).toBe(1);
    expect(result.failed).toEqual([{ row: 2, reason: 'duplicate_student' }]);
    expect(inserted).toHaveLength(1);
  });

  it('reports class-not-found when the class group cannot be resolved', async () => {
    const admin = makeAdmin({ classLookupFails: true });
    const { body } = await call({ students: [{ row: 2, ...row() }] }, admin);
    const result = body as unknown as { importedCount: number; failed: { reason: string }[] };

    expect(result.importedCount).toBe(0);
    expect(result.failed[0].reason).toBe('class_not_found');
  });

  it('rejects a missing or empty batch with 400', async () => {
    expect((await call({})).res.statusCode).toBe(400);
    expect((await call({ students: [] })).res.statusCode).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it('rejects batches over the 500-row cap', async () => {
    const students = Array.from({ length: 501 }, () => row());
    const { res, body } = await call({ students });
    expect(res.statusCode).toBe(400);
    expect(body).toEqual({ error: 'too_many_students' });
    expect(inserted).toHaveLength(0);
  });

  it('rate limits the endpoint per teacher and writes nothing when limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, limit: 10, remaining: 0, resetAt: Date.now() + 60_000 });
    const { res, body } = await call({ students: [{ row: 2, ...row() }] });

    expect(res.statusCode).toBe(429);
    expect(body).toEqual({ error: 'rate_limited' });
    expect(checkRateLimit).toHaveBeenCalledWith(
      `students-bulk:${TEACHER_ID}`,
      expect.objectContaining({ limit: expect.any(Number), windowMs: 60_000 }),
    );
    expect(inserted).toHaveLength(0);
  });

  it('refuses non-POST with 405', async () => {
    setTeacher(makeAdmin());
    const res = createRes();
    await handleTeacherStudentsBulk(createReq({ method: 'GET' }) as never, res as never);
    expect(res.statusCode).toBe(405);
  });
});
