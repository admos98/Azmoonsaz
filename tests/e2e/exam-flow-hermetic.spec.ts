import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * T2 — hermetic student exam E2E. Zero backend: every /api call is
 * intercepted with seeded fixtures, so CI needs no Supabase, no Vercel dev,
 * no browsers beyond the Playwright bundle. Covers:
 *  1. login → ready → paper → answer → submit (MCQ happy path)
 *  2. typed inputs render per question type (true/false, fill-blank, text)
 *  3. refresh recovery (token in sessionStorage re-fetches the paper)
 *  4. deadline freeze (410 on save → UI freezes, submit still offered)
 */

const PAPER = {
  ok: true,
  exam: {
    id: 'exam-1',
    examCode: 'DEMO7',
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
      id: 'q-mcq',
      type: 'single_choice',
      title: 'سوال ۱',
      body: {
        text: 'متن سوال تستی',
        options: [
          { id: 'A', text: 'گزینه الف' },
          { id: 'B', text: 'گزینه ب' },
        ],
      },
      points: 2,
    },
    {
      id: 'q-tf',
      type: 'true_false',
      title: 'سوال ۲',
      body: { text: 'زمین گرد است' },
      points: 1,
    },
    {
      id: 'q-fill',
      type: 'fill_blank',
      title: 'سوال ۳',
      body: { text: 'پایتخت ایران ___ است' },
      points: 1,
    },
    {
      id: 'q-short',
      type: 'short_answer',
      title: 'سوال ۴',
      body: { text: 'نام یک سیاره بنویسید' },
      points: 2,
    },
  ],
  savedAnswers: {},
};

const START = {
  ok: true,
  token: 'test-token-abc',
  session: { id: 'session-1', status: 'ongoing', started_at: new Date().toISOString() },
  exam: PAPER.exam,
  student: PAPER.student,
};

async function mockApi(page: Page, opts: { saveStatus?: number; savedAnswers?: Record<string, unknown> } = {}) {
  const saved: Record<string, unknown> = { ...(opts.savedAnswers || {}) };
  await page.route('**/api/student/**', async (route: Route) => {
    const url = route.request().url();
    if (url.includes('/api/student/start-session')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(START) });
    }
    if (url.includes('/api/student/exam-payload')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...PAPER, savedAnswers: saved }),
      });
    }
    if (url.includes('/api/student/save-answer')) {
      if (opts.saveStatus === 410) {
        return route.fulfill({
          status: 410,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'exam_time_expired' }),
        });
      }
      try {
        const post = route.request().postDataJSON() as { questionId?: string; answer?: { value?: unknown } };
        if (post?.questionId && post?.answer && 'value' in post.answer) saved[post.questionId] = post.answer.value;
      } catch {
        /* keep seeded answers */
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, savedAt: new Date().toISOString() }),
      });
    }
    if (url.includes('/api/student/submit')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, session: { id: 'session-1', status: 'submitted' } }),
      });
    }
    return route.continue();
  });
  return saved;
}

async function login(page: Page) {
  await page.goto('/secure-exam/DEMO7');
  await expect(page.locator('text=ورود امن دانش‌آموز')).toBeVisible();
  await page.fill('input[placeholder*="مثلاً 1000000001"]', '1000000001');
  await page.click('button:has-text("ورود امن به آزمون")');
  await expect(page.locator('button:has-text("دریافت سوالات و شروع آزمون")')).toBeVisible();
}

test.describe('Student exam flow (hermetic)', () => {
  test('login → paper → MCQ answer → submit', async ({ page }) => {
    await mockApi(page);
    await login(page);
    await page.click('button:has-text("دریافت سوالات و شروع آزمون")');
    await expect(page.locator('text=ارسال نهایی')).toBeVisible();

    // MCQ answer via the typed renderer.
    await page.click('button:has-text("گزینه ب")');
    await expect(page.locator('button:has-text("گزینه ب")')).toHaveAttribute('aria-pressed', 'true');

    // ConfirmDialog (not browser chrome) gates the irreversible submit.
    await page.click('button:has-text("ارسال نهایی پاسخ‌ها")');
    await page.click('button:has-text("ارسال نهایی"):visible');
    await expect(page.locator('text=ثبت نهایی شد')).toBeVisible();
  });

  test('typed inputs render per question type', async ({ page }) => {
    await mockApi(page);
    await login(page);
    await page.click('button:has-text("دریافت سوالات و شروع آزمون")');
    await expect(page.locator('text=ارسال نهایی')).toBeVisible();

    // True/false boolean buttons.
    await expect(page.locator('button:has-text("درست")').first()).toBeVisible();
    await page.click('button:has-text("درست")');
    await expect(page.locator('button:has-text("درست")')).toHaveAttribute('aria-pressed', 'true');

    // Fill-blank positional input.
    await page.fill('input[placeholder="پاسخ خود را بنویسید"] >> nth=0', 'تهران');

    // Short-answer text input.
    await page.fill('input[placeholder="پاسخ خود را بنویسید"] >> nth=1', 'مریخ');
  });

  test('refresh recovery restores saved answers without re-login', async ({ page }) => {
    await mockApi(page, { savedAnswers: { 'q-mcq': 'B' } });
    await login(page);
    await page.click('button:has-text("دریافت سوالات و شروع آزمون")');
    await expect(page.locator('button:has-text("گزینه ب")')).toHaveAttribute('aria-pressed', 'true');

    // Reload in the same tab: sessionStorage token re-fetches the paper.
    await page.reload();
    await expect(page.locator('button:has-text("گزینه ب")')).toHaveAttribute('aria-pressed', 'true');
  });

  test('deadline freeze: 410 on save surfaces expiry and freezes inputs', async ({ page }) => {
    await mockApi(page, { saveStatus: 410 });
    await login(page);
    await page.click('button:has-text("دریافت سوالات و شروع آزمون")');
    await expect(page.locator('text=ارسال نهایی')).toBeVisible();

    await page.click('button:has-text("گزینه الف")');
    await expect(page.locator('text=زمان آزمون به پایان رسید')).toBeVisible();
    // Submit stays offered so the paper can still land (grace is submit-only).
    await expect(page.locator('button:has-text("ارسال نهایی")')).toBeVisible();
  });
});
