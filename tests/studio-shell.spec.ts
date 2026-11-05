import { test, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';

const artifacts = process.env.APL_TEST_ARTIFACTS || '.artifacts/phase-1';
test.beforeEach(async () => { await mkdir(artifacts, { recursive: true }); });

test('a visitor can preview complete examples without creating a project', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make it yours/ })).toBeVisible();
  await expect(page.getByText('Canvas available now', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/welcome-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Preview Jordan Ellis', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Website preview"]');
  await expect(frame.getByRole('heading', { level: 1 })).toContainText('Ideas with character.');
  await frame.getByRole('link', { name: /Read the case study/ }).first().click();
  await expect(page.locator('.preview-toolbar code')).toHaveText('/work/form-study');
  await expect(frame.getByRole('heading', { level: 1 })).toContainText('Finding the shape');
  for (const width of [390, 768, 1280]) {
    await page.getByRole('combobox', { name: 'Width', exact: true }).selectOption(String(width));
    expect(await frame.locator('body').evaluate(el => el.scrollWidth <= el.ownerDocument.documentElement.clientWidth)).toBe(true);
  }
  await page.getByLabel('Preview page').selectOption('contact');
  await frame.getByLabel('Your name').fill('Example visitor');
  await frame.getByLabel('Email address').fill('visitor@example.test');
  await frame.getByLabel('What are you working on?').fill('Testing the sample contact form.');
  await frame.locator('#contact button').click();
  await expect(frame.getByRole('status')).toContainText('this message was not sent');
  await page.getByRole('button', { name: /Back to studio/ }).click();
  await page.getByRole('button', { name: /Your projects/ }).click();
  await expect(page.getByText('0 projects on this device')).toBeVisible();
});

test('live theme and composition choices survive editing, reload, and code export', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByLabel('Live example').selectOption('ellis');
  await page.getByLabel('Live composition').selectOption('centered');
  await page.getByRole('button', { name: 'Try ink theme', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try ink theme' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.live-component-preview .site')).toHaveCSS('background-color', 'rgb(25, 27, 28)');
  await page.getByRole('button', { name: /Start with this look/ }).click();
  await expect(page.getByRole('button', { name: 'Pages (4)' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Preview/ }).click();
  const frame = page.frameLocator('iframe[title="Website preview"]');
  await expect(frame.locator('.site')).toHaveCSS('background-color', 'rgb(25, 27, 28)');
  await expect(frame.locator('.site-hero')).toHaveClass(/hero-centered/);
  await expect(frame.locator('.apl-image img')).toHaveCount(2);
  await page.getByRole('button', { name: /Back to editor/ }).click();
  await page.getByRole('button', { name: /^Download code/ }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP', exact: true }).click();
  const downloaded = await pending;
  await mkdir(artifacts, { recursive: true });
  await downloaded.saveAs(`${artifacts}/ellis-export.zip`);
  const zip = unzipSync(await readFile((await downloaded.path())!));
  expect(zip['app/work/form-study/page.tsx']).toBeDefined();
  expect(zip['app/work/field-notes/page.tsx']).toBeDefined();
  expect(zip['app/contact/page.tsx']).toBeDefined();
  expect(zip['app/api/contact/route.ts']).toBeDefined();
  expect(zip['lib/portfolio.ts']).toBeUndefined();
  const p = JSON.parse(new TextDecoder().decode(zip['project.apl.json']));
  expect(p.schemaVersion).toBe(10);
  expect(p.website.theme.background).toBe('#191b1c');
  expect(p.design.version).toBe(1);
  for (const [file, bytes] of Object.entries(zip)) {
    const target = path.join(artifacts + '/ellis-export', file);
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
  }
});

test('dashboard renames, duplicates, searches, backs up, and restores independent projects', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Business \/ studio/ }).click();
  await page.getByRole('textbox', { name: 'Page title / SEO', exact: true }).fill('Preserve this authored title');
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Rename My business website', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('My independent studio');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate My independent studio', exact: true }).click();
  await expect(page.getByText('2 projects on this device')).toBeVisible();
  await page.getByRole('searchbox').fill('(copy)');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open My independent studio (copy)', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page title / SEO', exact: true })).toHaveValue('Preserve this authored title');
  await page.getByRole('textbox', { name: 'Page title / SEO', exact: true }).fill('Only the duplicate changes');
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.getByLabel('Choose project', { exact: true }).selectOption({ label: 'My independent studio' });
  await expect(page.getByRole('textbox', { name: 'Page title / SEO', exact: true })).toHaveValue('Preserve this authored title');
  const backupPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up', exact: true }).click();
  const backup = await backupPending;
  await page.locator('input[type="file"][hidden]').setInputFiles((await backup.path())!);
  await expect(page.getByLabel('Choose project')).toHaveValue(/.+/);
  await expect(page.getByRole('textbox', { name: 'Page title / SEO', exact: true })).toHaveValue('Preserve this authored title');
  await expect(page.getByLabel('Choose project').locator('option')).toHaveCount(3);
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Page title / SEO', exact: true })).toHaveValue('Preserve this authored title');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const workspacePending = page.waitForEvent('download');
  await page.getByRole('button', { name: /Back up all/ }).click();
  const workspace = unzipSync(await readFile((await (await workspacePending).path())!));
  expect(Object.keys(workspace).filter(name => name.endsWith('.apl.json'))).toHaveLength(3);
  expect(workspace['RESTORE.txt']).toBeDefined();
});

