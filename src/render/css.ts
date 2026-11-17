import type { Effect, FrameNode, Paint, SiteDoc, SiteNode } from '../doc/schema';
import { BREAKPOINTS, BREAKPOINT_MAX, BREAKPOINT_WIDTH, type Breakpoint } from '../doc/breakpoints';
import { motionCss } from './motion';
import { resolveNode } from './resolve';

/**
 * Node → CSS. This module is shared verbatim by the editor canvas, preview and
 * exported sites, so what you design is exactly what ships.
 *
 * Only `import type` from the document schema is allowed here (plus the
 * dependency-free breakpoints module) so exports need no extra runtime code.
 */

export type Decls = Record<string, string>;
export type AssetUrl = (assetId: string) => string | undefined;
export type RenderMode = { breakpoint: Breakpoint } | 'responsive';

const SCOPE = /^[a-z][a-z0-9-]{0,63}$/;
const SAFE_URL = /^(?:data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}|\/?[A-Za-z0-9._\-/]+)$/;

const num = (value: number) => String(Math.round(value * 1000) / 1000);
const px = (value: number) => num(value) + 'px';
const pct = (value: number) => num(value * 100) + '%';
export const nodeClass = (id: string) => 'n-' + id;

function fontStack(family: string): string {
  return `"${family}", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
}

/** Hug only makes sense for text and auto-layout frames; anything else behaves as fixed. */
function effectiveSizing(node: SiteNode) {
  const canHug = node.type === 'text' || (node.type === 'frame' && node.layout.mode !== 'none');
  const fix = (mode: 'fixed' | 'hug' | 'fill') => (mode === 'hug' && !canHug ? 'fixed' : mode);
  return { h: fix(node.sizing.h), v: fix(node.sizing.v) };
}

function gradientStops(stops: { offset: number; color: string }[]): string {
  return [...stops].sort((a, b) => a.offset - b.offset).map(stop => `${stop.color} ${pct(stop.offset)}`).join(', ');
}

/** A solid color, or the site color variable it follows (with the stored color as fallback). */
const colorOf = (paint: { color: string; variable?: string }) => (paint.variable ? `var(--c-${paint.variable}, ${paint.color})` : paint.color);

/** Site color variables: light values, plus dark values for dark mode when any differ. */
export function variablesCss(doc: SiteDoc, scope: string): string {
  const all = Object.values(doc.variables ?? {});
  if (!all.length) return '';
  const light = `.${scope}{${all.map(v => `--c-${v.id}:${v.light}`).join(';')}}`;
  const dark = all.filter(v => v.dark !== v.light).map(v => `--c-${v.id}:${v.dark}`).join(';');
  if (!dark) return light;
  return [light, `.${scope}[data-theme="dark"]{${dark}}`, `@media (prefers-color-scheme: dark){.${scope}:not([data-theme]){${dark}}}`].join('\n');
}

export interface VectorGradient { id: string; linear: boolean; x1: string; y1: string; x2: string; y2: string; stops: { offset: string; color: string }[] }
/** Gradient definition for a vector layer whose topmost fill is a gradient. */
export function vectorGradient(node: SiteNode): VectorGradient | null {
  if (node.type !== 'vector') return null;
  const top = [...node.fills].reverse().find(paint => paint.visible && paint.type !== 'image');
  if (!top || top.type === 'solid' || top.type === 'image') return null;
  const angle = top.type === 'linear' ? (top.angle * Math.PI) / 180 : 0, dx = Math.sin(angle) * 50, dy = -Math.cos(angle) * 50;
  return {
    id: 'g-' + node.id, linear: top.type === 'linear', x1: num(50 - dx) + '%', y1: num(50 - dy) + '%', x2: num(50 + dx) + '%', y2: num(50 + dy) + '%',
    stops: [...top.stops].sort((a, b) => a.offset - b.offset).map(stop => ({ offset: pct(stop.offset), color: stop.color })),
  };
}

function paintLayer(paint: Paint, assetUrl: AssetUrl): string | null {
  switch (paint.type) {
    case 'solid': return `linear-gradient(${colorOf(paint)}, ${colorOf(paint)})`;
    case 'linear': return `linear-gradient(${num(paint.angle)}deg, ${gradientStops(paint.stops)})`;
    case 'radial': return `radial-gradient(circle at center, ${gradientStops(paint.stops)})`;
    case 'image': {
      const url = assetUrl(paint.assetId);
      if (!url || !SAFE_URL.test(url)) return null;
      const placement = { cover: 'center / cover no-repeat', contain: 'center / contain no-repeat', fill: 'center / 100% 100% no-repeat', tile: 'top left repeat' }[paint.fit];
      return `url("${url}") ${placement}`;
    }
  }
}

function fillDecls(node: SiteNode, assetUrl: AssetUrl, out: Decls): void {
  const visible = node.fills.filter(paint => paint.visible);
  if (node.type === 'vector') {
    // Vectors paint their path: the topmost color fills it (a gradient contributes its first color).
    const top = [...visible].reverse().find(paint => paint.type !== 'image');
    out.fill = !top ? 'none' : top.type === 'solid' ? colorOf(top) : `url(#g-${node.id})`;
    return;
  }
  if (node.type === 'text') {
    // The topmost visible paint colors the text; gradients clip to the glyphs.
    const top = [...visible].reverse().find(paint => paint.type !== 'image');
    if (!top) out.color = 'inherit';
    else if (top.type === 'solid') out.color = colorOf(top);
    else {
      out.background = paintLayer(top, assetUrl)!;
      out['-webkit-background-clip'] = 'text';
      out['background-clip'] = 'text';
      out.color = 'transparent';
    }
    return;
  }
  if (!visible.length) return;
  if (visible.length === 1 && visible[0].type === 'solid') { out['background-color'] = colorOf(visible[0]); return; }
  // Document order is bottom → top; CSS lists the top layer first.
  const layers = [...visible].reverse().map(paint => paintLayer(paint, assetUrl)).filter((layer): layer is string => layer !== null);
  if (layers.length) out.background = layers.join(', ');
}

