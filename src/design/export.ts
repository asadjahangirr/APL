import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Konva from 'konva';
import { Layer, Stage } from 'react-konva';
import { RenderArtboard, preloadDesignImages } from './DesignScene';
import { designSchema, type Artboard, type DesignDocument } from './schema';
import { filename } from '../project/schema';

export const MAX_EXPORT_PIXELS = 16_000_000;
export const MAX_EXPORT_DIMENSION = 8192;
export const MAX_EXPORT_BATCH_PIXELS = 64_000_000;
export const MAX_EXPORT_ENCODED_BYTES = 100_000_000;

export function assertExportSize(artboard: Pick<Artboard, 'name' | 'width' | 'height'>, scale = 1) {
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 4) throw new Error('Choose an export scale between 0.1× and 4×.');
  const width = Math.ceil(artboard.width * scale);
  const height = Math.ceil(artboard.height * scale);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error(`${artboard.name}: this artboard needs valid dimensions before it can be exported.`);
  }
  if (width > MAX_EXPORT_DIMENSION || height > MAX_EXPORT_DIMENSION || width * height > MAX_EXPORT_PIXELS) {
    throw new Error(`${artboard.name}: this export is too large for the browser. Choose a smaller scale or artboard (maximum 16 million pixels and 8,192 pixels per side).`);
  }
  // The temporary live Stage also needs to fit, even for a downscaled output.
  if (artboard.width > MAX_EXPORT_DIMENSION || artboard.height > MAX_EXPORT_DIMENSION || artboard.width * artboard.height > MAX_EXPORT_PIXELS) {
    throw new Error(`${artboard.name}: split this large design into smaller artboards before exporting (maximum 16 million pixels and 8,192 pixels per side).`);
  }
  return { width, height };
}

export function assertExportBatch(artboards: Pick<Artboard, 'name' | 'width' | 'height'>[], scale = 1) {
  const pixels = artboards.reduce((sum, board) => {
    const dimensions = assertExportSize(board, scale);
    return sum + dimensions.width * dimensions.height;
  }, 0);
  if (pixels > MAX_EXPORT_BATCH_PIXELS) {
    throw new Error('This download contains too much artwork for the browser (maximum 64 million pixels). For PNG, choose the current artboard or 1× resolution. For PDF, use smaller artboards or split the design into projects.');
  }
}

function assertEncodedBytes(bytes: number) {
  if (bytes > MAX_EXPORT_ENCODED_BYTES) {
    throw new Error('These files exceed the 100 MB download limit. For PNG, choose the current artboard or 1× resolution. For PDF, use smaller artboards or split the design into projects.');
  }
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.download = name;
  link.href = url;
  globalThis.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Render only the artboard, excluding zoom, handles, guides and editor chrome. */
export async function renderArtboardPNG(document: DesignDocument, artboardId: string, scale = 1, region?: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  const design = designSchema.parse(document);
  const artboard = design.artboards.find(board => board.id === artboardId);
  if (!artboard) throw new Error('Choose an existing artboard to export.');
  assertExportSize(artboard, scale);
  const dimensions = assertExportSize(region ? { ...region, name: artboard.name } : artboard, scale);
  await preloadDesignImages(design, artboardId);
  await globalThis.document.fonts.ready;

  const container = globalThis.document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  Object.assign(container.style, { position: 'fixed', left: '-100000px', top: '0', opacity: '0', pointerEvents: 'none' });
  globalThis.document.body.append(container);
  const root = createRoot(container);
  let stage: Konva.Stage | null = null;
  try {
    flushSync(() => root.render(createElement(Stage, {
      width: artboard.width,
      height: artboard.height,
      ref: (node: Konva.Stage | null) => { stage = node; },
    }, createElement(Layer, { listening: false }, createElement(RenderArtboard, {
      document: design,
      artboard: { ...artboard, x: 0, y: 0 },
    })))));
    const rendered = stage as Konva.Stage | null;
    if (!rendered) throw new Error('The artboard renderer could not start. Try the download again.');
    rendered.draw();
    const canvas = rendered.toCanvas({
      x: region?.x ?? 0, y: region?.y ?? 0,
      width: dimensions.width / scale,
      height: dimensions.height / scale,
      pixelRatio: scale,
    });
    if (!canvas.width || !canvas.height) throw new Error('The browser could not create this image. Choose a smaller artboard.');
    try {
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob && blob.size > 0 ? resolve(blob) : reject(new Error('The browser could not encode this PNG. Choose a smaller artboard.')), 'image/png');
      });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    flushSync(() => root.unmount());
    container.remove();
  }
}

