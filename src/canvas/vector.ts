import { createNode } from '../doc/ops';
import type { SiteNode } from '../doc/schema';
import type { Point, Rect } from './geometry';

/** Path building for the Line, Arrow, Polygon, Star, Pen and Pencil tools. */

export type VectorNode = Extract<SiteNode, { type: 'vector' }>;
/** Pen anchor with an optional symmetric curve handle (hx, hy is the outgoing handle offset). */
export interface PenPoint { x: number; y: number; hx?: number; hy?: number }
export type ShapeTool = 'line' | 'arrow' | 'polygon' | 'star';

const n = (value: number) => String(Math.round(value * 100) / 100);
const identity = (x: number, y: number): Point => ({ x, y });
const STROKE = { color: '#111111', weight: 2, align: 'center' as const, style: 'solid' as const };
const solid = (color: string) => [{ type: 'solid' as const, color, visible: true }];

/** SVG path through pen anchors; segments with handles become curves. */
export function penD(points: PenPoint[], closed: boolean, map: (x: number, y: number) => Point = identity): string {
  if (!points.length) return '';
  const at = (x: number, y: number) => { const p = map(x, y); return `${n(p.x)} ${n(p.y)}`; };
  const segment = (a: PenPoint, b: PenPoint) => (a.hx || a.hy || b.hx || b.hy
    ? `C${at(a.x + (a.hx ?? 0), a.y + (a.hy ?? 0))} ${at(b.x - (b.hx ?? 0), b.y - (b.hy ?? 0))} ${at(b.x, b.y)}`
    : `L${at(b.x, b.y)}`);
  let d = 'M' + at(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) d += segment(points[i - 1], points[i]);
  if (closed && points.length > 1) d += segment(points[points.length - 1], points[0]) + 'Z';
  return d;
}

/** Drop points that barely change direction (Ramer–Douglas–Peucker). */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let worst = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = Math.abs((b.x - a.x) * (a.y - points[i].y) - (a.x - points[i].x) * (b.y - a.y)) / length;
    if (distance > worst) { worst = distance; index = i; }
  }
  if (worst <= tolerance) return [a, b];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

/** Smooth freehand path: quadratic curves through the midpoints of a simplified stroke. */
export function freehandD(points: Point[], map: (x: number, y: number) => Point = identity): string {
  if (!points.length) return '';
  const at = (p: Point) => { const q = map(p.x, p.y); return `${n(q.x)} ${n(q.y)}`; };
  if (points.length < 3) return 'M' + points.map(at).join('L');
  let d = 'M' + at(points[0]);
  for (let i = 1; i < points.length - 1; i++) d += `Q${at(points[i])} ${at({ x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 })}`;
  return d + 'L' + at(points[points.length - 1]);
}

export function polygonD(count: number): string {
  const points = Array.from({ length: count }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / count; return `${n(50 + 50 * Math.cos(a))} ${n(50 + 50 * Math.sin(a))}`; });
  return 'M' + points.join('L') + 'Z';
}
export function starD(count: number, inner: number): string {
  const points = Array.from({ length: count * 2 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / count, r = i % 2 ? 50 * inner : 50; return `${n(50 + r * Math.cos(a))} ${n(50 + r * Math.sin(a))}`; });
  return 'M' + points.join('L') + 'Z';
}
/** Path for a polygon / star layer's shape settings. */
export const shapeD = (shape: NonNullable<VectorNode['shape']>) => (shape.kind === 'star' ? starD(shape.points, shape.inner) : polygonD(shape.points));

function bounds(points: PenPoint[]): Rect {
  const xs = points.flatMap(p => [p.x, p.x + (p.hx ?? 0), p.x - (p.hx ?? 0)]), ys = points.flatMap(p => [p.y, p.y + (p.hy ?? 0), p.y - (p.hy ?? 0)]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
type Patch = { name: string; x: number; y: number; width: number; height: number };

/** Layer for a shape drawn by dragging from `start` to `end` (world space). `patch` holds its box in the container. */
export function shapeNode(tool: ShapeTool, start: Point, end: Point, clicked: boolean, patch: Patch): VectorNode {
  if (tool === 'polygon' || tool === 'star') {
    const shape = tool === 'star' ? { kind: 'star' as const, points: 5, inner: 0.45 } : { kind: 'polygon' as const, points: 3, inner: 0.5 };
    return createNode('vector', { ...patch, path: shapeD(shape), viewBox: [100, 100], shape, fills: solid('#D9D9D9') });
  }
  const a = clicked ? { x: 0, y: 0.5 } : { x: start.x - Math.min(start.x, end.x), y: start.y - Math.min(start.y, end.y) };
  const b = clicked ? { x: 100, y: 0.5 } : { x: end.x - Math.min(start.x, end.x), y: end.y - Math.min(start.y, end.y) };
  const width = clicked ? 100 : patch.width, height = clicked ? 1 : patch.height;
  // A perfectly horizontal or vertical line sits in the middle of its 1px box.
  if (Math.abs(a.y - b.y) < 1) a.y = b.y = height / 2;
  if (Math.abs(a.x - b.x) < 1) a.x = b.x = width / 2;
  let path = `M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}`;
  if (tool === 'arrow') {
    const angle = Math.atan2(b.y - a.y, b.x - a.x), size = Math.min(14, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
    const wing = (turn: number) => `${n(b.x - size * Math.cos(angle + turn))} ${n(b.y - size * Math.sin(angle + turn))}`;
    path += `M${wing(0.5)}L${n(b.x)} ${n(b.y)}L${wing(-0.5)}`;
  }
  return createNode('vector', { ...patch, width, height, path, viewBox: [width, height], fills: [], stroke: STROKE });
}

/** Layer for a pen path given in world space, placed inside `container`. */
export function penNode(points: PenPoint[], closed: boolean, container: Rect, name: string, absolute: boolean): VectorNode {
  const box = bounds(points), width = Math.max(1, Math.round(box.w)), height = Math.max(1, Math.round(box.h));
  return createNode('vector', {
    name, x: Math.round(box.x - container.x), y: Math.round(box.y - container.y), width, height, absolute,
    path: penD(points, closed, (x, y) => ({ x: x - box.x, y: y - box.y })), viewBox: [width, height],
    fills: closed ? solid('#D9D9D9') : [], stroke: STROKE,
  });
}
/** Layer for a freehand stroke given in world space. */
export function pencilNode(raw: Point[], container: Rect, name: string, absolute: boolean): VectorNode {
  const points = simplify(raw, 1.2), box = bounds(points);
  const width = Math.max(1, Math.round(box.w)), height = Math.max(1, Math.round(box.h));
  return createNode('vector', {
    name, x: Math.round(box.x - container.x), y: Math.round(box.y - container.y), width, height, absolute,
    path: freehandD(points, (x, y) => ({ x: x - box.x, y: y - box.y })), viewBox: [width, height], fills: [], stroke: STROKE,
  });
}
