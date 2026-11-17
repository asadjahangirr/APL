import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
const pageBox = async (page: Page) => (await page.locator('.ed-page').boundingBox())!;
const panelSelect = (page: Page, label: string) => page.locator('.ed-right .ed-select').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('select');
const field = (page: Page, label: string) => page.locator('.ed-right .ed-num').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
async function addText(page: Page, x: number, y: number, text: string) {
  const box = await pageBox(page);
  await page.keyboard.press('t');
  await page.mouse.click(box.x + x, box.y + y);
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ed-page').getByText(text)).toBeVisible();
}

test('link pages together, click through them in preview, and export a working website', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add page' }).click();
  await addText(page, 100, 100, 'Welcome to page two');
  await page.locator('.ed-pages .ed-page-btn', { hasText: 'Home' }).click();
  await addText(page, 100, 100, 'Go to page two');

  // Link the text to the second page. It stays plain text on the canvas.
  await page.locator('.ed-row', { hasText: 'Text' }).first().click();
  await panelSelect(page, 'When clicked').selectOption('page');
  await panelSelect(page, 'Page').selectOption({ label: 'Page 2 (/page-2)' });
  await expect(page.locator('.ed-page a')).toHaveCount(0);

  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  await preview.getByRole('link', { name: 'Go to page two' }).click();
  await expect(preview.getByText('Welcome to page two')).toBeVisible();
  await page.keyboard.press('Escape');

  // Export: a zip with one file per page, linked with relative addresses.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('my-first-site.zip');
  const files = unzipSync(new Uint8Array(readFileSync(await file.path())));
  expect(Object.keys(files).sort()).toEqual(['README.txt', 'index.html', 'page-2/index.html', 'robots.txt']);
  expect(strFromU8(files['index.html'])).toMatch(/<a class="n-[a-z0-9]+" href="page-2\/index\.html"[^>]*>Go to page two<\/a>/);
  expect(strFromU8(files['page-2/index.html'])).toContain('Welcome to page two');
  await expect(page.locator('.ed-toast')).toContainText('Downloaded my-first-site.zip');
});

test('components: instances update with the main component and keep their own text', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Library' }).click();
  const library = page.getByRole('dialog', { name: 'Design library' });
  await library.locator('.lib-cats button', { hasText: 'Elements' }).click();
  await library.locator('[data-design="el-stat"] .lib-card-main').click();
  await expect(page.locator('.ed-page').getByText('Active users')).toHaveCount(1);

  await page.locator('.ed-right').getByRole('button', { name: /Create component/ }).click();
  await expect(page.locator('.ed-right').getByText('Main component')).toBeVisible();
  await page.locator('.ed-right').getByRole('button', { name: 'Add instance' }).click();
  await expect(page.locator('.ed-right').getByText('◇ Instance')).toBeVisible();
  await expect(page.locator('.ed-page').getByText('Active users')).toHaveCount(2);

  // Layers lists the newest (the instance) first: change the instance's own label.
  await page.locator('.ed-row', { hasText: 'Active users' }).first().click();
  const content = page.locator('.ed-right .ed-text-field').filter({ has: page.locator('span', { hasText: /^Content$/ }) }).locator('textarea');
  await content.fill('Paying users');
  await content.blur();
  await expect(page.locator('.ed-page').getByText('Paying users')).toHaveCount(1);

  // Restyle the main component (the lower of the two component rows).
  await page.locator('.ed-row.is-component').last().click();
  await expect(page.locator('.ed-right').getByText('Main component')).toBeVisible();
  await field(page, '◜').fill('40');
  await field(page, '◜').press('Enter');
  const cards = page.locator('.ed-site > [data-node-id] > [data-node-id]');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveCSS('border-top-left-radius', '40px');
  await expect(cards.nth(1)).toHaveCSS('border-top-left-radius', '40px');
  // The instance kept its wording.
  await expect(page.locator('.ed-page').getByText('Paying users')).toHaveCount(1);
  await expect(page.locator('.ed-page').getByText('Active users')).toHaveCount(1);
});

test('site colors: a layer follows a named color, with a dark value shown in preview', async ({ page }) => {
  await openEditor(page);
  await page.locator('.ed-right').getByRole('button', { name: 'Add site color' }).click();
  await page.getByLabel('Color 1 light hex').fill('FF0000');
  await page.getByLabel('Color 1 light hex').blur();
  await page.getByLabel('Color 1 dark hex').fill('00FF00');
  await page.getByLabel('Color 1 dark hex').blur();

  const box = await pageBox(page);
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 80, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + 180, { steps: 4 });
  await page.mouse.up();
  await page.locator('.ed-right .ed-select[title="Follow a site color"] select').selectOption({ label: '● Color 1' });
  const rect = page.locator('.ed-page [data-node-id]').last();
  await expect(rect).toHaveCSS('background-color', 'rgb(255, 0, 0)');

  // Changing the site color updates the layer.
  await page.keyboard.press('Escape');
  await page.getByLabel('Color 1 light hex').fill('0000FF');
  await page.getByLabel('Color 1 light hex').blur();
  await expect(rect).toHaveCSS('background-color', 'rgb(0, 0, 255)');

  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  const shown = preview.locator('.ed-preview-site div[aria-hidden="true"]').last();
  await expect(shown).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await preview.getByRole('radio', { name: 'Dark colors' }).click();
  await expect(shown).toHaveCSS('background-color', 'rgb(0, 255, 0)');
});
