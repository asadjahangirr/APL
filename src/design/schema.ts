import { z } from 'zod';

export const MAX_DESIGN_BYTES = 20_000_000;
export const MAX_DESIGN_LAYERS = 1200;
export const MAX_DESIGN_DEPTH = 16;
export const MAX_DESIGN_ASSETS = 50;
export const MAX_DESIGN_ASSET_BYTES = 3_000_000;
export const MAX_DESIGN_IMAGE_PIXELS = 24_000_000;
export const MAX_DESIGN_TOTAL_IMAGE_PIXELS = 64_000_000;
export const MAX_ARTBOARDS = 24;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const name = z.string().trim().min(1).max(100);
const position = z.number().finite().min(-100_000).max(100_000);
const dimension = z.number().finite().min(1).max(12_000);
export const designColorSchema = z.string().regex(/^(#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{8}|transparent)$/);
export const fontFamilySchema = z.enum(['Arial', 'Georgia', 'system-ui', 'monospace']);
const typography = {
  fontFamily: fontFamilySchema,
  fontSize: z.number().finite().min(4).max(1000),
  fontWeight: z.number().int().min(100).max(900).multipleOf(100),
  lineHeight: z.number().finite().min(0.5).max(4),
};
export const artboardSchema = z.object({
  id, name, x: position, y: position, width: dimension, height: dimension, background: designColorSchema,
}).strict();
export const layerSchema = z.object({
  id, artboardId: id, parentId: id.nullable(), name,
  type: z.enum(['frame', 'group', 'rectangle', 'ellipse', 'text', 'image']),
  x: position, y: position, width: dimension, height: dimension,
  rotation: z.number().finite().min(-3600).max(3600),
  visible: z.boolean(), locked: z.boolean(), opacity: z.number().finite().min(0).max(1),
  fill: designColorSchema, stroke: designColorSchema,
  strokeWidth: z.number().finite().min(0).max(100), radius: z.number().finite().min(0).max(6000),
  text: z.string().max(20_000), ...typography, textAlign: z.enum(['left', 'center', 'right']),
  assetId: id.nullable(), colorStyleId: id.nullable(), typeStyleId: id.nullable(),
}).strict();
export const assetSchema = z.object({
  id, name,
  dataUrl: z.string().max(MAX_DESIGN_ASSET_BYTES).regex(/^data:image\/(png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).refine(value => (value.split(',')[1]?.length ?? 0) > 0, 'Choose a PNG, JPEG or WebP image.'),
  width: dimension.int(), height: dimension.int(),
}).strict().refine(asset => asset.width * asset.height <= MAX_DESIGN_IMAGE_PIXELS, 'Images may contain at most 24 million pixels.');
export const colorStyleSchema = z.object({ id, name, value: designColorSchema }).strict();
export const typeStyleSchema = z.object({ id, name, ...typography }).strict();

/** Positions share an artboard plane before inherited ancestor rotations. Flat sibling order is back to front. */
export const designSchema = z.object({
  version: z.literal(1),
  artboards: z.array(artboardSchema).max(MAX_ARTBOARDS),
  layers: z.array(layerSchema).max(MAX_DESIGN_LAYERS),
  assets: z.array(assetSchema).max(MAX_DESIGN_ASSETS),
  colors: z.array(colorStyleSchema).max(100),
  typeStyles: z.array(typeStyleSchema).max(100),
}).strict().superRefine((design, context) => {
  const issue = (message: string, path: (string | number)[] = []) => context.addIssue({ code: 'custom', message, path });
  const allIds = [...design.artboards, ...design.layers, ...design.assets, ...design.colors, ...design.typeStyles].map(value => value.id);
  if (new Set(allIds).size !== allIds.length) issue('Artboards, layers, assets and styles must have unique IDs.');
  const artboards = new Set(design.artboards.map(value => value.id));
  const layers = new Map(design.layers.map(value => [value.id, value]));
  const assets = new Set(design.assets.map(value => value.id));
  const colors = new Set(design.colors.map(value => value.id));
  const styles = new Set(design.typeStyles.map(value => value.id));
  if (design.assets.reduce((sum, asset) => sum + asset.width * asset.height, 0) > MAX_DESIGN_TOTAL_IMAGE_PIXELS) {
    issue('The combined image dimensions exceed 64 million pixels. Resize images or remove unused image layers.', ['assets']);
  }
  design.layers.forEach((layer, index) => {
    const path = ['layers', index];
    if (!artboards.has(layer.artboardId)) issue('A layer must belong to an existing artboard.', [...path, 'artboardId']);
    if (layer.assetId !== null && (!assets.has(layer.assetId) || layer.type !== 'image')) issue('Only image layers may reference an existing image asset.', [...path, 'assetId']);
    if (layer.colorStyleId !== null && !colors.has(layer.colorStyleId)) issue('The reusable color is missing.', [...path, 'colorStyleId']);
    if (layer.typeStyleId !== null && (!styles.has(layer.typeStyleId) || layer.type !== 'text')) issue('Only text layers may reference an existing type style.', [...path, 'typeStyleId']);
    let current = layer;
    const visited = new Set([current.id]);
    let depth = 0;
    while (current.parentId !== null) {
      const parent = layers.get(current.parentId);
      if (!parent) { issue('The parent layer is missing.', [...path, 'parentId']); break; }
      if (parent.artboardId !== layer.artboardId) { issue('Parent and child must belong to the same artboard.', [...path, 'parentId']); break; }
      if (parent.type !== 'frame' && parent.type !== 'group') { issue('Only frames and groups may contain other layers.', [...path, 'parentId']); break; }
      if (visited.has(parent.id)) { issue('Layer groups cannot contain a cycle.', [...path, 'parentId']); break; }
      visited.add(parent.id);
      depth += 1;
      if (depth > MAX_DESIGN_DEPTH) { issue(`A design may nest at most ${MAX_DESIGN_DEPTH} parents.`, [...path, 'parentId']); break; }
      current = parent;
    }
  });
  if (new TextEncoder().encode(JSON.stringify(design)).byteLength > MAX_DESIGN_BYTES) issue('This design exceeds the 20 MB editable-document limit.');
});

export type DesignDocument = z.infer<typeof designSchema>;
export type Artboard = z.infer<typeof artboardSchema>;
export type DesignLayer = z.infer<typeof layerSchema>;
export type LayerType = DesignLayer['type'];
export type DesignAsset = z.infer<typeof assetSchema>;
export type ColorStyle = z.infer<typeof colorStyleSchema>;
export type TypeStyle = z.infer<typeof typeStyleSchema>;

export function emptyDesign(): DesignDocument {
  return { version: 1, artboards: [], layers: [], assets: [], colors: [], typeStyles: [] };
}
export const createDesignDocument = emptyDesign;

export function createArtboard(options: Partial<Artboard> = {}): Artboard {
  return artboardSchema.parse({ id: crypto.randomUUID(), name: 'Desktop', x: 0, y: 0, width: 1440, height: 1000, background: '#ffffff', ...options });
}

export function createLayer(type: LayerType, artboardId: string, patch: Partial<DesignLayer> = {}): DesignLayer {
  return layerSchema.parse({
    id: crypto.randomUUID(), artboardId, parentId: null, type,
    name: ({ frame: 'Frame', group: 'Group', rectangle: 'Rectangle', ellipse: 'Ellipse', text: 'Text', image: 'Image' })[type],
    x: 80, y: 80, width: type === 'text' ? 360 : 240, height: type === 'text' ? 80 : 160,
    rotation: 0, visible: true, locked: false, opacity: 1,
    fill: type === 'text' ? '#202522' : type === 'frame' || type === 'group' || type === 'image' ? 'transparent' : '#c9d7ce',
    stroke: 'transparent', strokeWidth: 0, radius: 0, text: type === 'text' ? 'Your words here' : '',
    fontFamily: 'Arial', fontSize: 40, fontWeight: 400, lineHeight: 1.2, textAlign: 'left',
    assetId: null, colorStyleId: null, typeStyleId: null, ...patch,
  });
}
