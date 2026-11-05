import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { newProject } from '../src/project/templates';
import { createStudioProject, type StudioProject } from '../src/project/studio-document';
import { createArtboard, createLayer, emptyDesign } from '../src/design/schema';

const artifacts = '.artifacts/phase-3';
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Give your design a working life.' });
async function currentStudio(page: Page): Promise<StudioProject> {
  return page.evaluate(async () => {
    const id = location.hash.split('/').at(-1)!;
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('apl-studio', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { return await new Promise<StudioProject>((resolve, reject) => { const request = db.transaction('projects', 'readonly').objectStore('projects').get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  });
}
async function acknowledge(page: Page) {
  for (const input of await dialog(page).locator('.conversion-issue.warning input[type="checkbox"]').all()) await input.check();
}
async function inspectSizes(page: Page) {
  const review = dialog(page);
  const frame = page.frameLocator('iframe[title="Conversion website comparison"]');
  for (const width of [390, 768, 1280]) {
    await review.getByRole('button', { name: new RegExp(`(?:Mobile|Tablet|Desktop).*${width}`) }).click();
    await expect.poll(() => frame.locator('body').evaluate(body => ({ width: window.innerWidth, overflow: body.scrollWidth > window.innerWidth + 1 }))).toEqual({ width, overflow: false });
    await expect(frame.locator('h1')).toHaveCount(1);
    await expect.poll(() => frame.locator('h1').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `${artifacts}/comparison-${width}.png` });
  }
  await review.getByLabel('Approve responsive comparison').check();
}
test('an editable business design becomes a responsive semantic page, real contact export, and restorable connected backup', async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(artifacts, { recursive: true });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Blank design canvas/ }).click();
  await page.getByRole('button', { name: /Explore a business design/ }).click();
  await expect.poll(async () => (await currentStudio(page))?.design.artboards.length).toBeGreaterThanOrEqual(1);
  const before = await currentStudio(page);
  await page.getByRole('button', { name: 'Convert to website', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Review$/ }).click();
  await acknowledge(page);
  await dialog(page).getByRole('button', { name: 'Prepare comparison', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Conversion website comparison"]');
  await expect(frame.locator('h1')).toBeVisible({ timeout: 30_000 });
  await expect(dialog(page).getByRole('button', { name: 'Apply to Build', exact: true })).toBeDisabled();
  await inspectSizes(page);
  let requests = 0; page.on('request', request => { if (request.url().includes('/api/contact')) requests++; });
  await frame.getByLabel('Your name', { exact: true }).fill('Preview Visitor');
  await frame.getByLabel('Email address', { exact: true }).fill('preview@example.com');
  await frame.getByLabel('What are you working on?', { exact: true }).fill('This is a simulated inquiry in the editor.');
  await frame.locator('form').getByRole('button', { name: /Send/ }).click();
  await expect(frame.locator('form')).toContainText(/preview|sample|simulated/i);
  expect(requests).toBe(0);
  const link = frame.locator('a.apl-link-button').first();
  await expect(link).toHaveAttribute('href', /#contact|#c-/);
  await link.click();
  await dialog(page).getByRole('button', { name: 'Apply to Build', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Build', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect.poll(async () => (await currentStudio(page))?.conversions.length).toBe(1);
  const converted = await currentStudio(page);
  expect(converted.design).toEqual(before.design);
  expect(converted.website.pages.slice(0, before.website.pages.length)).toEqual(before.website.pages);
  expect(converted.website.content).toEqual(before.website.content);
  expect(converted.website.shared).toEqual(before.website.shared);
  const target = converted.website.pages.find(page => page.id === converted.conversions[0].pageId)!;
  expect(target.nodes.some(node => node.type === 'Contact')).toBe(true);
  const backupPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up', exact: true }).click();
  const backup = await backupPending;
  await backup.saveAs(`${artifacts}/accepted-converted-project.apl.json`);
  const backupStudio = JSON.parse(await readFile((await backup.path())!, 'utf8')) as StudioProject;
  expect(backupStudio).toEqual(converted);
  await page.getByRole('button', { name: /Download code/ }).click();
  const zipPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP', exact: true }).click();
  const zip = await zipPending;
  await zip.saveAs(`${artifacts}/accepted-converted-export.zip`);
  const zipBytes = await readFile((await zip.path())!);
  const files = unzipSync(zipBytes), decode = (name: string) => new TextDecoder().decode(files[name]);
  const manifest = JSON.parse(decode('export-manifest.json'));
  // The manifest format is versioned separately from Website9 / Studio10.
  expect(manifest.formatVersion).toBe(8);
  expect(manifest.modules).toEqual(['contact', 'admin-inbox']);
  expect(JSON.parse(decode('project.apl.json'))).toEqual(converted);
  expect(JSON.parse(decode('site-data.json'))).not.toHaveProperty('design');
  expect(files['src/site/authored-style.ts']).toBeDefined();
  expect(files['src/project/appearance-schema.ts']).toBeDefined();
  expect(decode('package.json')).not.toMatch(/konva|puckeditor|apl-builder/);
  const hashes: Record<string, string> = {};
  for (const name of Object.keys(manifest.files).sort()) { hashes[name] = hash(files[name]); expect(hashes[name]).toBe(manifest.files[name]); }
  expect(hash(JSON.stringify(hashes))).toBe(manifest.contentHash);
  expect(Object.keys(files)).toHaveLength(Object.keys(hashes).length + 1);
  await writeFile(`${artifacts}/download-proof.json`, JSON.stringify({ zipSha256: hash(zipBytes), contentHash: manifest.contentHash, files: Object.keys(hashes).length, pagePath: target.path, projectId: converted.id }, null, 2));
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  await page.getByRole('button', { name: 'Download design', exact: true }).click();
  const pngPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const pngDownload = await pngPending; await pngDownload.saveAs(`${artifacts}/accepted-design-images${pngDownload.suggestedFilename().endsWith('.zip') ? '.zip' : '.png'}`);
  const pdfPending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const pdf = await pdfPending; await pdf.saveAs(`${artifacts}/accepted-design.pdf`);
  expect((await PDFDocument.load(await readFile((await pdf.path())!))).getPageCount()).toBe(converted.design.artboards.length);
  await page.getByRole('dialog', { name: 'Take your design with you.' }).getByRole('button', { name: /^Close / }).click();
  await page.reload();
  await expect(page.getByRole('main', { name: 'Design workspace' })).toBeVisible();
  expect((await currentStudio(page)).conversions).toEqual(converted.conversions);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.locator('input[type="file"][accept=".json,.apl.json"]').setInputFiles(`${artifacts}/accepted-converted-project.apl.json`);
  await expect(page.getByRole('main', { name: 'Design workspace' })).toBeVisible();
  const restored = await currentStudio(page);
  expect(restored.id).not.toBe(converted.id); expect(restored.conversions).toEqual(converted.conversions); expect(restored.design).toEqual(converted.design);
  expect(errors).toEqual([]);
});

test('conversion requires explicit button actions, warns on omission, and cancellation preserves the website', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const website = newProject(), design = emptyDesign();
  const board = createArtboard({ id: 'guided-board', width: 1000, height: 700 }); design.artboards = [board];
  design.layers = [createLayer('text', board.id, { id: 'guided-title', name: 'Page headline', text: 'A useful website.', fontSize: 60 }), createLayer('text', board.id, { id: 'guided-action', name: 'Action label', text: 'Get in touch', x: 80, y: 250, fontSize: 20 })];
  const studio = createStudioProject(website, design);
  await page.locator('input[type="file"][accept=".json,.apl.json"]').setInputFiles({ name: 'guided.apl.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(studio)) });
  await expect(page.getByRole('main', { name: 'Design workspace' })).toBeVisible();
  const before = await currentStudio(page);
  await page.getByRole('button', { name: 'Convert to website', exact: true }).click();
  await dialog(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Structure$/ }).click();
  await dialog(page).getByLabel('Role for Action label').selectOption('button');
  await dialog(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Review$/ }).click();
  await expect(dialog(page)).toContainText(/Choose a real button destination|Choose.*action|destination/i);
  await expect(dialog(page).getByRole('button', { name: 'Prepare comparison' })).toBeDisabled();
  await dialog(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Connections$/ }).click();
  await dialog(page).getByLabel('Action type').selectOption('url');
  await dialog(page).getByLabel('Action destination').fill('javascript:alert(1)');
  await dialog(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Review$/ }).click();
  await expect(dialog(page).getByRole('button', { name: 'Prepare comparison' })).toBeDisabled();
  await dialog(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Structure$/ }).click();
  await dialog(page).getByLabel('Role for Action label').selectOption('ignore');
  await dialog(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Review$/ }).click();
  await expect(dialog(page)).toContainText(/explicitly omitted/);
  await expect(dialog(page).getByRole('button', { name: 'Prepare comparison' })).toBeDisabled();
  await dialog(page).getByRole('button', { name: 'Close conversion', exact: true }).click();
  expect((await currentStudio(page)).website).toEqual(before.website);
  expect((await currentStudio(page)).conversions).toEqual([]);
});