/** Only decoration and its clipping ancestors are rendered; overlapping text is excluded. */
export async function renderDecorationPNG(document: DesignDocument, artboardId: string, layerIds: string[]): Promise<string> {
  const { decorationBounds } = await import('../conversion/engine');
  const bounds = decorationBounds(document, artboardId, layerIds);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) throw new Error('This decorative artwork has no visible bounds.');
  const roots = new Set(layerIds), included = new Set<string>(), ancestors = new Set<string>();
  const byId = new Map(document.layers.map(layer => [layer.id, layer]));
  for (const layer of document.layers) {
    let current = layer;
    while (true) {
      if (roots.has(current.id)) { included.add(layer.id); break; }
      if (!current.parentId) break;
      current = byId.get(current.parentId)!;
    }
  }
  if (document.layers.some(layer => included.has(layer.id) && layer.type === 'text' && layer.visible)) throw new Error('Meaningful text must remain a website element. Remove text from this decorative artwork.');
  for (const id of included) {
    let parent = byId.get(id)?.parentId;
    while (parent) { if (!included.has(parent)) ancestors.add(parent); parent = byId.get(parent)?.parentId; }
  }
  const isolated = designSchema.parse({ ...document,
    artboards: document.artboards.map(board => board.id === artboardId ? { ...board, background: 'transparent' } : board),
    layers: document.layers.filter(layer => included.has(layer.id) || ancestors.has(layer.id)).map(layer => ancestors.has(layer.id) ? { ...layer, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, colorStyleId: null } : layer),
  });
  const blob = await renderArtboardPNG(isolated, artboardId, 1, bounds);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not encode decorative artwork.')); reader.readAsDataURL(blob);
  });
}

export async function downloadDesignPNG(document: DesignDocument, artboardIds?: string[], scale = 1): Promise<void> {
  const design = designSchema.parse(document);
  const chosen = artboardIds ? new Set(artboardIds) : null;
  const artboards = design.artboards.filter(board => !chosen || chosen.has(board.id));
  if (!artboards.length) throw new Error('Add or choose an artboard before downloading a PNG.');
  if (chosen && artboards.length !== chosen.size) throw new Error('An artboard selected for export no longer exists.');
  // Validate every board before starting a long export or preparing a partial ZIP.
  assertExportBatch(artboards, scale);
  if (artboards.length === 1) {
    const blob = await renderArtboardPNG(design, artboards[0].id, scale);
    assertEncodedBytes(blob.size);
    downloadBlob(`${filename(artboards[0].name)}.png`, blob);
    return;
  }
  const { zipSync } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  let encodedBytes = 0;
  for (const [index, artboard] of artboards.entries()) {
    const blob = await renderArtboardPNG(design, artboard.id, scale);
    encodedBytes += blob.size;
    assertEncodedBytes(encodedBytes);
    files[`${String(index + 1).padStart(2, '0')}-${filename(artboard.name)}.png`] = new Uint8Array(await blob.arrayBuffer());
  }
  const bytes = zipSync(files, { level: 0 });
  assertEncodedBytes(bytes.byteLength);
  downloadBlob('apl-design-artboards.zip', new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
}

/** A PDF page retains each artboard's proportions; artwork is flattened to PNG. */
export async function downloadDesignPDF(document: DesignDocument): Promise<void> {
  const design = designSchema.parse(document);
  if (!design.artboards.length) throw new Error('Add an artboard before downloading a PDF.');
  assertExportBatch(design.artboards);
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle('APL design artboards');
  pdf.setCreator('APL Studio');
  pdf.setSubject('Visual design export. Website behavior and editable layers are preserved in the APL backup, not this PDF.');
  let encodedBytes = 0;
  for (const artboard of design.artboards) {
    const png = await renderArtboardPNG(design, artboard.id);
    encodedBytes += png.size;
    assertEncodedBytes(encodedBytes);
    const image = await pdf.embedPng(await png.arrayBuffer());
    // 96 CSS pixels per inch maps screen dimensions into 72 PDF points per inch.
    const width = artboard.width * 0.75;
    const height = artboard.height * 0.75;
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  const bytes = await pdf.save();
  assertEncodedBytes(bytes.byteLength);
  downloadBlob('apl-design-artboards.pdf', new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
}
