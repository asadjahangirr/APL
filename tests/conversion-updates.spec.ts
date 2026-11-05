import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createArtboard, createLayer, emptyDesign } from '../src/design/schema';
import { newProject } from '../src/project/templates';
import { walkNodes } from '../src/project/schema';
import { createStudioProject, type StudioProject } from '../src/project/studio-document';
import { analyzeConversion, compareConversion, compileConversion, suggestConversionPlan } from '../src/conversion/engine';

const review = (page: Page) => page.getByRole('dialog', { name: 'Give your design a working life.' });
const importInput = (page: Page) => page.locator('input[type="file"][accept=".json,.apl.json"]');
const errors = new WeakMap<Page, string[]>();
test.use({ viewport: { width: 1440, height: 1000 }, actionTimeout: 15_000 });
test.beforeEach(({ page }) => { const values: string[] = []; errors.set(page, values); page.on('pageerror', error => values.push(error.message)); });
test.afterEach(({ page }, info) => { if (info.status === 'passed') expect(errors.get(page)).toEqual([]); });

async function fixture(options: { editedBuild?: boolean; occupiedCopy?: boolean } = {}): Promise<StudioProject> {
  const website = { ...newProject(), name: 'Linked conversion proof', updatedAt: '2026-10-03T10:00:00.000Z' };
  if (options.occupiedCopy) {
    const existing = structuredClone(website.pages[0]);
    existing.id = 'occupied-copy-page'; existing.name = 'Existing copy route'; existing.path = '/linked-proof-copy';
    existing.nodes = existing.nodes.filter(node => node.type === 'Hero').map(node => ({ ...node, id: 'occupied-copy-hero' }));
    website.pages.push(existing);
  }
  const board = createArtboard({ id: 'linked-desktop', name: 'Linked proof', width: 1200, height: 700 });
  const design = { ...emptyDesign(), artboards: [board], layers: [
    createLayer('text', board.id, { id: 'linked-heading', name: 'Page heading', text: 'An approved first heading.', x: 64, y: 64, width: 900, height: 120, fontSize: 56 }),
    createLayer('text', board.id, { id: 'linked-paragraph', name: 'Introduction', text: 'Native content that stays editable in both documents.', x: 64, y: 220, width: 700, height: 90, fontSize: 18 })
  ] };
  const plan = suggestConversionPlan(design, board.id, website);
  plan.page = { ...plan.page, name: 'Linked proof', path: '/linked-proof', title: 'Approved linked proof', description: 'Keep these search details intact.' };
  const acknowledgedWarnings = analyzeConversion(design, website, plan).issues.filter(issue => issue.severity === 'warning').map(issue => issue.id);
  const result = await compileConversion(design, website, plan, { acknowledgedWarnings, now: '2026-10-03T12:00:00.000Z' });
  const target = result.website.pages.find(page => page.id === result.record.pageId)!;
  target.nodes.push({ id: 'unrelated-build-note', type: 'Text', props: { title: 'Unrelated Build note', body: 'Keep this authored content through every conversion update.', align: 'left' } });
  if (options.editedBuild) {
    const heading = walkNodes(target.nodes).find(node => node.type === 'Heading')!;
    if (heading.type !== 'Heading') throw new Error('Expected a native Heading.');
    heading.props.text = 'Edited directly in Build.';
  }
  return createStudioProject(result.website, design, [result.record]);
}

