import type { SiteDoc } from '../doc/schema';
import { MAX_ZOOM, MIN_ZOOM, type Viewport } from './store';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Ids from the page root down to `id`. */
export function chainOf(doc: SiteDoc, id: string): string[] {
  const out: string[] = [];
  let current: string | null = id;
  while (current !== null && doc.nodes[current]) { out.unshift(current); current = doc.nodes[current].parentId; }
  return out;
}

/**
 * Figma-style click selection. Clicking selects the outermost layer under the
 * pointer, except that siblings of (and layers inside the ancestors of) the
 * current selection become directly selectable. `deep` (Ctrl/Cmd) selects the
 * exact layer hit.
 */
export function pickSelectable(doc: SiteDoc, chain: string[], selection: string[], deep: boolean): string | null {
  if (chain.length < 2) return null; // only the page frame was hit
  if (deep) return chain[chain.length - 1];
  const scope = new Set<string>([chain[0]]);
  for (const id of selection) for (const ancestor of chainOf(doc, id).slice(0, -1)) scope.add(ancestor);
  for (let index = chain.length - 1; index >= 1; index--) {
    const parentId = doc.nodes[chain[index]]?.parentId;
    if (parentId && scope.has(parentId)) return chain[index];
  }
  return chain[1];
}

/** Double-click: step one level deeper from the selected layer toward the layer hit. */
export function enterChild(chain: string[], selectedId: string | undefined): string | null {
  if (!selectedId) return null;
  const index = chain.indexOf(selectedId);
  return index >= 0 && index < chain.length - 1 ? chain[index + 1] : null;
}

/**
 * Insertion index for dropping into an auto-layout container, given the other
 * children's rects in order. Wrapping rows are handled by comparing rows first.
 */
export function dropIndex(siblings: Rect[], direction: 'horizontal' | 'vertical' | 'grid', point: Point): number {
  for (let index = 0; index < siblings.length; index++) {
    const rect = siblings[index];
    if (direction === 'vertical') { if (point.y < rect.y + rect.h / 2) return index; continue; }
    if (point.y < rect.y) return index;
    if (point.y <= rect.y + rect.h && point.x < rect.x + rect.w / 2) return index;
  }
  return siblings.length;
}

/** New bounds while dragging a resize handle. `keepRatio` holds the starting aspect ratio. */
export function resizeBounds(handle: Handle, start: Rect, dx: number, dy: number, keepRatio = false): Rect {
  let { x, y, w, h } = start;
  if (handle.includes('e')) w = start.w + dx;
  if (handle.includes('w')) { w = start.w - dx; x = start.x + dx; }
  if (handle.includes('s')) h = start.h + dy;
  if (handle.includes('n')) { h = start.h - dy; y = start.y + dy; }
  if (keepRatio && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    const horizontalOnly = handle === 'e' || handle === 'w', verticalOnly = handle === 'n' || handle === 's';
    if (horizontalOnly || (!verticalOnly && Math.abs(w / start.w) >= Math.abs(h / start.h))) h = w / ratio;
    else w = h * ratio;
    if (handle.includes('w')) x = start.x + start.w - w;
    if (handle.includes('n')) y = start.y + start.h - h;
  }
  // Dragging past the opposite edge flips instead of producing negative sizes.
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

/** Normalized rectangle from two drag points. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Zoom by `factor` keeping the screen point under the cursor fixed. */
export function zoomAt(viewport: Viewport, factor: number, screen: Point): Viewport {
  const zoom = clampZoom(viewport.zoom * factor);
  const worldX = (screen.x - viewport.x) / viewport.zoom, worldY = (screen.y - viewport.y) / viewport.zoom;
  return { zoom, x: screen.x - worldX * zoom, y: screen.y - worldY * zoom };
}

/** Viewport that fits a world rect into the screen with padding (never above 100%). */
export function fitRect(screenW: number, screenH: number, content: Rect, padding = 48): Viewport {
  const zoom = clampZoom(Math.min(1, (screenW - padding * 2) / Math.max(1, content.w), (screenH - padding * 2) / Math.max(1, content.h)));
  return { zoom, x: (screenW - content.w * zoom) / 2 - content.x * zoom, y: Math.max(padding, (screenH - content.h * zoom) / 2) - content.y * zoom };
}

/** Size for a newly inserted image: natural size, scaled down to fit `max` width. */
export function insertSize(width: number, height: number, max = 640): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(1, width));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// ── Rotation ─────────────────────────────────────────────────────────────────
export function rotatePoint(point: Point, degrees: number): Point {
  const t = (degrees * Math.PI) / 180, cos = Math.cos(t), sin = Math.sin(t);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

/** Angle in degrees of `point` around `center` (0° = pointing right, clockwise positive). */
export function angleAt(center: Point, point: Point): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

/** Normalize to (-180, 180]. */
export function normalizeAngle(degrees: number): number {
  let value = ((degrees % 360) + 360) % 360;
  if (value > 180) value -= 360;
  return Math.round(value * 100) / 100;
}

/**
 * Resize a rotated box (unrotated x/y/w/h in parent space, rotated about its
 * center) by a world-space pointer delta, keeping the opposite handle pinned.
 */
export function resizeRotated(start: Rect, rotation: number, handle: Handle, dx: number, dy: number, keepRatio = false): Rect {
  const local = rotatePoint({ x: dx, y: dy }, -rotation);
  const size = resizeBounds(handle, { x: 0, y: 0, w: start.w, h: start.h }, local.x, local.y, keepRatio);
  const { w, h } = size;
  const fx = handle.includes('e') ? 0 : handle.includes('w') ? 1 : 0.5;
  const fy = handle.includes('s') ? 0 : handle.includes('n') ? 1 : 0.5;
  const center = { x: start.x + start.w / 2, y: start.y + start.h / 2 };
  const offset = rotatePoint({ x: fx * start.w - start.w / 2, y: fy * start.h - start.h / 2 }, rotation);
  const anchor = { x: center.x + offset.x, y: center.y + offset.y };
  const back = rotatePoint({ x: fx * w - w / 2, y: fy * h - h / 2 }, rotation);
  return { x: anchor.x - back.x - w / 2, y: anchor.y - back.y - h / 2, w, h };
}
