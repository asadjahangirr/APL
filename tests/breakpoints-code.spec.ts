import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
const library = (page: Page) => page.getByRole('dialog', { name: 'Design library' });
const field = (page: Page, label: string) => page.locator('.ed-right .ed-num').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input');

test('design for phone: the page narrows, edits become phone-only and can be reset', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Library' }).click();
  await library(page).locator('.lib-cats button', { hasText: 'Heroes' }).click();
  await library(page).locator('[data-design="hero-centered"]').click();
  const headline = page.locator('.ed-page h1');
  await expect(headline).toHaveCSS('font-size', '64px');

  await page.getByRole('radio', { name: /Design for phone/ }).click();
  await expect(page.locator('.ed-page')).toHaveAttribute('data-breakpoint', 'mobile');
  expect(await page.locator('.ed-page').evaluate(el => (el as HTMLElement).style.width)).toBe('390px');
  await expect(headline).toHaveCSS('font-size', '37px'); // the library design's own phone size

  // Select the headline from Layers and change its size on phone only.
  await page.locator('.ed-row', { hasText: 'Ship your next idea' }).click();
  await expect(page.locator('.ed-bp-note')).toContainText('Designing for phone');
  await field(page, 'Size').fill('30');
  await field(page, 'Size').press('Enter');
  await expect(headline).toHaveCSS('font-size', '30px');
  await expect(page.locator('.ed-bp-note')).toContainText('text style');

  await page.getByRole('radio', { name: 'Design for desktop' }).click();
  await expect(headline).toHaveCSS('font-size', '64px');

  // Preview shows both; then reset the phone change.
  await page.getByRole('radio', { name: /Design for phone/ }).click();
  await page.locator('.ed-bp-note').getByRole('button', { name: /Reset/ }).click();
  await expect(headline).toHaveCSS('font-size', '50px'); // falls back to the tablet size
  await page.keyboard.press('Control+z');
  await expect(headline).toHaveCSS('font-size', '30px');

  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  await expect(preview.locator('h1')).toHaveCSS('font-size', '64px');
  await preview.getByRole('radio', { name: /Mobile/ }).click();
  await expect(preview.locator('h1')).toHaveCSS('font-size', '30px');
});

test('copy code from a library card and from a layer on the canvas', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openEditor(page);
  await page.getByRole('button', { name: 'Library' }).click();
  await library(page).locator('.lib-cats button', { hasText: 'Buttons' }).click();
  await expect(library(page).locator('.lib-card')).toHaveCount(20);
  await library(page).getByRole('button', { name: 'Copy code for Glow buttons' }).click();
  const dialog = page.getByRole('dialog', { name: /Code for Glow buttons/ });
  await expect(dialog.locator('pre')).toContainText('<div class="apl-glow-buttons-paper">');
  await dialog.getByRole('button', { name: 'Copy code' }).click();
  await expect(dialog.getByRole('button', { name: 'Copied ✓' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('box-shadow:');
  await dialog.getByRole('tab', { name: 'React' }).click();
  await expect(dialog.locator('pre')).toContainText('export default function GlowButtonsPaper()');

  // Escape closes the code first, then the library.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(library(page)).toBeVisible();
  await library(page).locator('[data-design="btn-glow"] .lib-card-main').click();
  await expect(library(page)).toHaveCount(0);

  // The inserted layer's code is available from the Design panel.
  await page.locator('.ed-right').getByRole('button', { name: /Copy code/ }).click();
  await expect(page.getByRole('dialog', { name: /Code for Glow buttons/ }).locator('pre')).toContainText('Launch now');
});

test('gradient fills can be edited in the Design panel', async ({ page }) => {
  await openEditor(page);
  const box = (await page.locator('.ed-page').boundingBox())!;
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 80, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 200, { steps: 4 });
  await page.mouse.up();
  await page.locator('.ed-paint select').selectOption('linear');
  const rect = page.locator('.ed-page [data-node-id]').last();
  await expect(rect).toHaveCSS('background-image', /linear-gradient\(135deg/);
  await field(page, 'Angle').fill('90');
  await field(page, 'Angle').press('Enter');
  await page.getByRole('button', { name: '+ Add color stop' }).click();
  await expect(page.locator('.ed-grad-stop')).toHaveCount(3);
  await expect(rect).toHaveCSS('background-image', /linear-gradient\(90deg.*50%/);
});
