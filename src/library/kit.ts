import { createNode, DEFAULT_LAYOUT, DEFAULT_TEXT_STYLE } from '../doc/ops';
import { guessInputType } from '../doc/interactive';
import type { Effect, FrameNode, Layout, Link, Motion, Override, Paint, SiteNode, TextNode } from '../doc/schema';
import type { Theme } from './themes';

/**
 * A small builder kit for library designs. Everything it produces is ordinary
 * SiteDoc layers (auto-layout frames, text, shapes) with tablet and mobile
 * overrides already filled in, so inserted designs are fully editable and
 * responsive.
 */
export interface Tree { node: SiteNode; children: Tree[] }
export type Kid = Tree | Kid[] | false | null | undefined;
type Size = number | 'fill' | 'hug';

export const solid = (color: string): Paint[] => [{ type: 'solid', color, visible: true }];
export const lin = (angle: number, ...colors: string[]): Paint[] => [{ type: 'linear', angle, stops: colors.map((color, i) => ({ offset: i / (colors.length - 1), color })), visible: true }];
export const rad = (from: string, to: string): Paint[] => [{ type: 'radial', stops: [{ offset: 0, color: from }, { offset: 1, color: to }], visible: true }];
/** Replace a color's alpha: alpha('#112233', '80'). */
export const alpha = (color: string, aa: string) => color.slice(0, 7) + aa;
/** Drop shadow effect: glow(…blur) or hard offset (blur 0). */
export const drop = (x: number, y: number, blur: number, color: string, spread = 0): Effect => ({ type: 'dropShadow', x, y, blur, spread, color, visible: true });

/** Options shared by every layer. */
interface Common {
  name?: string;
  w?: Size; h?: Size; maxW?: number; minH?: number;
  /** Absolute position inside the parent; `center` pins it to the parent's horizontal center. */
  abs?: [number, number]; center?: boolean;
  op?: number; rot?: number; motion?: Motion;
  /** What happens on click (link to a page or address). */
  link?: Link;
  /** Hidden on mobile / hidden on tablet and mobile / shown on mobile only. */
  hideM?: boolean; hideT?: boolean; onlyM?: boolean;
  /** Starts hidden everywhere (shown by a "show / hide" click). */
  hidden?: boolean;
  /** Stays in view while its frame scrolls past (distance from the top). */
  sticky?: number;
  /** Fill the parent's width on mobile. */
  mfill?: boolean;
  mobile?: Override; tablet?: Override;
}
/** Frame options. */
export interface F extends Common {
  tag?: FrameNode['tag'];
  gap?: number; rgap?: number; pad?: number | number[]; main?: 'start' | 'center' | 'end' | 'between'; cross?: Layout['alignCross']; wrap?: boolean;
  bg?: string | Paint[]; r?: number; line?: boolean | string; shadow?: boolean; clip?: boolean; blur?: number;
  /** Extra effects, such as a hard offset shadow or a colored glow. */
  fx?: Effect[];
  /** Stack a row vertically on mobile. */
  stack?: boolean | 'center';
  /** Grid columns on tablet / mobile, and padding on tablet / mobile. */
  tcols?: number; mcols?: number; tpad?: number | number[]; mpad?: number | number[];
}
/** Text options. */
export interface X extends Common {
  size?: number; weight?: number; color?: string; font?: 'head' | 'body'; align?: 'left' | 'center' | 'right';
  lh?: number; ls?: number; upper?: boolean; italic?: boolean; strike?: boolean; underline?: boolean; tag?: TextNode['tag'];
  /** Gradient text. */
  grad?: Paint[];
  /** Keep the same size on every breakpoint. */
  fixed?: boolean;
}
/** Shape options. */
export interface S extends Common { bg?: string | Paint[]; r?: number; line?: boolean | string; blur?: number; shadow?: boolean }

