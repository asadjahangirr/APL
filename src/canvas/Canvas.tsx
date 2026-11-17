import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BREAKPOINT_WIDTH } from '../doc/breakpoints';
import { applyConstraints, createNode, getNode, insertNode, moveNode, nextName, removeNodes, resizeNode, updateNode } from '../doc/ops';
import type { NodeType, SiteDoc, SiteNode } from '../doc/schema';
import { SitePage } from '../render/SitePage';
import { angleAt, chainOf, dropIndex, enterChild, fitRect, HANDLES, normalizeAngle, pickSelectable, rectFromPoints, resizeBounds, resizeRotated, rotatePoint, zoomAt, type Handle, type Point, type Rect } from './geometry';
import { guidesFor, measureBetween, measureGaps, rectsIntersect, snapMove, snapPoint, unionRect, type Guide, type Measure } from './snap';
import { adjustSpacing, dropContainer, preferReorder, sizingForParent, spacingRegions, type SpacingRegion, type SpacingTarget } from './autolayout';
import { useEditor, type EditorStore, type Tool } from './store';
import { freehandD, penD, penNode, pencilNode, shapeNode, type PenPoint, type ShapeTool } from './vector';

const PAGE_SCOPE = 'ed-site';
const DRAG_THRESHOLD = 3;
const SNAP_PX = 6;
const DRAW_TOOLS: Partial<Record<Tool, NodeType>> = { frame: 'frame', rect: 'rect', ellipse: 'ellipse', text: 'text', line: 'vector', arrow: 'vector', polygon: 'vector', star: 'vector' };
const isLineTool = (tool: Tool) => tool === 'line' || tool === 'arrow';
const CORNERS = ['nw', 'ne', 'se', 'sw'] as const;
const round = (value: number) => Math.round(value);

export interface CanvasApi {
  /** World-space rect of a rendered layer, or null if it is not visible. */
  measureWorld(id: string): Rect | null;
  /** World point at the center of the visible canvas. */
  centerWorld(): Point;
  clientToWorld(clientX: number, clientY: number): Point;
  fitPage(): void;
  zoomToSelection(): void;
  zoomBy(factor: number): void;
  setZoom(zoom: number): void;
  startTextEditing(id: string, isNew?: boolean): void;
}

/** Snapping context captured when a gesture starts (world space). */
interface SnapContext { targets: Rect[]; siblings: Rect[]; parent: Rect | null }

type Gesture =
  | { kind: 'pan'; start: Point; viewport: { x: number; y: number } }
  | { kind: 'pen' }
  | { kind: 'pencil'; containerId: string; container: Rect; points: Point[] }
  | { kind: 'draw'; tool: Tool; type: NodeType; containerId: string; container: Rect; start: Point; current: Point; snap: SnapContext }
  | { kind: 'press'; id: string; start: Point; startWorld: Point }
  | { kind: 'marquee'; start: Point; additive: boolean; base: string[]; candidates: { id: string; rect: Rect }[]; moved: boolean }
  | { kind: 'move'; ids: string[]; parentId: string; starts: Map<string, Point>; startWorld: Point; box: Rect | null; snap: SnapContext; target: string | null; index?: number }
  | { kind: 'flow'; id: string; parentId: string; rect: Rect; grab: Point; target: string; index?: number }
  | { kind: 'spacing'; id: string; target: SpacingTarget; axis: 'x' | 'y'; start: number; startWorld: Point; region: number }
  | { kind: 'resize'; id: string; handle: Handle; start: Rect; startWorld: Point; free: boolean; root: boolean; rotation: number; origin: Point; snap: SnapContext }
  | { kind: 'rotate'; id: string; center: Point; startAngle: number; rotation: number };

interface SelectionBox { id: string; rect: Rect; rotation: number; w: number; h: number }
interface Overlay { hover: Rect | null; selection: SelectionBox[]; root: Rect | null; spacing: SpacingRegion[] }

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
function isFree(doc: SiteDoc, node: SiteNode): boolean {
  const parent = node.parentId ? doc.nodes[node.parentId] : null;
  return !parent || parent.type !== 'frame' || parent.layout.mode === 'none' || node.absolute;
}

/** Screen-space corner/edge point of a (possibly rotated) selection box. */
function boxPoint(box: SelectionBox, fx: number, fy: number): Point {
  const cx = box.rect.x + box.rect.w / 2, cy = box.rect.y + box.rect.h / 2;
  const p = rotatePoint({ x: (fx - 0.5) * box.w, y: (fy - 0.5) * box.h }, box.rotation);
  return { x: cx + p.x, y: cy + p.y };
}
const handleFactors = (handle: string) => ({ fx: handle.includes('w') ? 0 : handle.includes('e') ? 1 : 0.5, fy: handle.includes('n') ? 0 : handle.includes('s') ? 1 : 0.5 });

