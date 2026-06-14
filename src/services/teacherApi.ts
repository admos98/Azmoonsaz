import { getSupabasePublicClient } from '../lib/supabasePublic';
import { publicEnv } from '../config/env';
import { ApiError } from '../lib/apiClient';

export function isSecureTeacherModeAvailable(): boolean {
  return publicEnv.isSupabaseConfigured;
}

export async function getTeacherAccessToken(): Promise<string | null> {
  if (!isSecureTeacherModeAvailable()) return null;
  const supabase = getSupabasePublicClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function teacherRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getTeacherAccessToken();
  if (!token) throw new ApiError('missing_teacher_session', 401, null);

  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + token,
      ...(init.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : 'teacher_api_failed';
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
}

export async function teacherGet<T>(path: string): Promise<T> {
  return teacherRequest<T>(path, { method: 'GET' });
}

export async function teacherPost<T>(path: string, body: unknown): Promise<T> {
  return teacherRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
