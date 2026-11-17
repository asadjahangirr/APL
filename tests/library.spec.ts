import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
const library = (page: Page) => page.getByRole('dialog', { name: 'Design library' });
async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(library(page)).toBeVisible();
}

test('browse the library, switch style, search and insert a section that can be undone', async ({ page }) => {
  await openEditor(page);
  await openLibrary(page);
  await expect(library(page).getByText(/1,\d{3} designs/)).toBeVisible();

  // Categories and search narrow the grid.
  await library(page).locator('.lib-cats button', { hasText: 'Heroes' }).click();
  await expect(library(page).locator('.lib-card')).toHaveCount(10);
  await library(page).getByRole('searchbox').fill('email');
  await expect(library(page).locator('.lib-card')).toHaveCount(1);
  await library(page).getByRole('searchbox').fill('');

  // Thumbnails are the real design rendered in the chosen style.
  await library(page).getByRole('radio', { name: 'Midnight' }).click();
  const thumb = library(page).locator('[data-design="hero-centered"] .lib-thumb');
  await expect(thumb.getByText('Ship your next idea before the week is over.')).toBeVisible();
  await expect(thumb).toHaveCSS('background-color', 'rgb(11, 13, 18)');

  // Insert: the dialog closes and the section is on the page as editable layers.
  await library(page).locator('[data-design="hero-centered"]').click();
  await expect(library(page)).toHaveCount(0);
  await expect(page.locator('.ed-page').getByText('Ship your next idea before the week is over.')).toBeVisible();
  await expect(page.locator('.ed-row', { hasText: 'Hero' }).first()).toBeVisible();
  // The empty free-form page became a vertical stack, so a second section lands below the first.
  await openLibrary(page);
  await library(page).locator('.lib-cats button', { hasText: 'Footers' }).click();
  await library(page).locator('[data-design="footer-simple"]').click();
  const hero = (await page.locator('.ed-page h1').boundingBox())!;
  const footer = (await page.locator('.ed-page footer').boundingBox())!;
  expect(footer.y).toBeGreaterThan(hero.y + hero.height);

  await page.keyboard.press('Control+z');
  await expect(page.locator('.ed-page footer')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.ed-page h1')).toHaveCount(0);
});

test('a full page inserts every section, survives reload and adapts to a phone in preview', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.press('Shift+I');
  await expect(library(page)).toBeVisible();
  await library(page).locator('.lib-cats button', { hasText: 'Full pages' }).click();
  await library(page).locator('[data-design="page-saas"]').click();
  await expect(page.locator('.ed-page nav')).toHaveCount(1);
  await expect(page.locator('.ed-page section')).toHaveCount(8);
  await expect(page.locator('.ed-page footer')).toHaveCount(1);

  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.ed-page section')).toHaveCount(8);

  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  await preview.getByRole('radio', { name: /Mobile/ }).click();
  // Desktop links are hidden on a phone and the menu button appears instead.
  await expect(preview.locator('nav').getByText('Pricing', { exact: true })).toBeHidden();
  await expect(preview.locator('nav').getByText('☰')).toBeVisible();
  // Three pricing cards stack in one column.
  const starter = (await preview.getByRole('heading', { name: 'Starter', exact: true }).boundingBox())!;
  const team = (await preview.getByRole('heading', { name: 'Team', exact: true }).boundingBox())!;
  expect(team.y).toBeGreaterThan(starter.y + 100);
  expect(Math.abs(team.x - starter.x)).toBeLessThan(2);
});

test('motion is still on the canvas, plays in preview and can be set from the Design panel', async ({ page }) => {
  await openEditor(page);
  await openLibrary(page);
  await library(page).locator('.lib-cats button', { hasText: 'Animated' }).click();
  await library(page).locator('[data-design="motion-pulse-cta"]').click();
  const button = page.locator('.ed-page').getByText('Start building — it is free').locator('..');
  await expect(button).toHaveCSS('animation-name', 'none');

  // Add a hover effect to the selected section from the Design panel.
  await page.locator('.ed-right .ed-select', { hasText: 'On hover' }).locator('select').selectOption('grow');
  await expect(page.locator('.ed-right').getByText('Motion plays in Preview')).toBeVisible();

  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  await expect(preview.getByText('Start building — it is free').locator('..')).toHaveCSS('animation-name', 'apl-loop-pulse');
});
