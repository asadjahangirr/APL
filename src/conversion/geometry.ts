import { designSchema, type DesignDocument, type DesignLayer } from '../design/schema';

export interface ConversionBounds { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number };
type Matrix = [number, number, number, number, number, number];
const identity: Matrix = [1, 0, 0, 1, 0, 0];
function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function point(matrix: Matrix, x: number, y: number): Point { return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] }; }
export function ancestors(design: DesignDocument, layer: DesignLayer): DesignLayer[] {
  const result: DesignLayer[] = [];
  let id = layer.parentId;
  while (id !== null) {
    const parent = design.layers.find(value => value.id === id);
    if (!parent) break;
    result.unshift(parent); id = parent.parentId;
  }
  return result;
}
export function isVisible(design: DesignDocument, layer: DesignLayer): boolean {
  return [layer, ...ancestors(design, layer)].every(value => value.visible && value.opacity > 0);
}
export function effectiveOpacity(design: DesignDocument, layer: DesignLayer): number {
  return [layer, ...ancestors(design, layer)].reduce((opacity, value) => opacity * value.opacity, 1);
}
function transform(design: DesignDocument, layer: DesignLayer): Matrix {
  let result = identity;
  let origin = { x: 0, y: 0 };
  for (const entry of [...ancestors(design, layer), layer]) {
    const angle = entry.rotation * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
    result = multiply(result, [cosine, sine, -sine, cosine, entry.x - origin.x, entry.y - origin.y]);
    origin = entry;
  }
  return result;
}
export function absoluteRotation(design: DesignDocument, layer: DesignLayer): number {
  return [...ancestors(design, layer), layer].reduce((angle, value) => angle + value.rotation, 0);
}
function polygon(design: DesignDocument, layer: DesignLayer, stroke = false): Point[] {
  const matrix = transform(design, layer), inset = stroke && layer.stroke !== 'transparent' ? layer.strokeWidth / 2 : 0;
  return [[-inset, -inset], [layer.width + inset, -inset], [layer.width + inset, layer.height + inset], [-inset, layer.height + inset]].map(([x, y]) => point(matrix, x, y));
}
function cross(a: Point, b: Point, p: Point): number { return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); }
function intersection(a: Point, b: Point, c: Point, d: Point): Point {
  const ab = { x: b.x - a.x, y: b.y - a.y }, cd = { x: d.x - c.x, y: d.y - c.y };
  const divisor = ab.x * cd.y - ab.y * cd.x;
  if (Math.abs(divisor) < 1e-12) return b;
  const factor = ((c.x - a.x) * cd.y - (c.y - a.y) * cd.x) / divisor;
  return { x: a.x + factor * ab.x, y: a.y + factor * ab.y };
}
/** Intersect convex transformed frame bounds without losing ancestor rotation. */
function clip(subject: Point[], boundary: Point[]): Point[] {
  let result = subject;
  for (let index = 0; index < boundary.length && result.length; index++) {
    const a = boundary[index], b = boundary[(index + 1) % boundary.length], input = result;
    result = [];
    for (let edge = 0; edge < input.length; edge++) {
      const current = input[edge], previous = input[(edge + input.length - 1) % input.length];
      const inside = cross(a, b, current) >= -1e-8, wasInside = cross(a, b, previous) >= -1e-8;
      if (inside !== wasInside) result.push(intersection(previous, current, a, b));
      if (inside) result.push(current);
    }
  }
  return result;
}
function clippedPolygon(design: DesignDocument, layer: DesignLayer, stroke = false): Point[] {
  const board = design.artboards.find(value => value.id === layer.artboardId)!;
  let result = polygon(design, layer, stroke);
  for (const parent of ancestors(design, layer)) if (parent.type === 'frame') result = clip(result, polygon(design, parent));
  return clip(result, [{ x: 0, y: 0 }, { x: board.width, y: 0 }, { x: board.width, y: board.height }, { x: 0, y: board.height }]);
}
function bounds(points: Point[]): ConversionBounds | null {
  if (!points.length) return null;
  const x = Math.min(...points.map(value => value.x)), y = Math.min(...points.map(value => value.y));
  return { x, y, width: Math.max(...points.map(value => value.x)) - x, height: Math.max(...points.map(value => value.y)) - y };
}
export function layerGeometry(design: DesignDocument, layer: DesignLayer): { bounds: ConversionBounds; clipped: boolean } {
  const original = polygon(design, layer), visible = clippedPolygon(design, layer);
  const area = (points: Point[]) => Math.abs(points.reduce((sum, value, index) => { const next = points[(index + 1) % points.length]; return sum + value.x * next.y - next.x * value.y; }, 0)) / 2;
  return { bounds: bounds(original)!, clipped: area(visible) + 1e-5 < area(original) };
}
export function subtree(design: DesignDocument, ids: readonly string[]): DesignLayer[] {
  const included = new Set(ids);
  let size = -1;
  while (size !== included.size) {
    size = included.size;
    for (const layer of design.layers) if (layer.parentId !== null && included.has(layer.parentId)) included.add(layer.id);
  }
  return design.layers.filter(layer => included.has(layer.id));
}

/** Artboard-relative composed bounds; shared scene rendering retains rounded clipping. */
export function decorationBounds(input: DesignDocument, artboardId: string, layerIds: readonly string[]): ConversionBounds {
  const design = designSchema.parse(input);
  if (!design.artboards.some(board => board.id === artboardId)) throw new Error('The source artboard is missing.');
  if (!layerIds.length || layerIds.some(id => !design.layers.some(layer => layer.id === id && layer.artboardId === artboardId))) throw new Error('Choose existing decorative layers on this artboard.');
  const layers = subtree(design, layerIds).filter(layer => isVisible(design, layer));
  if (layers.some(layer => layer.type === 'text' && layer.text.trim())) throw new Error('Meaningful text must remain website text and cannot be flattened into artwork.');
  const points = layers.filter(layer => layer.type !== 'group' && (layer.type !== 'frame' || layer.fill !== 'transparent' || layer.strokeWidth > 0)).flatMap(layer => clippedPolygon(design, layer, true));
  const result = bounds(points);
  if (!result || result.width <= 0 || result.height <= 0) throw new Error('This artwork has no visible area inside its artboard and frames.');
  return result;
}
