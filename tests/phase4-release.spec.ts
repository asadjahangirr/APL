import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { unzipSync } from 'fflate';

const artifacts = '.artifacts/phase-4';
for (const template of [
  { id: 'meridian', name: 'Atelier Meridian', pages: 5, module: 'services-cms', absent: 'portfolio' },
  { id: 'mira', name: 'Mira Sol', pages: 6, module: 'portfolio-cms', absent: 'services' },
]) test(`${template.name} keeps its Design, multi-page preview, reusable sections and independent code`, async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/#/new');
  const card = page.locator('.paired-templates article').filter({ has: page.getByRole('heading', { name: template.name, exact: true }) });
  await card.getByRole('button', { name: 'Use website', exact: true }).click();
  await expect(page.getByRole('button', { name: `Pages (${template.pages})`, exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Preview/ }).click();
  const frame = page.frameLocator('iframe[title="Website preview"]');
  for (const width of [390, 768, 1280]) {
    await page.getByRole('combobox', { name: 'Width', exact: true }).selectOption(String(width));
    await expect(frame.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await frame.locator('body').evaluate(body => body.scrollWidth <= body.ownerDocument.documentElement.clientWidth)).toBe(true);
    for (const image of await frame.locator('img').all()) {
      await image.evaluate((image: HTMLImageElement) => image.decode());
    }
    const iframe = page.locator('iframe[title="Website preview"]');
    await iframe.evaluate((element: HTMLIFrameElement) => { element.style.height = element.contentDocument!.documentElement.scrollHeight + 'px'; });
    await iframe.screenshot({ path: `${artifacts}/${template.id}-${width}.png` });
    await iframe.evaluate((element: HTMLIFrameElement) => { element.style.height = 'calc(100dvh - 150px)'; });
  }
  if (template.id === 'mira') {
    await frame.getByRole('link', { name: 'Read Lumen Press case study', exact: true }).click();
    await expect(page.locator('.preview-toolbar code')).toHaveText('/work/lumen-press');
    await expect(frame.getByRole('heading', { level: 1 })).toContainText('An open page.');
  }
  await page.getByRole('button', { name: /Back to editor/ }).click();
  await page.getByRole('button', { name: 'Components', exact: true }).click();
  const components = page.getByRole('dialog', { name: 'Your reusable components.' });
  await expect(components.getByRole('heading', { name: 'Start project invitation', exact: true })).toBeVisible();
  await expect(components.locator('.release-instance-list li')).toHaveCount(template.id === 'mira' ? 4 : 3);
  await components.getByRole('button', { name: 'Close Your reusable components.' }).click();

  await page.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.getByRole('main', { name: 'Design workspace', exact: true })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('button', { name: /^Download code/ }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP', exact: true }).click();
  const download = await pending;
  await download.saveAs(`${artifacts}/${template.id}-export.zip`);
  const zip = unzipSync(await readFile((await download.path())!));
  const decode = (name: string) => new TextDecoder().decode(zip[name]);
  const backup = JSON.parse(decode('project.apl.json'));
  expect(backup.schemaVersion).toBe(10);
  expect(backup.website.pages).toHaveLength(template.pages);
  expect(backup.website.components).toHaveLength(1);
  expect(backup.design.artboards).toHaveLength(2);
  expect(backup.design.layers.length).toBeGreaterThan(20);
  expect(zip[`app/api/admin/${template.absent}/route.ts`]).toBeUndefined();
  const manifest = JSON.parse(decode('export-manifest.json'));
  expect(manifest.modules).toContain(template.module);
  for (const [name, expectedHash] of Object.entries(manifest.files)) {
    expect(createHash('sha256').update(zip[name]).digest('hex'), name).toBe(expectedHash);
  }
  for (const [name, bytes] of Object.entries(zip)) {
    const target = path.join(artifacts, `${template.id}-export`, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
});

test('a linked section can be edited, deliberately propagated, detached and reopened', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/#/new');
  const card = page.locator('.paired-templates article').filter({ has: page.getByRole('heading', { name: 'Atelier Meridian', exact: true }) });
  await card.getByRole('button', { name: 'Use website', exact: true }).click();
  const frame = page.frameLocator('iframe');
  await frame.getByRole('heading', { name: /Let’s make room/ }).click();
  await page.getByRole('textbox', { name: 'Heading text', exact: true }).fill('A new chapter, together.');
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.getByRole('button', { name: 'Components', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your reusable components.' });
  await expect(dialog.locator('.release-instance-list')).toContainText('edited in Build');
  await dialog.getByLabel('I reviewed this section in Build and want to update all its linked copies.').check();
  await dialog.getByRole('button', { name: 'Update linked copies', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'Component and its linked copies updated.' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Detach Start project invitation from Studio', exact: true }).click();
  await expect(dialog.locator('.release-instance-list li')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Close Your reusable components.' }).click();
  await page.getByLabel('Editing page', { exact: true }).selectOption('studio');
  await expect(frame.getByRole('heading', { name: 'A new chapter, together.', exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Editing page', { exact: true }).selectOption('approach');
  await expect(frame.getByRole('heading', { name: 'A new chapter, together.', exact: true })).toBeVisible();
});
