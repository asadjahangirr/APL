import { test, expect, type Page } from '@playwright/test';
import type { DesignDocument } from '../src/design/schema';

type FixtureWindow = Window & { designFixture: { snapshot: () => DesignDocument; nodeBounds: (id: string) => { x: number; y: number; width: number; height: number }; nodePosition: (id: string) => { x: number; y: number }; unmount: () => void } };

async function fixture(page: Page, selected: string[], zoom: number, outsideChild = false) {
  await page.route('**/src/main.tsx', route => route.fulfill({ contentType: 'text/javascript', body: 'export {};' }));
  await page.goto('/');
  await page.evaluate(async ({ selected, zoom, outsideChild }) => {
    const fixturePath = '/tests/fixtures/design-interaction.tsx', schemaPath = '/src/design/schema.ts';
    const { mountInteractionFixture } = await import(/* @vite-ignore */ fixturePath);
    const { createArtboard, createLayer, emptyDesign } = await import(/* @vite-ignore */ schemaPath);
    const container = document.createElement('div');
    Object.assign(container.style, { position: 'fixed', top: '0', left: '0' });
    document.body.append(container);
    const design = {
      ...emptyDesign(), artboards: [createArtboard({ id: 'board', width: 400, height: 300 })],
      layers: [
        createLayer('frame', 'board', outsideChild ? { id: 'parent', x: 40, y: 40, width: 100, height: 80, rotation: 0, fill: '#cccccc' } : { id: 'parent', x: 160, y: 20, width: 200, height: 200, rotation: 90 }),
        createLayer('rectangle', 'board', outsideChild ? { id: 'child', parentId: 'parent', x: 120, y: 55, width: 100, height: 20, fill: '#0000ff' } : { id: 'child', parentId: 'parent', x: 200, y: 60, width: 40, height: 40, fill: '#0000ff' }),
        createLayer('rectangle', 'board', { id: 'root', x: 260, y: 40, width: 40, height: 40, fill: '#ff0000' }),
      ],
    };
    (window as unknown as FixtureWindow).designFixture = mountInteractionFixture(container, design, selected, zoom);
  }, { selected, zoom, outsideChild });
}

async function position(page: Page, id: string) {
  return page.evaluate(id => (window as unknown as FixtureWindow).designFixture.nodePosition(id), id);
}
async function snapshot(page: Page) { return page.evaluate(() => (window as unknown as FixtureWindow).designFixture.snapshot()); }
async function startDrag(page: Page, id: string, dx: number, dy: number) {
  const bounds = await page.evaluate(id => (window as unknown as FixtureWindow).designFixture.nodeBounds(id), id);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await page.mouse.move(center.x, center.y); await page.mouse.down();
  await page.mouse.move(center.x + dx, center.y + dy, { steps: 10 });
}

test('a rotated-parent child follows a real pointer drag at different canvas zoom levels', async ({ page }) => {
  for (const zoom of [0.5, 1.75]) {
    await fixture(page, ['child'], zoom);
    const original = await position(page, 'child');
    await startDrag(page, 'child', 15, 8); await page.mouse.up();
    await expect.poll(async () => (await snapshot(page)).layers.find(layer => layer.id === 'child')!.x).toBeCloseTo(200 + 8 / zoom, 5);
    const model = (await snapshot(page)).layers.find(layer => layer.id === 'child')!;
    expect(model.y).toBeCloseTo(60 - 15 / zoom, 5);
    const after = await position(page, 'child');
    expect(after.x - original.x).toBeCloseTo(15, 5);
    expect(after.y - original.y).toBeCloseTo(8, 5);
    await page.evaluate(() => (window as unknown as FixtureWindow).designFixture.unmount());
  }
});

test('mixed-parent multi-selection keeps both layers under the pointer during preview and commit', async ({ page }) => {
  await fixture(page, ['child', 'root'], 1);
  const beforeChild = await position(page, 'child'), beforeRoot = await position(page, 'root');
  await startDrag(page, 'child', 20, 10);
  const previewChild = await position(page, 'child'), previewRoot = await position(page, 'root');
  expect(previewChild.x - beforeChild.x).toBeCloseTo(20, 5);
  expect(previewChild.y - beforeChild.y).toBeCloseTo(10, 5);
  expect(previewRoot.x - beforeRoot.x).toBeCloseTo(20, 5);
  expect(previewRoot.y - beforeRoot.y).toBeCloseTo(10, 5);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).layers.find(layer => layer.id === 'root')!.x).toBeCloseTo(280, 5);
  const child = (await snapshot(page)).layers.find(layer => layer.id === 'child')!;
  expect(child.x).toBeCloseTo(210, 5); expect(child.y).toBeCloseTo(40, 5);
  const afterChild = await position(page, 'child'), afterRoot = await position(page, 'root');
  expect(afterChild.x - beforeChild.x).toBeCloseTo(20, 5); expect(afterChild.y - beforeChild.y).toBeCloseTo(10, 5);
  expect(afterRoot.x - beforeRoot.x).toBeCloseTo(20, 5); expect(afterRoot.y - beforeRoot.y).toBeCloseTo(10, 5);
});

