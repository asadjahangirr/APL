import { test, expect } from '@playwright/test';
test('capture the preserved phase-0 source in a disposable browser', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A space to make/ })).toBeVisible();
  await page.screenshot({ path: '.artifacts/phase-0/entry-desktop-before.png', fullPage: true });
  await page.getByRole('button', { name: /Business \/ studio/ }).click();
  await expect(page.getByRole('textbox', { name: 'Page title / SEO', exact: true })).toBeVisible();
  await page.screenshot({ path: '.artifacts/phase-0/editor-desktop-before.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.artifacts/phase-0/editor-mobile-before.png', fullPage: true });
});
