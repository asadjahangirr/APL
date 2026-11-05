import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import type { DesignDocument } from '../src/design/schema';

test.beforeEach(async ({ page }) => {
  // Keep these scene tests independent from app routing and ongoing editor HMR.
  await page.route('**/src/main.tsx', route => route.fulfill({ contentType: 'text/javascript', body: 'export {};' }));
});

test('visual PNG uses artboard bounds, frame clipping, inherited opacity, rotation, styles and decoded images', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const exportPath = '/src/design/export.ts';
    const schemaPath = '/src/design/schema.ts';
    const { renderArtboardPNG } = await import(/* @vite-ignore */ exportPath);
    const { createArtboard, createLayer, emptyDesign } = await import(/* @vite-ignore */ schemaPath);
    const source = document.createElement('canvas');
    source.width = 2; source.height = 2;
    const sourceContext = source.getContext('2d')!;
    sourceContext.fillStyle = '#ff0000'; sourceContext.fillRect(0, 0, 1, 2);
    sourceContext.fillStyle = '#00ff00'; sourceContext.fillRect(1, 0, 1, 2);
    const design: DesignDocument = {
      ...emptyDesign(),
      artboards: [createArtboard({ id: 'board', name: 'Pixel proof', x: 500, y: 250, width: 160, height: 100 })],
      assets: [{ id: 'asset', name: 'Tiny image', width: 2, height: 2, dataUrl: source.toDataURL('image/png') }],
      colors: [{ id: 'red-style', name: 'Red text', value: '#ff0000' }],
      layers: [
        createLayer('frame', 'board', { id: 'frame', x: 10, y: 10, width: 60, height: 60, opacity: 0.5 }),
        createLayer('rectangle', 'board', { id: 'clipped', parentId: 'frame', x: 50, y: 20, width: 60, height: 20, fill: '#ff0000' }),
        createLayer('rectangle', 'board', { id: 'rotated', x: 120, y: 20, width: 20, height: 10, rotation: 90, fill: '#00ff00' }),
        createLayer('image', 'board', { id: 'image', x: 100, y: 65, width: 20, height: 20, assetId: 'asset' }),
        createLayer('text', 'board', { id: 'text', x: 4, y: 75, width: 50, height: 24, fontSize: 20, text: 'APL', fill: '#0000ff', colorStyleId: 'red-style' }),
      ],
    };
    const blob = await renderArtboardPNG(design, 'board');
    const image = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
    const textPixels = context.getImageData(4, 75, 50, 24).data;
    let redTextPixels = 0;
    for (let index = 0; index < textPixels.length; index += 4) {
      if (textPixels[index] > 180 && textPixels[index + 1] < 80 && textPixels[index + 2] < 80) redTextPixels += 1;
    }
    image.close();
    return { width: canvas.width, height: canvas.height, red: pixel(55, 25), clipped: pixel(75, 25), rotated: pixel(115, 25), outsideRotation: pixel(125, 25), image: pixel(117, 75), redTextPixels, mime: blob.type, stageContainers: document.querySelectorAll('.konvajs-content').length };
  });
  expect(result).toMatchObject({ width: 160, height: 100, red: [255, 127, 127, 255], clipped: [255, 255, 255, 255], rotated: [0, 255, 0, 255], outsideRotation: [255, 255, 255, 255], mime: 'image/png' });
  expect(result.image[1]).toBeGreaterThan(230);
  expect(result.image[0]).toBeLessThan(25);
  expect(result.redTextPixels).toBeGreaterThan(30);
  expect(result.stageContainers).toBe(0);
});

test('multi-artboard PNG downloads a complete ZIP and PDF preserves page dimensions', async ({ page }) => {
  await page.goto('/');
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(async () => {
      const exportPath = '/src/design/export.ts', schemaPath = '/src/design/schema.ts';
      const { downloadDesignPNG } = await import(/* @vite-ignore */ exportPath);
      const { createArtboard, emptyDesign } = await import(/* @vite-ignore */ schemaPath);
      await downloadDesignPNG({ ...emptyDesign(), artboards: [createArtboard({ id: 'one', name: 'Same name', width: 160, height: 100 }), createArtboard({ id: 'two', name: 'Same name', width: 80, height: 50, x: 240, background: '#ff0000' })] }, undefined, 2);
    }),
  ]);
  expect(pngDownload.suggestedFilename()).toBe('apl-design-artboards.zip');
  const files = unzipSync(new Uint8Array(await readFile((await pngDownload.path())!)));
  expect(Object.keys(files)).toEqual(['01-same-name.png', '02-same-name.png']);
  const dimensions = Object.values(files).map(bytes => {
    const png = Buffer.from(bytes);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  });
  expect(dimensions).toEqual([[320, 200], [160, 100]]);
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(async () => {
      const exportPath = '/src/design/export.ts', schemaPath = '/src/design/schema.ts';
      const { downloadDesignPDF } = await import(/* @vite-ignore */ exportPath);
      const { createArtboard, emptyDesign } = await import(/* @vite-ignore */ schemaPath);
      await downloadDesignPDF({ ...emptyDesign(), artboards: [createArtboard({ id: 'one', width: 160, height: 100 }), createArtboard({ id: 'two', width: 80, height: 50, x: 240 })] });
    }),
  ]);
  expect(pdfDownload.suggestedFilename()).toBe('apl-design-artboards.pdf');
  const pdf = await PDFDocument.load(await readFile((await pdfDownload.path())!));
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPages().map(page => [page.getWidth(), page.getHeight()])).toEqual([[120, 75], [60, 37.5]]);
});