function effectDecls(node: SiteNode, out: Decls): void {
  const visible = node.effects.filter(effect => effect.visible);
  const shadows = visible.filter((effect): effect is Extract<Effect, { type: 'dropShadow' | 'innerShadow' }> => effect.type === 'dropShadow' || effect.type === 'innerShadow');
  if (node.type === 'vector') {
    const drops = shadows.filter(effect => effect.type === 'dropShadow').map(effect => `drop-shadow(${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${effect.color})`);
    if (drops.length) out.filter = drops.join(' ');
  } else if (node.type === 'text') {
    const text = shadows.filter(effect => effect.type === 'dropShadow').map(effect => `${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${effect.color}`);
    if (text.length) out['text-shadow'] = text.join(', ');
  } else if (shadows.length) {
    out['box-shadow'] = shadows.map(effect => `${effect.type === 'innerShadow' ? 'inset ' : ''}${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${px(effect.spread)} ${effect.color}`).join(', ');
  }
  const layerBlur = visible.find(effect => effect.type === 'layerBlur');
  if (layerBlur && layerBlur.type === 'layerBlur' && layerBlur.radius > 0) out.filter = (out.filter ? out.filter + ' ' : '') + `blur(${px(layerBlur.radius)})`;
  const backgroundBlur = visible.find(effect => effect.type === 'backgroundBlur');
  if (backgroundBlur && backgroundBlur.type === 'backgroundBlur' && backgroundBlur.radius > 0) {
    out['backdrop-filter'] = `blur(${px(backgroundBlur.radius)})`;
    out['-webkit-backdrop-filter'] = out['backdrop-filter'];
  }
}