test('the separate recovery snapshot preserves the original workspace through subsequent edits', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Business \/ studio/ }).click();
  const title = page.getByRole('textbox', { name: 'Page title / SEO', exact: true });
  await title.fill('Before the studio update');
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.reload();
  await expect(title).toHaveValue('Before the studio update');
  await title.fill('My newer website');
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.reload();
  await expect(title).toHaveValue('My newer website');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download recovery snapshot/ }).click();
  const zip = unzipSync(await readFile((await (await pending).path())!));
  const file = Object.keys(zip).find(name => name.endsWith('.apl.json'))!;
  const p = JSON.parse(new TextDecoder().decode(zip[file]));
  expect(p.schemaVersion).toBe(10);
  expect(p.website.pages[0].title).toBe('Before the studio update');
  await page.getByRole('button', { name: 'Open My business website', exact: true }).click();
  await expect(title).toHaveValue('My newer website');
  await page.locator('input[type="file"][hidden]').setInputFiles({ name: 'broken.apl.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":999}') });
  await expect(page.getByRole('status').filter({ hasText: 'Could not import this backup' })).toBeVisible();
  await expect(title).toHaveValue('My newer website');
  await expect(page.getByLabel('Choose project').locator('option')).toHaveCount(1);
});

test('failed saves stay recoverable when another project saves successfully', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'projects' && value.name === 'Unsaved website') throw new DOMException('Simulated quota failure', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Business \/ studio/ }).click();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Unsaved website');
  await expect(page.getByRole('alert').filter({ hasText: 'could not be saved' })).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: /Personal portfolio/ }).click();
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('My portfolio');
  await expect(page.getByRole('alert').filter({ hasText: 'could not be saved' })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery backup' }).click();
  const zip = unzipSync(await readFile((await (await pending).path())!));
  const data = JSON.parse(new TextDecoder().decode(zip[Object.keys(zip).find(name => name.endsWith('.apl.json'))!]));
  expect(data.name).toBe('Unsaved website');
});

test('welcome, dashboard, and project creation fit mobile and tablet screens', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.locator('body').evaluate(el => el.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `${artifacts}/welcome-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Your projects/ }).click();
  await expect(page.getByRole('heading', { name: 'Room for your ideas.' })).toBeVisible();
  expect(await page.locator('body').evaluate(el => el.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${artifacts}/dashboard-empty-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: /Create your first project/ }).click();
  await page.screenshot({ path: `${artifacts}/new-mobile.png`, fullPage: true });
  expect(await page.locator('body').evaluate(el => el.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button', { name: /Use Northline Studio/ }).click();
  await expect(page.getByRole('button', { name: 'Pages (3)' })).toBeVisible();
  await expect(page.frameLocator('iframe').getByRole('heading', { level: 1 })).toContainText('A clear direction.');
  expect(await page.locator('body').evaluate(el => el.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${artifacts}/build-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.getByRole('main', { name: 'Design workspace', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Give your idea/ })).toBeVisible();
  expect(await page.locator('body').evaluate(el => el.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${process.env.APL_TEST_ARTIFACTS || '.artifacts/phase-2'}/canvas-from-website-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pages (3)' })).toBeVisible();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.screenshot({ path: `${artifacts}/dashboard-mobile.png`, fullPage: true });
  expect(await page.locator('body').evaluate(el => el.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('Northline exports complete routes and original local images', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Use Northline Studio/ }).click();
  await expect(page.getByRole('textbox', { name: 'Page title / SEO', exact: true })).toHaveValue('Home | Northline Studio');
  await page.screenshot({ path: `${artifacts}/build-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: /^Preview/ }).click();
  const frame = page.frameLocator('iframe[title="Website preview"]');
  await frame.getByRole('link', { name: 'Our approach', exact: true }).click();
  await expect(page.locator('.preview-toolbar code')).toHaveText('/about');
  await page.locator('iframe').screenshot({ path: `${artifacts}/northline-about.png` });
  await page.getByRole('button', { name: /Back to editor/ }).click();
  await page.getByRole('button', { name: /^Download code/ }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP', exact: true }).click();
  const downloaded = await pending;
  await downloaded.saveAs(`${artifacts}/northline-export.zip`);
  const zip = unzipSync(await readFile((await downloaded.path())!));
  expect(zip['app/about/page.tsx']).toBeDefined(); expect(zip['app/contact/page.tsx']).toBeDefined();
  expect(Object.keys(zip).some(file => /^public\/assets\/.*\.webp$/.test(file))).toBe(true);
  expect(zip['app/api/contact/route.ts']).toBeDefined(); expect(zip['lib/services.ts']).toBeUndefined();
  for (const [file, bytes] of Object.entries(zip)) {
    const target = path.join(artifacts + '/northline-export', file);
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
  }
});