export const Canvas = forwardRef<CanvasApi, { store: EditorStore }>(function Canvas({ store }, ref) {
  const doc = useEditor(store, state => state.doc);
  const pageId = useEditor(store, state => state.pageId);
  const selection = useEditor(store, state => state.selection);
  const hover = useEditor(store, state => state.hover);
  const tool = useEditor(store, state => state.tool);
  const viewport = useEditor(store, state => state.viewport);
  const editingTextId = useEditor(store, state => state.editingTextId);
  const breakpoint = useEditor(store, state => state.breakpoint);
  const page = doc.pages.find(value => value.id === pageId) ?? doc.pages[0];

  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const newText = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [indicator, setIndicator] = useState<Rect | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [overlay, setOverlay] = useState<Overlay>({ hover: null, selection: [], root: null, spacing: [] });
  const [dropTarget, setDropTarget] = useState<Rect | null>(null);
  const [ghost, setGhost] = useState<Rect | null>(null);
  const [activeSpacing, setActiveSpacing] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  // Pen: anchors placed so far (world space). Pencil reuses the same preview.
  const pen = useRef<{ containerId: string; container: Rect; points: PenPoint[] } | null>(null);
  const [penView, setPenView] = useState<{ points: PenPoint[]; cursor: Point | null; free: Point[] | null } | null>(null);
  const [line, setLine] = useState<[Point, Point] | null>(null);

  // ── Coordinates ────────────────────────────────────────────────────────────
  const toScreen = useCallback((clientX: number, clientY: number): Point => {
    const box = viewportRef.current!.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  }, []);
  const toWorld = useCallback((screen: Point): Point => {
    const v = store.getState().viewport;
    return { x: (screen.x - v.x) / v.zoom, y: (screen.y - v.y) / v.zoom };
  }, [store]);
  const element = useCallback((id: string) => pageRef.current?.querySelector<HTMLElement>(`[data-node-id="${id}"]`) ?? null, []);
  const measureScreen = useCallback((id: string): Rect | null => {
    const el = element(id), box = viewportRef.current?.getBoundingClientRect();
    if (!el || !box) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height && getComputedStyle(el).display === 'none') return null;
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
  }, [element]);
  const measureWorld = useCallback((id: string): Rect | null => {
    const s = measureScreen(id);
    if (!s) return null;
    const v = store.getState().viewport;
    return { x: (s.x - v.x) / v.zoom, y: (s.y - v.y) / v.zoom, w: s.w / v.zoom, h: s.h / v.zoom };
  }, [measureScreen, store]);
  /** Siblings + parent rects used for snapping and spacing around `ids`. */
  const snapContext = useCallback((parentId: string | null, exclude: string[]): SnapContext => {
    const current = store.getState().doc;
    const parentRect = parentId ? measureWorld(parentId) : null;
    const siblings = parentId ? current.nodes[parentId].children.filter(id => !exclude.includes(id) && current.nodes[id]?.visible).map(measureWorld).filter((r): r is Rect => r !== null) : [];
    return { targets: parentRect ? [...siblings, parentRect] : siblings, siblings, parent: parentRect };
  }, [measureWorld, store]);
  const toScreenRect = (r: Rect, v = store.getState().viewport): Rect => ({ x: r.x * v.zoom + v.x, y: r.y * v.zoom + v.y, w: r.w * v.zoom, h: r.h * v.zoom });

  // ── Viewport helpers ───────────────────────────────────────────────────────
  const size = () => ({ w: viewportRef.current?.clientWidth ?? 1200, h: viewportRef.current?.clientHeight ?? 800 });
  const fitPage = useCallback(() => {
    const { w, h } = size();
    const height = measureWorld(page.rootId)?.h ?? 900;
    const width = BREAKPOINT_WIDTH[store.getState().breakpoint];
    const fitted = fitRect(w, h, { x: 0, y: 0, w: width, h: Math.min(height, (h - 96) / Math.min(1, (w - 96) / width)) }, 48);
    store.set({ viewport: fitted });
  }, [measureWorld, page.rootId, store]);
  const zoomBy = useCallback((factor: number) => {
    const { w, h } = size();
    store.set({ viewport: zoomAt(store.getState().viewport, factor, { x: w / 2, y: h / 2 }) });
  }, [store]);

  useImperativeHandle(ref, () => ({
    measureWorld,
    centerWorld: () => { const { w, h } = size(); return toWorld({ x: w / 2, y: h / 2 }); },
    clientToWorld: (clientX: number, clientY: number) => toWorld(toScreen(clientX, clientY)),
    fitPage,
    zoomToSelection: () => {
      const rects = store.getState().selection.map(measureWorld).filter((r): r is Rect => r !== null);
      if (!rects.length) return fitPage();
      const u = unionRect(rects), s = size();
      const zoom = Math.min(4, (s.w - 160) / Math.max(1, u.w), (s.h - 160) / Math.max(1, u.h));
      store.set({ viewport: { zoom, x: s.w / 2 - (u.x + u.w / 2) * zoom, y: s.h / 2 - (u.y + u.h / 2) * zoom } });
    },
    zoomBy,
    setZoom: (zoom: number) => zoomBy(zoom / store.getState().viewport.zoom),
    startTextEditing: (id: string, isNew = false) => {
      newText.current = isNew;
      if (!isNew) store.beginGesture();
      store.set({ editingTextId: id, selection: [id] });
    },
  }), [fitPage, measureWorld, store, toScreen, toWorld, zoomBy]);

  // Fit the page when a site/page opens.
  useLayoutEffect(() => { fitPage(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doc.id, pageId, breakpoint]);

  // ── Measurement: overlay rects + design-time size sync ─────────────────────
  useLayoutEffect(() => {
    const zoom = viewport.zoom;
    setOverlay({
      hover: hover && !selection.includes(hover) ? measureScreen(hover) : null,
      selection: selection.flatMap(id => {
        const rect = measureScreen(id), node = doc.nodes[id];
        if (!rect || !node) return [];
        // Rotated layers: outline the unrotated box, rotated about the measured center.
        return node.rotation ? [{ id, rect, rotation: node.rotation, w: node.width * zoom, h: node.height * zoom }] : [{ id, rect, rotation: 0, w: rect.w, h: rect.h }];
      }),
      root: measureScreen(page.rootId),
      spacing: (() => {
        const frame = selection.length === 1 ? doc.nodes[selection[0]] : undefined;
        if (!frame || frame.type !== 'frame' || frame.layout.mode === 'none' || frame.rotation || editingTextId || tool !== 'move') return [];
        const rect = measureScreen(frame.id);
        if (!rect) return [];
        const children = frame.children.filter(id => doc.nodes[id]?.visible && !doc.nodes[id].absolute).map(measureScreen).filter((r): r is Rect => r !== null);
        return spacingRegions(frame.layout, rect, children, zoom);
      })(),
    });
  }, [doc, selection, hover, viewport, page.rootId, measureScreen, tick, editingTextId, tool]);

  useLayoutEffect(() => {
    // Hug/fill layers have no authored size; record their rendered size so
    // constraints and the Design panel use real dimensions.
    const root = pageRef.current;
    if (!root) return;
    const zoom = store.getState().viewport.zoom;
    const updates: { id: string; width: number; height: number }[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('[data-node-id]')) {
      const id = el.dataset.nodeId!, node = doc.nodes[id];
      if (!node || (node.sizing.h === 'fixed' && node.sizing.v === 'fixed') || id === page.rootId) continue;
      let w: number, h: number;
      if (node.rotation) { w = el.offsetWidth; h = el.offsetHeight; } // layout size ignores the rotation transform
      else { const r = el.getBoundingClientRect(); w = r.width / zoom; h = r.height / zoom; }
      if (!w && !h) continue;
      const width = node.sizing.h === 'fixed' ? node.width : Math.round(w * 100) / 100;
      const height = node.sizing.v === 'fixed' ? node.height : Math.round(h * 100) / 100;
      if (Math.abs(width - node.width) > 0.5 || Math.abs(height - node.height) > 0.5) updates.push({ id, width, height });
    }
    if (updates.length) store.commit(current => updates.reduce((next, u) => {
      const node = next.nodes[u.id];
      if (!node) return next;
      const moved = updateNode(next, u.id, { width: u.width, height: u.height });
      return node.type === 'frame' ? applyConstraints(moved, u.id, node.width, node.height, u.width, u.height) : moved;
    }, current), { silent: true });
  }, [doc, page.rootId, store, tick]);

  // Re-measure when fonts/images load or the page reflows.
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setTick(t => t + 1));
    observer.observe(el);
    const onLoad = () => setTick(t => t + 1);
    el.addEventListener('load', onLoad, true);
    document.fonts?.addEventListener?.('loadingdone', onLoad);
    return () => { observer.disconnect(); el.removeEventListener('load', onLoad, true); document.fonts?.removeEventListener?.('loadingdone', onLoad); };
  }, [pageId]);

  // ── Wheel: pan, Ctrl/⌘ or pinch to zoom ────────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current!;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const v = store.getState().viewport;
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025));
        store.set({ viewport: zoomAt(v, factor, toScreen(event.clientX, event.clientY)) });
      } else {
        const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
        const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
        store.set({ viewport: { ...v, x: v.x - dx, y: v.y - dy } });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [store, toScreen]);

  // Space-to-pan; releasing Alt clears measurements.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTyping(event.target) && !store.getState().editingTextId) { event.preventDefault(); setSpaceDown(true); }
      if (event.key === 'Enter' && pen.current && !isTyping(event.target)) { event.stopImmediatePropagation(); finishPenRef.current(false); }
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceDown(false); if (event.key === 'Alt' && !gesture.current) setMeasures([]); };
    const blur = () => { setSpaceDown(false); setMeasures([]); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [store]);

  // ── Hit testing ────────────────────────────────────────────────────────────
  const hitChain = useCallback((clientX: number, clientY: number): string[] | null => {
    const current = store.getState().doc;
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      if (!pageRef.current?.contains(el)) continue;
      const id = (el.closest('[data-node-id]') as HTMLElement | null)?.dataset.nodeId;
      if (!id || !current.nodes[id]) continue;
      const chain = chainOf(current, id);
      if (chain.some(value => current.nodes[value].locked)) continue;
      return chain;
    }
    return null;
  }, [store]);

  /** Hit chain under the pointer, looking through the layers being dragged. */
  const chainBeneath = useCallback((clientX: number, clientY: number, moving: string[]): string[] | null => {
    const current = store.getState().doc;
    const dragged = moving.map(element).filter((el): el is HTMLElement => el !== null);
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      if (!pageRef.current?.contains(el) || dragged.some(d => d.contains(el))) continue;
      const id = (el.closest('[data-node-id]') as HTMLElement | null)?.dataset.nodeId;
      if (id && current.nodes[id]) return chainOf(current, id);
    }
    return null;
  }, [element, store]);
  /** Insertion index + indicator for dropping into an auto-layout frame. */
  const flowDrop = useCallback((targetId: string, screen: Point, exclude: string[]): number => {
    const current = store.getState().doc;
    const target = current.nodes[targetId];
    if (!target || target.type !== 'frame' || target.layout.mode === 'none') { setIndicator(null); return 0; }
    const ids = target.children.filter(id => !exclude.includes(id) && !current.nodes[id].absolute && current.nodes[id].visible);
    const siblings = ids.map(measureScreen).filter((r): r is Rect => r !== null);
    const index = dropIndex(siblings, target.layout.mode, screen);
    const parent = measureScreen(targetId);
    if (parent) {
      const before = siblings[index], after = siblings[index - 1];
      if (target.layout.mode === 'vertical') {
        const y = before ? before.y - 2 : after ? after.y + after.h + 2 : parent.y + target.layout.padding[0] * store.getState().viewport.zoom;
        setIndicator({ x: parent.x + 4, y: y - 1, w: Math.max(4, parent.w - 8), h: 2 });
      } else {
        const anchor = before ?? after;
        const x = before ? before.x - 2 : after ? after.x + after.w + 2 : parent.x + target.layout.padding[3] * store.getState().viewport.zoom;
        setIndicator({ x: x - 1, y: anchor ? anchor.y : parent.y + 4, w: 2, h: anchor ? anchor.h : Math.max(4, parent.h - 8) });
      }
    }
    // Translate the index among visible flow siblings to an index in the full child list.
    const all = target.children.filter(id => !exclude.includes(id));
    return index < ids.length ? all.indexOf(ids[index]) : all.length;
  }, [measureScreen, store]);

  // ── Pointer interaction ────────────────────────────────────────────────────
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (store.getState().editingTextId) return; // the text editor handles its own events
    if (event.button === 2) return;
    const screen = toScreen(event.clientX, event.clientY), world = toWorld(screen);
    const state = store.getState();
    viewportRef.current!.setPointerCapture(event.pointerId);
    setMeasures([]);

    if (event.button === 1 || state.tool === 'hand' || spaceDown) {
      event.preventDefault();
      gesture.current = { kind: 'pan', start: screen, viewport: { x: state.viewport.x, y: state.viewport.y } };
      setPanning(true);
      return;
    }
    if (state.tool === 'pen' || state.tool === 'pencil') {
      const chain = hitChain(event.clientX, event.clientY) ?? [page.rootId];
      const containerId = pen.current?.containerId ?? [...chain].reverse().find(id => state.doc.nodes[id].type === 'frame') ?? page.rootId;
      const container = pen.current?.container ?? measureWorld(containerId) ?? { x: 0, y: 0, w: BREAKPOINT_WIDTH[state.breakpoint], h: 900 };
      if (state.tool === 'pencil') {
        gesture.current = { kind: 'pencil', containerId, container, points: [world] };
        setPenView({ points: [], cursor: null, free: [world] });
        return;
      }
      const current = pen.current ?? { containerId, container, points: [] };
      const first = current.points[0], last = current.points[current.points.length - 1];
      // Clicking the first anchor closes the shape.
      if (first && current.points.length > 1 && Math.hypot(first.x - world.x, first.y - world.y) * state.viewport.zoom < 9) { finishPen(true); return; }
      if (!last || Math.hypot(last.x - world.x, last.y - world.y) * state.viewport.zoom > 1) current.points = [...current.points, { x: round(world.x * 100) / 100, y: round(world.y * 100) / 100 }];
      pen.current = current;
      setPenView({ points: current.points, cursor: null, free: null });
      gesture.current = { kind: 'pen' };
      return;
    }
    const target = event.target as HTMLElement;
    const spacingEl = target.closest<HTMLElement>('[data-spacing]');
    if (spacingEl && state.selection.length === 1) {
      const region = overlay.spacing[Number(spacingEl.dataset.spacing)];
      const frame = state.doc.nodes[state.selection[0]];
      if (region && frame?.type === 'frame') {
        store.beginGesture();
        const start = region.target.kind === 'gap' ? frame.layout.gap : frame.layout.padding[region.target.side];
        gesture.current = { kind: 'spacing', id: frame.id, target: region.target, axis: region.axis, start, startWorld: world, region: Number(spacingEl.dataset.spacing) };
        setActiveSpacing(Number(spacingEl.dataset.spacing));
        return;
      }
    }
    const handle = target.dataset.handle as Handle | undefined;
    if (handle && state.selection.length === 1) {
      const id = state.selection[0], node = getNode(state.doc, id), measured = measureWorld(id);
      if (!measured) return;
      const root = id === page.rootId;
      const free = !root && isFree(state.doc, node);
      store.beginGesture();
      const start = { x: node.x, y: node.y, w: node.sizing.h === 'fixed' || node.rotation ? node.width : measured.w, h: node.sizing.v === 'fixed' || node.rotation ? node.height : measured.h };
      gesture.current = {
        kind: 'resize', id, handle, startWorld: world, free, root, rotation: node.rotation, start,
        origin: { x: measured.x - node.x, y: measured.y - node.y }, snap: snapContext(node.parentId, [id]),
      };
      return;
    }
    if (target.dataset.rotate && state.selection.length === 1) {
      const id = state.selection[0], node = state.doc.nodes[id], measured = measureWorld(id);
      if (!node || !measured) return;
      const center = { x: measured.x + measured.w / 2, y: measured.y + measured.h / 2 };
      store.beginGesture();
      gesture.current = { kind: 'rotate', id, center, startAngle: angleAt(center, world), rotation: node.rotation };
      return;
    }
    if (target.dataset.pageLabel) { store.select([page.rootId]); return; }

    const drawType = DRAW_TOOLS[state.tool];
    if (drawType) {
      const chain = hitChain(event.clientX, event.clientY) ?? [page.rootId];
      const containerId = [...chain].reverse().find(id => state.doc.nodes[id].type === 'frame') ?? page.rootId;
      const container = measureWorld(containerId) ?? { x: 0, y: 0, w: BREAKPOINT_WIDTH[state.breakpoint], h: 900 };
      const snap = snapContext(containerId, []);
      const ctx = { ...snap, targets: [...snap.siblings, container] };
      const start = event.ctrlKey || event.metaKey ? world : snapPoint(world, ctx.targets, SNAP_PX / state.viewport.zoom).point;
      gesture.current = { kind: 'draw', tool: state.tool, type: drawType, containerId, container, start, current: start, snap: ctx };
      return;
    }

    const chain = hitChain(event.clientX, event.clientY);
    const picked = chain ? pickSelectable(state.doc, chain, state.selection, event.ctrlKey || event.metaKey) : null;
    if (!picked) {
      // Empty canvas or page background: marquee selection.
      const root = state.doc.nodes[page.rootId];
      const candidates = root.children.map(id => ({ id, rect: measureWorld(id) })).filter((c): c is { id: string; rect: Rect } => c.rect !== null && !state.doc.nodes[c.id].locked);
      gesture.current = { kind: 'marquee', start: world, additive: event.shiftKey, base: event.shiftKey ? state.selection : [], candidates, moved: false };
      return;
    }
    if (event.shiftKey) {
      store.select(state.selection.includes(picked) ? state.selection.filter(id => id !== picked) : [...state.selection, picked]);
      return;
    }
    if (!state.selection.includes(picked)) store.select([picked]);
    gesture.current = { kind: 'press', id: picked, start: screen, startWorld: world };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const screen = toScreen(event.clientX, event.clientY), world = toWorld(screen);
    const state = store.getState();
    const threshold = SNAP_PX / state.viewport.zoom;
    const snapping = !(event.ctrlKey || event.metaKey);
    if (!g) {
      if (pen.current) setPenView({ points: pen.current.points, cursor: world, free: null });
      if (state.tool !== 'move' || spaceDown || state.editingTextId) { if (state.hover) store.set({ hover: null }); return; }
      const chain = hitChain(event.clientX, event.clientY);
      const candidate = chain ? pickSelectable(state.doc, chain, state.selection, event.ctrlKey || event.metaKey) : null;
      if (candidate !== state.hover) store.set({ hover: candidate });
      // Alt: measure from the selection to the layer under the pointer.
      if (event.altKey && state.selection.length) {
        const target = chain ? [...chain].reverse().find(id => !state.selection.includes(id)) : undefined;
        const from = state.selection.map(measureWorld).filter((r): r is Rect => r !== null);
        const to = target ? measureWorld(target) : null;
        setMeasures(from.length && to ? measureBetween(unionRect(from), to) : []);
      } else if (measures.length) setMeasures([]);
      return;
    }
    switch (g.kind) {
      case 'pen': {
        // Dragging after placing an anchor pulls out a curve handle.
        const current = pen.current;
        if (!current?.points.length) return;
        const anchor = current.points[current.points.length - 1];
        if (Math.hypot(world.x - anchor.x, world.y - anchor.y) * state.viewport.zoom < DRAG_THRESHOLD) return;
        current.points = [...current.points.slice(0, -1), { ...anchor, hx: round((world.x - anchor.x) * 100) / 100, hy: round((world.y - anchor.y) * 100) / 100 }];
        setPenView({ points: current.points, cursor: null, free: null });
        return;
      }
      case 'pencil': {
        const last = g.points[g.points.length - 1];
        if (Math.hypot(world.x - last.x, world.y - last.y) * state.viewport.zoom < 2) return;
        g.points.push(world);
        setPenView({ points: [], cursor: null, free: [...g.points] });
        return;
      }
      case 'pan':
        store.set({ viewport: { ...state.viewport, x: g.viewport.x + screen.x - g.start.x, y: g.viewport.y + screen.y - g.start.y } });
        return;
      case 'draw': {
        let current = snapping ? snapPoint(world, g.snap.targets, threshold).point : world;
        if (event.shiftKey && isLineTool(g.tool)) {
          // Shift keeps lines at 45° steps.
          const dx = current.x - g.start.x, dy = current.y - g.start.y, step = Math.PI / 4;
          const angle = Math.round(Math.atan2(dy, dx) / step) * step, length = Math.hypot(dx, dy);
          current = { x: g.start.x + Math.cos(angle) * length, y: g.start.y + Math.sin(angle) * length };
        } else if (event.shiftKey) { const side = Math.max(Math.abs(current.x - g.start.x), Math.abs(current.y - g.start.y)); current = { x: g.start.x + Math.sign(current.x - g.start.x || 1) * side, y: g.start.y + Math.sign(current.y - g.start.y || 1) * side }; }
        gesture.current = { ...g, current };
        const r = rectFromPoints(g.start, current);
        if (isLineTool(g.tool)) { const s = (p: Point) => ({ x: p.x * state.viewport.zoom + state.viewport.x, y: p.y * state.viewport.zoom + state.viewport.y }); setLine([s(g.start), s(current)]); }
        else setPreview(toScreenRect(r));
        setGuides(snapping ? guidesFor(r, g.snap.targets) : []);
        return;
      }
      case 'marquee': {
        const r = rectFromPoints(g.start, world);
        if (!g.moved && r.w * state.viewport.zoom < DRAG_THRESHOLD && r.h * state.viewport.zoom < DRAG_THRESHOLD) return;
        gesture.current = { ...g, moved: true };
        setMarquee(toScreenRect(r));
        const hits = g.candidates.filter(c => rectsIntersect(c.rect, r)).map(c => c.id);
        const next = [...g.base, ...hits.filter(id => !g.base.includes(id))];
        if (next.join() !== state.selection.join()) store.select(next);
        return;
      }
      case 'press': {
        if (Math.hypot(screen.x - g.start.x, screen.y - g.start.y) < DRAG_THRESHOLD) return;
        const ids = state.selection.filter(id => id !== page.rootId && !state.doc.nodes[id]?.locked);
        if (!ids.length) { gesture.current = null; return; }
        const node = state.doc.nodes[g.id];
        if (ids.length === 1 && node && !isFree(state.doc, node)) {
          const rect = measureWorld(g.id);
          if (!rect) return;
          gesture.current = { kind: 'flow', id: g.id, parentId: node.parentId!, rect, grab: { x: g.startWorld.x - rect.x, y: g.startWorld.y - rect.y }, target: node.parentId! };
        } else {
          const movable = ids.filter(id => isFree(state.doc, state.doc.nodes[id]));
          const rects = movable.map(measureWorld).filter((r): r is Rect => r !== null);
          const parentId = state.doc.nodes[movable[0] ?? g.id]?.parentId ?? page.rootId;
          store.beginGesture();
          gesture.current = {
            kind: 'move', ids: movable, parentId, startWorld: g.startWorld, box: rects.length ? unionRect(rects) : null,
            starts: new Map(movable.map(id => [id, { x: state.doc.nodes[id].x, y: state.doc.nodes[id].y }])),
            snap: snapContext(parentId, movable), target: null,
          };
        }
        onPointerMove(event);
        return;
      }
      case 'move': {
        let dx = world.x - g.startWorld.x, dy = world.y - g.startWorld.y;
        if (event.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        dx = round(dx); dy = round(dy);
        if (g.box) {
          const moved = { ...g.box, x: g.box.x + dx, y: g.box.y + dy };
          if (snapping) {
            const snap = snapMove(moved, g.snap.targets, threshold);
            if (!(event.shiftKey && dx === 0)) dx += snap.dx;
            if (!(event.shiftKey && dy === 0)) dy += snap.dy;
          }
          const final = { ...g.box, x: g.box.x + dx, y: g.box.y + dy };
          setGuides(snapping ? guidesFor(final, g.snap.targets) : []);
          setMeasures(measureGaps(final, g.snap.siblings, g.snap.parent));
        }
        store.commit(current => g.ids.reduce((next, id) => {
          const start = g.starts.get(id)!;
          return updateNode(next, id, { x: Math.round(start.x + dx), y: Math.round(start.y + dy) });
        }, current));
        // Dropping onto another frame moves the layers into it (hold Ctrl/⌘ to keep them where they are).
        const chain = snapping ? chainBeneath(event.clientX, event.clientY, g.ids) : null;
        const target = chain ? dropContainer(state.doc, chain, g.ids) : null;
        if (target && target !== g.parentId) {
          const t = state.doc.nodes[target];
          setDropTarget(measureScreen(target));
          const index = t.type === 'frame' && t.layout.mode !== 'none' ? flowDrop(target, screen, g.ids) : undefined;
          if (index === undefined) setIndicator(null);
          gesture.current = { ...g, target, index };
        } else if (g.target) { setDropTarget(null); setIndicator(null); gesture.current = { ...g, target: null, index: undefined }; }
        return;
      }
      case 'flow': {
        const chain = chainBeneath(event.clientX, event.clientY, [g.id]);
        setGhost(toScreenRect({ ...g.rect, x: world.x - g.grab.x, y: world.y - g.grab.y }));
        if (!chain) {
          // Over empty canvas: dropping here cancels the move.
          setIndicator(null); setDropTarget(null);
          gesture.current = { ...g, target: g.parentId, index: undefined };
          return;
        }
        const candidate = (snapping && dropContainer(state.doc, chain, [g.id])) || g.parentId;
        const target = preferReorder(state.doc, candidate, g.parentId, measureScreen(candidate), screen);
        const t = state.doc.nodes[target];
        const flow = t?.type === 'frame' && t.layout.mode !== 'none';
        const index = flow ? flowDrop(target, screen, [g.id]) : undefined;
        if (!flow) setIndicator(null);
        setDropTarget(target !== g.parentId ? measureScreen(target) : null);
        setGhost(toScreenRect({ ...g.rect, x: world.x - g.grab.x, y: world.y - g.grab.y }));
        gesture.current = { ...g, target, index };
        return;
      }
      case 'spacing': {
        const frame = state.doc.nodes[g.id];
        if (!frame || frame.type !== 'frame') return;
        const delta = g.axis === 'x' ? world.x - g.startWorld.x : world.y - g.startWorld.y;
        const layout = adjustSpacing(frame.layout, g.target, g.start, delta, { mirror: event.altKey, all: event.shiftKey });
        store.commit(current => updateNode(current, g.id, { layout }));
        return;
      }
      case 'resize': {
        let dx = world.x - g.startWorld.x, dy = world.y - g.startWorld.y;
        const handle: Handle = g.root ? 's' : g.handle;
        const node = state.doc.nodes[g.id];
        if (!node) return;
        const horizontal = handle.includes('e') || handle.includes('w'), vertical = handle.includes('n') || handle.includes('s');
        // Snap the dragged edges (unrotated, freely positioned layers).
        if (snapping && !g.rotation && g.free && !event.shiftKey) {
          const edge = { x: g.origin.x + g.start.x + (handle.includes('e') ? g.start.w : 0) + dx, y: g.origin.y + g.start.y + (handle.includes('s') ? g.start.h : 0) + dy };
          const snapped = snapPoint(edge, g.snap.targets, threshold, [...(horizontal ? ['x' as const] : []), ...(vertical ? ['y' as const] : [])]);
          dx += snapped.point.x - edge.x; dy += snapped.point.y - edge.y;
        }
        const next = g.rotation && g.free ? resizeRotated(g.start, g.rotation, handle, dx, dy, event.shiftKey) : resizeBounds(handle, g.start, dx, dy, event.shiftKey);
        if (!g.rotation && g.free) setGuides(snapping ? guidesFor({ x: g.origin.x + next.x, y: g.origin.y + next.y, w: next.w, h: next.h }, g.snap.targets, [...(horizontal ? ['x' as const] : []), ...(vertical ? ['y' as const] : [])]) : []);
        store.commit(current => {
          const sizing = { h: horizontal || event.shiftKey ? 'fixed' as const : node.sizing.h, v: vertical || event.shiftKey ? 'fixed' as const : node.sizing.v };
          const updated = updateNode(current, g.id, { sizing });
          return resizeNode(updated, g.id, g.free
            ? { x: round(next.x), y: round(next.y), width: round(next.w), height: round(next.h) }
            : { width: horizontal || event.shiftKey ? round(next.w) : undefined, height: vertical || event.shiftKey ? round(next.h) : undefined });
        });
        return;
      }
      case 'rotate': {
        let rotation = g.rotation + angleAt(g.center, world) - g.startAngle;
        if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
        store.commit(current => updateNode(current, g.id, { rotation: normalizeAngle(Math.round(rotation * 10) / 10) }));
        return;
      }
    }
  };

  const finishDraw = (g: Extract<Gesture, { kind: 'draw' }>) => {
    const state = store.getState();
    const r = rectFromPoints(g.start, g.current);
    const clicked = r.w < 2 && r.h < 2;
    const container = state.doc.nodes[g.containerId];
    if (!container || container.type !== 'frame') return;
    const defaults: Record<NodeType, { w: number; h: number }> = { frame: { w: 100, h: 100 }, rect: { w: 100, h: 100 }, ellipse: { w: 100, h: 100 }, text: { w: 40, h: 22 }, image: { w: 200, h: 150 }, vector: { w: 100, h: 100 }, embed: { w: 560, h: 315 } };
    const width = clicked ? defaults[g.type].w : Math.max(1, round(r.w)), height = clicked ? defaults[g.type].h : Math.max(1, round(r.h));
    const name = nextName(state.doc, g.type === 'vector' ? { line: 'Line', arrow: 'Arrow', polygon: 'Polygon', star: 'Star' }[g.tool as ShapeTool] : { frame: 'Frame', rect: 'Rectangle', ellipse: 'Ellipse', text: 'Text', image: 'Image', vector: 'Vector', embed: 'Embed' }[g.type]);
    const patch = { name, x: round(r.x - g.container.x), y: round(r.y - g.container.y), width, height };
    const node = g.type === 'text'
      ? createNode('text', { ...patch, text: '', sizing: clicked ? { h: 'hug', v: 'hug' } : { h: 'fixed', v: 'hug' } })
      : g.type === 'vector' ? shapeNode(g.tool as ShapeTool, g.start, g.current, clicked, patch)
      : createNode(g.type as Exclude<NodeType, 'text' | 'image' | 'vector'>, patch);
    let index: number | undefined;
    if (container.layout.mode !== 'none') {
      const siblings = container.children.map(measureScreen).filter((rect): rect is Rect => rect !== null);
      const v = state.viewport;
      index = dropIndex(siblings, container.layout.mode, { x: g.start.x * v.zoom + v.x, y: g.start.y * v.zoom + v.y });
    }
    if (g.type === 'text') store.beginGesture();
    const ok = store.commit(current => insertNode(current, node, container.id, index), { selection: [node.id] });
    store.set({ tool: 'move' });
    if (ok && g.type === 'text') { newText.current = true; store.set({ editingTextId: node.id }); }
    else if (!ok) store.cancelGesture();
  };

  /** Move free layers into another frame, keeping their on-screen position (or flowing them in at `index`). */
  const reparent = (ids: string[], targetId: string, index?: number) => {
    const state = store.getState();
    const target = state.doc.nodes[targetId], targetRect = measureWorld(targetId);
    if (!target || target.type !== 'frame' || !targetRect) return;
    const rects = new Map(ids.map(id => [id, measureWorld(id)]));
    store.commit(current => ids.reduce((next, id, i) => {
      const node = next.nodes[id], rect = rects.get(id);
      if (!node || !rect || ids.some(other => other !== id && chainOf(next, id).includes(other))) return next;
      let moved = moveNode(next, id, targetId, index === undefined ? undefined : index + i);
      const sizing = sizingForParent(node, target);
      moved = updateNode(moved, id, {
        x: Math.round(rect.x - targetRect.x), y: Math.round(rect.y - targetRect.y), sizing,
        absolute: false, ...(node.sizing.h === 'fill' && sizing.h === 'fixed' ? { width: Math.round(rect.w) } : {}), ...(node.sizing.v === 'fill' && sizing.v === 'fixed' ? { height: Math.round(rect.h) } : {}),
      });
      return moved;
    }, current), { selection: ids });
  };
  const finishFlowDrag = (g: Extract<Gesture, { kind: 'flow' }>, world: Point) => {
    const state = store.getState();
    const node = state.doc.nodes[g.id], target = state.doc.nodes[g.target];
    if (!node || !target || target.type !== 'frame') return;
    if (g.target === g.parentId) {
      if (g.index !== undefined && state.doc.nodes[g.parentId].children.indexOf(g.id) !== g.index) store.commit(doc => moveNode(doc, g.id, g.parentId, g.index));
      return;
    }
    const targetRect = measureWorld(g.target);
    if (!targetRect) return;
    const sizing = sizingForParent(node, target);
    store.commit(current => {
      const moved = moveNode(current, g.id, g.target, g.index);
      return updateNode(moved, g.id, {
        x: Math.round(world.x - g.grab.x - targetRect.x), y: Math.round(world.y - g.grab.y - targetRect.y), sizing, absolute: false,
        ...(sizing.h === 'fixed' && node.sizing.h !== 'fixed' ? { width: Math.round(g.rect.w) } : {}),
        ...(sizing.v === 'fixed' && node.sizing.v !== 'fixed' ? { height: Math.round(g.rect.h) } : {}),
      });
    }, { selection: [g.id] });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) viewportRef.current.releasePointerCapture(event.pointerId);
    setPreview(null); setLine(null); setIndicator(null); setPanning(false); setMarquee(null); setGuides([]); setMeasures([]);
    setDropTarget(null); setGhost(null); setActiveSpacing(null);
    if (!g) return;
    if (g.kind === 'draw') finishDraw(g);
    else if (g.kind === 'pencil') finishPencil(g);
    else if (g.kind === 'marquee') { if (!g.moved && !g.additive) store.select([]); }
    else if (g.kind === 'flow') finishFlowDrag(g, toWorld(toScreen(event.clientX, event.clientY)));
    else if (g.kind === 'move') { if (g.target) reparent(g.ids, g.target, g.index); store.endGesture(); }
    else if (g.kind === 'resize' || g.kind === 'rotate' || g.kind === 'spacing') store.endGesture();
  };

  /** Turn the pen anchors placed so far into a vector layer. */
  const finishPen = (closed: boolean) => {
    const current = pen.current;
    pen.current = null;
    setPenView(null);
    const state = store.getState();
    if (state.tool === 'pen') store.set({ tool: 'move' });
    const container = current ? state.doc.nodes[current.containerId] : undefined;
    if (!current || current.points.length < 2 || !container || container.type !== 'frame') return;
    const node = penNode(current.points, closed, current.container, nextName(state.doc, 'Vector'), container.layout.mode !== 'none');
    store.commit(doc => insertNode(doc, node, container.id), { selection: [node.id] });
  };
  const finishPenRef = useRef(finishPen);
  finishPenRef.current = finishPen;
  // Switching tools (or pressing Esc) ends the path being drawn.
  useEffect(() => { if (tool !== 'pen' && pen.current) finishPenRef.current(false); }, [tool]);

  const finishPencil = (g: Extract<Gesture, { kind: 'pencil' }>) => {
    setPenView(null);
    const state = store.getState();
    const container = state.doc.nodes[g.containerId];
    store.set({ tool: 'move' });
    if (g.points.length < 2 || !container || container.type !== 'frame') return;
    const node = pencilNode(g.points, g.container, nextName(state.doc, 'Drawing'), container.layout.mode !== 'none');
    store.commit(doc => insertNode(doc, node, container.id), { selection: [node.id] });
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const state = store.getState();
    if (pen.current) { finishPen(false); return; }
    if (state.tool !== 'move' || state.editingTextId) return;
    const chain = hitChain(event.clientX, event.clientY);
    if (!chain) return;
    const selected = state.selection.length === 1 ? state.selection[0] : undefined;
    const node = selected ? state.doc.nodes[selected] : undefined;
    if (node?.type === 'text' && chain.includes(node.id)) {
      store.beginGesture(); newText.current = false;
      store.set({ editingTextId: node.id });
      return;
    }
    const child = enterChild(chain, selected) ?? pickSelectable(state.doc, chain, state.selection, false);
    if (!child) return;
    const target = state.doc.nodes[child];
    if (target?.type === 'text' && child === chain[chain.length - 1] && selected === child) {
      store.beginGesture(); newText.current = false;
      store.set({ editingTextId: child });
    } else store.select([child]);
  };

  // ── Text editing ───────────────────────────────────────────────────────────
  const finishTextEditing = useCallback(() => {
    const state = store.getState();
    const id = state.editingTextId;
    if (!id) return;
    const node = state.doc.nodes[id];
    store.set({ editingTextId: null });
    if (node?.type === 'text' && !node.text.trim()) {
      if (newText.current) { store.cancelGesture(); store.select([]); }
      else { store.commit(doc => removeNodes(doc, [id]), { selection: [] }); store.endGesture(); }
    } else store.endGesture();
    newText.current = false;
  }, [store]);

  const cursor = panning ? 'grabbing' : spaceDown || tool === 'hand' ? 'grab' : DRAW_TOOLS[tool] || tool === 'pen' || tool === 'pencil' ? (tool === 'text' ? 'text' : 'crosshair') : 'default';
  const single = overlay.selection.length === 1 ? overlay.selection[0] : null;
  const showHandles = single && !editingTextId && tool === 'move';
  const root = single?.id === page.rootId;
  const v = viewport;
  const w2s = (x: number, y: number) => ({ x: x * v.zoom + v.x, y: y * v.zoom + v.y });

  return (
    <div
      ref={viewportRef} className="ed-viewport" style={{ cursor }} data-testid="canvas"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onPointerLeave={() => { if (!gesture.current && store.getState().hover) store.set({ hover: null }); }}
      onDoubleClick={onDoubleClick} onContextMenu={event => event.preventDefault()}
    >
      <div className="ed-world" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.zoom})` }}>
        <div ref={pageRef} className="ed-page" style={{ width: BREAKPOINT_WIDTH[breakpoint] }} data-breakpoint={breakpoint}>
          {editingTextId && <style>{`.${PAGE_SCOPE} [data-node-id="${editingTextId}"]{visibility:hidden}`}</style>}
          <SitePage doc={doc} pageId={page.id} mode={{ breakpoint }} scope={PAGE_SCOPE} annotate />
        </div>
        {editingTextId && doc.nodes[editingTextId]?.type === 'text' && (
          <TextEditor key={editingTextId} store={store} id={editingTextId} measureWorld={measureWorld} element={element} onDone={finishTextEditing} />
        )}
      </div>

      <div className="ed-overlay" aria-hidden="true">
        {overlay.root && (
          <div className="ed-page-label" data-page-label="true" style={{ left: overlay.root.x, top: overlay.root.y - 22 }}>{page.name}</div>
        )}
        {(line || penView) && (
          <svg className="ed-pen" aria-hidden="true">
            {line && <line x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} />}
            {penView?.free && <path d={freehandD(penView.free, w2s)} />}
            {penView && penView.points.length > 0 && <>
              <path d={penD(penView.points, false, w2s)} />
              {penView.cursor && (() => { const a = penView.points[penView.points.length - 1], p = w2s(a.x, a.y), q = w2s(penView.cursor.x, penView.cursor.y); return <line className="ed-pen-next" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />; })()}
              {penView.points.map((point, index) => { const p = w2s(point.x, point.y); return <circle key={index} cx={p.x} cy={p.y} r={index === 0 ? 5 : 3.5} className={index === 0 ? 'ed-pen-first' : undefined} />; })}
            </>}
          </svg>
        )}
        {overlay.hover && <div className="ed-hover" style={box(overlay.hover)} />}
        {overlay.selection.map(sel => <div key={sel.id} className="ed-selection" style={selectionStyle(sel)} />)}
        {showHandles && single && !root && CORNERS.map(corner => {
          const { fx, fy } = handleFactors(corner);
          const p = boxPoint({ ...single, w: single.w + 20, h: single.h + 20 }, fx, fy);
          return <div key={'r' + corner} data-rotate={corner} className="ed-rotate" style={{ left: p.x, top: p.y }} />;
        })}
        {showHandles && single && HANDLES.filter(h => (root ? h === 's'
          // Like Figma, hide edge-midpoint handles when the layer is too small to tell them apart.
          : !(((h === 'n' || h === 's') && single.w < 32) || ((h === 'e' || h === 'w') && single.h < 32)))).map(handle => {
          const { fx, fy } = handleFactors(handle);
          const p = boxPoint(single, fx, fy);
          return <div key={handle} data-handle={handle} className={`ed-handle ed-handle-${handle}`} style={{ left: p.x, top: p.y, transform: single.rotation ? `rotate(${single.rotation}deg)` : undefined }} />;
        })}
        {single && !editingTextId && (
          <div className="ed-size-badge" style={{ left: single.rect.x + single.rect.w / 2, top: single.rect.y + single.rect.h + 8 }}>
            {Math.round(single.w / v.zoom)} × {Math.round(single.h / v.zoom)}{single.rotation ? ` · ${Math.round(single.rotation)}°` : ''}
          </div>
        )}
        {guides.map((guide, index) => {
          const a = guide.axis === 'x' ? w2s(guide.pos, guide.from) : w2s(guide.from, guide.pos);
          const b = guide.axis === 'x' ? w2s(guide.pos, guide.to) : w2s(guide.to, guide.pos);
          return <div key={'g' + index} className="ed-guide" style={{ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.max(1, Math.abs(b.x - a.x)), height: Math.max(1, Math.abs(b.y - a.y)) }} />;
        })}
        {measures.map((m, index) => {
          const a = w2s(m.x1, m.y1), b = w2s(m.x2, m.y2);
          const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
          return (
            <div key={'m' + index}>
              <div className="ed-measure" style={{ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: horizontal ? Math.abs(b.x - a.x) : 1, height: horizontal ? 1 : Math.abs(b.y - a.y) }} />
              <div className="ed-measure-label" style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}>{Math.round(m.value)}</div>
            </div>
          );
        })}
        {overlay.spacing.map((region, index) => (
          // The band is only a visual; the small bar in its middle is the handle, so the
          // rest of a selected frame (including its padding) can still be dragged.
          <div key={'s' + index} className={'ed-spacing ed-spacing-' + region.axis + (activeSpacing === index ? ' is-active' : '')} style={box(region.rect)}>
            <span className="ed-spacing-hit" data-spacing={index} title={region.target.kind === 'gap' ? 'Drag to change the gap' : 'Drag to change padding (Alt: both sides, Shift: all sides)'}><span className="ed-spacing-bar" /></span>
            {activeSpacing === index && <span className="ed-spacing-label">{region.target.kind === 'gap' ? 'Gap' : 'Padding'} {Math.round(region.value)}</span>}
          </div>
        ))}
        {dropTarget && <div className="ed-drop-target" style={box(dropTarget)} />}
        {ghost && <div className="ed-ghost" style={box(ghost)} />}
        {preview && <div className="ed-draw-preview" style={box(preview)} />}
        {marquee && <div className="ed-marquee" style={box(marquee)} />}
        {indicator && <div className="ed-drop-indicator" style={box(indicator)} />}
      </div>
    </div>
  );
});

const box = (r: Rect): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h });
function selectionStyle(sel: SelectionBox): CSSProperties {
  if (!sel.rotation) return box(sel.rect);
  const cx = sel.rect.x + sel.rect.w / 2, cy = sel.rect.y + sel.rect.h / 2;
  return { left: cx - sel.w / 2, top: cy - sel.h / 2, width: sel.w, height: sel.h, transform: `rotate(${sel.rotation}deg)` };
}

/** In-place text editing: a textarea mirroring the text layer's typography, in world space. */
function TextEditor({ store, id, measureWorld, element, onDone }: { store: EditorStore; id: string; measureWorld: (id: string) => Rect | null; element: (id: string) => HTMLElement | null; onDone: () => void }) {
  const node = useEditor(store, state => state.doc.nodes[id]);
  const doc = useEditor(store, state => state.doc);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    setRect(measureWorld(id));
    const el = element(id);
    if (!el) return;
    const computed = getComputedStyle(el);
    setStyle({
      fontFamily: computed.fontFamily, fontSize: computed.fontSize, fontWeight: computed.fontWeight as CSSProperties['fontWeight'], fontStyle: computed.fontStyle,
      lineHeight: computed.lineHeight, letterSpacing: computed.letterSpacing, textAlign: computed.textAlign as CSSProperties['textAlign'],
      textTransform: computed.textTransform as CSSProperties['textTransform'], whiteSpace: computed.whiteSpace as CSSProperties['whiteSpace'],
      color: computed.color === 'rgba(0, 0, 0, 0)' ? '#111111' : computed.color, overflowWrap: computed.overflowWrap as CSSProperties['overflowWrap'],
    });
  }, [doc, id, measureWorld, element]);
  // The textarea only mounts once the layer has been measured; focus it then.
  const focused = useRef(false);
  useEffect(() => { const el = ref.current; if (el && !focused.current) { focused.current = true; el.focus(); el.select(); } }, [rect]);
  if (!node || node.type !== 'text' || !rect) return null;
  return (
    <textarea
      ref={ref} className="ed-text-editor" aria-label="Edit text" spellCheck={false}
      style={{ ...style, left: rect.x, top: rect.y, width: Math.max(rect.w, 4), height: Math.max(rect.h, parseFloat(String(style.lineHeight)) || 20) }}
      value={node.text}
      onChange={event => store.commit(doc => updateNode(doc, id, { text: event.target.value }))}
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); onDone(); } }}
      onBlur={onDone}
      onPointerDown={event => event.stopPropagation()}
    />
  );
}
