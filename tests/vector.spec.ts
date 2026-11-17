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

test('line, arrow, polygon and star tools draw vector layers', async ({ page }) => {
  await openEditor(page);
  const box = await pageBox(page);

  await page.keyboard.press('l');
  await drag(page, { x: box.x + 60, y: box.y + 60 }, { x: box.x + 260, y: box.y + 160 });
  await expect(page.locator('.ed-row', { hasText: 'Line 1' })).toHaveClass(/is-selected/);
  await expect(page.locator('.ed-page svg path')).toHaveCount(1);
  expect(await page.locator('.ed-page svg path').getAttribute('d')).toMatch(/^M0 0L[\d.]+ [\d.]+$/);
  await expect(page.locator('.ed-page svg')).toHaveCSS('stroke-width', '2px');

  await page.keyboard.press('Shift+L');
  await drag(page, { x: box.x + 60, y: box.y + 220 }, { x: box.x + 260, y: box.y + 220 });
  await expect(page.locator('.ed-row', { hasText: 'Arrow 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Shape tools' }).click();
  await page.getByRole('menuitem', { name: /Star/ }).click();
  await drag(page, { x: box.x + 320, y: box.y + 60 }, { x: box.x + 440, y: box.y + 180 });
  await expect(page.locator('.ed-row', { hasText: 'Star 1' })).toHaveClass(/is-selected/);
  const star = page.locator('.ed-page svg').last();
  const before = await star.locator('path').getAttribute('d');
  expect(before!.split('L')).toHaveLength(10);
  // Points are editable after drawing.
  await field(page, 'Points').fill('8');
  await field(page, 'Points').press('Enter');
  await expect.poll(async () => (await star.locator('path').getAttribute('d'))!.split('L').length).toBe(16);

  await page.keyboard.press('y');
  await drag(page, { x: box.x + 480, y: box.y + 60 }, { x: box.x + 580, y: box.y + 160 });
  await expect(page.locator('.ed-row', { hasText: 'Polygon 1' })).toBeVisible();

  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.ed-page svg')).toHaveCount(4);
});

test('pen places corners and curves and closes a shape; pencil draws freehand', async ({ page }) => {
  await openEditor(page);
  const box = await pageBox(page);
  const at = (x: number, y: number) => ({ x: box.x + x, y: box.y + y });

  await page.keyboard.press('p');
  await page.mouse.click(at(100, 100).x, at(100, 100).y);
  await page.mouse.click(at(260, 100).x, at(260, 100).y);
  await drag(page, at(260, 240), at(200, 280)); // drag = curve handle
  await expect(page.locator('.ed-pen circle')).toHaveCount(3);
  await page.mouse.click(at(100, 100).x, at(100, 100).y); // back to the first point closes it
  await expect(page.locator('.ed-pen')).toHaveCount(0);
  await expect(page.locator('.ed-row', { hasText: 'Vector 1' })).toHaveClass(/is-selected/);
  const d = (await page.locator('.ed-page svg path').getAttribute('d'))!;
  expect(d).toMatch(/^M.*L.*C.*Z$/);
  await expect(page.locator('.ed-page svg')).toHaveCSS('fill', 'rgb(217, 217, 217)');

  // Open path finished with Enter.
  await page.keyboard.press('p');
  await page.mouse.click(at(340, 100).x, at(340, 100).y);
  await page.mouse.click(at(440, 160).x, at(440, 160).y);
  await page.mouse.click(at(340, 220).x, at(340, 220).y);
  await page.keyboard.press('Enter');
  await expect(page.locator('.ed-row', { hasText: 'Vector 2' })).toBeVisible();
  await expect(page.locator('.ed-page svg').last()).toHaveCSS('fill', 'none');

  await page.keyboard.press('Shift+P');
  await page.mouse.move(at(100, 340).x, at(100, 340).y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(at(100 + i * 15, 340 + Math.sin(i / 2) * 30).x, at(100 + i * 15, 340 + Math.sin(i / 2) * 30).y);
  await page.mouse.up();
  await expect(page.locator('.ed-row', { hasText: 'Drawing 1' })).toHaveClass(/is-selected/);
  expect(await page.locator('.ed-page svg').last().locator('path').getAttribute('d')).toContain('Q');

  await page.keyboard.press('Control+z');
  await expect(page.locator('.ed-page svg')).toHaveCount(2);
});

test('library designs can be previewed full size and inserted from the preview', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Library' }).click();
  const library = page.getByRole('dialog', { name: 'Design library' });
  await library.locator('.lib-cats button', { hasText: 'Animated' }).click();
  await library.getByRole('button', { name: 'Preview Pulsing call to action' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  await expect(preview.getByText('Start building — it is free').locator('..')).toHaveCSS('animation-name', 'apl-loop-pulse');
  await preview.getByRole('radio', { name: /Mobile/ }).click();
  await expect(preview.locator('h2')).toHaveCSS('font-size', '37px');
  // Escape closes only the preview.
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(library).toBeVisible();
  await library.getByRole('button', { name: 'Preview Pulsing call to action' }).click();
  await preview.getByRole('button', { name: 'Insert this design' }).click();
  await expect(library).toHaveCount(0);
  await expect(page.locator('.ed-page').getByText('Your turn.')).toBeVisible();
});
