import { z } from 'zod';

/**
 * SiteDoc v1 — the single source of truth for APL v2.
 *
 * A design IS the website: every page is a root frame whose node tree is
 * rendered by src/render with real HTML/CSS, both in the editor and in the
 * exported Next.js site. Nodes are stored flat (by id) with explicit
 * parent/children links so editor operations stay cheap.
 *
 * Every value that reaches generated CSS is validated here (colors, font
 * names, numbers, asset data URLs), so documents cannot inject styles.
 */

export const SITE_DOC_VERSION = 1 as const;
export const MAX_NODES = 5000;
export const MAX_PAGES = 50;
export const MAX_DEPTH = 32;
export const MAX_ASSETS = 200;
export const MAX_ASSET_BYTES = 4_000_000;
export const MAX_DOC_BYTES = 40_000_000;

export { BREAKPOINTS, BREAKPOINT_WIDTH, BREAKPOINT_MAX, type Breakpoint } from './breakpoints';

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const name = z.string().trim().min(1).max(120);
const coord = z.number().finite().min(-100_000).max(100_000);
const size = z.number().finite().min(0).max(100_000);
const px = (max = 2000) => z.number().finite().min(0).max(max);
export const colorSchema = z.string().regex(/^#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/);
/** Font family names only: letters, digits and spaces (e.g. Google Fonts names). */
export const fontFamilySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ]{0,59}$/);

// ── Paints & effects ─────────────────────────────────────────────────────────
const stopSchema = z.object({ offset: z.number().min(0).max(1), color: colorSchema }).strict();
export const paintSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color: colorSchema, visible: z.boolean(), /** Site color this fill follows; `color` holds its light value. */ variable: idSchema.optional() }).strict(),
  z.object({ type: z.literal('linear'), angle: z.number().finite().min(-360).max(360), stops: z.array(stopSchema).min(2).max(16), visible: z.boolean() }).strict(),
  z.object({ type: z.literal('radial'), stops: z.array(stopSchema).min(2).max(16), visible: z.boolean() }).strict(),
  z.object({ type: z.literal('image'), assetId: idSchema, fit: z.enum(['cover', 'contain', 'fill', 'tile']), visible: z.boolean() }).strict(),
]);
export const effectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['dropShadow', 'innerShadow']), x: z.number().finite().min(-1000).max(1000), y: z.number().finite().min(-1000).max(1000), blur: px(1000), spread: z.number().finite().min(-1000).max(1000), color: colorSchema, visible: z.boolean() }).strict(),
  z.object({ type: z.enum(['layerBlur', 'backgroundBlur']), radius: px(500), visible: z.boolean() }).strict(),
]);
export const strokeSchema = z.object({
  color: colorSchema, weight: px(200), align: z.enum(['inside', 'center', 'outside']), style: z.enum(['solid', 'dashed', 'dotted']),
  variable: idSchema.optional(),
}).strict();

// ── Layout ───────────────────────────────────────────────────────────────────
export const sizingModeSchema = z.enum(['fixed', 'hug', 'fill']);
export const sizingSchema = z.object({ h: sizingModeSchema, v: sizingModeSchema }).strict();
export const constraintsSchema = z.object({
  h: z.enum(['left', 'right', 'leftRight', 'center', 'scale']),
  v: z.enum(['top', 'bottom', 'topBottom', 'center', 'scale']),
}).strict();
const padding = z.tuple([px(4000), px(4000), px(4000), px(4000)]); // top, right, bottom, left
export const layoutSchema = z.object({
  mode: z.enum(['none', 'horizontal', 'vertical', 'grid']),
  gap: px(4000),
  /** Row gap when wrapping / in grid. Null reuses gap. */
  counterGap: px(4000).nullable(),
  padding,
  alignMain: z.enum(['start', 'center', 'end', 'spaceBetween']),
  alignCross: z.enum(['start', 'center', 'end', 'baseline']),
  wrap: z.boolean(),
  gridColumns: z.number().int().min(1).max(12),
}).strict();