function frameLayoutDecls(node: FrameNode, out: Decls): void {
  const layout = node.layout;
  if (layout.mode === 'none') return;
  const [top, right, bottom, left] = layout.padding;
  if (top || right || bottom || left) out.padding = `${px(top)} ${px(right)} ${px(bottom)} ${px(left)}`;
  const rowGap = layout.counterGap ?? layout.gap;
  if (layout.mode === 'grid') {
    out['grid-template-columns'] = `repeat(${layout.gridColumns}, minmax(0, 1fr))`;
    out['column-gap'] = px(layout.gap);
    out['row-gap'] = px(rowGap);
    return;
  }
  out['flex-direction'] = layout.mode === 'horizontal' ? 'row' : 'column';
  out['flex-wrap'] = layout.wrap ? 'wrap' : 'nowrap';
  if (layout.mode === 'horizontal') { out['column-gap'] = px(layout.gap); out['row-gap'] = px(layout.wrap ? rowGap : 0); }
  else out['row-gap'] = px(layout.gap);
  out['justify-content'] = { start: 'flex-start', center: 'center', end: 'flex-end', spaceBetween: 'space-between' }[layout.alignMain];
  out['align-items'] = { start: 'flex-start', center: 'center', end: 'flex-end', baseline: 'baseline' }[layout.alignCross];
  if (layout.wrap) out['align-content'] = out['align-items'] === 'baseline' ? 'flex-start' : out['align-items'];
}

/** CSS display of a layer when it is shown. */
export function shownDisplay(node: SiteNode): string {
  if (node.type === 'frame') return ({ none: 'block', horizontal: 'flex', vertical: 'flex', grid: 'grid' } as const)[node.layout.mode];
  if (node.type === 'text' && node.maxLines) return '-webkit-box';
  return 'block';
}

export interface DeclContext {
  breakpoint: Breakpoint;
  /** Resolved parent (null for the page root). */
  parent: SiteNode | null;
  parentIsRoot: boolean;
  assetUrl: AssetUrl;
}

