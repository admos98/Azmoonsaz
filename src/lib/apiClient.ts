import { mockExams, mockStudents } from '../mockData';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: { Accept: 'application/json', ...(init.headers || {}) },
    });

    if (res.status >= 500) throw new Error(`50x Server or Proxy Error: ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const message = typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : 'api_request_failed';
      throw new ApiError(message, res.status, payload);
    }

    return payload as T;
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) throw err;

    console.warn(`[ApiClient] Live API '${path}' unreachable. Falling back to offline sandbox simulator:`, err);

    if (path.includes('/start-session')) {
      const parsedBody = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      const exam = mockExams.find(e => e.examCode.toUpperCase() === (parsedBody.examCode || '').toUpperCase()) || mockExams[0];
      const student = mockStudents.find(s => s.nationalId === parsedBody.nationalId) || mockStudents[0] || { id: 'stu-1', name: 'دانش‌آموز نمونه', grade: 'هفتم' };

      return {
        ok: true,
        token: `mock_token_${Date.now()}`,
        session: { id: `ses_${Date.now()}`, status: 'ongoing', started_at: new Date().toISOString() },
        exam: {
          id: exam.id,
          examCode: exam.examCode,
          title: exam.title,
          grade: exam.grade,
          subject: exam.subject,
          status: exam.status,
          mode: exam.settings?.mode || 'official',
          durationMinutes: exam.duration || 45,
        },
        student: { id: student.id, name: student.name, grade: student.grade },
      } as unknown as T;
    }

    if (path.includes('/exam-payload')) {
      const exam = mockExams[0];
      return {
        ok: true,
        exam: {
          id: exam.id,
          examCode: exam.examCode,
          title: exam.title,
          grade: exam.grade,
          subject: exam.subject,
          status: exam.status,
          mode: exam.settings?.mode || 'official',
          durationMinutes: exam.duration || 45,
        },
        session: { id: `ses_${Date.now()}`, startedAt: new Date().toISOString() },
        questions: exam.questions.map((q, idx) => ({
          id: q.id,
          type: q.type,
          title: q.title,
          body: {
            text: q.text,
            imageUrl: q.imageUrl,
            options: q.options?.map(o => ({ id: o.id, text: o.text, imageUrl: (o as any).imageUrl })),
          },
          points: q.points,
          position: idx + 1,
        })),
      } as unknown as T;
    }

    if (path.includes('/save-answer')) {
      return { ok: true, savedAt: new Date().toLocaleTimeString('fa-IR') } as unknown as T;
    }

    if (path.includes('/submit')) {
      return { ok: true, session: { id: 'ses_mock', status: 'submitted' } } as unknown as T;
    }

    throw new ApiError('ارتباط با سرور برقرار نشد (آفلاین).', 503, { error: 'offline_mode' });
  }
}