const pads = (value: number | number[] | undefined): [number, number, number, number] => {
  if (value === undefined) return [0, 0, 0, 0];
  if (typeof value === 'number') return [value, value, value, value];
  return value.length === 2 ? [value[0], value[1], value[0], value[1]] : [value[0], value[1], value[2], value[3]];
};
const paint = (value: string | Paint[] | undefined): Paint[] => (value === undefined ? [] : typeof value === 'string' ? solid(value) : value);
const sizeMode = (value: Size | undefined, fallback: 'hug' | 'fixed'): 'fixed' | 'hug' | 'fill' => (value === undefined ? fallback : typeof value === 'number' ? 'fixed' : value);
const flat = (kids: Kid[]): Tree[] => kids.flatMap(kid => (Array.isArray(kid) ? flat(kid) : kid ? [kid] : []));

export type Kit = ReturnType<typeof kit>;
/** Placeholder destination for links; inserting a design points links named after a page at that page. */
export const HASH: Link = { type: 'url', href: '#', newTab: false };

export function kit(t: Theme) {
  const shadow = { type: 'dropShadow' as const, x: 0, y: 14, blur: 36, spread: -10, color: t.dark ? '#00000080' : '#0F172A24', visible: true };
  const stroke = (value: boolean | string | undefined) => (value ? { color: value === true ? t.line : value, weight: t.lw, align: 'inside' as const, style: 'solid' as const } : null);

  /** Fields every layer shares, including responsive overrides. */
  function common(o: Common, fallback: 'hug' | 'fixed', mobile: Override, tablet: Override) {
    if (o.hideM) mobile.visible = false;
    if (o.hideT) tablet.visible = false;
    if (o.onlyM) mobile.visible = true;
    if (o.mfill) mobile.sizing = { h: 'fill', ...mobile.sizing };
    if (o.sticky !== undefined && mobile.sticky === undefined) mobile.sticky = null;
    const overrides: SiteNode['overrides'] = {};
    if (Object.keys(tablet).length) overrides.tablet = tablet;
    if (Object.keys(mobile).length) overrides.mobile = mobile;
    return {
      sizing: { h: sizeMode(o.w, fallback), v: sizeMode(o.h, fallback) },
      width: typeof o.w === 'number' ? o.w : 320, height: typeof o.h === 'number' ? o.h : 100,
      maxWidth: o.maxW ?? null, minHeight: o.minH ?? null,
      absolute: !!o.abs, x: o.abs?.[0] ?? 0, y: o.abs?.[1] ?? 0,
      constraints: { h: o.center ? 'center' as const : 'left' as const, v: 'top' as const },
      opacity: o.op ?? 1, rotation: o.rot ?? 0, visible: !o.onlyM && !o.hidden, overrides,
      // Sticky layers stop sticking once the layout stacks into one column on phones.
      ...(o.sticky !== undefined ? { sticky: o.sticky } : {}),
      ...(o.motion ? { motion: o.motion } : {}),
      ...(o.link ? { link: o.link } : {}),
    };
  }

  function frame(mode: Layout['mode'], o: F, kids: Kid[], columns = 2): Tree {
    const mobile: Override = { ...o.mobile }, tablet: Override = { ...o.tablet };
    if (o.stack) mobile.layout = { mode: 'vertical', alignMain: 'start', alignCross: o.stack === 'center' ? 'center' : 'start', ...mobile.layout };
    if (o.tpad !== undefined) tablet.layout = { padding: pads(o.tpad), ...tablet.layout };
    if (o.mpad !== undefined) mobile.layout = { padding: pads(o.mpad), ...mobile.layout };
    if (mode === 'grid') {
      const tcols = o.tcols ?? Math.min(columns, 2), mcols = o.mcols ?? 1;
      if (tcols !== columns) tablet.layout = { gridColumns: tcols, ...tablet.layout };
      if (mcols !== tcols) mobile.layout = { gridColumns: mcols, ...mobile.layout };
    }
    const effects = [...(o.shadow ? [shadow] : []), ...(o.blur ? [{ type: 'backgroundBlur' as const, radius: o.blur, visible: true }] : []), ...(o.fx ?? [])];
    const node = createNode('frame', {
      name: o.name ?? (mode === 'grid' ? 'Grid' : mode === 'horizontal' ? 'Row' : 'Stack'),
      // Anything named "… button" is a real, clickable button on the site.
      tag: o.tag ?? (/(^|\s)button$/i.test(o.name ?? '') ? 'button' : 'div'),
      layout: {
        ...DEFAULT_LAYOUT, mode, gap: o.gap ?? 0, counterGap: o.rgap ?? null, padding: pads(o.pad), wrap: !!o.wrap, gridColumns: columns,
        alignMain: o.main === 'between' ? 'spaceBetween' : o.main ?? 'start', alignCross: o.cross ?? 'start',
      },
      fills: paint(o.bg), radius: [o.r ?? 0, o.r ?? 0, o.r ?? 0, o.r ?? 0], stroke: stroke(o.line), effects, clip: !!o.clip,
      ...common(o, 'hug', mobile, tablet),
    });
    return { node, children: flat(kids) };
  }
  const row = (o: F, kids: Kid[]) => frame('horizontal', o, kids);
  const col = (o: F, kids: Kid[]) => frame('vertical', o, kids);
  const grid = (columns: number, o: F, kids: Kid[]) => frame('grid', o, kids, columns);

  function txt(value: string, o: X = {}): Tree {
    const size = o.size ?? 16, head = o.font === 'head';
    const mobile: Override = { ...o.mobile }, tablet: Override = { ...o.tablet };
    if (!o.fixed) {
      // Large type steps down on smaller screens.
      const [ts, ms] = size >= 80 ? [0.66, 0.4] : size >= 56 ? [0.78, 0.58] : size >= 36 ? [0.88, 0.72] : size >= 24 ? [1, 0.88] : [1, 1];
      if (ts < 1) tablet.textStyle = { fontSize: Math.round(size * ts), ...tablet.textStyle };
      if (ms < 1) mobile.textStyle = { fontSize: Math.round(size * ms), ...mobile.textStyle };
    }
    const node = createNode('text', {
      name: (o.name ?? value).trim().slice(0, 40) || 'Text', text: value, tag: o.tag ?? 'p',
      fills: o.grad ?? solid(o.color ?? t.text),
      textStyle: {
        ...DEFAULT_TEXT_STYLE, fontFamily: head ? t.head : t.body, fontWeight: o.weight ?? (head ? t.hw : 400), fontSize: size,
        lineHeight: o.lh ?? (size >= 40 ? 1.08 : size >= 22 ? 1.25 : 1.55),
        letterSpacing: o.ls ?? (head && size >= 22 ? Math.round(size * t.hls * 10) / 10 : 0),
        align: o.align ?? 'left', italic: !!o.italic, decoration: o.strike ? 'line-through' : o.underline ? 'underline' : 'none', transform: o.upper ? 'uppercase' : 'none',
      },
      ...common({ ...o, h: 'hug' }, 'hug', mobile, tablet),
    });
    return { node, children: [] };
  }
  const h1 = (value: string, o: X = {}) => txt(value, { font: 'head', size: 64, tag: 'h1', w: 'fill', ...o });
  const h2 = (value: string, o: X = {}) => txt(value, { font: 'head', size: 44, tag: 'h2', w: 'fill', ...o });
  const h3 = (value: string, o: X = {}) => txt(value, { font: 'head', size: 22, tag: 'h3', w: 'fill', lh: 1.3, ...o });
  const p = (value: string, o: X = {}) => txt(value, { size: 17, color: t.muted, w: 'fill', lh: 1.6, ...o });
  const eyebrow = (value: string, o: X = {}) => txt(value, { size: 13, weight: 600, ls: 1.4, upper: true, color: t.accent, tag: 'span', ...o });

  function shape(kind: 'rect' | 'ellipse', o: S): Tree {
    const effects = [...(o.shadow ? [shadow] : []), ...(o.blur ? [{ type: 'layerBlur' as const, radius: o.blur, visible: true }] : [])];
    const node = createNode(kind, {
      name: o.name ?? (kind === 'rect' ? 'Shape' : 'Circle'), fills: paint(o.bg ?? t.line), radius: [o.r ?? 0, o.r ?? 0, o.r ?? 0, o.r ?? 0],
      stroke: stroke(o.line), effects, ...common(o, 'fixed', { ...o.mobile }, { ...o.tablet }),
    });
    return { node, children: [] };
  }
  /** Picture placeholder: a soft gradient block. Replace it with a real image after inserting. */
  const img = (index: number, o: S = {}) => shape('rect', { name: 'Picture', w: 'fill', h: 320, r: t.r, bg: lin(135, ...t.imgs[index % 3]), ...o });
  const avatar = (index: number, size = 40, o: S = {}) => shape('ellipse', { name: 'Avatar', w: size, h: size, bg: lin(135, ...t.imgs[index % 3]), ...o });
  const rule = (o: S = {}) => shape('rect', { name: 'Divider', w: 'fill', h: t.lw, bg: t.line, ...o });
  /** Soft glow used as a section decoration. */
  const glow = (x: number, y: number, size: number, color = t.accent, o: S = {}) => shape('ellipse', { name: 'Glow', w: size, h: size, abs: [x, y], center: true, bg: rad(alpha(color, '59'), alpha(color, '00')), ...o });

  type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'onInv' | 'accent';
  function btn(label: string, kind: ButtonKind = 'primary', o: F & { lg?: boolean } = {}): Tree {
    const { lg, ...rest } = o;
    const look = {
      primary: { bg: t.primary, color: t.onPrimary }, accent: { bg: t.accent, color: t.dark ? t.bg : '#FFFFFF' }, onInv: { bg: t.onInv, color: t.inv },
      secondary: { bg: undefined, color: t.text }, ghost: { bg: undefined, color: t.text },
    }[kind];
    return row({
      name: label + ' button', pad: kind === 'ghost' ? [lg ? 16 : 13, 0] : lg ? [16, 28] : [13, 22], r: t.br, bg: look.bg, line: kind === 'secondary',
      main: 'center', cross: 'center', gap: 8, motion: { hover: { type: kind === 'ghost' ? 'dim' : 'lift' } }, ...rest,
    }, [txt(label, { size: lg ? 16 : 15, weight: 600, color: look.color, lh: 1.2, tag: 'span' })]);
  }
  const badge = (label: string, color = t.accent, o: F = {}) => row({ name: 'Badge', pad: [5, 12], r: Math.min(t.br, 999), bg: alpha(color, '1F'), cross: 'center', gap: 6, ...o }, [txt(label, { size: 12.5, weight: 600, color, lh: 1.3, tag: 'span' })]);
  const icon = (glyph: string, size = 44, color = t.accent, o: F = {}) => row({ name: 'Icon', w: size, h: size, r: Math.min(t.r, Math.round(size * 0.28)), bg: alpha(color, '1F'), main: 'center', cross: 'center', ...o }, [txt(glyph, { size: Math.round(size * 0.45), weight: 600, color, lh: 1, tag: 'span' })]);
  const card = (o: F, kids: Kid[]) => col({ name: 'Card', pad: 28, gap: 14, r: t.r, bg: t.surface, w: 'fill', line: t.card === 'line', shadow: t.card === 'shadow', ...o }, kids);
  /**
   * A real form field: the box is the visible field and its text is the placeholder.
   * Boxes aligned to the top (`cross: 'start'`, the tall message style) take several lines.
   */
  function input(placeholder: string, o: F = {}, about = placeholder): Tree {
    const area = o.cross === 'start';
    const box = row({ name: 'Field', pad: [13, 16], r: Math.min(t.br, 12), bg: t.surface, line: true, w: 'fill', cross: 'center', ...o }, [txt(placeholder, { name: placeholder, size: 15, color: t.muted, lh: 1.2, tag: area ? 'textarea' : 'input', w: 'fill' })]);
    const text = box.children[0].node;
    if (!area && text.type === 'text') text.inputType = guessInputType(about);
    return box;
  }
  /** Labelled form field. */
  const field = (label: string, placeholder: string, o: F = {}) => col({ name: label, gap: 8, w: 'fill' }, [txt(label, { size: 14, weight: 500, tag: 'span' }), input(placeholder, o, label + ' ' + placeholder)]);
  const logo = (name = 'Northwind', color = t.text) => row({ name: 'Logo', gap: 10, cross: 'center' }, [
    shape('rect', { name: 'Mark', w: 22, h: 22, r: Math.min(t.r, 7), bg: color === t.text ? t.primary : color }),
    txt(name, { font: 'head', size: 20, weight: Math.max(t.hw, 600) > 800 ? 800 : t.hw, color, ls: -0.3, lh: 1.2, tag: 'span' }),
  ]);
  const stars = (o: X = {}) => txt('★★★★★', { name: 'Rating', size: 15, ls: 2, color: '#F5A524', lh: 1.2, tag: 'span', ...o });
  const check = (label: string, color = t.text, mark = t.accent) => row({ name: 'Point', gap: 10, w: 'fill' }, [txt('✓', { size: 15, weight: 700, color: mark, tag: 'span' }), txt(label, { size: 15, color, w: 'fill' })]);
  /** Small text link list item. */
  const link = (label: string, color = t.muted, o: X = {}) => txt(label, { size: 15, weight: 500, color, lh: 1.3, tag: 'span', link: HASH, ...o });

  /** Full-width page section with a centered container. `deco` layers sit behind the content. */
  function section(name: string, o: F & { py?: number; deco?: Kid[]; inner?: F }, kids: Kid[]): Tree {
    const { py = 96, deco, inner, gap, cross, maxW, ...rest } = o;
    return col({
      name, tag: 'section', w: 'fill', cross: 'center', pad: [py, 64], tpad: [Math.round(py * 0.75), 40], mpad: [Math.max(Math.min(py, 40), Math.round(py * 0.6)), 20],
      bg: t.bg, clip: !!deco, ...rest,
    }, [deco, col({ name: 'Container', w: 'fill', maxW: maxW ?? 1200, gap: gap ?? 56, cross: cross ?? 'start', ...inner }, kids)]);
  }
  /** Section heading: eyebrow, title and supporting line. */
  function intro(label: string | null, title: string, sub?: string | null, o: { center?: boolean; color?: string; muted?: string; size?: number; maxW?: number } = {}): Tree {
    const align = o.center ? 'center' : 'left';
    return col({ name: 'Heading', gap: 16, w: 'fill', maxW: o.maxW ?? 720, cross: o.center ? 'center' : 'start' }, [
      label ? eyebrow(label) : null,
      h2(title, { align, color: o.color ?? t.text, size: o.size ?? 44 }),
      sub ? p(sub, { align, color: o.muted ?? t.muted, size: 18 }) : null,
    ]);
  }

  return { t, row, col, grid, txt, h1, h2, h3, p, eyebrow, shape, img, avatar, rule, glow, btn, badge, icon, card, input, field, logo, stars, check, link, section, intro };
}

/** Flatten a tree into linked nodes, root first (root.parentId is null). */
export function flatten(tree: Tree): SiteNode[] {
  const out: SiteNode[] = [];
  const visit = (current: Tree, parentId: string | null) => {
    out.push({ ...current.node, parentId, children: current.children.map(child => child.node.id) } as SiteNode);
    for (const child of current.children) visit(child, current.node.id);
  };
  visit(tree, null);
  return out;
}
