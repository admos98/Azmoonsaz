/**
 * T7 — student PIN login flow:
 *  - the login form requires national ID + 6-digit PIN
 *  - first login (pinSetupRequired) shows the set-PIN screen with confirm
 *  - mismatched confirmations block locally with a Persian error
 *  - completed setup lands on the ready screen
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecureExamPortal from '../../pages/student/SecureExamPortal';

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock('../../lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/apiClient')>();
  return { ...actual, apiPost: (...args: unknown[]) => mockApiPost(...args) };
});

const EXAM_CODE = 'DEMO7';

const setupResponse = {
  ok: true,
  pinSetupRequired: true,
  student: { id: 'student-1', name: 'دانش‌آموز نمونه', grade: 'هفتم' },
};

const sessionResponse = {
  ok: true,
  token: 'token-abc',
  session: { id: 'session-1', status: 'ongoing', started_at: new Date().toISOString() },
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
  student: { id: 'student-1', name: 'دانش‌آموز نمونه', grade: 'هفتم' },
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  mockApiPost.mockReset();
});

async function fillLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('مثلاً 1000000001'), '1000000001');
  await user.type(screen.getByPlaceholderText('۶ رقم'), '123456');
}

describe('SecureExamPortal PIN login (T7)', () => {
  it('keeps the submit disabled until ID and 6-digit PIN are complete', async () => {
    const user = userEvent.setup();
    render(<SecureExamPortal presetExamCode={EXAM_CODE} onBackToTeacher={() => {}} />);
    const submit = screen.getByRole('button', { name: 'ورود امن به آزمون' });
    expect(submit).toBeDisabled();

    await fillLogin(user);
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('first login greets the student and shows the set-PIN screen', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue(setupResponse);
    render(<SecureExamPortal presetExamCode={EXAM_CODE} onBackToTeacher={() => {}} />);

    await fillLogin(user);
    await user.click(screen.getByRole('button', { name: 'ورود امن به آزمون' }));

    await waitFor(() => {
      expect(screen.getByText('سلام، دانش‌آموز نمونه')).toBeVisible();
    });
    expect(
      screen.getByRole('button', { name: 'ثبت رمز و ورود به آزمون' }),
    ).toBeVisible();
    // The PIN travels with the login attempt.
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/student/start-session',
      expect.objectContaining({ pin: '123456' }),
    );
  });

  it('mismatched confirmations block locally with a Persian error', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue(setupResponse);
    render(<SecureExamPortal presetExamCode={EXAM_CODE} onBackToTeacher={() => {}} />);

    await fillLogin(user);
    await user.click(screen.getByRole('button', { name: 'ورود امن به آزمون' }));
    await waitFor(() => {
      expect(screen.getByText('سلام، دانش‌آموز نمونه')).toBeVisible();
    });

    await user.type(screen.getByPlaceholderText('۶ رقم'), '123456');
    await user.type(screen.getByPlaceholderText('تکرار ۶ رقم'), '654321');
    await user.click(screen.getByRole('button', { name: 'ثبت رمز و ورود به آزمون' }));

    expect(
      await screen.findByText('رمز ۶ رقمی باید دقیقاً ۶ رقم باشد و تکرار آن یکسان باشد.'),
    ).toBeVisible();
    // One call only (the setup trigger) — the mismatch never hit the network.
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it('completed setup stores the session and lands on the ready screen', async () => {
    const user = userEvent.setup();
    mockApiPost
      .mockResolvedValueOnce(setupResponse)
      .mockResolvedValueOnce(sessionResponse);
    render(<SecureExamPortal presetExamCode={EXAM_CODE} onBackToTeacher={() => {}} />);

    await fillLogin(user);
    await user.click(screen.getByRole('button', { name: 'ورود امن به آزمون' }));
    await waitFor(() => {
      expect(screen.getByText('سلام، دانش‌آموز نمونه')).toBeVisible();
    });

    await user.type(screen.getByPlaceholderText('۶ رقم'), '123456');
    await user.type(screen.getByPlaceholderText('تکرار ۶ رقم'), '123456');
    await user.click(screen.getByRole('button', { name: 'ثبت رمز و ورود به آزمون' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'دریافت سوالات و شروع آزمون' }),
      ).toBeVisible();
    });
    // Setup confirmation travels with its repeat.
    expect(mockApiPost).toHaveBeenLastCalledWith(
      '/api/student/start-session',
      expect.objectContaining({ pin: '123456', pinConfirm: '123456' }),
    );
  });
});
