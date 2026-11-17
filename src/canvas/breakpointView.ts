import { BREAKPOINT_WIDTH, type Breakpoint } from '../doc/breakpoints';
import type { Override, SiteDoc, SiteNode } from '../doc/schema';
import { resolveNode } from '../render/resolve';

/**
 * Editing on Tablet or Mobile works on a "view" of the document in which every
 * layer already has that breakpoint's overrides applied. The whole editor
 * (canvas gestures, panels, commands) edits the view as if it were a normal
 * document; `applyViewChange` then stores what changed as breakpoint overrides
 * in the real document. Desktop edits the real document directly.
 */

const NESTED = ['layout', 'textStyle', 'sizing', 'constraints'] as const;
const RESPONSIVE = new Set<string>([
  'x', 'y', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'absolute', 'visible', 'rotation', 'opacity',
  'fills', 'stroke', 'effects', 'radius', 'clip', 'sticky', ...NESTED,
]);
type Small = Exclude<Breakpoint, 'desktop'>;

const docCache = new WeakMap<SiteDoc, Partial<Record<Small, SiteDoc>>>();
const nodeCache = new WeakMap<SiteNode, Partial<Record<Small, SiteNode>>>();

function viewNode(node: SiteNode, breakpoint: Small, isRoot: boolean): SiteNode {
  const cached = nodeCache.get(node)?.[breakpoint];
  if (cached) return cached;
  let out = resolveNode(node, breakpoint);
  // Page frames are as wide as the device being designed.
  if (isRoot && out.width !== BREAKPOINT_WIDTH[breakpoint]) out = { ...out, width: BREAKPOINT_WIDTH[breakpoint] };
  nodeCache.set(node, { ...nodeCache.get(node), [breakpoint]: out });
  return out;
}

export function viewDoc(real: SiteDoc, breakpoint: Breakpoint): SiteDoc {
  if (breakpoint === 'desktop') return real;
  const cached = docCache.get(real)?.[breakpoint];
  if (cached) return cached;
  const roots = new Set(real.pages.map(page => page.rootId));
  const nodes: Record<string, SiteNode> = {};
  for (const [id, node] of Object.entries(real.nodes)) nodes[id] = viewNode(node, breakpoint, roots.has(id));
  const view = { ...real, nodes };
  docCache.set(real, { ...docCache.get(real), [breakpoint]: view });
  return view;
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Store the difference between two views as overrides (responsive properties) or base changes (everything else). */
export function applyViewChange(real: SiteDoc, previous: SiteDoc, next: SiteDoc, breakpoint: Small): SiteDoc {
  const nodes = { ...real.nodes };
  for (const id of Object.keys(previous.nodes)) if (!next.nodes[id]) delete nodes[id];
  for (const [id, after] of Object.entries(next.nodes)) {
    const before = previous.nodes[id];
    if (after === before) continue;
    if (!before || !nodes[id]) { nodes[id] = after; continue; } // new layers exist on every breakpoint
    const base: Record<string, unknown> = { ...nodes[id] };
    const a = after as unknown as Record<string, unknown>, b = before as unknown as Record<string, unknown>;
    // A changed `overrides` object (for example "reset") replaces the stored one first.
    if (a.overrides !== b.overrides) base.overrides = a.overrides;
    const override: Record<string, unknown> = { ...((base.overrides as SiteNode['overrides'])[breakpoint] ?? {}) };
    let touched = false;
    for (const key of Object.keys(a)) {
      if (key === 'overrides' || same(a[key], b[key])) continue;
      if (!RESPONSIVE.has(key)) { base[key] = a[key]; continue; }
      touched = true;
      if ((NESTED as readonly string[]).includes(key)) {
        const part: Record<string, unknown> = { ...(override[key] as object | undefined) };
        const av = a[key] as Record<string, unknown>, bv = b[key] as Record<string, unknown>;
        for (const sub of Object.keys(av)) if (!same(av[sub], bv[sub])) part[sub] = av[sub];
        override[key] = part;
      } else override[key] = a[key];
    }
    if (touched) base.overrides = { ...(base.overrides as object), [breakpoint]: override as Override };
    nodes[id] = base as unknown as SiteNode;
  }
  return { ...real, name: next.name, pages: next.pages, assets: next.assets, variables: next.variables, settings: next.settings, nodes };
}

const LABELS: Record<string, string> = {
  x: 'position', y: 'position', width: 'width', height: 'height', minWidth: 'min width', maxWidth: 'max width', minHeight: 'min height', maxHeight: 'max height',
  sizing: 'sizing', constraints: 'constraints', absolute: 'positioning', visible: 'visibility', rotation: 'rotation', opacity: 'opacity', fills: 'fill', stroke: 'stroke',
  effects: 'effects', radius: 'corners', clip: 'clipping', layout: 'layout', textStyle: 'text style', sticky: 'sticking',
};
/** Human-readable list of what a layer changes on a breakpoint. Measured sizes of hug/fill layers are not counted. */
export function overrideSummary(node: SiteNode, breakpoint: Small): string[] {
  const override = node.overrides[breakpoint];
  if (!override) return [];
  const out = new Set<string>();
  for (const key of Object.keys(override)) {
    if (key === 'width' && node.sizing.h !== 'fixed') continue;
    if (key === 'height' && node.sizing.v !== 'fixed') continue;
    out.add(LABELS[key] ?? key);
  }
  return [...out];
}