async function stored(page: Page): Promise<StudioProject> {
  return page.evaluate(async () => {
    const id = location.hash.split('/').at(-1)!;
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('apl-studio', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { return await new Promise<StudioProject>((resolve, reject) => { const request = db.transaction('projects', 'readonly').objectStore('projects').get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  });
}

async function openFixture(page: Page, studio: StudioProject) {
  await page.goto('/#/new');
  await importInput(page).setInputFiles({ name: 'linked-proof.apl.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(studio)) });
  await expect(page.getByRole('main', { name: 'Design workspace', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await stored(page))?.conversions.length).toBe(1);
}

async function editSource(page: Page, text: string) {
  await page.getByRole('button', { name: 'Select Page heading', exact: true }).click();
  await page.getByRole('textbox', { name: 'Text content', exact: true }).fill(text);
  await page.getByRole('textbox', { name: 'Text content', exact: true }).blur();
  await expect.poll(async () => (await stored(page))?.design.layers.find(layer => layer.id === 'linked-heading')?.text).toBe(text);
}

async function chooseLinkedConversion(page: Page, status: string) {
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('button', { name: 'Compare conversions', exact: true }).click();
  const history = review(page).locator('button.conversion-history').filter({ hasText: 'Linked proof' });
  await expect(history).toContainText(status);
  await history.click();
}

async function prepare(page: Page) {
  await review(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Review$/ }).click();
  for (const input of await review(page).locator('.conversion-issue.warning input[type="checkbox"]').all()) await input.check();
  await expect(review(page).getByRole('button', { name: 'Prepare comparison', exact: true })).toBeEnabled();
  await review(page).getByRole('button', { name: 'Prepare comparison', exact: true }).click();
  await expect(page.frameLocator('iframe[title="Conversion website comparison"]').locator('h1')).toBeVisible({ timeout: 30_000 });
}

async function approveAndApply(page: Page) {
  const frame = page.frameLocator('iframe[title="Conversion website comparison"]');
  for (const width of [390, 768, 1280]) {
    await review(page).getByRole('button', { name: new RegExp(`(?:Mobile|Tablet|Desktop).*${width}`) }).click();
    await expect.poll(() => frame.locator('body').evaluate(body => ({ width: window.innerWidth, overflow: body.scrollWidth > window.innerWidth + 1 }))).toEqual({ width, overflow: false });
  }
  await review(page).getByLabel('Approve responsive comparison').check();
  await review(page).getByRole('button', { name: 'Apply to Build', exact: true }).click();
  await expect(review(page)).toHaveCount(0);
}

async function backup(page: Page): Promise<StudioProject> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as StudioProject;
}

test('a later Design change explicitly updates connected roots while preserving page settings and authored content', async ({ page }) => {
  test.setTimeout(120_000);
  await openFixture(page, await fixture());
  const before = await stored(page), oldRecord = before.conversions[0];
  await editSource(page, 'A reviewed second heading.');
  const editedDesign = (await stored(page)).design;
  await chooseLinkedConversion(page, 'design changed');
  await prepare(page);
  await expect(review(page).getByLabel('Conversion update choice')).toHaveValue('replace');
  await expect(review(page).getByRole('checkbox', { name: /Also apply the page/ })).not.toBeChecked();
  await expect(page.frameLocator('iframe[title="Conversion website comparison"]').locator('h1')).toHaveText('A reviewed second heading.');
  await approveAndApply(page);
  await expect.poll(async () => (await stored(page)).conversions[0].sourceFingerprint).not.toBe(oldRecord.sourceFingerprint);
  const updated = await stored(page), record = updated.conversions[0];
  expect(updated.design).toEqual(editedDesign);
  expect(updated.conversions).toHaveLength(1);
  expect(record.id).toBe(oldRecord.id); expect(record.pageId).toBe(oldRecord.pageId); expect(record.targetRootIds).toEqual(oldRecord.targetRootIds);
  const target = updated.website.pages.find(page => page.id === record.pageId)!;
  const originalTarget = before.website.pages.find(page => page.id === record.pageId)!;
  expect({ ...target, nodes: [] }).toEqual({ ...originalTarget, nodes: [] });
  expect(target.nodes.find(node => node.id === 'unrelated-build-note')).toEqual(originalTarget.nodes.find(node => node.id === 'unrelated-build-note'));
  expect(updated.website.pages.filter(page => page.id !== record.pageId)).toEqual(before.website.pages.filter(page => page.id !== record.pageId));
  expect(updated.website.content).toEqual(before.website.content); expect(updated.website.shared).toEqual(before.website.shared);
  expect(await compareConversion(updated.design, updated.website, record)).toBe('current');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Compare conversions', exact: true })).toBeVisible();
  expect((await stored(page)).conversions).toEqual(updated.conversions);
});

test('Build conflicts default to a unique copy and show current Build before an explicitly reviewed replacement is cancelled', async ({ page }) => {
  test.setTimeout(120_000);
  await openFixture(page, await fixture({ editedBuild: true, occupiedCopy: true }));
  const before = await stored(page);
  await chooseLinkedConversion(page, 'website changed');
  await expect(review(page).getByLabel('Page address', { exact: true })).toHaveValue('/linked-proof-copy-2');
  await review(page).getByRole('navigation', { name: 'Conversion steps' }).getByRole('button', { name: /Review$/ }).click();
  await expect(review(page).getByLabel('Conversion update choice')).toHaveValue('copy');
  await review(page).getByLabel('Conversion update choice').selectOption('replace');
  await expect(review(page)).toContainText('overwrites edits inside them');
  await prepare(page);
  await review(page).getByText('Compare with the current Build page before replacing it', { exact: true }).click();
  await expect(page.frameLocator('iframe[title="Current Build comparison"]').locator('h1')).toHaveText('Edited directly in Build.');
  await expect(page.frameLocator('iframe[title="Conversion website comparison"]').locator('h1')).toHaveText('An approved first heading.');
  await review(page).getByRole('button', { name: 'Close conversion', exact: true }).click();
  expect((await stored(page)).website).toEqual(before.website);
  expect((await stored(page)).conversions).toEqual(before.conversions);
});

test('a quota-failed conversion retains a complete connected backup and its records survive a later Build retry', async ({ page }) => {
  test.setTimeout(120_000);
  const initial = await fixture(), originalRecord = initial.conversions[0];
  await page.addInitScript(({ id, sourceFingerprint }) => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      const allowWrites = (window as unknown as { allowConversionWrites?: boolean }).allowConversionWrites;
      if (!allowWrites && this.name === 'projects' && value.schemaVersion === 10 && value.conversions.some((record: { id: string; sourceFingerprint: string }) => record.id === id && record.sourceFingerprint !== sourceFingerprint)) throw new DOMException('Simulated conversion quota failure', 'QuotaExceededError');
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
  }, { id: originalRecord.id, sourceFingerprint: originalRecord.sourceFingerprint });
  await openFixture(page, initial);
  await editSource(page, 'A recovery-only converted heading.');
  await chooseLinkedConversion(page, 'design changed');
  await prepare(page); await approveAndApply(page);
  await expect(page.getByRole('alert').filter({ hasText: 'could not be saved' })).toBeVisible();
  const persisted = await stored(page);
  expect(persisted.conversions[0].sourceFingerprint).toBe(originalRecord.sourceFingerprint);
  const recovered = await backup(page);
  expect(recovered.schemaVersion).toBe(10); expect(recovered.conversions).toHaveLength(1);
  expect(recovered.conversions[0].id).toBe(originalRecord.id);
  expect(recovered.conversions[0].pageId).toBe(originalRecord.pageId);
  expect(recovered.conversions[0].targetRootIds).toEqual(originalRecord.targetRootIds);
  expect(recovered.conversions[0].sourceFingerprint).not.toBe(originalRecord.sourceFingerprint);
  expect(recovered.design.layers.find(layer => layer.id === 'linked-heading')?.text).toBe('A recovery-only converted heading.');
  expect(await compareConversion(recovered.design, recovered.website, recovered.conversions[0])).toBe('current');
  await page.evaluate(() => { (window as unknown as { allowConversionWrites?: boolean }).allowConversionWrites = true; });
  await page.getByRole('textbox', { name: 'Page title / SEO', exact: true }).fill('Saved after conversion retry');
  await expect.poll(async () => (await stored(page)).conversions[0].sourceFingerprint).toBe(recovered.conversions[0].sourceFingerprint);
  const saved = await stored(page);
  expect(saved.design).toEqual(recovered.design); expect(saved.conversions).toEqual(recovered.conversions);
  expect(saved.website.pages.find(page => page.id === originalRecord.pageId)?.title).toBe('Saved after conversion retry');
  await expect(page.getByRole('button', { name: 'Download recovery backup', exact: true })).toHaveCount(0);
});
