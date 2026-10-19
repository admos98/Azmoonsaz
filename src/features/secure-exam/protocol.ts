/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { ApiError } from '../../lib/apiClient';

/** The student never sees grading data — these are the server's safe shapes. */
export type Phase = 'login' | 'pin-setup' | 'ready' | 'take' | 'submitted';

// Wave B: Turnstile join check — renders only when the site key is deployed;
// the server enforces only when its secret is deployed (both or neither).
export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => void;
    };
  }
}

export type SafeExam = {
  id: string;
  examCode: string;
  title: string;
  grade: string;
  subject: string;
  status: string;
  mode: string;
  startsAt?: string;
  endsAt?: string;
  durationMinutes: number;
};

export type SafeStudent = { id: string; name: string; grade: string };

export type SafeQuestion = {
  id: string;
  type: string;
  title: string;
  body: {
    text?: string;
    imageUrl?: string;
    options?: { id: string; text: string; imageUrl?: string }[];
    parts?: {
      id: string;
      text: string;
      type: string;
      imageUrl?: string;
      options?: { id: string; text: string; imageUrl?: string }[];
    }[];
    displayPairs?: { left: string; right: string }[];
    displayItems?: string[];
    /** Non-secret fill-blank field count (correctFillBlanks stays server-side). */
    blankCount?: number;
  };
  points: number;
  sectionTitle?: string;
  position?: number;
};

export type StartResponse = {
  ok: boolean;
  token?: string;
  pinSetupRequired?: boolean;
  session?: { id: string; status: string; started_at: string; submitted_at?: string | null };
  exam?: SafeExam;
  student: SafeStudent;
};

export type PayloadResponse = {
  ok: boolean;
  exam: SafeExam;
  session: { id: string; startedAt: string };
  student?: SafeStudent | null;
  questions: SafeQuestion[];
  savedAnswers?: Record<string, unknown>;
};

/** Server error codes → Persian sentences the student can act on. */
export function friendlyApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.message;
    const map: Record<string, string> = {
      invalid_credentials: 'اطلاعات وارد شده معتبر نیست یا شما اجازه شرکت در این آزمون را ندارید.',
      invalid_exam_code: 'کد آزمون معتبر نیست.',
      exam_not_found: 'آزمونی با این کد پیدا نشد.',
      exam_not_open: 'این آزمون هنوز شروع نشده است.',
      exam_closed: 'زمان شرکت در این آزمون به پایان رسیده است.',
      exam_already_finalized: 'پاسخ شما قبلاً برای این آزمون ثبت نهایی شده است.',
      exam_time_expired: 'زمان آزمون شما به پایان رسیده است. پاسخ‌نامه را ثبت کنید.',
      not_allowed_for_exam: 'شما اجازه شرکت در این آزمون را ندارید.',
      too_many_requests: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
      session_not_active: 'نشست آزمون فعال نیست یا قبلاً ارسال شده است.',
      invalid_session: 'نشست آزمون نامعتبر است. دوباره وارد آزمون شوید.',
      exam_invalidated: 'شرکت شما در این آزمون مسدود شده است. برای پیگیری با دبیر تماس بگیرید.',
      turnstile_invalid: 'احراز هویت امنیتی تکمیل نشد. لطفاً دوباره تلاش کنید.',
    };
    return map[code] || 'خطایی در ارتباط با سرور رخ داد.';
  }
  return 'خطایی غیرمنتظره رخ داد.';
}