// ── Text ─────────────────────────────────────────────────────────────────────
export const textStyleSchema = z.object({
  fontFamily: fontFamilySchema,
  fontWeight: z.number().int().min(100).max(900).multipleOf(100),
  fontSize: z.number().finite().min(1).max(1000),
  /** Multiplier of font size; null = font's normal line height. */
  lineHeight: z.number().finite().min(0.5).max(5).nullable(),
  letterSpacing: z.number().finite().min(-100).max(100),
  align: z.enum(['left', 'center', 'right', 'justify']),
  italic: z.boolean(),
  decoration: z.enum(['none', 'underline', 'line-through']),
  transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']),
}).strict();

// ── Motion ───────────────────────────────────────────────────────────────────
export const ENTER_TYPES = ['fade', 'fadeUp', 'fadeDown', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'blurIn', 'flipIn', 'pop', 'rotateIn', 'spinIn', 'bounceIn', 'dropIn', 'rise', 'expand'] as const;
export const LOOP_TYPES = ['float', 'pulse', 'breathe', 'spin', 'bounce', 'wiggle', 'drift', 'marquee', 'marqueeUp', 'shake', 'heartbeat', 'swing', 'flash', 'jelly', 'tada', 'ping', 'hue', 'glow', 'shimmer'] as const;
export const SCROLL_TYPES = ['parallax', 'fadeIn', 'slideUp', 'scaleUp', 'zoomOut', 'slideLeft', 'slideRight', 'blurIn', 'rotate', 'reveal'] as const;
export const HOVER_TYPES = ['lift', 'grow', 'shrink', 'dim', 'brighten', 'tilt', 'pop', 'press', 'float', 'pushRight', 'rotate', 'shadow', 'saturate', 'invert'] as const;
/** Animations play on the live site and in Preview; the design canvas stays still. */
export const motionSchema = z.object({
  /** Plays once, when the page loads or when the layer scrolls into view. */
  enter: z.object({ type: z.enum(ENTER_TYPES), duration: z.number().int().min(50).max(5000), delay: z.number().int().min(0).max(5000), trigger: z.enum(['load', 'inView']) }).strict().optional(),
  /** Repeats forever. */
  loop: z.object({ type: z.enum(LOOP_TYPES), duration: z.number().int().min(200).max(120_000) }).strict().optional(),
  hover: z.object({ type: z.enum(HOVER_TYPES) }).strict().optional(),
  /** Tied to the page's scroll position (parallax, reveal on scroll). `amount` is 0–100. */
  scroll: z.object({ type: z.enum(SCROLL_TYPES), amount: z.number().int().min(0).max(100) }).strict().optional(),
}).strict();
export type Motion = z.infer<typeof motionSchema>;

