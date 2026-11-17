import type { Point, Rect } from './geometry';

/**
 * Smart guides, snapping and distance measurement (world coordinates).
 * A guide on axis 'x' is a vertical line at x = pos from y = from to y = to.
 */
export interface Guide { axis: 'x' | 'y'; pos: number; from: number; to: number }
export interface Measure { x1: number; y1: number; x2: number; y2: number; value: number }

const lines = (r: Rect, axis: 'x' | 'y') => (axis === 'x' ? [r.x, r.x + r.w / 2, r.x + r.w] : [r.y, r.y + r.h / 2, r.y + r.h]);
const EPS = 0.01;

export function unionRect(rects: Rect[]): Rect {
  const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
  return { x, y, w: Math.max(...rects.map(r => r.x + r.w)) - x, h: Math.max(...rects.map(r => r.y + r.h)) - y };
}
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x - EPS && inner.y >= outer.y - EPS && inner.x + inner.w <= outer.x + outer.w + EPS && inner.y + inner.h <= outer.y + outer.h + EPS;
}

/** Best offset (≤ threshold) aligning any of `moving` to any of `fixed`, or 0. */
function bestOffset(moving: number[], fixed: number[], threshold: number): number | null {
  let best: number | null = null;
  for (const m of moving) for (const f of fixed) {
    const diff = f - m;
    if (Math.abs(diff) <= threshold && (best === null || Math.abs(diff) < Math.abs(best))) best = diff;
  }
  return best;
}

/** Guides for every target line that `box` now touches exactly. */
export function guidesFor(box: Rect, targets: Rect[], axes: ('x' | 'y')[] = ['x', 'y']): Guide[] {
  const out = new Map<string, Guide>();
  for (const axis of axes) {
    const mine = lines(box, axis);
    for (const target of targets) for (const line of lines(target, axis)) {
      if (!mine.some(value => Math.abs(value - line) < EPS)) continue;
      const from = axis === 'x' ? Math.min(box.y, target.y) : Math.min(box.x, target.x);
      const to = axis === 'x' ? Math.max(box.y + box.h, target.y + target.h) : Math.max(box.x + box.w, target.x + target.w);
      const key = axis + Math.round(line * 100);
      const existing = out.get(key);
      out.set(key, existing ? { ...existing, from: Math.min(existing.from, from), to: Math.max(existing.to, to) } : { axis, pos: line, from, to });
    }
  }
  return [...out.values()];
}

/** Snap a moving box's edges/centers to target edges/centers. */
export function snapMove(box: Rect, targets: Rect[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const dx = bestOffset(lines(box, 'x'), targets.flatMap(t => lines(t, 'x')), threshold) ?? 0;
  const dy = bestOffset(lines(box, 'y'), targets.flatMap(t => lines(t, 'y')), threshold) ?? 0;
  const moved = { ...box, x: box.x + dx, y: box.y + dy };
  return { dx, dy, guides: guidesFor(moved, targets) };
}

/** Snap a single point (drawing, resizing an edge). */
export function snapPoint(point: Point, targets: Rect[], threshold: number, axes: ('x' | 'y')[] = ['x', 'y']): { point: Point; snapped: { x: boolean; y: boolean } } {
  const sx = axes.includes('x') ? bestOffset([point.x], targets.flatMap(t => lines(t, 'x')), threshold) : null;
  const sy = axes.includes('y') ? bestOffset([point.y], targets.flatMap(t => lines(t, 'y')), threshold) : null;
  return { point: { x: point.x + (sx ?? 0), y: point.y + (sy ?? 0) }, snapped: { x: sx !== null, y: sy !== null } };
}

const round = (value: number) => Math.round(value * 100) / 100;
function segment(x1: number, y1: number, x2: number, y2: number): Measure {
  return { x1, y1, x2, y2, value: round(Math.abs(x2 - x1) + Math.abs(y2 - y1)) };
}

/**
 * Figma-style spacing while moving: distance from `box` to its nearest sibling
 * in each direction (when they overlap on the other axis), else to the parent edge.
 */
export function measureGaps(box: Rect, siblings: Rect[], parent: Rect | null): Measure[] {
  const out: Measure[] = [];
  const overlapY = (t: Rect) => t.y < box.y + box.h && t.y + t.h > box.y;
  const overlapX = (t: Rect) => t.x < box.x + box.w && t.x + t.w > box.x;
  const midY = (t: Rect) => (Math.max(t.y, box.y) + Math.min(t.y + t.h, box.y + box.h)) / 2;
  const midX = (t: Rect) => (Math.max(t.x, box.x) + Math.min(t.x + t.w, box.x + box.w)) / 2;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const inside = parent && contains(parent, box);

  const left = siblings.filter(t => overlapY(t) && t.x + t.w <= box.x + EPS).sort((a, b) => b.x + b.w - (a.x + a.w))[0];
  if (left) out.push(segment(left.x + left.w, midY(left), box.x, midY(left)));
  else if (inside) out.push(segment(parent.x, cy, box.x, cy));
  const right = siblings.filter(t => overlapY(t) && t.x >= box.x + box.w - EPS).sort((a, b) => a.x - b.x)[0];
  if (right) out.push(segment(box.x + box.w, midY(right), right.x, midY(right)));
  else if (inside) out.push(segment(box.x + box.w, cy, parent.x + parent.w, cy));
  const up = siblings.filter(t => overlapX(t) && t.y + t.h <= box.y + EPS).sort((a, b) => b.y + b.h - (a.y + a.h))[0];
  if (up) out.push(segment(midX(up), up.y + up.h, midX(up), box.y));
  else if (inside) out.push(segment(cx, parent.y, cx, box.y));
  const down = siblings.filter(t => overlapX(t) && t.y >= box.y + box.h - EPS).sort((a, b) => a.y - b.y)[0];
  if (down) out.push(segment(midX(down), box.y + box.h, midX(down), down.y));
  else if (inside) out.push(segment(cx, box.y + box.h, cx, parent.y + parent.h));
  return out.filter(m => m.value > EPS);
}

/** Alt-hover: distances between the selection `a` and the hovered layer `b`. */
export function measureBetween(a: Rect, b: Rect): Measure[] {
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  if (contains(b, a)) {
    return [
      segment(b.x, cy, a.x, cy), segment(a.x + a.w, cy, b.x + b.w, cy),
      segment(cx, b.y, cx, a.y), segment(cx, a.y + a.h, cx, b.y + b.h),
    ].filter(m => m.value > EPS);
  }
  if (contains(a, b)) return measureBetween(b, a);
  const out: Measure[] = [];
  const oy = Math.max(a.y, b.y) < Math.min(a.y + a.h, b.y + b.h) ? (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2 : cy;
  const ox = Math.max(a.x, b.x) < Math.min(a.x + a.w, b.x + b.w) ? (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2 : cx;
  if (b.x >= a.x + a.w) out.push(segment(a.x + a.w, oy, b.x, oy));
  else if (b.x + b.w <= a.x) out.push(segment(b.x + b.w, oy, a.x, oy));
  if (b.y >= a.y + a.h) out.push(segment(ox, a.y + a.h, ox, b.y));
  else if (b.y + b.h <= a.y) out.push(segment(ox, b.y + b.h, ox, a.y));
  return out.filter(m => m.value > EPS);
}
