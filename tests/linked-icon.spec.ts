import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';

test('a user adds a labeled Home icon, previews its link, and downloads independent source', async ({ page }) => {
  test.setTimeout(100_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Business \/ studio/ }).click();
  await page.getByRole('button', { name: 'Add layout', exact: true }).click();
  await page.getByRole('list').getByText('Outline', { exact: true }).click();
  const tree = page.getByRole('region', { name: 'Page structure', exact: true });
  await tree.getByRole('combobox', { name: 'Element to add to Column 1', exact: true }).selectOption('Icon');
  await tree.getByRole('button', { name: 'Add Icon / linked symbol to Column 1', exact: true }).click();
  await page.getByRole('combobox', { name: 'Symbol', exact: true }).selectOption('home');
  await page.getByRole('textbox', { name: 'Accessible description', exact: true }).fill('Go to home');
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.getByRole('button', { name: /^Preview/ }).click();
  const frame = page.frameLocator('iframe[title="Website preview"]');
  const icon = frame.getByRole('link', { name: 'Go to home', exact: true });
  await expect(icon).toHaveAttribute('href', '/');
  for (const width of [390, 768, 1280]) {
    await page.getByRole('combobox', { name: 'Width', exact: true }).selectOption(String(width));
    await expect(icon.locator('svg')).toBeVisible();
  }
  await icon.click(); await expect(page.locator('.preview-toolbar code')).toHaveText('/');
  await page.getByRole('button', { name: /Back to editor/ }).click();
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Take a component with you.' });
  const option = dialog.getByLabel('Component to copy').locator('option').filter({ hasText: /^Icon \// });
  await dialog.getByLabel('Component to copy').selectOption((await option.getAttribute('value'))!);
  await expect(dialog.getByLabel('Source file')).toHaveValue('src/site/Icon.tsx');
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download bundle', exact: true }).click();
  const download = await pending;
  const folder = '.artifacts/phase-4/icon-export';
  await mkdir(folder, { recursive: true });
  await download.saveAs(folder + '.zip');
  const files = unzipSync(await readFile((await download.path())!));
  const manifest = JSON.parse(new TextDecoder().decode(files['export-manifest.json']));
  expect(manifest.modules).toEqual([]);
  expect(manifest.components).toEqual(['Section', 'Icon']);
  expect(files['src/site/IconGlyph.tsx']).toBeDefined();
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(folder, name);
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
  }
});