// ── Nodes ────────────────────────────────────────────────────────────────────
/** `button` makes a frame a real, clickable button on the site (see render/element). */
export const frameTagSchema = z.enum(['div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'button']);
/** `input` / `textarea` make a text layer a form field; its text becomes the placeholder. */
export const textTagSchema = z.enum(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'input', 'textarea']);
export const INPUT_TYPES = ['text', 'email', 'password', 'tel', 'number', 'search', 'url'] as const;

/** Properties that may differ per breakpoint. */
const responsiveFields = {
  x: coord, y: coord, width: size, height: size,
  minWidth: size.nullable(), maxWidth: size.nullable(), minHeight: size.nullable(), maxHeight: size.nullable(),
  sizing: sizingSchema,
  constraints: constraintsSchema,
  absolute: z.boolean(),
  visible: z.boolean(),
  rotation: z.number().finite().min(-360).max(360),
  opacity: z.number().finite().min(0).max(1),
  fills: z.array(paintSchema).max(16),
  stroke: strokeSchema.nullable(),
  effects: z.array(effectSchema).max(16),
  radius: z.tuple([px(100_000), px(100_000), px(100_000), px(100_000)]), // tl, tr, br, bl
  clip: z.boolean(),
};
export type ResponsiveProps = { [K in keyof typeof responsiveFields]: z.infer<typeof responsiveFields[K]> };

/** Sparse per-breakpoint patch. Nested layout/textStyle/sizing/constraints merge shallowly. */
export const overrideSchema = z.object({
  ...Object.fromEntries(Object.entries(responsiveFields).map(([key, schema]) => [key, schema.optional()])) as { [K in keyof typeof responsiveFields]: z.ZodOptional<typeof responsiveFields[K]> },
  /** Frames only. */
  layout: layoutSchema.partial().strict().optional(),
  /** Text only. */
  textStyle: textStyleSchema.partial().strict().optional(),
  /** Sticky can be turned off (null) on smaller screens. */
  sticky: px(4000).nullable().optional(),
  sizing: sizingSchema.partial().strict().optional(),
  constraints: constraintsSchema.partial().strict().optional(),
}).strict();
export type Override = z.infer<typeof overrideSchema>;

/**
 * What happens when a visitor clicks a frame or text layer: go to a page or
 * address, scroll to a layer, or show / hide a layer (menus, pop-ups, accordions).
 * A target that no longer exists simply does nothing.
 */
export const linkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('page'), pageId: idSchema }).strict(),
  z.object({ type: z.literal('url'), href: z.string().max(2000).regex(/^(https?:\/\/|mailto:|tel:|#|\/)[^\s"<>]*$/), newTab: z.boolean() }).strict(),
  z.object({ type: z.literal('scroll'), targetId: idSchema }).strict(),
  z.object({ type: z.literal('toggle'), targetId: idSchema }).strict(),
]);
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'] as const;
export const CURSORS = ['auto', 'default', 'pointer', 'text', 'move', 'grab', 'crosshair', 'zoom-in', 'help', 'not-allowed', 'none'] as const;
export type Link = z.infer<typeof linkSchema>;

const base = {
  id: idSchema,
  name,
  parentId: idSchema.nullable(),
  children: z.array(idSchema).max(MAX_NODES),
  locked: z.boolean(),
  ...responsiveFields,
  overrides: z.object({ tablet: overrideSchema.optional(), mobile: overrideSchema.optional() }).strict(),
  motion: motionSchema.optional(),
  link: linkSchema.optional(),
  /** Stays in view while its frame scrolls past: the distance from the top of the window (px). Null or missing: off. */
  sticky: px(4000).nullable().optional(),
  /** How this layer mixes with what is behind it. */
  blend: z.enum(BLEND_MODES).optional(),
  /** Mouse pointer shown over this layer on the site. */
  cursor: z.enum(CURSORS).optional(),
  /** Main component marker; instances point back with `instanceOf` (root) and `sourceId` (layers). See doc/components. */
  component: z.boolean().optional(),
  instanceOf: idSchema.optional(),
  sourceId: idSchema.optional(),
};

export const frameNodeSchema = z.object({
  ...base, type: z.literal('frame'), tag: frameTagSchema, layout: layoutSchema,
  /** Let visitors scroll the content inside this frame (carousels, side panels), optionally snapping to each item. */
  scroll: z.enum(['x', 'y', 'both']).optional(),
  snap: z.boolean().optional(),
}).strict();
export const textNodeSchema = z.object({ ...base, type: z.literal('text'), tag: textTagSchema, text: z.string().max(20_000), textStyle: textStyleSchema,
  /** Kind of value an `input` field takes (default text). */
  inputType: z.enum(INPUT_TYPES).optional(),
  /** Cut long text off after this many lines, ending with "…". */
  maxLines: z.number().int().min(1).max(20).optional(),
}).strict();
export const rectNodeSchema = z.object({ ...base, type: z.literal('rect') }).strict();
export const ellipseNodeSchema = z.object({ ...base, type: z.literal('ellipse') }).strict();
export const imageNodeSchema = z.object({
  ...base, type: z.literal('image'), assetId: idSchema.nullable(), fit: z.enum(['cover', 'contain', 'fill']), alt: z.string().max(500),
}).strict();

/** SVG path data: move, line, curve and close commands with numbers only. */
export const pathDataSchema = z.string().min(1).max(20_000).regex(/^[MLCQZ0-9eE.\s-]+$/);
/**
 * Vector layer (lines, arrows, polygons, stars, pen and pencil paths). The path
 * is drawn in a `viewBox` coordinate space that stretches to the layer's size.
 */
export const vectorNodeSchema = z.object({
  ...base, type: z.literal('vector'), path: pathDataSchema,
  viewBox: z.tuple([z.number().finite().min(1).max(100_000), z.number().finite().min(1).max(100_000)]),
  /** Editable settings for polygons and stars. */
  shape: z.object({ kind: z.enum(['polygon', 'star']), points: z.number().int().min(3).max(60), inner: z.number().min(0.05).max(1) }).strict().optional(),
}).strict();

/**
 * Embedded content shown in a sandboxed frame: a video or map address
 * (YouTube, Vimeo, Google Maps or any https page), or custom HTML/CSS/JS code.
 */
export const embedNodeSchema = z.object({
  ...base, type: z.literal('embed'), kind: z.enum(['url', 'code']),
  url: z.string().max(2000).regex(/^(https:\/\/[^\s"<>]*)?$/),
  code: z.string().max(100_000),
}).strict();
export type EmbedNode = z.infer<typeof embedNodeSchema>;

export const nodeSchema = z.discriminatedUnion('type', [frameNodeSchema, textNodeSchema, rectNodeSchema, ellipseNodeSchema, imageNodeSchema, vectorNodeSchema, embedNodeSchema]);
export type SiteNode = z.infer<typeof nodeSchema>;
export type NodeType = SiteNode['type'];
export type FrameNode = z.infer<typeof frameNodeSchema>;
export type TextNode = z.infer<typeof textNodeSchema>;
export type ImageNode = z.infer<typeof imageNodeSchema>;
export type Paint = z.infer<typeof paintSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type Layout = z.infer<typeof layoutSchema>;
export type TextStyle = z.infer<typeof textStyleSchema>;
export type Sizing = z.infer<typeof sizingSchema>;
export type Constraints = z.infer<typeof constraintsSchema>;

// ── Pages, assets, document ──────────────────────────────────────────────────
export const pathSchema = z.string().max(160).refine(value => {
  if (value === '/') return true;
  if (!/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$/.test(value)) return false;
  if (value.split('/').some(segment => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(segment))) return false;
  return !['admin', 'api', 'assets', 'auth', 'node-modules'].includes(value.split('/')[1]);
}, 'Use a path such as /about or /work/design. Admin, API, auth and asset paths are reserved.');

export const pageSchema = z.object({
  id: idSchema, name: z.string().trim().min(1).max(60), path: pathSchema, rootId: idSchema,
  title: z.string().max(120), description: z.string().max(320),
}).strict();
export type Page = z.infer<typeof pageSchema>;

export const assetSchema = z.object({
  id: idSchema, name,
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']),
  dataUrl: z.string().max(MAX_ASSET_BYTES).regex(/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/),
  width: z.number().int().min(1).max(20_000), height: z.number().int().min(1).max(20_000),
}).strict().refine(asset => asset.dataUrl.startsWith('data:' + asset.mime + ';'), 'Asset data must match its declared type.');
export type Asset = z.infer<typeof assetSchema>;

/** Named site color with a light and a dark value. */
export const variableSchema = z.object({ id: idSchema, name: z.string().trim().min(1).max(60), light: colorSchema, dark: colorSchema }).strict();
export type Variable = z.infer<typeof variableSchema>;

/** Site-wide settings used by the exported website. */
export const siteSettingsSchema = z.object({
  /** Animation between pages. */
  transition: z.enum(['none', 'fade', 'slide']).optional(),
  /** Published address, used for the sitemap, canonical links and social previews. */
  siteUrl: z.string().max(300).regex(/^https?:\/\/[^\s"<>]+$/).optional(),
  /** Browser tab icon and social preview image (site images). */
  favicon: idSchema.optional(),
  socialImage: idSchema.optional(),
  /** Code added to every page's <head> (analytics, verification tags). */
  headCode: z.string().max(20_000).optional(),
}).strict();
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const siteDocSchema = z.object({
  version: z.literal(SITE_DOC_VERSION),
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  pages: z.array(pageSchema).min(1).max(MAX_PAGES),
  nodes: z.record(idSchema, nodeSchema),
  assets: z.record(idSchema, assetSchema),
  variables: z.record(idSchema, variableSchema).optional(),
  settings: siteSettingsSchema.optional(),
}).strict().superRefine((doc, ctx) => {
  const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', message, path });
  const nodes = Object.entries(doc.nodes);
  if (nodes.length > MAX_NODES) issue(`A site may contain at most ${MAX_NODES} layers.`, ['nodes']);
  if (Object.keys(doc.assets).length > MAX_ASSETS) issue(`A site may contain at most ${MAX_ASSETS} images.`, ['assets']);
  for (const [key, asset] of Object.entries(doc.assets)) if (asset.id !== key) issue('Asset keys must match their ids.', ['assets', key]);
  if (Object.keys(doc.variables ?? {}).length > 200) issue('A site may have at most 200 colors.', ['variables']);
  for (const [key, variable] of Object.entries(doc.variables ?? {})) if (variable.id !== key) issue('Color keys must match their ids.', ['variables', key]);
  for (const key of ['favicon', 'socialImage'] as const) {
    const id = doc.settings?.[key];
    if (id && !doc.assets[id]) issue('A site setting references a missing image.', ['settings', key]);
  }

  const pageIds = new Set<string>(), paths = new Set<string>(), roots = new Set<string>();
  doc.pages.forEach((page, index) => {
    if (pageIds.has(page.id)) issue('Page ids must be unique.', ['pages', index, 'id']);
    if (paths.has(page.path)) issue('Each page needs a unique path.', ['pages', index, 'path']);
    pageIds.add(page.id); paths.add(page.path);
    const root = doc.nodes[page.rootId];
    if (!root || root.type !== 'frame' || root.parentId !== null) issue('Each page must reference a top-level frame.', ['pages', index, 'rootId']);
    if (roots.has(page.rootId)) issue('Pages cannot share a root frame.', ['pages', index, 'rootId']);
    roots.add(page.rootId);
  });
  if (!paths.has('/')) issue('The site needs a home page at /.', ['pages']);

  for (const [key, node] of nodes) {
    const path = ['nodes', key];
    if (node.id !== key) { issue('Node keys must match their ids.', path); continue; }
    if (node.parentId === null && !roots.has(node.id)) issue('Top-level layers must be page frames.', [...path, 'parentId']);
    if (node.children.length && node.type !== 'frame') issue('Only frames may contain layers.', [...path, 'children']);
    if (new Set(node.children).size !== node.children.length) issue('A layer may appear once among its parent\'s children.', [...path, 'children']);
    for (const child of node.children) if (doc.nodes[child]?.parentId !== node.id) issue('Child layers must point back to their parent.', [...path, 'children']);
    if (node.parentId !== null) {
      const parent = doc.nodes[node.parentId];
      if (!parent || !parent.children.includes(node.id)) issue('The parent layer must list this layer as a child.', [...path, 'parentId']);
    }
    for (const paint of [...node.fills, ...Object.values(node.overrides).flatMap(o => o?.fills ?? [])]) {
      if (paint.type === 'image' && !doc.assets[paint.assetId]) issue('An image fill references a missing image.', [...path, 'fills']);
    }
    for (const [bp, override] of Object.entries(node.overrides)) {
      if (override?.layout && node.type !== 'frame') issue('Only frames have auto layout.', [...path, 'overrides', bp, 'layout']);
      if (override?.textStyle && node.type !== 'text') issue('Only text layers have text styles.', [...path, 'overrides', bp, 'textStyle']);
    }
    if (node.type === 'image' && node.assetId !== null && !doc.assets[node.assetId]) issue('The image layer references a missing image.', [...path, 'assetId']);
    // Depth and cycles.
    let current: SiteNode | undefined = node, depth = 0;
    const seen = new Set<string>();
    while (current && current.parentId !== null) {
      if (seen.has(current.id)) { issue('Layers cannot contain a cycle.', [...path, 'parentId']); break; }
      seen.add(current.id);
      current = doc.nodes[current.parentId];
      if (++depth > MAX_DEPTH) { issue(`Layers may be nested at most ${MAX_DEPTH} deep.`, [...path, 'parentId']); break; }
    }
  }
  if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > MAX_DOC_BYTES) issue('This site exceeds the 40 MB document limit.');
});
export type SiteDoc = z.infer<typeof siteDocSchema>;
