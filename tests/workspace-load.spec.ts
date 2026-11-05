import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('a failed canvas module keeps navigation and backup reachable, then reload recovers', async ({ page }) => {
  await page.route('**/src/design/DesignCanvas.tsx*', route => route.abort('failed'));
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Blank design canvas/ }).click();
  await expect(page.getByRole('heading', { name: 'The workspace could not be opened.' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Build', exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up project', exact: true }).click();
  const backup = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(backup.schemaVersion).toBe(10);
  expect(backup.name).toBe('Untitled design');
  expect(backup.design.artboards).toEqual([]);
  expect(backup.website.pages[0].path).toBe('/');
  await page.unroute('**/src/design/DesignCanvas.tsx*');
  await page.getByRole('button', { name: 'Reload workspace', exact: true }).click();
  await expect(page.getByRole('main', { name: 'Design workspace', exact: true })).toBeVisible({ timeout: 30_000 });
});