/** CSS declarations for one already-resolved node at one breakpoint. Display is always set. */
export function nodeDecls(node: SiteNode, ctx: DeclContext): Decls {
  const out: Decls = {};
  const sizing = effectiveSizing(node);
  const transforms: string[] = [];
  out.display = node.visible ? shownDisplay(node) : 'none';

  const parent = ctx.parent;
  if (!parent) {
    // Page root: always spans the viewport width.
    out.position = 'relative';
    out.width = '100%';
    out['min-height'] = sizing.v === 'fixed' ? px(node.height) : sizing.v === 'fill' ? '100vh' : 'auto';
  } else if (parent.type !== 'frame' || parent.layout.mode === 'none' || node.absolute) {
    // Free positioning within the parent's box, honoring constraints.
    const pw = ctx.parentIsRoot ? BREAKPOINT_WIDTH[ctx.breakpoint] : parent.width;
    const ph = parent.height;
    out.position = 'absolute';
    const { h, v } = node.constraints;
    let translateX = false, translateY = false;
    const width = sizing.h === 'hug' ? 'auto' : px(node.width);
    const height = sizing.v === 'hug' ? 'auto' : px(node.height);
    if (h === 'left') { out.left = px(node.x); out.width = width; }
    else if (h === 'right') { out.right = px(pw - node.x - node.width); out.width = width; }
    else if (h === 'leftRight') { out.left = px(node.x); out.right = px(pw - node.x - node.width); out.width = 'auto'; }
    else if (h === 'center') { out.left = `calc(50% + ${px(node.x + node.width / 2 - pw / 2)})`; out.width = width; translateX = true; }
    else { out.left = pw ? pct(node.x / pw) : '0%'; out.width = pw ? pct(node.width / pw) : width; }
    if (v === 'top') { out.top = px(node.y); out.height = height; }
    else if (v === 'bottom') { out.bottom = px(ph - node.y - node.height); out.height = height; }
    else if (v === 'topBottom') { out.top = px(node.y); out.bottom = px(ph - node.y - node.height); out.height = 'auto'; }
    else if (v === 'center') { out.top = `calc(50% + ${px(node.y + node.height / 2 - ph / 2)})`; out.height = height; translateY = true; }
    else { out.top = ph ? pct(node.y / ph) : '0%'; out.height = ph ? pct(node.height / ph) : height; }
    if (translateX || translateY) transforms.push(`translate(${translateX ? '-50%' : '0'}, ${translateY ? '-50%' : '0'})`);
  } else if (parent.layout.mode === 'grid') {
    out.position = 'relative';
    out.width = sizing.h === 'fixed' ? px(node.width) : 'auto';
    out.height = sizing.v === 'fixed' ? px(node.height) : 'auto';
    out['justify-self'] = sizing.h === 'fill' ? 'stretch' : 'start';
    out['align-self'] = sizing.v === 'fill' ? 'stretch' : 'start';
    if (sizing.h === 'fill') out['min-width'] = '0';
  } else {
    // Auto layout flow.
    out.position = 'relative';
    const main = parent.layout.mode === 'horizontal' ? 'h' : 'v';
    const mainDim = main === 'h' ? 'width' : 'height', crossDim = main === 'h' ? 'height' : 'width';
    const mainSizing = sizing[main], crossSizing = sizing[main === 'h' ? 'v' : 'h'];
    const mainValue = main === 'h' ? node.width : node.height, crossValue = main === 'h' ? node.height : node.width;
    out.flex = mainSizing === 'fill' ? '1 1 0px' : '0 0 auto';
    out[mainDim] = mainSizing === 'fixed' ? px(mainValue) : 'auto';
    if (mainSizing === 'fill') out['min-' + mainDim] = '0';
    // Cross-axis fill: width:100% in a column keeps max-width + parent centering working;
    // in a row, stretch to the row's height.
    if (crossSizing === 'fill' && crossDim === 'width') out.width = '100%';
    else out[crossDim] = crossSizing === 'fixed' ? px(crossValue) : 'auto';
    if (crossSizing === 'fill' && crossDim === 'height') out['align-self'] = 'stretch';
  }

  // Sticky: stays in view while its frame scrolls past (layers in auto layout only).
  const inFlow = parent?.type === 'frame' && parent.layout.mode !== 'none' && !node.absolute;
  if (inFlow && node.sticky != null) { out.position = 'sticky'; out.top = px(node.sticky); out['z-index'] = '5'; }
  if (inFlow && parent?.type === 'frame' && parent.scroll && parent.snap) out['scroll-snap-align'] = 'start';
  if (node.blend && node.blend !== 'normal') out['mix-blend-mode'] = node.blend;
  if (node.cursor) out.cursor = node.cursor;

  if (node.minWidth !== null) out['min-width'] = px(node.minWidth);
  if (node.maxWidth !== null) out['max-width'] = px(node.maxWidth);
  if (node.minHeight !== null) out['min-height'] = px(node.minHeight);
  if (node.maxHeight !== null) out['max-height'] = px(node.maxHeight);

  if (node.rotation) transforms.push(`rotate(${num(node.rotation)}deg)`);
  if (transforms.length) out.transform = transforms.join(' ');
  if (node.opacity < 1) out.opacity = num(node.opacity);

  if (node.type === 'frame') frameLayoutDecls(node, out);
  if (node.type === 'text') {
    const style = node.textStyle;
    out['font-family'] = fontStack(style.fontFamily);
    out['font-size'] = px(style.fontSize);
    out['font-weight'] = String(style.fontWeight);
    out['line-height'] = style.lineHeight === null ? 'normal' : num(style.lineHeight);
    if (style.letterSpacing) out['letter-spacing'] = px(style.letterSpacing);
    out['text-align'] = style.align;
    if (style.italic) out['font-style'] = 'italic';
    if (style.decoration !== 'none') out['text-decoration'] = style.decoration;
    if (style.transform !== 'none') out['text-transform'] = style.transform;
    out['white-space'] = sizing.h === 'hug' ? 'pre' : 'pre-wrap';
    if (sizing.h !== 'hug') out['overflow-wrap'] = 'break-word';
    if (node.maxLines) { out['-webkit-line-clamp'] = String(node.maxLines); out['-webkit-box-orient'] = 'vertical'; out.overflow = 'hidden'; }
  }
  if (node.type === 'image') out['object-fit'] = node.fit;
  fillDecls(node, ctx.assetUrl, out);

  if (node.type === 'ellipse') out['border-radius'] = '50%';
  else if (node.radius.some(value => value > 0)) out['border-radius'] = node.radius.map(px).join(' ');
  if (node.type === 'frame' && node.scroll) {
    // Scrollable frame (carousel, side panel), optionally snapping to each item.
    out['overflow-x'] = node.scroll === 'y' ? 'hidden' : 'auto';
    out['overflow-y'] = node.scroll === 'x' ? 'hidden' : 'auto';
    if (node.snap) out['scroll-snap-type'] = `${node.scroll === 'both' ? 'both' : node.scroll} mandatory`;
  } else if (node.type === 'frame' && node.clip) out.overflow = 'clip'; // clip, unlike hidden, keeps sticky layers working
  if (node.type === 'embed') out.overflow = 'hidden';
  if (node.type === 'vector') {
    out.overflow = 'visible';
    const stroke = node.stroke;
    if (stroke && stroke.weight > 0) {
      out.stroke = colorOf(stroke);
      out['stroke-width'] = px(stroke.weight);
      out['stroke-linecap'] = 'round';
      out['stroke-linejoin'] = 'round';
      if (stroke.style !== 'solid') out['stroke-dasharray'] = stroke.style === 'dashed' ? `${num(stroke.weight * 3)} ${num(stroke.weight * 2.5)}` : `0 ${num(stroke.weight * 2)}`;
    } else out.stroke = 'none';
  } else if (node.stroke && node.stroke.weight > 0) {
    const stroke = node.stroke;
    out.outline = `${px(stroke.weight)} ${stroke.style} ${colorOf(stroke)}`;
    out['outline-offset'] = px(stroke.align === 'inside' ? -stroke.weight : stroke.align === 'center' ? -stroke.weight / 2 : 0);
  }
  effectDecls(node, out);
  return out;
}

