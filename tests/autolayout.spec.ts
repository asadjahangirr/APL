import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
const rows = (page: Page, name: string) => page.locator('.ed-row', { hasText: name });
const field = (page: Page, label: string) => page.locator('.ed-right .ed-num').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}
/** Three rectangles in a row, 60 screen px apart, turned into a horizontal auto-layout frame. */
async function navRow(page: Page) {
  const box = (await page.locator('.ed-page').boundingBox())!;
  for (const x of [100, 220, 340]) {
    await page.keyboard.press('r');
    await drag(page, { x: box.x + x, y: box.y + 100 }, { x: box.x + x + 60, y: box.y + 140 });
  }
  await page.keyboard.press('Escape');
  await drag(page, { x: box.x + 60, y: box.y + 60 }, { x: box.x + 460, y: box.y + 180 });
  await expect(page.locator('.ed-row.is-selected')).toHaveCount(3);
  await page.keyboard.press('Shift+A');
  await expect(rows(page, 'Frame 1')).toHaveClass(/is-selected/);
  return box;
}

test('Shift+A infers a row; dragging the on-canvas gap handle changes the gap', async ({ page }) => {
  await openEditor(page);
  await navRow(page);
  await expect(page.getByRole('radio', { name: 'Horizontal' })).toHaveAttribute('aria-checked', 'true');
  for (const name of ['Rectangle 1', 'Rectangle 2', 'Rectangle 3']) await expect(rows(page, name)).toHaveAttribute('aria-level', '3');
  const gap = Number(await field(page, 'Gap').inputValue());
  expect(gap).toBeGreaterThan(50);

  // The 5th spacing region is the first gap (after the four padding bands).
  const handle = (await page.locator('.ed-spacing').nth(4).boundingBox())!;
  await drag(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { x: handle.x + handle.width / 2 + 40, y: handle.y + handle.height / 2 });
  await expect.poll(async () => Number(await field(page, 'Gap').inputValue())).toBeGreaterThan(gap + 40);
  // Undo restores the inferred gap in one step.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => Number(await field(page, 'Gap').inputValue())).toBe(gap);
});

test('alignment grid, padding, auto gap and fill/hug rules', async ({ page }) => {
  await openEditor(page);
  await navRow(page);
  await page.getByRole('radio', { name: 'Align middle center' }).click();
  await expect(page.getByRole('radio', { name: 'Align middle center' })).toHaveAttribute('aria-checked', 'true');
  const horizontal = field(page, '↔');
  await horizontal.fill('24'); await horizontal.press('Enter');
  const frame = page.locator('.ed-page [data-node-id]').filter({ has: page.locator('[data-node-id]') }).last();
  await expect(frame).toHaveCSS('padding-left', '24px');
  await expect(frame).toHaveCSS('justify-content', 'center');
  await page.getByRole('button', { name: 'Use auto gap' }).click();
  await expect(frame).toHaveCSS('justify-content', 'space-between');
  await page.getByRole('button', { name: 'Gap: Auto' }).click();

  // A child filling the row's width turns the hugging row into a fixed width.
  await rows(page, 'Rectangle 2').click();
  await page.locator('.ed-size-row').first().locator('select').selectOption('fill');
  await rows(page, 'Frame 1').click();
  await expect(page.locator('.ed-size-row').first().locator('select')).toHaveValue('fixed');
});

test('drag layers into and out of auto layout', async ({ page }) => {
  await openEditor(page);
  const box = await navRow(page);
  // A loose rectangle dropped between items joins the row.
  await page.keyboard.press('r');
  await drag(page, { x: box.x + 200, y: box.y + 300 }, { x: box.x + 240, y: box.y + 340 });
  await expect(rows(page, 'Rectangle 4')).toHaveAttribute('aria-level', '2');
  const second = (await page.locator('.ed-page [data-node-id]').nth(3).boundingBox())!; // Rectangle 2 inside the row
  await page.mouse.move(box.x + 220, box.y + 320);
  await page.mouse.down();
  await page.mouse.move(box.x + 230, box.y + 250, { steps: 4 });
  await page.mouse.move(second.x + 4, second.y + second.height / 2, { steps: 6 });
  await expect(page.locator('.ed-drop-target')).toBeVisible();
  await expect(page.locator('.ed-drop-indicator')).toBeVisible();
  await page.mouse.up();
  await expect(rows(page, 'Rectangle 4')).toHaveAttribute('aria-level', '3');

  // Dragging an item out onto the empty page frees it again.
  const item = (await page.locator('.ed-page [data-node-id]').nth(2).boundingBox())!;
  await rows(page, 'Frame 1').click();
  await page.keyboard.press('Enter'); // select the children…
  await rows(page, 'Rectangle 1').click(); // …then just one
  await drag(page, { x: item.x + item.width / 2, y: item.y + item.height / 2 }, { x: box.x + 600, y: box.y + 280 });
  await expect(rows(page, 'Rectangle 1')).toHaveAttribute('aria-level', '2');
  await expect(page.locator('.ed-ghost')).toHaveCount(0);

  // Dropping over empty canvas (outside the page) cancels the move.
  await rows(page, 'Rectangle 2').click();
  const r2 = (await page.locator('.ed-page [data-node-id]').nth(2).boundingBox())!;
  const order = await page.locator('.ed-row').allInnerTexts();
  await drag(page, { x: r2.x + r2.width / 2, y: r2.y + r2.height / 2 }, { x: box.x + box.width + 120, y: box.y + 40 });
  expect(await page.locator('.ed-row').allInnerTexts()).toEqual(order);
});
