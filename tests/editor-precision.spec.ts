import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
const pageBox = async (page: Page) => (await page.locator('.ed-page').boundingBox())!;
const rows = (page: Page, name: string) => page.locator('.ed-row', { hasText: name });
const field = (page: Page, label: string) => page.locator('.ed-right .ed-num').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  if (release) await page.mouse.up();
}
/** Two 100×100-screen-px rectangles side by side, sharing their top edge. */
async function twoRects(page: Page) {
  const box = await pageBox(page);
  await page.keyboard.press('r');
  await drag(page, { x: box.x + 100, y: box.y + 100 }, { x: box.x + 200, y: box.y + 200 });
  await page.keyboard.press('r');
  await drag(page, { x: box.x + 400, y: box.y + 100 }, { x: box.x + 500, y: box.y + 200 });
  await expect(rows(page, 'Rectangle 2')).toHaveClass(/is-selected/);
  return box;
}

test('smart guides and spacing while moving; marquee, group, undo and align', async ({ page }) => {
  await openEditor(page);
  const box = await twoRects(page);

  // Dragging Rectangle 2 shows red guides (shared top edge) and distance labels.
  await drag(page, { x: box.x + 450, y: box.y + 150 }, { x: box.x + 470, y: box.y + 150 }, false);
  await expect(page.locator('.ed-guide').first()).toBeVisible();
  await expect(page.locator('.ed-measure-label').first()).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.ed-guide')).toHaveCount(0);

  // Marquee from the empty page background selects both.
  await page.keyboard.press('Escape');
  await drag(page, { x: box.x + 60, y: box.y + 60 }, { x: box.x + 560, y: box.y + 260 });
  await expect(page.locator('.ed-row.is-selected')).toHaveCount(2);
  await expect(page.getByText('2 layers selected')).toBeVisible();

  // Group with Ctrl+G, undo with Ctrl+Z.
  await page.keyboard.press('Control+g');
  await expect(rows(page, 'Group 1')).toHaveClass(/is-selected/);
  // Both rectangles are now children of the group (page → group → rectangle).
  await expect(rows(page, 'Rectangle 1')).toHaveAttribute('aria-level', '3');
  await expect(rows(page, 'Rectangle 2')).toHaveAttribute('aria-level', '3');
  await page.keyboard.press('Control+z');
  await expect(rows(page, 'Group 1')).toHaveCount(0);

  // Align bottoms of a taller and a shorter rectangle from the Design panel.
  await rows(page, 'Rectangle 2').click();
  const h = field(page, 'H');
  await h.fill('300'); await h.press('Enter');
  await drag(page, { x: box.x + 60, y: box.y + 60 }, { x: box.x + 560, y: box.y + 260 });
  await page.getByRole('button', { name: 'Align bottom' }).click();
  const r1 = (await page.locator('.ed-page [data-node-id]').nth(1).boundingBox())!;
  const r2 = (await page.locator('.ed-page [data-node-id]').nth(2).boundingBox())!;
  expect(Math.abs(r1.y + r1.height - (r2.y + r2.height))).toBeLessThan(1.5);
});

test('copy and paste layers, including onto another page', async ({ page }) => {
  await openEditor(page);
  await twoRects(page);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(rows(page, 'Rectangle 2')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add page' }).click();
  await expect(page.locator('.ed-pages li.is-current')).toContainText('Page 2');
  await page.keyboard.press('Control+v');
  await expect(rows(page, 'Rectangle 2')).toHaveCount(1);
  await expect(page.locator('.ed-page [data-node-id]')).toHaveCount(2); // the new page frame + the pasted rectangle
});

test('rotate with the corner handle and measure with Alt', async ({ page }) => {
  await openEditor(page);
  const box = await twoRects(page);

  // Alt-hover from the selected rectangle to the other one shows the gap.
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + 150, box.y + 150, { steps: 3 });
  await expect(page.locator('.ed-measure-label').first()).toBeVisible();
  await page.keyboard.up('Alt');

  // Rotate: drag just outside the top-right corner around the center.
  const zone = (await page.locator('[data-rotate="ne"]').boundingBox())!;
  await drag(page, { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 }, { x: box.x + 560, y: box.y + 220 });
  await expect.poll(async () => Math.abs(Number(await field(page, '↻').inputValue()))).toBeGreaterThan(10);
  await expect(page.locator('.ed-size-badge')).toContainText('°');
  await page.keyboard.press('Control+z');
  await expect(field(page, '↻')).toHaveValue('0');
});

test('command palette finds and runs commands', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox', { name: 'Search commands' });
  await expect(search).toBeFocused();
  await search.fill('ellipse');
  await expect(page.getByRole('dialog', { name: 'Command palette' }).getByRole('option').first()).toContainText('Ellipse tool');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ellipse', exact: true })).toHaveClass(/is-active/);
  await page.getByRole('button', { name: 'Command palette' }).click();
  await page.keyboard.type('add page');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ed-pages li')).toHaveCount(2);
});
