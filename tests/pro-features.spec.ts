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
const panel = (page: Page) => page.locator('.ed-right');

test('FAQ accordion: questions show and hide their answers in preview', async ({ page }) => {
  await openEditor(page);
  await insert(page, 'FAQ', 'faq-list');
  await page.getByRole('button', { name: 'Preview' }).click();
  const site = page.getByRole('dialog', { name: 'Preview' }).locator('.ed-preview-site');

  const questions = site.locator('button[data-apl-toggle]');
  expect(await questions.count()).toBeGreaterThan(3);
  const second = questions.nth(1);
  const answer = site.locator('#' + (await second.getAttribute('data-apl-toggle')));
  await expect(answer).toBeHidden();
  await expect(second).toHaveAttribute('aria-expanded', 'false');
  await second.click();
  await expect(answer).toBeVisible();
  await expect(second).toHaveAttribute('aria-expanded', 'true');
  await second.click();
  await expect(answer).toBeHidden();

  // The first answer starts open and closes on click.
  const first = questions.first();
  const firstAnswer = site.locator('#' + (await first.getAttribute('data-apl-toggle')));
  await expect(firstAnswer).toBeVisible();
  await first.click();
  await expect(firstAnswer).toBeHidden();
});

test('a layer can scroll to another layer and stick while the page scrolls', async ({ page }) => {
  await openEditor(page);
  await insert(page, 'Animated', 'motion-scroll-story');
  await insert(page, 'FAQ', 'faq-list');

  // Make the sticky intro's eyebrow scroll to the FAQ section.
  await page.locator('.ed-row', { hasText: 'How it works' }).first().click();
  await panel(page).getByLabel('When clicked').selectOption('scroll');
  await panel(page).locator('label.ed-select', { has: page.locator('span', { hasText: /^Layer$/ }) }).locator('select').selectOption({ label: 'FAQ' });

  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  const stage = preview.locator('.ed-preview-stage');

  // Sticky: after scrolling down, the intro is still near the top of the window.
  const sticky = preview.locator('.ed-preview-site h2', { hasText: 'Every step, one scroll at a time.' });
  await stage.evaluate(el => el.scrollTo({ top: 500 }));
  await expect.poll(async () => (await sticky.boundingBox())!.y - (await stage.boundingBox())!.y).toBeLessThan(260);

  await preview.getByRole('link', { name: 'How it works' }).click();
  const faq = preview.locator('.ed-preview-site section').last();
  await expect.poll(async () => Math.abs((await faq.boundingBox())!.y - (await stage.boundingBox())!.y)).toBeLessThan(40);
});

test('embed a YouTube video and custom code; both play in preview', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Embed video, map or code' }).click();
  await expect(page.locator('.ed-page .apl-embed-empty')).toBeVisible();
  const address = panel(page).getByLabel('Address');
  await address.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await address.press('Enter');
  await expect(page.locator('.ed-page iframe.apl-embed')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');

  await panel(page).getByLabel('Show').selectOption('code');
  await expect(page.locator('.ed-page iframe.apl-embed')).toHaveAttribute('sandbox', /allow-scripts/);

  await page.getByRole('button', { name: 'Preview' }).click();
  const frame = page.getByRole('dialog', { name: 'Preview' }).frameLocator('iframe.apl-embed');
  await expect(frame.getByRole('button', { name: 'Click me' })).toBeVisible();
  // Click where the button shows on screen (Preview scales the page; the sample centers its button).
  const box = (await page.getByRole('dialog', { name: 'Preview' }).locator('iframe.apl-embed').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(frame.getByRole('button', { name: 'Clicked 1×' })).toBeVisible();
});

test('version history: save a version, change the design, restore it', async ({ page }) => {
  await openEditor(page);
  await insert(page, 'FAQ', 'faq-list');
  await page.keyboard.press('Control+Alt+s');
  const dialog = page.getByRole('dialog', { name: 'Version history' });
  await dialog.getByLabel('Version name').fill('With FAQ');
  await dialog.getByRole('button', { name: 'Save version' }).click();
  await expect(dialog.getByText('With FAQ')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+z');
  await expect(page.locator('.ed-page section')).toHaveCount(0);

  await page.locator('.ed-logo').click();
  await page.getByRole('menuitem', { name: 'Version history…' }).click();
  await dialog.locator('li', { hasText: 'With FAQ' }).getByRole('button', { name: 'Restore' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.ed-page section')).toHaveCount(1);
  // The design before restoring was kept as a version too.
  await page.keyboard.press('Control+Alt+s');
  await expect(dialog.getByText('Before restoring “With FAQ”')).toBeVisible();
});

test('publishing settings and new style controls are in the Design panel', async ({ page }) => {
  await openEditor(page);
  await panel(page).getByLabel('Page transition').selectOption('fade');
  const address = panel(page).getByLabel('Site address');
  await address.fill('https://example.com');
  await address.press('Enter');
  await expect(panel(page).getByLabel('Site address')).toHaveValue('https://example.com');

  await insert(page, 'FAQ', 'faq-list');
  await page.locator('.ed-row', { hasText: 'Answer' }).first().click();
  await panel(page).getByLabel('Max lines').selectOption('1');
  await panel(page).getByLabel('Blend').selectOption('multiply');
  await expect(panel(page).getByLabel('Max lines')).toHaveValue('1');
  // The canvas shows the change: the answer is cut to one line and multiplies with its background.
  await expect.poll(() => page.locator('.ed-page').evaluate(root => [...root.querySelectorAll('p')].filter(p => getComputedStyle(p).webkitLineClamp === '1' && getComputedStyle(p).mixBlendMode === 'multiply').length)).toBe(1);
});