// ── Stylesheets ──────────────────────────────────────────────────────────────

/** Per-node declarations for one breakpoint, walking the page tree with resolved parents. */
export function pageDecls(doc: SiteDoc, rootId: string, breakpoint: Breakpoint, assetUrl: AssetUrl): Map<string, Decls> {
  const out = new Map<string, Decls>();
  const visit = (id: string, parent: SiteNode | null, parentIsRoot: boolean) => {
    const raw = doc.nodes[id];
    if (!raw) return;
    const node = resolveNode(raw, breakpoint);
    out.set(id, nodeDecls(node, { breakpoint, parent, parentIsRoot, assetUrl }));
    for (const child of node.children) visit(child, node, parent === null);
  };
  visit(rootId, null, false);
  return out;
}

const RESET_VALUE: Record<string, string> = {
  left: 'auto', right: 'auto', top: 'auto', bottom: 'auto', width: 'auto', height: 'auto',
  'min-width': 'auto', 'min-height': 'auto', 'max-width': 'none', 'max-height': 'none', transform: 'none',
};

function rule(scope: string, id: string, decls: Decls): string {
  const body = Object.entries(decls).map(([key, value]) => `${key}:${value}`).join(';');
  return body ? `.${scope} .${nodeClass(id)}{${body}}` : '';
}
function diff(previous: Decls, next: Decls): Decls {
  const out: Decls = {};
  for (const [key, value] of Object.entries(next)) if (previous[key] !== value) out[key] = value;
  for (const key of Object.keys(previous)) if (!(key in next)) out[key] = RESET_VALUE[key] ?? 'unset';
  return out;
}

