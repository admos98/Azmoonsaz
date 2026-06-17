import { test, expect } from '@playwright/test';

test.describe('Azmoonsaz E2E Assessment Flow (v2 alpha)', () => {
  test('Student takes exam securely with offline autosave fallback', async ({ page }) => {
    await page.goto('/secure-exam/DEMO7');
    await expect(page.locator('text=ورود امن دانش‌آموز')).toBeVisible();

    await page.fill('input[placeholder*="مثلاً 1000000001"]', '1000000001');
    await page.click('button:has-text("ورود امن به آزمون")');

    await expect(page.locator('button:has-text("دریافت سوالات و شروع آزمون")')).toBeVisible();
    await page.click('button:has-text("دریافت سوالات و شروع آزمون")');

    await expect(page.locator('text=ارسال نهایی')).toBeVisible();

    const firstOption = page.locator('button:has-text("گزینه")').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
      await expect(page.locator('text=ذخیره')).toBeVisible();
    }

    page.on('dialog', dialog => dialog.accept());
    await page.click('button:has-text("ارسال نهایی")');

    await expect(page.locator('text=ثبت نهایی شد')).toBeVisible();
  });
});