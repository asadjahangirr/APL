import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
const pageBox = async (page: Page) => (await page.locator('.ed-page').boundingBox())!;
const field = (page: Page, label: string) => page.locator('.ed-right .ed-num').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test('draw, move, resize and type on a blank page; undo/redo; changes survive reload', async ({ page }) => {
  await openEditor(page);
  const box = await pageBox(page);

  // Draw a rectangle.
  await page.keyboard.press('r');
  await drag(page, { x: box.x + 100, y: box.y + 100 }, { x: box.x + 300, y: box.y + 220 });
  await expect(page.locator('.ed-row', { hasText: 'Rectangle 1' })).toHaveClass(/is-selected/);
  const width = Number(await field(page, 'W').inputValue());
  expect(width).toBeGreaterThan(200);

  // Move it.
  const x0 = Number(await field(page, 'X').inputValue());
  await drag(page, { x: box.x + 200, y: box.y + 160 }, { x: box.x + 300, y: box.y + 160 });
  await expect.poll(async () => Number(await field(page, 'X').inputValue())).toBeGreaterThan(x0 + 100);

  // Resize from the bottom-right handle.
  const handle = (await page.locator('.ed-handle-se').boundingBox())!;
  await drag(page, { x: handle.x + 4, y: handle.y + 4 }, { x: handle.x + 54, y: handle.y + 4 });
  await expect.poll(async () => Number(await field(page, 'W').inputValue())).toBeGreaterThan(width + 50);

  // Text tool: click, type, Escape.
  await page.keyboard.press('t');
  await page.mouse.click(box.x + 120, box.y + 320);
  await page.keyboard.type('Hello APL');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ed-page').getByText('Hello APL')).toBeVisible();
  await expect(page.locator('.ed-row', { hasText: 'Text 1' })).toBeVisible();

  // Creating + typing text is a single undo step.
  await page.keyboard.press('Control+z');
  await expect(page.locator('.ed-page').getByText('Hello APL')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.ed-page').getByText('Hello APL')).toBeVisible();

  // Autosave + reload.
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.ed-page').getByText('Hello APL')).toBeVisible();
  await expect(page.locator('.ed-row', { hasText: 'Rectangle 1' })).toBeVisible();

  // Images: picked through the toolbar, embedded locally, shown as a real <img>.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.ed-row', { hasText: 'dot' })).toHaveClass(/is-selected/);
  await expect(page.locator('.ed-page img')).toHaveCount(1);
  const alt = page.locator('.ed-right .ed-text-field', { hasText: 'Alt text' }).locator('input');
  await alt.fill('A single dot');
  await alt.press('Enter');
  await expect(page.locator('.ed-page img')).toHaveAttribute('alt', 'A single dot');
  // Unsupported files are rejected with a message.
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  await (await chooser2).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(page.locator('.ed-toast')).toContainText('PNG, JPEG, WebP, GIF or SVG');

  // Delete removes the selected layer.
  await page.locator('.ed-row', { hasText: 'Rectangle 1' }).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.ed-row', { hasText: 'Rectangle 1' })).toHaveCount(0);
});

test('sample site: Figma-style selection, auto-layout reorder, editing and device preview', async ({ page }) => {
  await openEditor(page);
  await page.locator('.ed-logo').click();
  await page.getByRole('menuitem', { name: /Open sample/ }).click();
  const card1 = page.locator('.ed-page [data-node-id="card-1"]');
  await expect(card1).toBeVisible();
  // Web fonts change text wrapping (and so layout); measure only after they load.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);

  // First click selects the section, double-click enters the card.
  let c1 = (await card1.boundingBox())!;
  await page.mouse.click(c1.x + c1.width / 2, c1.y + 12);
  await expect(page.locator('.ed-row.is-selected')).toHaveText(/Features/);
  await page.mouse.dblclick(c1.x + c1.width / 2, c1.y + 12);
  await expect(page.locator('.ed-row.is-selected')).toHaveText(/Brand systems/);

  // Drag the first card after the third (grid reorder).
  c1 = (await card1.boundingBox())!;
  const c3 = (await page.locator('.ed-page [data-node-id="card-3"]').boundingBox())!;
  // Grab the card away from the center of its top padding (that spot is the padding handle).
  await drag(page, { x: c1.x + 16, y: c1.y + c1.height / 2 }, { x: c3.x + c3.width - 4, y: c3.y + c3.height / 2 });
  await expect.poll(() => page.locator('.ed-page article').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.nodeId))).toEqual(['card-2', 'card-3', 'card-1']);

  // Edit the headline from the Design panel.
  await page.locator('.ed-row', { hasText: 'We design calm' }).click();
  const content = page.locator('.ed-right .ed-text-field', { hasText: 'Content' }).locator('textarea');
  await content.fill('Websites, designed and shipped.');
  await content.blur();
  await expect(page.locator('.ed-page h1')).toHaveText('Websites, designed and shipped.');

  // Preview renders the page at device widths; mobile hides the nav links.
  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  await expect(preview.locator('h1')).toHaveText('Websites, designed and shipped.');
  await preview.getByRole('radio', { name: /Mobile/ }).click();
  await expect(preview.locator('[class="n-links"]')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
});

test('pages can be added, switched and renamed', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add page' }).click();
  await expect(page.locator('.ed-pages li.is-current')).toContainText('Page 2');
  await expect(page.locator('.ed-pages li.is-current')).toContainText('/page-2');
  const name = page.locator('.ed-right .ed-text-field', { hasText: 'Name' }).first().locator('input');
  await name.fill('About');
  await name.press('Enter');
  await expect(page.locator('.ed-pages li.is-current')).toContainText('About');
  await page.locator('.ed-pages').getByRole('button', { name: /Home/ }).click();
  await expect(page.locator('.ed-title')).toContainText('Home');
});