export function baseCss(scope: string): string {
  return [
    `.${scope}{position:relative;width:100%}`,
    `.${scope} *,.${scope} *::before,.${scope} *::after{box-sizing:border-box;margin:0;padding:0}`,
    `.${scope} :where(h1,h2,h3,h4,h5,h6,p,span){font-size:inherit;font-weight:inherit}`,
    `.${scope} img{display:block;max-width:none}`,
    `.${scope} a{color:inherit;text-decoration:none}`,
    // Buttons and fields: drop the browser's own look so they match the design exactly.
    // :where keeps these below each layer's own rule.
    `.${scope} :where(button){-webkit-appearance:none;appearance:none;background:none;border:0;border-radius:0;font:inherit;color:inherit;text-align:inherit;letter-spacing:inherit;text-transform:inherit;-webkit-user-select:none;user-select:none}`,
    `.${scope} :where(button,a,label){cursor:pointer;-webkit-tap-highlight-color:transparent}`,
    `.${scope} :where(label){cursor:text}`,
    `.${scope} :where(button):active{filter:brightness(.92)}`,
    `.${scope} :where(input,textarea){-webkit-appearance:none;appearance:none;background:transparent;border:0;border-radius:0;outline:0;min-width:0;resize:none;field-sizing:content;font:inherit;color:inherit;letter-spacing:inherit}`,
    `.${scope} :where(input,textarea)::placeholder{color:inherit;opacity:.75}`,
    // Keyboard focus is always visible (wins over a layer's outline stroke).
    `.${scope} button:focus-visible,.${scope} a:focus-visible{outline:2px solid currentColor;outline-offset:3px}`,
    `.${scope} label:focus-within{outline:2px solid currentColor;outline-offset:1px}`,
    // Embedded videos, maps and code fill their layer.
    `.${scope} .apl-embed{display:block;width:100%;height:100%;border:0}`,
    `.${scope} .apl-embed-empty{display:grid;place-items:center;padding:16px;text-align:center;font:500 13px/1.4 system-ui,sans-serif;color:#6B6E76;background:repeating-linear-gradient(135deg,#0000 0 10px,#0000000A 10px 20px)}`,
  ].join('\n');
}

/**
 * "Show / hide a layer" targets: once clicked (data-apl-flip), a hidden layer
 * shows with its own layout and a shown layer hides, on each screen size.
 */
function flipRules(doc: SiteDoc, onPage: Map<string, Decls>, breakpoint: Breakpoint, scope: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const node of Object.values(doc.nodes)) {
    if (node.link?.type !== 'toggle' || !onPage.has(node.link.targetId) || out.has(node.link.targetId)) continue;
    const target = resolveNode(doc.nodes[node.link.targetId], breakpoint);
    out.set(target.id, `.${scope} .${nodeClass(target.id)}[data-apl-flip]{display:${target.visible ? 'none' : shownDisplay(target)}}`);
  }
  return out;
}

export interface CssOptions {
  scope: string; mode: RenderMode; assetUrl: AssetUrl;
  /** Emit animations (live site and preview). The design canvas leaves this off. */
  motion?: boolean;
}

/** Complete stylesheet for a page: a single breakpoint (editor) or desktop-first media queries (live site). */
export function pageCss(doc: SiteDoc, rootId: string, options: CssOptions): string {
  if (!SCOPE.test(options.scope)) throw new Error('Invalid render scope.');
  const { scope, assetUrl } = options;
  const lines = [baseCss(scope), variablesCss(doc, scope)];
  const motion = options.motion ? motionCss(doc, rootId, scope) : '';
  if (options.mode !== 'responsive') {
    const decls = pageDecls(doc, rootId, options.mode.breakpoint, assetUrl);
    for (const [id, value] of decls) lines.push(rule(scope, id, value));
    lines.push(...flipRules(doc, decls, options.mode.breakpoint, scope).values());
    lines.push(motion);
    return lines.filter(Boolean).join('\n');
  }
  const [desktop, tablet, mobile] = BREAKPOINTS.map(bp => pageDecls(doc, rootId, bp, assetUrl));
  const [flipD, flipT, flipM] = BREAKPOINTS.map(bp => flipRules(doc, desktop, bp, scope));
  for (const [id, decls] of desktop) lines.push(rule(scope, id, decls));
  lines.push(...flipD.values());
  const media = (max: number, previous: Map<string, Decls>, next: Map<string, Decls>, flipBefore: Map<string, string>, flip: Map<string, string>) => {
    const rules = [...next].map(([id, decls]) => rule(scope, id, diff(previous.get(id) ?? {}, decls))).filter(Boolean);
    for (const [id, value] of flip) if (flipBefore.get(id) !== value) rules.push(value);
    if (rules.length) lines.push(`@media (max-width: ${max}px){\n${rules.join('\n')}\n}`);
  };
  media(BREAKPOINT_MAX.tablet, desktop, tablet, flipD, flipT);
  media(BREAKPOINT_MAX.mobile, tablet, mobile, flipT, flipM);
  lines.push(motion);
  return lines.filter(Boolean).join('\n');
}
