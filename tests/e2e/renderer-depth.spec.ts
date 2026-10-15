import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * T3 — renderer-depth E2E. Extends the T2 hermetic harness
 * (exam-flow-hermetic.spec.ts) from the five smoke paths to EVERY advertised
 * renderer: save → reload → restore → submit for multiple_choice, matching,
 * ordering, cloze and reading_comprehension.
 *
 * Same contract as T2: zero backend. Every /api call is intercepted with
 * seeded fixtures, so CI needs no Supabase, no Vercel dev, no live network.
 *
 * The point of the save → RELOAD → restore leg is the answer-value contract:
 * what the renderer sends must come back through `savedAnswers` and repaint
 * as the same selection. A renderer whose write shape drifts from its read
 * shape passes a plain "click it" test and fails here.
 */

// ---------------------------------------------------------------------------
// Fixtures — one paper holding every renderer under test.
// Shapes mirror the server contract in api/_lib/examSecurity.js:
//   matching          → displayPairs (scrambled; canonical key stays server-side)
//   ordering          → displayItems (scrambled; canonical key stays server-side)
//   cloze / reading   → parts[], each with its own typed input
// ---------------------------------------------------------------------------
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
      id: 'q-multi',
      type: 'multiple_choice',
      title: 'چندگزینه‌ای',
      body: {
        text: 'کدام موارد عدد اول هستند؟',
        options: [
          { id: 'A', text: 'گزینه یک' },
          { id: 'B', text: 'گزینه دو' },
          { id: 'C', text: 'گزینه سه' },
        ],
      },
      points: 3,
    },
    {
      id: 'q-match',
      type: 'matching',
      title: 'وصل‌کردنی',
      body: {
        text: 'هر مورد را به معادلش وصل کنید',
        displayPairs: [
          { left: 'پایتخت ایران', right: 'تهران' },
          { left: 'پایتخت فرانسه', right: 'پاریس' },
        ],
      },
      points: 2,
    },
    {
      id: 'q-order',
      type: 'ordering',
      title: 'مرتب‌سازی',
      body: {
        text: 'به ترتیب قرار دهید',
        displayItems: ['سوم', 'اول', 'دوم'],
      },
      points: 2,
    },
    {
      id: 'q-cloze',
      type: 'cloze',
      title: 'کلوز تست',
      body: {
        text: 'جای خالی‌ها را پر کنید',
        parts: [
          { id: 'p1', text: 'پایتخت ایران ___ است', type: 'fill_blank' },
          { id: 'p2', text: 'آب در ___ درجه می‌جوشد', type: 'fill_blank' },
        ],
      },
      points: 2,
    },
    {
      id: 'q-reading',
      type: 'reading_comprehension',
      title: 'درک مطلب',
      body: {
        text: 'متن را بخوانید و پاسخ دهید',
        parts: [
          {
            id: 'r1',
            text: 'مضمون اصلی متن چیست؟',
            type: 'single_choice',
            options: [
              { id: 'A', text: 'گزینه الف' },
              { id: 'B', text: 'گزینه ب' },
            ],
          },
          { id: 'r2', text: 'یک صفت بنویسید', type: 'short_answer' },
        ],
      },
      points: 4,
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

async function mockApi(page: Page, opts: { savedAnswers?: Record<string, unknown> } = {}) {
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
  await page.fill('input[placeholder="۶ رقم"]', '123456');
  await page.click('button:has-text("ورود امن به آزمون")');
  await page.click('button:has-text("دریافت سوالات و شروع آزمون")');
  await expect(page.locator('text=ارسال نهایی')).toBeVisible();
}

/** Scope to one PartInput pane — part inputs repeat their inner labels. */
function partPane(page: Page, partText: string) {
  return page.locator('div.pane').filter({ hasText: partText });
}

async function submit(page: Page) {
  await page.getByRole('button', { name: 'ارسال نهایی پاسخ‌ها', exact: true }).click();
  // Two dialogs can own the submit: the sync-queued prompt appears first when
  // the offline queue is non-empty (an answer whose save failed and was
  // queued), and only then does the final-submit confirmation show. The
  // harness must walk whichever one is on screen.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const syncPrompt = dialog.getByRole('button', { name: 'همگام‌سازی و ادامه', exact: true });
  if (await syncPrompt.isVisible().catch(() => false)) {
    await syncPrompt.click();
  }
  await dialog.getByRole('button', { name: 'ارسال نهایی', exact: true }).click();
  await expect(page.locator('text=ثبت نهایی شد')).toBeVisible();
}

test.describe('Renderer depth: save → reload → restore → submit', () => {
  test('multiple_choice: toggles two options, survives reload, submits', async ({ page }) => {
    const saved = await mockApi(page);
    await login(page);

    const first = page.getByRole('button', { name: 'گزینه یک', exact: true });
    const second = page.getByRole('button', { name: 'گزینه دو', exact: true });
    await first.click();
    await second.click();

    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    // Multi-select contract: the value is an id ARRAY, not a scalar.
    await expect.poll(() => saved['q-multi']).toEqual(['A', 'B']);

    // Toggle-off must shrink the array — a renderer that only ever appends
    // would still look right on screen until the second click.
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => saved['q-multi']).toEqual(['B']);

    // Re-add and let the write land BEFORE reloading: reload restores from the
    // server copy, so a value still inside the debounce window would vanish
    // and look like a renderer bug.
    //
    // Order is NOT part of this contract. A re-added id appends to the end
    // (['B','A']), and grading compares SETS — examSecurity.js gradeTypedAnswer
    // builds a Set per side and compares size + membership. Asserting a literal
    // array here would encode an incidental order as if it were the contract.
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => [...((saved['q-multi'] as string[]) || [])].sort()).toEqual(['A', 'B']);
    await page.reload();
    await expect(page.getByRole('button', { name: 'گزینه یک', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'گزینه دو', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await submit(page);
  });

  test('matching: selects a partner per row, survives reload, submits', async ({ page }) => {
    const saved = await mockApi(page);
    await login(page);

    // Matching rows are keyed by the LEFT term; the dropdown is portaled to
    // <body>, so options are queried globally rather than inside the card.
    await page.getByRole('button', { name: 'معادل پایتخت ایران' }).click();
    await page.getByRole('option', { name: 'تهران', exact: true }).click();
    await expect.poll(() => saved['q-match']).toEqual({ 'پایتخت ایران': 'تهران' });

    await page.getByRole('button', { name: 'معادل پایتخت فرانسه' }).click();
    await page.getByRole('option', { name: 'پاریس', exact: true }).click();
    await expect
      .poll(() => saved['q-match'])
      .toEqual({ 'پایتخت ایران': 'تهران', 'پایتخت فرانسه': 'پاریس' });

    await page.reload();
    // Restored value paints the selected label into the trigger.
    await expect(page.getByRole('button', { name: 'معادل پایتخت ایران' })).toContainText('تهران');
    await expect(page.getByRole('button', { name: 'معادل پایتخت فرانسه' })).toContainText('پاریس');

    await submit(page);
  });

  test('ordering: pristine order commits, a move reorders, both survive reload', async ({ page }) => {
    const saved = await mockApi(page);
    await login(page);

    // Display order is scrambled server-side; the renderer commits the
    // pristine sequence on mount so an untouched order is still an answer.
    await expect.poll(() => saved['q-order']).toEqual(['سوم', 'اول', 'دوم']);

    // "Move up" on row 1 swaps it with row 0.
    await page.getByRole('button', { name: 'انتقال به بالا', exact: true }).nth(1).click();
    await expect.poll(() => saved['q-order']).toEqual(['اول', 'سوم', 'دوم']);

    await page.reload();
    // The reloaded paper restores the committed sequence: the first row is
    // now 'اول', proving the write round-tripped rather than re-seeding.
    await expect(page.locator('div.pane span.flex-1').first()).toHaveText('اول');

    await submit(page);
  });

  test('cloze: each part keeps its own part-keyed answer and submits', async ({ page }) => {
    const saved = await mockApi(page);
    await login(page);

    // Each part renders its own FillBlankInput, so the inner blank labels
    // repeat across parts — scope through the part pane, never a bare label.
    await partPane(page, 'پایتخت ایران ___ است').getByLabel('جای خالی ۱').fill('تهران');
    await partPane(page, 'آب در ___ درجه می‌جوشد').getByLabel('جای خالی ۱').fill('۱۰۰');

    // The value must be a RECORD keyed by part id — not a flat array, which
    // would collide across parts on multi-part questions. Each part's own
    // fill-blank value is itself positional (an array), even with one blank.
    await expect.poll(() => saved['q-cloze']).toEqual({ p1: ['تهران'], p2: ['۱۰۰'] });

    await page.reload();
    await expect(partPane(page, 'پایتخت ایران ___ است').getByLabel('جای خالی ۱')).toHaveValue('تهران');
    await expect(partPane(page, 'آب در ___ درجه می‌جوشد').getByLabel('جای خالی ۱')).toHaveValue('۱۰۰');

    await submit(page);
  });

  test('reading_comprehension: mixed part types save into one part-keyed record', async ({ page }) => {
    const saved = await mockApi(page);
    await login(page);

    // Part 1 is a choice renderer, part 2 a free-text renderer: both must
    // land in the same record so grading can resolve them per part id.
    await partPane(page, 'مضمون اصلی متن چیست؟').getByRole('button', { name: 'گزینه ب', exact: true }).click();
    await partPane(page, 'یک صفت بنویسید').getByPlaceholder('پاسخ خود را بنویسید').fill('زیبا');

    await expect.poll(() => saved['q-reading']).toMatchObject({ r1: 'B' });
    await expect.poll(() => saved['q-reading']).toMatchObject({ r2: 'زیبا' });

    await page.reload();
    await expect(
      partPane(page, 'مضمون اصلی متن چیست؟').getByRole('button', { name: 'گزینه ب', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');

    await submit(page);
  });

  test('every advertised renderer is reachable in one paper', async ({ page }) => {
    await mockApi(page);
    await login(page);

    // Guards against a paper that silently drops a renderer: each question
    // type under test must produce at least one interactive control.
    await expect(page.getByRole('button', { name: 'گزینه یک', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'معادل پایتخت ایران' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'انتقال به بالا', exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('جای خالی ۱').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'گزینه الف', exact: true })).toBeVisible();
  });
});