test('dragging a selected parent from its child keeps the group selected and moves descendants once', async ({ page }) => {
  await fixture(page, ['parent'], 1);
  const before = await position(page, 'child');
  await startDrag(page, 'child', 18, 12); await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).layers.find(layer => layer.id === 'parent')!.x).toBeCloseTo(178, 5);
  const model = await snapshot(page);
  expect(model.layers.find(layer => layer.id === 'parent')!.y).toBeCloseTo(32, 5);
  expect(model.layers.find(layer => layer.id === 'child')!.x).toBeCloseTo(218, 5);
  expect(model.layers.find(layer => layer.id === 'child')!.y).toBeCloseTo(72, 5);
  const after = await position(page, 'child');
  expect(after.x - before.x).toBeCloseTo(18, 5); expect(after.y - before.y).toBeCloseTo(12, 5);
});

test('selection controls still resize mixed-parent nodes together after native drag proxy removal', async ({ page }) => {
  await fixture(page, ['child', 'root'], 1);
  const bounds = await page.evaluate(() => {
    const child = (window as unknown as FixtureWindow).designFixture.nodeBounds('child');
    const root = (window as unknown as FixtureWindow).designFixture.nodeBounds('root');
    return { right: Math.max(child.x + child.width, root.x + root.width), bottom: Math.max(child.y + child.height, root.y + root.height) };
  });
  await page.mouse.move(bounds.right, bounds.bottom); await page.mouse.down();
  await page.mouse.move(bounds.right + 22, bounds.bottom + 6, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).layers.find(layer => layer.id === 'root')!.width).toBeCloseTo(44, 5);
  const design = await snapshot(page), root = design.layers.find(layer => layer.id === 'root')!, child = design.layers.find(layer => layer.id === 'child')!;
  expect(root.height).toBeCloseTo(44, 5);
  expect(child.width).toBeCloseTo(44, 5); expect(child.height).toBeCloseTo(44, 5);
});

test('frame handles follow the declared clipped rectangle, even when its child extends far outside', async ({ page }) => {
  await fixture(page, ['parent'], 1, true);
  const bounds = await page.evaluate(() => (window as unknown as FixtureWindow).designFixture.nodeBounds('parent'));
  expect(bounds).toEqual({ x: 60, y: 60, width: 100, height: 80 });
  const original = await page.locator('.konvajs-content canvas').first().evaluate(element => {
    const canvas = element as HTMLCanvasElement, context = canvas.getContext('2d')!;
    return { inside: [...context.getImageData(155, 80, 1, 1).data], clipped: [...context.getImageData(165, 80, 1, 1).data] };
  });
  expect(original.inside).toEqual([0, 0, 255, 255]); expect(original.clipped).toEqual([255, 255, 255, 255]);
  await page.mouse.move(bounds.x + bounds.width, bounds.y + bounds.height); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width + 30, bounds.y + bounds.height + 20, { steps: 10 });
  const preview = await page.evaluate(() => ({ frame: (window as unknown as FixtureWindow).designFixture.nodeBounds('parent'), child: (window as unknown as FixtureWindow).designFixture.nodeBounds('child') }));
  expect(preview.frame.width).toBeCloseTo(130, 5); expect(preview.frame.height).toBeCloseTo(100, 5);
  expect(preview.child.width).toBeCloseTo(100, 5); expect(preview.child.height).toBeCloseTo(20, 5);
  expect(preview.child.x).toBeCloseTo(140, 5); expect(preview.child.y).toBeCloseTo(75, 5);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).layers.find(layer => layer.id === 'parent')!.width).toBeCloseTo(130, 5);
  expect((await snapshot(page)).layers.find(layer => layer.id === 'parent')!.height).toBeCloseTo(100, 5);
  const child = (await snapshot(page)).layers.find(layer => layer.id === 'child')!;
  expect(child.width).toBe(100); expect(child.height).toBe(20);
  expect(child.x).toBeCloseTo(120, 5); expect(child.y).toBeCloseTo(55, 5);
  const exported = await page.evaluate(async () => {
    const exportPath = '/src/design/export.ts';
    const { renderArtboardPNG } = await import(/* @vite-ignore */ exportPath);
    const design = (window as unknown as FixtureWindow).designFixture.snapshot();
    const bitmap = await createImageBitmap(await renderArtboardPNG(design, 'board'));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close();
    return { inside: [...context.getImageData(165, 65, 1, 1).data], clipped: [...context.getImageData(175, 65, 1, 1).data] };
  });
  expect(exported.inside).toEqual([0, 0, 255, 255]); expect(exported.clipped).toEqual([255, 255, 255, 255]);
});
