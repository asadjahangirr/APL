import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

test('a builder can inspect source and download a selective component bundle', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Business \/ studio/ }).click();
  await page.getByRole('button', { name: 'Copy code' }).click();

  const dialog = page.getByRole('dialog', { name: 'Take a component with you.' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Source file')).toHaveValue('src/site/Hero.tsx');
  await expect(dialog.getByLabel('Component source code')).toContainText('function Hero');
  await expect(dialog.getByText('frontend component')).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await dialog.getByRole('button', { name: 'Copy file', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('File copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('function Hero');

  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download bundle' }).click();
  const download = await pending;
  const zip = unzipSync(await readFile((await download.path())!));
  expect(zip['README.md']).toBeDefined();
  expect(zip['src/site/Hero.tsx']).toBeDefined();
  expect(zip['src/site/Contact.tsx']).toBeUndefined();
  expect(zip['app/api/contact/route.ts']).toBeUndefined();
  expect(JSON.parse(new TextDecoder().decode(zip['export-manifest.json'])).components).toEqual(['Hero']);

  const contact = await dialog.getByLabel('Component to copy').locator('option', { hasText: 'Contact' }).first().getAttribute('value');
  expect(contact).toBeTruthy();
  await dialog.getByLabel('Component to copy').selectOption(contact!);
  await expect(dialog.getByLabel('Source file')).toHaveValue('src/site/Contact.tsx');
  await expect(dialog.getByText(/contact, admin-inbox/)).toBeVisible();
  await expect(dialog.getByText(/needs its included backend setup/)).toBeVisible();
});

