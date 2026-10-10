import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecureExamPortal from '../../pages/student/SecureExamPortal';
import { persistExamSession } from '../../services/studentSessionStore';

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock('../../lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/apiClient')>();
  return { ...actual, apiPost: (...args: unknown[]) => mockApiPost(...args) };
});

const EXAM_CODE = 'DEMO7';

const payload = {
  ok: true,
  exam: {
    id: 'exam-1',
    examCode: EXAM_CODE,
    title: 'ریاضی',
    grade: 'هفتم',
    subject: 'ریاضی',
    status: 'active',
    mode: 'official',
    durationMinutes: 60,
  },
  session: { id: 'session-1', startedAt: new Date().toISOString() },
  student: { id: 'student-1', name: 'دانش‌آموز نمونه', grade: 'هفتم' },
  questions: [
    {
      id: 'q1',
      type: 'single_choice',
      title: 'سوال ۱',
      body: {
        text: 'متن سوال',
        options: [
          { id: 'A', text: 'گزینه الف' },
          { id: 'B', text: 'گزینه ب' },
        ],
      },
      points: 2,
    },
  ],
  savedAnswers: { q1: 'A' },
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  mockApiPost.mockReset();
});

describe('SecureExamPortal refresh recovery', () => {
  it('re-fetches the paper on mount and restores saved answers as selected', async () => {
    persistExamSession({
      token: 'token-abc',
      examCode: EXAM_CODE,
      exam: { title: 'ریاضی', subject: 'ریاضی' },
      student: { name: 'دانش‌آموز نمونه' },
    });
    mockApiPost.mockResolvedValue(payload);

    const { container } = render(
      <SecureExamPortal presetExamCode={EXAM_CODE} onBackToTeacher={() => {}} />,
    );

    // Paper loads without re-login: submit button only exists in take phase.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ارسال نهایی پاسخ‌ها/ })).toBeVisible();
    });
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/student/exam-payload',
      {},
      { Authorization: 'Bearer token-abc' },
    );
    // The previously saved option renders pressed.
    const pressed = container.querySelector('button[aria-pressed="true"]');
    expect(pressed?.textContent).toContain('گزینه الف');
  });

  it('falls back to login and clears storage when the persisted token is dead', async () => {
    persistExamSession({ token: 'dead-token', examCode: EXAM_CODE });
    const { ApiError } = await import('../../lib/apiClient');
    mockApiPost.mockRejectedValue(new ApiError('invalid_session', 401, {}));

    render(<SecureExamPortal presetExamCode={EXAM_CODE} onBackToTeacher={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('ورود امن دانش‌آموز')).toBeVisible();
    });
    expect(window.sessionStorage.length).toBe(0);
  });

  it('stays on login when there is no persisted session (no network call)', () => {
    render(<SecureExamPortal presetExamCode={EXAM_CODE} onBackToTeacher={() => {}} />);
    expect(screen.getByText('ورود امن دانش‌آموز')).toBeVisible();
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
