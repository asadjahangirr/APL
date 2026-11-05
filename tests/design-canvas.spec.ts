import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { newProject } from '../src/project/templates';
import { projectSchema as legacyV7ProjectSchema } from '../src/project/legacy-v7-schema';
import type { StudioProject } from '../src/project/studio-document';

const artifacts = '.artifacts/phase-2';
test.use({ actionTimeout: 15_000 });
const workspace = (page: Page) => page.getByRole('main', { name: 'Design workspace', exact: true });
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const errors: string[] = []; runtimeErrors.set(page, errors); page.on('pageerror', error => errors.push(error.message)); });
test.afterEach(({ page }, info) => { if (info.status === 'passed') expect(runtimeErrors.get(page), 'The canvas journey must finish without uncaught browser errors.').toEqual([]); });

async function blankDesign(page: Page) {
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Blank design canvas/ }).click();
  await expect(workspace(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Give your idea/ })).toBeVisible({ timeout: 30_000 });
}
async function addBoard(page: Page, preset: 'Desktop' | 'Mobile', name: string, height?: number) {
  await page.getByRole('toolbar', { name: 'Design tools' }).getByRole('button', { name: 'Add artboard', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'A screen for your idea' });
  await dialog.getByRole('button', { name: new RegExp('^' + preset) }).click();
  await dialog.getByLabel('New artboard name', { exact: true }).fill(name);
  await dialog.getByLabel('New artboard name', { exact: true }).blur();
  if (height !== undefined) { await dialog.getByLabel('New artboard height').fill(String(height)); await dialog.getByLabel('New artboard height').blur(); }
  await dialog.getByRole('button', { name: 'Create artboard', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Artboards', exact: true }).getByRole('button', { name: new RegExp('^' + name) })).toHaveAttribute('aria-pressed', 'true');
}
async function field(page: Page, label: string, value: string | number) {
  const input = label === 'Text content' ? page.getByRole('textbox', { name: label, exact: true }) : page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.blur();
}
async function savedStudio(page: Page): Promise<StudioProject | undefined> {
  return page.evaluate(async () => {
    const id = location.hash.split('/').at(-1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('apl-studio', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { return await new Promise((resolve, reject) => { const request = db.transaction('projects', 'readonly').objectStore('projects').get(id!); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  });
}
async function backup(page: Page): Promise<StudioProject> {
  await page.getByRole('button', { name: 'Download design', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download APL backup', exact: true }).click();
  const download = await pending;
  await mkdir(artifacts, { recursive: true });
  const journey = test.info().title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70);
  await download.saveAs(`${artifacts}/${journey}-${download.suggestedFilename()}`);
  const studio = JSON.parse(await readFile((await download.path())!, 'utf8')) as StudioProject;
  await page.getByRole('dialog', { name: 'Take your design with you.' }).getByRole('button', { name: /^Close / }).click();
  return studio;
}
const importInput = (page: Page) => page.locator('input[type="file"][accept=".json,.apl.json"]');

test('a beginner creates multi-artboard layers, reusable styles, groups, and an independent editable restore', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blankDesign(page);
  await page.getByRole('button', { name: 'Canvas guide', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: 'A canvas, without the guesswork.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Layers keep you organized.' })).toBeVisible();
  await page.getByRole('button', { name: "Let's make something", exact: true }).click();
  await addBoard(page, 'Desktop', 'Landing / desktop');
  await page.getByRole('button', { name: 'Add text (T)', exact: true }).click();
  await field(page, 'Layer name', 'Headline');
  await field(page, 'Text content', 'Make room for a different idea.');
  await page.getByRole('combobox', { name: 'Font family', exact: true }).selectOption('Georgia');
  await field(page, 'Font size', 48);
  await field(page, 'X', 64);
  await field(page, 'Y', 72);
  await field(page, 'Text color value', '#234b34');
  await page.getByRole('button', { name: 'Save as a type style', exact: true }).click();
  await page.getByLabel('Style name', { exact: true }).fill('Hero type');
  await page.getByLabel('Style name', { exact: true }).blur();
  await page.getByRole('button', { name: 'Save style', exact: true }).click();
  await page.getByRole('button', { name: 'Save as a color style', exact: true }).click();
  await page.getByLabel('Style name', { exact: true }).fill('Forest');
  await page.getByLabel('Style name', { exact: true }).blur();
  await page.getByRole('button', { name: 'Save style', exact: true }).click();
  await page.getByRole('button', { name: 'Add text (T)', exact: true }).click();
  await field(page, 'Layer name', 'Supporting words');
  await field(page, 'Text content', 'Design freely. Keep it yours.');
  await page.getByRole('combobox', { name: 'Type style', exact: true }).selectOption({ label: 'Hero type' });
  await page.getByRole('combobox', { name: 'Color style', exact: true }).selectOption({ label: 'Forest' });
  await field(page, 'Y', 200);
  await field(page, 'Forest value', '#165b3d');
  await field(page, 'Hero type font size', 52);
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('52');
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Add frame (F)', exact: true }).click();
  await field(page, 'Layer name', 'Content frame');
  await page.getByRole('button', { name: 'Add rectangle (R)', exact: true }).click();
  await field(page, 'Layer name', 'Card background');
  await field(page, 'Corner radius', 24);
  await page.getByRole('button', { name: 'Add ellipse (O)', exact: true }).click();
  await field(page, 'Layer name', 'Accent circle');
  await page.getByRole('button', { name: 'Select Card background', exact: true }).click();
  await page.getByRole('button', { name: 'Select Accent circle', exact: true }).click({ modifiers: ['Shift'] });
  await expect(page.locator('.dc-selection-toolbar')).toContainText('2 selected');
  await page.getByRole('button', { name: /^Group selection/ }).click();
  await field(page, 'Layer name', 'Shapes together');
  await page.getByRole('button', { name: /^Undo \(/ }).click();
  await expect(page.getByRole('button', { name: 'Select Group', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Undo \(/ }).click();
  await expect(page.getByRole('button', { name: 'Select Group', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Redo \(/ }).click();
  await page.getByRole('button', { name: /^Redo \(/ }).click();
  await page.getByRole('button', { name: 'Select Shapes together', exact: true }).click();
  await page.getByRole('button', { name: 'Lock selection', exact: true }).click();
  await expect(page.getByLabel('X', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Unlock selection', exact: true }).click();
  await expect(page.getByLabel('X', { exact: true })).toBeEnabled();
  const raster = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48; const context = canvas.getContext('2d')!; context.fillStyle = '#b87948'; context.fillRect(0, 0, 64, 48); return canvas.toDataURL('image/png').split(',')[1]; });
  await page.getByLabel('Upload design image', { exact: true }).setInputFiles({ name: 'Studio art.png', mimeType: 'image/png', buffer: Buffer.from(raster, 'base64') });
  await expect(page.getByRole('button', { name: 'Select Studio art.png', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Inside frame / group', exact: true }).selectOption({ label: 'Content frame' });
  await field(page, 'X', 144); await field(page, 'Y', 180);
  await addBoard(page, 'Mobile', 'Landing / mobile');
  await page.getByRole('button', { name: 'Add text (T)', exact: true }).click();
  await field(page, 'Layer name', 'Mobile headline');
  await field(page, 'Text content', 'Room for your ideas.');
  await page.getByRole('combobox', { name: 'Color style', exact: true }).selectOption({ label: 'Forest' });
  await expect.poll(async () => (await savedStudio(page))?.design.artboards.length).toBe(2);
  await expect.poll(async () => (await savedStudio(page))?.design.layers.find(layer => layer.name === 'Mobile headline')?.text).toBe('Room for your ideas.');
  const authored = await backup(page);
  expect(authored.schemaVersion).toBe(10);
  expect(authored.design.assets).toHaveLength(1);
  expect(authored.design.layers.find(layer => layer.name === 'Headline')).toMatchObject({ fill: '#165b3d', fontSize: 52 });
  expect(authored.design.layers.find(layer => layer.name === 'Supporting words')).toMatchObject({ fill: '#165b3d', fontSize: 52 });
  const shapes = authored.design.layers.find(layer => layer.name === 'Shapes together')!;
  expect(authored.design.layers.filter(layer => layer.parentId === shapes.id)).toHaveLength(2);
  await page.reload();
  await expect(workspace(page)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Artboards', exact: true }).getByRole('button')).toHaveCount(2);
  const reopened = await backup(page);
  expect(reopened.design).toEqual(authored.design);
  expect(reopened.website).toEqual(authored.website);
  await importInput(page).setInputFiles({ name: 'Restored.apl.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(authored)) });
  await expect(workspace(page)).toBeVisible();
  await expect(page.getByLabel('Choose project', { exact: true }).locator('option')).toHaveCount(2);
  const restored = await backup(page);
  expect(restored.id).not.toBe(authored.id);
  expect(restored.design).toEqual(authored.design);
  expect(restored.website.pages).toEqual(authored.website.pages);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page title / SEO', exact: true })).toHaveValue(authored.website.pages[0].title);
});

test('untouched fractional number fields preserve geometry and linked typography', async ({ page }) => {
  await blankDesign(page);
  await addBoard(page, 'Mobile', 'Precision screen');
  await page.getByRole('button', { name: 'Add text (T)', exact: true }).click();
  await field(page, 'X', 100.1234);
  await field(page, 'Font size', 24.1234);
  await page.getByRole('button', { name: 'Save as a type style', exact: true }).click();
  await page.getByLabel('Style name', { exact: true }).fill('Precise type');
  await page.getByLabel('Style name', { exact: true }).blur();
  await page.getByRole('button', { name: 'Save style', exact: true }).click();
  const before = await backup(page);
  expect(before.design.layers[0]).toMatchObject({ x: 100.1234, fontSize: 24.1234 });
  expect(before.design.layers[0].typeStyleId).toBeTruthy();
  for (const name of ['X', 'Font size', 'Precise type font size']) {
    await page.getByLabel(name, { exact: true }).focus();
    await page.getByLabel(name, { exact: true }).blur();
  }
  expect(await backup(page)).toEqual(before);
});

test('pointer drag and corner resize persist geometry and keyboard undo restores the gesture', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blankDesign(page);
  await addBoard(page, 'Mobile', 'Interaction screen', 400);
  await page.getByLabel('Canvas zoom', { exact: true }).selectOption('100');
  await page.getByRole('button', { name: 'Snap to edges and centers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Snap to edges and centers' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Add rectangle (R)', exact: true }).click();
  await field(page, 'Width', 100); await field(page, 'Height', 80); await field(page, 'X', 50); await field(page, 'Y', 60);
  await field(page, 'Fill value', '#e93a85');
  // Read the rendered rectangle's pixels. All movement and handle interaction below use real pointer events.
  async function pixels() {
    return page.locator('.dc-stage-host canvas').first().evaluate(canvasElement => {
      const canvas = canvasElement as HTMLCanvasElement, context = canvas.getContext('2d')!, image = context.getImageData(0, 0, canvas.width, canvas.height), box = canvas.getBoundingClientRect();
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) { const index = (y * canvas.width + x) * 4; if (image.data[index] === 233 && image.data[index + 1] === 58 && image.data[index + 2] === 133 && image.data[index + 3] === 255) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); } }
      if (right < left) throw new Error('The authored rectangle is not visible on the canvas.');
      return { left: box.x + left * box.width / canvas.width, top: box.y + top * box.height / canvas.height, right: box.x + (right + 1) * box.width / canvas.width, bottom: box.y + (bottom + 1) * box.height / canvas.height };
    });
  }
  const original = await pixels();
  const center = { x: (original.left + original.right) / 2, y: (original.top + original.bottom) / 2 };
  await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.mouse.move(center.x + 40, center.y + 30, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => (await savedStudio(page))?.design.layers[0].x).toBeCloseTo(90, 1);
  await expect(page.getByLabel('Y', { exact: true })).toHaveValue('90');
  const moved = await pixels();
  await page.mouse.move(moved.right, moved.bottom); await page.mouse.down(); await page.mouse.move(moved.right + 60, moved.bottom + 40, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => (await savedStudio(page))?.design.layers[0].width).toBeCloseTo(160, 1);
  await expect(page.getByLabel('Height', { exact: true })).toHaveValue('120');
  await page.locator('.dc-stage-host').focus();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await savedStudio(page))?.design.layers[0].width).toBe(100);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => (await savedStudio(page))?.design.layers[0].width).toBeCloseTo(160, 1);
  await page.getByRole('button', { name: 'Select Rectangle', exact: true }).click();
  await page.locator('.dc-stage-host').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(async () => (await savedStudio(page))?.design.layers[0].x).toBeCloseTo(100, 1);
  await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: `${artifacts}/canvas-pointer-edit.png` });
  await page.reload(); await expect(workspace(page)).toBeVisible();
  const reopened = await backup(page);
  for (const [key, expected] of Object.entries({ width: 160, height: 120, x: 100, y: 90 })) expect(reopened.design.layers[0][key as 'width' | 'height' | 'x' | 'y']).toBeCloseTo(expected, 1);
});

test('one pointer resize of multiple layers is one complete undo and redo gesture', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blankDesign(page);
  await addBoard(page, 'Mobile', 'Selection resize screen', 400);
  await page.getByLabel('Canvas zoom', { exact: true }).selectOption('100');
  await page.getByRole('button', { name: 'Snap to edges and centers', exact: true }).click();
  for (const rectangle of [
    { name: 'First rectangle', x: 50, y: 60, fill: '#e93a85' },
    { name: 'Second rectangle', x: 220, y: 180, fill: '#2774e7' },
  ]) {
    await page.getByRole('button', { name: 'Add rectangle (R)', exact: true }).click();
    await field(page, 'Layer name', rectangle.name);
    await field(page, 'Width', 100); await field(page, 'Height', 80);
    await field(page, 'X', rectangle.x); await field(page, 'Y', rectangle.y);
    await field(page, 'Fill value', rectangle.fill);
  }
  const before = await backup(page);
  await page.getByRole('button', { name: 'Select First rectangle', exact: true }).click();
  await page.getByRole('button', { name: 'Select Second rectangle', exact: true }).click({ modifiers: ['Shift'] });
  for (const name of ['First rectangle', 'Second rectangle']) await expect(page.getByRole('button', { name: 'Select ' + name, exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Locate the real selection handle from the two authored colors, without
  // reaching into application state or invoking transform callbacks.
  const bounds = await page.locator('.dc-stage-host canvas').first().evaluate(canvasElement => {
    const canvas = canvasElement as HTMLCanvasElement, context = canvas.getContext('2d')!, pixels = context.getImageData(0, 0, canvas.width, canvas.height), box = canvas.getBoundingClientRect();
    let right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      const pink = pixels.data[index] === 233 && pixels.data[index + 1] === 58 && pixels.data[index + 2] === 133;
      const blue = pixels.data[index] === 39 && pixels.data[index + 1] === 116 && pixels.data[index + 2] === 231;
      if ((pink || blue) && pixels.data[index + 3] === 255) { right = Math.max(right, x); bottom = Math.max(bottom, y); }
    }
    if (right < 0) throw new Error('The selected rectangles are not visible on the canvas.');
    return { right: box.x + (right + 1) * box.width / canvas.width, bottom: box.y + (bottom + 1) * box.height / canvas.height };
  });
  await page.mouse.move(bounds.right, bounds.bottom); await page.mouse.down();
  await page.mouse.move(bounds.right + 54, bounds.bottom + 40, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => (await savedStudio(page))?.design.layers.every(layer => layer.width > 100 && layer.height > 80)).toBe(true);
  const resized = await backup(page);
  expect(resized.design.layers).toHaveLength(2);
  for (const layer of resized.design.layers) { expect(layer.width).toBeCloseTo(120, 1); expect(layer.height).toBeCloseTo(96, 1); }

  await page.locator('.dc-stage-host').focus();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await savedStudio(page))?.design).toEqual(before.design);
  expect((await backup(page)).design).toEqual(before.design);
  await page.locator('.dc-stage-host').focus();
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => (await savedStudio(page))?.design).toEqual(resized.design);
  expect((await backup(page)).design).toEqual(resized.design);
});

test('an authored v7 backup opens an empty Design and preserves the complete Website document', async ({ page }) => {
  test.setTimeout(90_000);
  const { components: _components, ...historical } = newProject('business');
  const legacy = legacyV7ProjectSchema.parse({ ...historical, schemaVersion: 7 });
  legacy.name = 'Authored before canvas'; legacy.pages[0].title = 'A title from version 7';
  legacy.pages.push({ ...structuredClone(legacy.pages[0]), id: 'private-route', path: '/private-story', name: 'Private story', inNavigation: false, title: 'Keep this hidden page', nodes: [] });
  await page.goto('/#/new');
  await importInput(page).setInputFiles({ name: 'version7.apl.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(workspace(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Give your idea/ })).toBeVisible();
  const migrated = await backup(page);
  expect(migrated.design.artboards).toEqual([]); expect(migrated.design.layers).toEqual([]);
  expect(migrated.website.pages).toEqual(legacy.pages); expect(migrated.website.content).toEqual(legacy.content); expect(migrated.website.shared).toEqual(legacy.shared); expect(migrated.website.theme).toEqual(legacy.theme);
  const invalid = { ...migrated, design: { ...migrated.design, version: 999 } };
  await importInput(page).setInputFiles({ name: 'unknown-design.apl.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole('status').filter({ hasText: 'Could not import this backup' })).toBeVisible();
  await expect(page.getByLabel('Choose project').locator('option')).toHaveCount(1);
  expect((await backup(page)).website.pages).toEqual(legacy.pages);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page title / SEO', exact: true })).toHaveValue('A title from version 7');
});

test('quota-failed Design stays recoverable after Build edits and a different project saves', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'projects' && value.schemaVersion === 10 && value.design.layers.some((layer: { text: string }) => layer.text === 'Recovery-only text')) throw new DOMException('Simulated Design quota failure', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blankDesign(page); await addBoard(page, 'Mobile', 'Recovery screen');
  await page.getByRole('button', { name: 'Add text (T)', exact: true }).click();
  await field(page, 'Text content', 'Recovery-only text');
  await expect(page.getByRole('alert').filter({ hasText: 'could not be saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('textbox', { name: 'Page title / SEO', exact: true }).fill('Website edit after the Design failure');
  await expect(page.getByRole('alert').filter({ hasText: 'could not be saved' })).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: /Personal portfolio/ }).click();
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('My portfolio');
  await expect(page.getByRole('alert').filter({ hasText: 'could not be saved' })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery backup', exact: true }).click();
  const zip = unzipSync(await readFile((await (await pending).path())!));
  const file = Object.keys(zip).find(name => name.endsWith('.apl.json'))!;
  const recovered = JSON.parse(new TextDecoder().decode(zip[file])) as StudioProject;
  expect(recovered.design.layers[0].text).toBe('Recovery-only text');
  expect(recovered.website.pages[0].title).toBe('Website edit after the Design failure');
  const other = await savedStudio(page);
  expect(other?.website.name).toBe('My portfolio');
  // Restore in a fresh browser storage context, without the injected quota failure.
  const restoredContext = await page.context().browser()!.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const restorePage = await restoredContext.newPage(); restorePage.on('pageerror', error => runtimeErrors.get(page)!.push(error.message)); await restorePage.goto('/#/new');
    await importInput(restorePage).setInputFiles({ name: 'Recovered.apl.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(recovered)) });
    await restorePage.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(workspace(restorePage)).toBeVisible();
    const restored = await backup(restorePage);
    expect(restored.design).toEqual(recovered.design); expect(restored.website.pages).toEqual(recovered.website.pages);
  } finally { await restoredContext.close(); }
});

test('empty and populated canvas, beginner guide, and mobile controls fit 390, 768, and 1440 screens', async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(artifacts, { recursive: true });
  await blankDesign(page);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator('body').evaluate(body => body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `${artifacts}/canvas-empty-${width}.png` });
  }
  await page.getByRole('button', { name: /Or explore an editable design study/ }).click();
  await expect.poll(async () => (await savedStudio(page))?.design.artboards.length).toBe(2);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Fit all artboards', exact: true }).click();
    expect(await page.locator('body').evaluate(body => body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `${artifacts}/canvas-study-${width}.png` });
    const openLayers = page.getByRole('button', { name: 'Open layers panel', exact: true });
    if (await openLayers.isVisible()) {
      await openLayers.click();
      await expect(page.getByRole('group', { name: 'Artboards', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Select Editorial title', exact: true }).click();
      const closeLayers = page.getByRole('button', { name: 'Close layers panel', exact: true });
      if (await closeLayers.isVisible()) await closeLayers.click();
      await page.getByRole('button', { name: 'Open properties panel', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Text content', exact: true })).toHaveValue('Room for\na different idea.');
      expect(await page.locator('body').evaluate(body => body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: `${artifacts}/canvas-properties-${width}.png` });
      await page.getByRole('button', { name: 'Close properties panel', exact: true }).click();
    }
  }
  await page.getByRole('button', { name: 'Canvas guide', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'A canvas, without the guesswork.' })).toBeVisible();
  expect(await page.locator('body').evaluate(body => body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${artifacts}/canvas-guide-mobile.png` });
});

test('Download design produces a selected 2x PNG, an ordered artboard ZIP, and a matching visual PDF', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blankDesign(page);
  await page.getByRole('button', { name: /Or explore an editable design study/ }).click();
  await expect.poll(async () => (await savedStudio(page))?.design.artboards.length).toBe(2);
  const original = await backup(page);
  const desktop = original.design.artboards[0], mobile = original.design.artboards[1];
  await page.getByRole('button', { name: 'Select Editorial title', exact: true }).click();
  await page.getByRole('button', { name: 'Download design', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Take your design with you.' });
  await dialog.getByRole('combobox', { name: 'PNG artboards', exact: true }).selectOption('selected');
  await dialog.getByRole('combobox', { name: 'PNG resolution', exact: true }).selectOption('2');
  const selectedPending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const selectedDownload = await selectedPending;
  expect(selectedDownload.suggestedFilename()).toMatch(/\.png$/);
  const selectedPNG = await readFile((await selectedDownload.path())!);
  expect(selectedPNG.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect([selectedPNG.readUInt32BE(16), selectedPNG.readUInt32BE(20)]).toEqual([desktop.width * 2, desktop.height * 2]);
  const pixels = await page.evaluate(async dataUrl => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const node = new Image(); node.onload = () => resolve(node); node.onerror = () => reject(new Error('The downloaded PNG did not decode.')); node.src = dataUrl; });
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    return { background: Array.from(context.getImageData(2, 2, 1, 1).data), claySun: Array.from(context.getImageData(948 * 2, 333 * 2, 1, 1).data) };
  }, `data:image/png;base64,${selectedPNG.toString('base64')}`);
  expect(pixels.background).toEqual([247, 244, 236, 255]);
  expect(pixels.claySun).toEqual([197, 105, 69, 255]);
  await mkdir(artifacts, { recursive: true }); await selectedDownload.saveAs(`${artifacts}/studio-desktop-2x.png`);
  await dialog.getByRole('combobox', { name: 'PNG artboards', exact: true }).selectOption('all');
  await dialog.getByRole('combobox', { name: 'PNG resolution', exact: true }).selectOption('1');
  const allPending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const allDownload = await allPending;
  expect(allDownload.suggestedFilename()).toBe('apl-design-artboards.zip');
  const artboards = unzipSync(await readFile((await allDownload.path())!));
  const files = Object.keys(artboards);
  expect(files).toHaveLength(2); expect(files[0]).toMatch(/^01-.*\.png$/); expect(files[1]).toMatch(/^02-.*\.png$/);
  for (const [index, board] of [desktop, mobile].entries()) {
    const bytes = Buffer.from(artboards[files[index]]);
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([board.width, board.height]);
  }
  await allDownload.saveAs(`${artifacts}/studio-artboards-original-size.zip`);
  const pdfPending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const pdfDownload = await pdfPending;
  const pdf = await PDFDocument.load(await readFile((await pdfDownload.path())!));
  expect(pdfDownload.suggestedFilename()).toBe('apl-design-artboards.pdf');
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPages().map(pdfPage => pdfPage.getSize())).toEqual([{ width: desktop.width * 0.75, height: desktop.height * 0.75 }, { width: mobile.width * 0.75, height: mobile.height * 0.75 }]);
  await pdfDownload.saveAs(`${artifacts}/studio-artboards-visual.pdf`);
  await dialog.getByRole('button', { name: /^Close / }).click();
  const after = await backup(page);
  expect(after.design).toEqual(original.design); expect(after.website).toEqual(original.website);
  expect((await savedStudio(page))?.design).toEqual(original.design);
});

test('dashboard shows Design covers and duplicates the whole canvas into an independently editable project', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blankDesign(page);
  await page.getByRole('button', { name: /Or explore an editable design study/ }).click();
  await expect.poll(async () => (await savedStudio(page))?.design.artboards.length).toBe(2);
  const original = await backup(page);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(page.locator('.design-project-cover svg')).toHaveCount(1);
  await expect(page.locator('.project-card')).toContainText(/2 artboards.*website/);
  await expect(page.getByRole('button', { name: 'Design Untitled design', exact: true })).toBeVisible();
  await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: `${artifacts}/dashboard-with-design.png`, fullPage: true });
  await page.getByRole('button', { name: 'Duplicate Untitled design', exact: true }).click();
  await expect(page.getByText('2 projects on this device', { exact: true })).toBeVisible();
  await expect(page.locator('.design-project-cover svg')).toHaveCount(2);
  await page.getByRole('button', { name: 'Design Untitled design (copy)', exact: true }).click();
  await expect(workspace(page)).toBeVisible({ timeout: 30_000 });
  const copy = await backup(page);
  expect(copy.id).not.toBe(original.id); expect(copy.design).toEqual(original.design); expect(copy.website.pages).toEqual(original.website.pages);
  await page.getByRole('button', { name: 'Select Wordmark', exact: true }).click();
  await field(page, 'Text content', 'The independently edited copy');
  await expect.poll(async () => (await savedStudio(page))?.design.layers.find(layer => layer.name === 'Wordmark')?.text).toBe('The independently edited copy');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Design Untitled design', exact: true }).click();
  await expect(workspace(page)).toBeVisible({ timeout: 30_000 });
  expect((await backup(page)).design).toEqual(original.design);
});