test('export errors clearly on missing/corrupt visible assets and excessive dimensions while ignoring hidden images', async ({ page }) => {
  await page.goto('/');
  const errors = await page.evaluate(async () => {
    const exportPath = '/src/design/export.ts', schemaPath = '/src/design/schema.ts';
    const { renderArtboardPNG, downloadDesignPNG, downloadDesignPDF } = await import(/* @vite-ignore */ exportPath);
    const { createArtboard, createLayer, emptyDesign } = await import(/* @vite-ignore */ schemaPath);
    const design = { ...emptyDesign(), artboards: [createArtboard({ id: 'board', width: 100, height: 100 })], layers: [createLayer('image', 'board', { id: 'image', name: 'Cover' })] };
    const error = async (doc: DesignDocument) => {
      try { await renderArtboardPNG(doc, 'board'); return 'unexpected success'; } catch (value) { return (value as Error).message; }
    };
    const missing = await error(design);
    const corrupt = await error({ ...design, assets: [{ id: 'broken', name: 'Damaged PNG', width: 1, height: 1, dataUrl: 'data:image/png;base64,YWJjZA==' }], layers: [{ ...design.layers[0], assetId: 'broken' }] });
    const oversized = await error({ ...emptyDesign(), artboards: [createArtboard({ id: 'board', width: 9000, height: 100 })] });
    const bomb = new Uint8Array(33);
    bomb.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const header = new DataView(bomb.buffer); header.setUint32(8, 13); bomb.set([73, 72, 68, 82], 12); header.setUint32(16, 12000); header.setUint32(20, 12000);
    const excessiveImage = await error({ ...design, assets: [{ id: 'bomb', name: 'Oversized compressed image', width: 1, height: 1, dataUrl: `data:image/png;base64,${btoa(String.fromCharCode(...bomb))}` }], layers: [{ ...design.layers[0], assetId: 'bomb' }] });
    header.setUint32(16, 100); header.setUint32(20, 100);
    const mismatchedImage = await error({ ...design, assets: [{ id: 'mismatch', name: 'Incorrect metadata', width: 1, height: 1, dataUrl: `data:image/png;base64,${btoa(String.fromCharCode(...bomb))}` }], layers: [{ ...design.layers[0], assetId: 'mismatch' }] });
    const hidden = await renderArtboardPNG({ ...design, layers: [{ ...design.layers[0], visible: false }] }, 'board');
    const manyBoards = { ...emptyDesign(), artboards: Array.from({ length: 5 }, (_, index) => createArtboard({ id: 'board-' + index, width: 4000, height: 4000 })) };
    const downloadError = async (operation: () => Promise<void>) => { try { await operation(); return 'unexpected success'; } catch (value) { return (value as Error).message; } };
    const batchPNG = await downloadError(() => downloadDesignPNG(manyBoards));
    const batchPDF = await downloadError(() => downloadDesignPDF(manyBoards));
    // Simulate an encoder returning a very large file without allocating 100 MB.
    // The download must stop before reading it into a ZIP or PDF.
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    let oversizedPNG: string, oversizedPDF: string;
    try {
      HTMLCanvasElement.prototype.toBlob = function(callback) { const blob = new Blob(['tiny'], { type: 'image/png' }); Object.defineProperty(blob, 'size', { value: 100_000_001 }); callback(blob); };
      const blank = { ...emptyDesign(), artboards: [createArtboard({ id: 'board', width: 100, height: 100 })] };
      oversizedPNG = await downloadError(() => downloadDesignPNG(blank));
      oversizedPDF = await downloadError(() => downloadDesignPDF(blank));
    } finally { HTMLCanvasElement.prototype.toBlob = originalToBlob; }
    return { missing, corrupt, oversized, excessiveImage, mismatchedImage, batchPNG, batchPDF, oversizedPNG, oversizedPDF, hidden: hidden.size, stageContainers: document.querySelectorAll('.konvajs-content').length };
  });
  expect(errors.missing).toContain('Cover: choose an image');
  expect(errors.corrupt).toContain('invalid or unsupported image header');
  expect(errors.oversized).toContain('too large for the browser');
  expect(errors.excessiveImage).toContain('24 million pixels');
  expect(errors.mismatchedImage).toContain('dimensions do not match');
  expect(errors.batchPNG).toContain('maximum 64 million pixels'); expect(errors.batchPDF).toContain('maximum 64 million pixels');
  expect(errors.oversizedPNG).toContain('100 MB download limit'); expect(errors.oversizedPDF).toContain('100 MB download limit');
  expect(errors.hidden).toBeGreaterThan(0);
  expect(errors.stageContainers).toBe(0);
});
