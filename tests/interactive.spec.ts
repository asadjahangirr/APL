import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
const library = (page: Page) => page.getByRole('dialog', { name: 'Design library' });
async function insert(page: Page, category: string, id: string) {
  await page.keyboard.press('Shift+I');
  await expect(library(page)).toBeVisible();
  await library(page).locator('.lib-cats button', { hasText: category }).click();
  await library(page).locator(`[data-design="${id}"]`).click();
  await expect(library(page)).toHaveCount(0);
}

test('buttons and fields are plain layers on the canvas and real controls in preview', async ({ page }) => {
  await openEditor(page);
  await insert(page, 'Full pages', 'page-saas');

  // Canvas: still ordinary layers that select on click.
  const canvas = page.locator('.ed-page');
  await expect(canvas.locator('button, input, textarea')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ed-row.is-selected')).toHaveCount(0);
  await canvas.getByText('Get started').first().click();
  await expect(page.locator('.ed-row.is-selected')).toHaveCount(1);

  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  const site = preview.locator('.ed-preview-site');

  // Buttons are real buttons: pointer cursor, not selectable as text, reachable by keyboard.
  const cta = site.getByRole('button', { name: 'Get started' }).first();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveCSS('cursor', 'pointer');
  await expect(cta).toHaveCSS('user-select', 'none');
  await cta.focus();
  await expect(cta).toBeFocused();
  // The reset keeps the designed look: no browser border or grey button background.
  await expect(cta).toHaveCSS('border-top-width', '0px');

  // Nav items are links.
  await expect(site.getByRole('link', { name: 'Pricing' }).first()).toHaveCSS('cursor', 'pointer');
});

test('a contact form in preview: click a field box to focus it, type a message, press the button', async ({ page }) => {
  await openEditor(page);
  await insert(page, 'Contact', 'contact-form');
  await page.getByRole('button', { name: 'Preview' }).click();
  const site = page.getByRole('dialog', { name: 'Preview' }).locator('.ed-preview-site');

  // Clicking the padding of the field box (the <label>) focuses its input.
  const box = site.locator('label').first();
  const rect = (await box.boundingBox())!;
  await page.mouse.click(rect.x + rect.width - 6, rect.y + rect.height / 2);
  await expect(box.locator('input')).toBeFocused();
  await page.keyboard.type('Jane');
  await expect(box.locator('input')).toHaveValue('Jane');
  await expect(site.locator('input[type="email"]')).toHaveCount(1);

  const message = site.locator('textarea').first();
  await message.fill('Hello there.\nSecond line.');
  await expect(message).toHaveValue('Hello there.\nSecond line.');
  await site.getByRole('button', { name: 'Send message' }).click();
});
