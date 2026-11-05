import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Rect, Text, Transformer, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Cursor, Hand, FrameCorners, TextT, Image as ImageIcon, Square, Circle, Plus, ArrowUUpLeft, ArrowUUpRight, DownloadSimple, Stack, SlidersHorizontal, Palette, ArrowsOut, Minus, Question, Magnet, Copy, Trash, Selection, X, FilePng, FilePdf, CheckCircle, SpinnerGap, Monitor, DeviceMobile } from './icons';
import type { Project } from '../project/schema';
import { getDesign, saveDesign, validateDesignForProject } from '../project/storage';
import { downloadBackup } from '../export/download';
import Dialog from '../editor/Dialog';
import { createArtboard, createLayer, designSchema, emptyDesign, MAX_ARTBOARDS, type DesignDocument, type DesignLayer, type Artboard, type LayerType } from './schema';
import { addArtboard, addLayer, updateLayer, updateArtboard, removeLayers, removeArtboards, duplicateLayers, moveLayers, transformLayer, alignLayers, groupLayers, ungroupLayers, selectionRoots, isLayerLocked, layerBounds, reorderLayers, snapMove, type SnapGuide } from './model';
import { createHistory, commitHistory, undoHistory, redoHistory, type DesignHistory } from './history';
import { RenderArtboard, loadDesignImage, attachDesignTransformer } from './DesignScene';
import { readImageDimensions } from './image-validation';
import { editorialStudy } from './demo';
import { businessDesign } from '../conversion/demo';
import { ColorField, IconButton, NumberField, TextField } from './controls';
import DesignInspector from './DesignInspector';
import LayersPanel from './LayersPanel';
import './design-canvas.css';

type Tool = 'select' | 'hand';
type View = { x: number; y: number; zoom: number };
type CanvasEvent = KonvaEventObject<MouseEvent | TouchEvent>;
const presets = [{ name: 'Desktop', width: 1440, height: 1000 }, { name: 'Tablet', width: 768, height: 1024 }, { name: 'Mobile', width: 390, height: 844 }, { name: 'Square', width: 1080, height: 1080 }, { name: 'Presentation', width: 1920, height: 1080 }];

export default function DesignCanvas({ project, saved, failed, convert }: { project: Project; saved: (project: Project) => void; failed: (project: Project, message: string) => void; convert: (artboardId?: string) => void }) {
  const [history, setHistory] = useState<DesignHistory>(() => createHistory(emptyDesign()));
  const historyRef = useRef(history);
  const document = history.present;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [boardId, setBoardId] = useState('');
  const board = document.artboards.find(board => board.id === boardId) || document.artboards[0];
  const selectedLayers = document.layers.filter(layer => selected.includes(layer.id));
  const selectedLayer = selectedLayers[0];
  const proportionalResize = selectionRoots(document, selected).length > 1 || selectedLayer?.type === 'group';
  const [tool, setTool] = useState<Tool>('select');
  const [space, setSpace] = useState(false);
  const [snapping, setSnapping] = useState(true);
  const [view, setView] = useState<View>({ x: 60, y: 60, zoom: 0.6 });
  const [size, setSize] = useState({ width: 600, height: 640 });
  const [help, setHelp] = useState(false);
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [boardPreset, setBoardPreset] = useState(0);
  const [boardName, setBoardName] = useState('Desktop');
  const [boardWidth, setBoardWidth] = useState(1440);
  const [boardHeight, setBoardHeight] = useState(1000);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportScale, setExportScale] = useState(1);
  const [exportScope, setExportScope] = useState('all');
  const [exportError, setExportError] = useState('');
  const [message, setMessage] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [leftTab, setLeftTab] = useState<'layers' | 'styles'>('layers');
  const [mobilePanel, setMobilePanel] = useState<'layers' | 'properties' | null>(null);
  const [styleDialog, setStyleDialog] = useState<'color' | 'type' | null>(null);
  const [styleName, setStyleName] = useState('');
  const [textEditing, setTextEditing] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const marquee = useRef<Konva.Rect>(null);
  const dragSelection = useRef<{ x: number; y: number; boardId?: string; additive: boolean } | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const saveRevision = useRef(0);
  const alive = useRef(true);
  const activeProjectId = useRef(project.id);
  activeProjectId.current = project.id;
  const transformBatch = useRef<{ projectId: string; patches: Map<string, Partial<DesignLayer>> } | null>(null);
  const guideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialFit = useRef(false);
  const panning = tool === 'hand' || space;

  useEffect(() => {
    let active = true;
    alive.current = true;
    transformBatch.current = null;
    void getDesign(project).then(design => { if (active) { const next = createHistory(design); historyRef.current = next; setHistory(next); setBoardId(design.artboards[0]?.id || ''); } }).catch(error => { if (active) setLoadError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; alive.current = false; transformBatch.current = null; if (guideTimer.current) clearTimeout(guideTimer.current); };
  }, [project.id]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => { const rect = entries[0].contentRect; setSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) }); });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading]);
  useEffect(() => {
    if (loading || !document.artboards.length || initialFit.current || size.width < 100) return;
    initialFit.current = true;
    fit(document.artboards);
  }, [loading, size, document.artboards]);
  useEffect(() => {
    const node = stage.current, handles = transformer.current;
    if (!node || !handles) return;
    const roots = selectionRoots(document, selected).filter(layer => !isLayerLocked(document, layer.id) && layer.visible);
    attachDesignTransformer(handles, roots.flatMap(layer => { const found = node.findOne('#' + layer.id); return found ? [found] : []; }));
    handles.getLayer()?.batchDraw();
  }, [document, selected, panning]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (saveState === 'failed' || saveState === 'saving') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  function displayError(error: unknown) {
    const issue = error instanceof Error && 'issues' in error && Array.isArray(error.issues) ? error.issues[0]?.message : undefined;
    setMessage(typeof issue === 'string' ? issue : error instanceof Error ? error.message : 'Could not apply that change. Your previous design is preserved.');
  }
  function persist(design: DesignDocument) {
    const nextProject = { ...project, updatedAt: new Date().toISOString() }, revision = ++saveRevision.current;
    setSaveState('saving');
    void saveDesign(nextProject, design).then(() => { saved(nextProject); if (alive.current && revision === saveRevision.current) setSaveState('saved'); }).catch(error => { failed(nextProject, error.message); if (alive.current && revision === saveRevision.current) setSaveState('failed'); });
  }
  function commit(design: DesignDocument) {
    try {
      const next = commitHistory(historyRef.current, validateDesignForProject(project, design));
      if (next === historyRef.current) return;
      historyRef.current = next; setHistory(next); setMessage(''); persist(next.present);
      setSelected(ids => ids.filter(id => next.present.layers.some(layer => layer.id === id)));
    } catch (error) { displayError(error); }
  }
  function change(operation: (design: DesignDocument) => DesignDocument) { try { commit(operation(historyRef.current.present)); } catch (error) { displayError(error); } }
  function historyMove(direction: 'undo' | 'redo') {
    try {
      const next = direction === 'undo' ? undoHistory(historyRef.current) : redoHistory(historyRef.current);
      if (next === historyRef.current) return;
      validateDesignForProject(project, next.present);
      historyRef.current = next; setHistory(next); setSelected([]); persist(next.present); setMessage('');
    } catch (error) { displayError(error); }
  }
  function fit(boards: Artboard[] = document.artboards) {
    if (!boards.length) return;
    const x = Math.min(...boards.map(board => board.x)), y = Math.min(...boards.map(board => board.y));
    const right = Math.max(...boards.map(board => board.x + board.width)), bottom = Math.max(...boards.map(board => board.y + board.height));
    const margin = size.width < 500 ? 22 : 56;
    const zoom = Math.max(0.001, Math.min(1.5, (size.width - margin * 2) / (right - x), (size.height - margin * 2) / (bottom - y)));
    setView({ x: (size.width - (right - x) * zoom) / 2 - x * zoom, y: (size.height - (bottom - y) * zoom) / 2 - y * zoom + 8, zoom });
  }
  function zoomTo(zoom: number, pointer = { x: size.width / 2, y: size.height / 2 }) {
    const nextZoom = Math.max(0.001, Math.min(4, zoom));
    setView(previous => ({ zoom: nextZoom, x: pointer.x - (pointer.x - previous.x) / previous.zoom * nextZoom, y: pointer.y - (pointer.y - previous.y) / previous.zoom * nextZoom }));
  }
  function chooseBoard(id: string) { const chosen = document.artboards.find(board => board.id === id); setBoardId(id); setSelected([]); if (chosen) fit([chosen]); }
  function select(id: string, additive: boolean, preserveSelection = false) {
    const layer = document.layers.find(layer => layer.id === id);
    if (!layer) return;
    setBoardId(layer.artboardId);
    setSelected(ids => additive ? ids.includes(id) ? ids.filter(value => value !== id) : [...ids.filter(value => document.layers.find(layer => layer.id === value)?.artboardId === layer.artboardId), id] : preserveSelection && ids.includes(id) && ids.length > 1 ? ids : [id]);
  }
  function insert(type: LayerType) {
    if (!board) { setAddBoardOpen(true); setMessage('First add a screen for your design.'); return; }
    if (type === 'image') { imageInput.current?.click(); return; }
    const count = document.layers.filter(layer => layer.artboardId === board.id).length;
    const width = Math.min(type === 'text' ? 360 : type === 'frame' ? 500 : 240, board.width - 16);
    const height = Math.min(type === 'text' ? 100 : type === 'frame' ? 320 : 160, board.height - 16);
    const layer = createLayer(type, board.id, { width: Math.max(1, width), height: Math.max(1, height), x: Math.max(8, Math.min(80 + count % 6 * 16, board.width - width - 8)), y: Math.max(8, Math.min(80 + count % 6 * 16, board.height - height - 8)) });
    change(design => addLayer(design, layer)); setSelected([layer.id]); setTool('select');
  }
  function createBoard() {
    try {
      const x = document.artboards.length ? Math.max(...document.artboards.map(board => board.x + board.width)) + 120 : 0;
      const created = createArtboard({ name: boardName.trim() || presets[boardPreset].name, width: boardWidth, height: boardHeight, x });
      commit(addArtboard(document, created)); setBoardId(created.id); setSelected([]); setAddBoardOpen(false); initialFit.current = true; fit([created]);
    } catch (error) { displayError(error); }
  }
  function updateSelected(patch: Partial<DesignLayer>) {
    change(design => {
      let next = design;
      for (const layer of selectionRoots(design, selected)) {
        if (isLayerLocked(design, layer.id) && patch.locked === undefined && patch.visible === undefined) continue;
        const geometry = ['x', 'y', 'width', 'height', 'rotation'].some(key => key in patch);
        next = geometry ? transformLayer(next, layer.id, patch) : updateLayer(next, layer.id, patch);
      }
      return next;
    });
  }
  function duplicateSelection() {
    try {
      const next = duplicateLayers(document, selected), oldIds = new Set(document.layers.map(layer => layer.id));
      commit(next); setSelected(selectionRoots(next, next.layers.filter(layer => !oldIds.has(layer.id)).map(layer => layer.id)).map(layer => layer.id));
    } catch (error) { displayError(error); }
  }
  function groupSelection(ungroup = false) {
    try { const next = ungroup ? ungroupLayers(document, selected) : groupLayers(document, selected); const oldIds = new Set(document.layers.map(layer => layer.id)); commit(next); setSelected(ungroup ? [] : next.layers.filter(layer => !oldIds.has(layer.id)).map(layer => layer.id)); } catch (error) { displayError(error); }
  }
  function dragEnded(ids: string[], dx: number, dy: number, localDeltas?: Record<string, { dx: number; dy: number }>) {
    if (localDeltas) { change(design => selectionRoots(design, ids).reduce((next, layer) => { const delta = localDeltas[layer.id]; return delta ? moveLayers(next, [layer.id], delta.dx, delta.dy) : next; }, design)); setGuides([]); return; }
    const snap = snapping ? snapMove(document, ids, dx, dy, 6 / view.zoom) : { dx, dy, guides: [] };
    change(design => moveLayers(design, ids, snap.dx, snap.dy)); setGuides(snap.guides);
    if (guideTimer.current) clearTimeout(guideTimer.current);
    guideTimer.current = setTimeout(() => setGuides([]), 700);
  }
  function transformEnded(id: string, patch: Partial<DesignLayer>) {
    let batch = transformBatch.current;
    if (!batch || batch.projectId !== project.id) {
      batch = { projectId: project.id, patches: new Map() };
      transformBatch.current = batch;
      const scheduled = batch;
      // Konva emits one synchronous end event per selected root. Commit their
      // complete gesture once so undo and validation remain atomic.
      queueMicrotask(() => {
        if (transformBatch.current !== scheduled) return;
        transformBatch.current = null;
        if (!alive.current || activeProjectId.current !== scheduled.projectId) return;
        const patches = [...scheduled.patches];
        scheduled.patches.clear();
        change(design => patches.reduce((next, [layerId, layerPatch]) => transformLayer(next, layerId, layerPatch), design));
      });
    }
    batch.patches.set(id, { ...patch });
  }
  function guidePoints(guide: SnapGuide): number[] {
    if (!board) return [];
    const root = selectionRoots(document, selected)[0];
    const parent = root?.parentId ? document.layers.find(layer => layer.id === root.parentId) : undefined;
    const parentNode = parent ? stage.current?.findOne('#' + parent.id) : undefined;
    if (parent && parentNode && stage.current) {
      const local = guide.axis === 'x' ? [{ x: guide.position - parent.x, y: 0 }, { x: guide.position - parent.x, y: parent.height }] : [{ x: 0, y: guide.position - parent.y }, { x: parent.width, y: guide.position - parent.y }];
      const stageInverse = stage.current.getAbsoluteTransform().copy().invert();
      return local.flatMap(point => { const world = stageInverse.point(parentNode.getAbsoluteTransform().point(point)); return [world.x, world.y]; });
    }
    return guide.axis === 'x' ? [board.x + guide.position, board.y, board.x + guide.position, board.y + board.height] : [board.x, board.y + guide.position, board.x + board.width, board.y + guide.position];
  }
  async function importImage(file: File) {
    if (!board) return;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) throw new Error('Choose a PNG, JPEG or WebP image under 2 MB.');
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this image.')); reader.readAsDataURL(file); });
      const dimensions = readImageDimensions(dataUrl);
      const asset = { id: crypto.randomUUID(), name: file.name.slice(0, 100) || 'Image', dataUrl, ...dimensions };
      await loadDesignImage(asset);
      const width = Math.min(asset.width, board.width * 0.6, 600), height = asset.height / asset.width * width;
      const layer = createLayer('image', board.id, { name: asset.name, assetId: asset.id, width, height: Math.min(12000, height), x: 32, y: 32 });
      // A slow image read adds to the most recent design, not the upload-start snapshot.
      change(design => addLayer({ ...design, assets: [...design.assets, asset] }, layer)); setSelected([layer.id]);
    } catch (error) { displayError(error); }
  }
  function addStyle() {
    if (!selectedLayer || !styleDialog) return;
    const id = crypto.randomUUID(), name = styleName.trim();
    if (!name) { setMessage('Give your style a name.'); return; }
    change(design => styleDialog === 'color' ? { ...design, colors: [...design.colors, { id, name, value: selectedLayer.fill }], layers: design.layers.map(layer => layer.id === selectedLayer.id ? { ...layer, colorStyleId: id } : layer) } : { ...design, typeStyles: [...design.typeStyles, { id, name, fontFamily: selectedLayer.fontFamily, fontSize: selectedLayer.fontSize, fontWeight: selectedLayer.fontWeight, lineHeight: selectedLayer.lineHeight }], layers: design.layers.map(layer => layer.id === selectedLayer.id ? { ...layer, typeStyleId: id } : layer) });
    setStyleDialog(null); setLeftTab('styles');
  }
  function updateTypeStyle(id: string, patch: Partial<DesignDocument['typeStyles'][number]>) {
    change(design => ({ ...design, typeStyles: design.typeStyles.map(style => style.id === id ? { ...style, ...patch, id } : style), layers: design.layers.map(layer => layer.typeStyleId === id ? { ...layer, ...patch, id: layer.id, name: layer.name } : layer) }));
  }
  function pointerPosition() {
    const node = stage.current, pointer = node?.getPointerPosition();
    return node && pointer ? node.getAbsoluteTransform().copy().invert().point(pointer) : null;
  }
  function startSelection(event: CanvasEvent) {
    if (panning || (event.evt instanceof MouseEvent && event.evt.button !== 0)) return;
    const node = stage.current, point = pointerPosition();
    if (!node || !point || (event.target !== node && event.target.name() !== 'artboard-background')) return;
    const under = document.artboards.find(board => point.x >= board.x && point.x <= board.x + board.width && point.y >= board.y && point.y <= board.y + board.height);
    if (under) setBoardId(under.id);
    const additive = 'shiftKey' in event.evt && event.evt.shiftKey;
    dragSelection.current = { ...point, boardId: under?.id, additive: Boolean(additive) };
    marquee.current?.setAttrs({ x: point.x, y: point.y, width: 0, height: 0, visible: true });
  }
  function moveSelection() {
    const start = dragSelection.current, point = pointerPosition();
    if (!start || !point) return;
    marquee.current?.setAttrs({ x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) });
    marquee.current?.getLayer()?.batchDraw();
  }
  function finishSelection() {
    const start = dragSelection.current, box = marquee.current;
    if (!start || !box) return;
    if (box.width() < 3 / view.zoom && box.height() < 3 / view.zoom) { if (!start.additive) setSelected([]); }
    else {
      const candidates = document.layers.filter(layer => !isLayerLocked(document, layer.id) && layer.visible && (!start.boardId || layer.artboardId === start.boardId) && !layer.parentId);
      const ids = candidates.filter(layer => { const board = document.artboards.find(board => board.id === layer.artboardId)!, bounds = layerBounds(document, [layer.id])!; return Konva.Util.haveIntersection({ x: box.x(), y: box.y(), width: box.width(), height: box.height() }, { ...bounds, x: board.x + bounds.x, y: board.y + bounds.y }); }).map(layer => layer.id);
      const firstBoard = document.layers.find(layer => layer.id === ids[0])?.artboardId;
      const sameBoardIds = ids.filter(id => document.layers.find(layer => layer.id === id)?.artboardId === firstBoard);
      if (firstBoard) setBoardId(firstBoard);
      setSelected(previous => start.additive ? [...new Set([...previous.filter(id => document.layers.find(layer => layer.id === id)?.artboardId === firstBoard), ...sameBoardIds])] : sameBoardIds);
    }
    dragSelection.current = null; box.visible(false); box.getLayer()?.batchDraw();
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (loading || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || globalThis.document.querySelector('dialog[open]')) return;
      const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (event.code === 'Space') {
        if (event.target instanceof Element && event.target.closest('button, a, [role="button"]')) return;
        event.preventDefault(); setSpace(true); return;
      }
      if (command && key === 'z') { event.preventDefault(); historyMove(event.shiftKey ? 'redo' : 'undo'); }
      else if (command && key === 'a') { event.preventDefault(); setSelected(document.layers.filter(layer => layer.artboardId === board?.id && layer.visible && !isLayerLocked(document, layer.id)).map(layer => layer.id)); }
      else if (command && key === 'd') { event.preventDefault(); duplicateSelection(); }
      else if (command && key === 'g') { event.preventDefault(); groupSelection(event.shiftKey); }
      else if (key === 'delete' || key === 'backspace') { if (selected.length) { event.preventDefault(); change(design => removeLayers(design, selected)); } }
      else if (key === 'escape') { setSelected([]); setSpace(false); setTool('select'); setMobilePanel(null); }
      else if (key.startsWith('arrow') && selected.length) { event.preventDefault(); const amount = event.shiftKey ? 10 : 1; change(design => moveLayers(design, selected, key === 'arrowleft' ? -amount : key === 'arrowright' ? amount : 0, key === 'arrowup' ? -amount : key === 'arrowdown' ? amount : 0)); }
      else if (!command && !event.altKey) { if (key === 'v') setTool('select'); else if (key === 'h') setTool('hand'); else if (key === 'r') insert('rectangle'); else if (key === 'o') insert('ellipse'); else if (key === 't') insert('text'); else if (key === 'f') insert('frame'); else if (key === '?') setHelp(true); }
    };
    const releaseSpace = () => setSpace(false);
    const keyup = (event: KeyboardEvent) => { if (event.code === 'Space') releaseSpace(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', releaseSpace);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', releaseSpace); };
  });

  async function exportDesign(format: 'png' | 'pdf' | 'apl') {
    setExporting(true); setExportError('');
    try {
      if (format === 'apl') await downloadBackup(project);
      else { const exporter = await import('./export'); if (format === 'pdf') await exporter.downloadDesignPDF(document); else await exporter.downloadDesignPNG(document, exportScope === 'all' ? undefined : [board!.id], exportScale); }
      setMessage(format === 'apl' ? 'Editable backup downloaded with both Design and Build.' : format.toUpperCase() + ' downloaded. Your editable design stays in APL.');
    } catch (error) { setExportError(error instanceof Error ? error.message : 'Could not download this design.'); }
    finally { setExporting(false); }
  }

  if (loading) return <main id="main" className="dc-loading"><SpinnerGap size={32} className="dc-spinner"/><p role="status">Opening your design…</p></main>;
  if (loadError) return <main id="main" className="dc-loading"><h1>Your design could not be opened.</h1><p role="alert">{loadError}</p><p>The stored project has not been replaced.</p></main>;
  return <main id="main" className="design-canvas" aria-label="Design workspace">
    <div className="dc-topbar"><div className="dc-file-info"><span className="dc-mode-badge">DESIGN</span><strong>{project.name}</strong><span className={'dc-save-state ' + saveState} role="status">{saveState === 'saved' ? <CheckCircle size={14}/> : <SpinnerGap size={14} className={saveState === 'saving' ? 'dc-spinner' : ''}/>}<span>{saveState === 'saved' ? 'Saved on this device' : saveState === 'saving' ? 'Saving…' : 'Save failed — keep a backup'}</span></span></div><div className="dc-top-actions"><button className="dc-download" disabled={!board || !document.layers.some(layer => layer.artboardId === board.id && layer.visible)} onClick={() => convert(board?.id)}><Monitor size={18}/>Convert to website</button><IconButton icon={Question} label="Canvas guide" onClick={() => setHelp(true)}>Guide</IconButton><button className="dc-download" onClick={() => { setExportError(''); setExportOpen(true); }}><DownloadSimple size={18}/>Download design</button></div></div>
    <div className="dc-body">
      <aside className={'dc-left-panel' + (mobilePanel === 'layers' ? ' mobile-open' : '')} aria-label="Layers and styles"><div className="dc-sidebar-tabs"><button aria-pressed={leftTab === 'layers'} onClick={() => setLeftTab('layers')}><Stack size={16}/>Layers</button><button aria-pressed={leftTab === 'styles'} onClick={() => setLeftTab('styles')}><Palette size={16}/>Styles</button><IconButton className="dc-panel-close" icon={X} label="Close layers panel" onClick={() => setMobilePanel(null)}/></div>{leftTab === 'layers' ? <LayersPanel document={document} activeBoard={board} selected={selected} chooseBoard={chooseBoard} select={select} update={(id, patch) => change(design => updateLayer(design, id, patch))} addBoard={() => setAddBoardOpen(true)}/> : <div className="dc-style-library"><div className="dc-panel-heading"><h2>Reusable styles</h2><span>Change once, use everywhere</span></div><p className="dc-panel-empty">Save a selected layer's color or typography from Properties, then apply it to other layers.</p><h3>Colors / {document.colors.length}</h3>{document.colors.map(style => <div className="dc-saved-style" key={style.id}><TextField label="Color style name" value={style.name} onChange={name => change(design => ({ ...design, colors: design.colors.map(item => item.id === style.id ? { ...item, name } : item) }))}/><ColorField label={style.name} value={style.value} onChange={value => change(design => ({ ...design, colors: design.colors.map(item => item.id === style.id ? { ...item, value } : item), layers: design.layers.map(layer => layer.colorStyleId === style.id ? { ...layer, fill: value } : layer) }))}/><IconButton icon={Trash} label={'Remove color style ' + style.name} onClick={() => change(design => ({ ...design, colors: design.colors.filter(item => item.id !== style.id), layers: design.layers.map(layer => layer.colorStyleId === style.id ? { ...layer, colorStyleId: null, fill: style.value } : layer) }))}/></div>)}<h3>Typography / {document.typeStyles.length}</h3>{document.typeStyles.map(style => <div className="dc-saved-style dc-type-style" key={style.id}><TextField label="Type style name" value={style.name} onChange={name => change(design => ({ ...design, typeStyles: design.typeStyles.map(item => item.id === style.id ? { ...item, name } : item) }))}/><p style={{ fontFamily: style.fontFamily }}>Aa <small>{style.fontFamily} / {style.fontSize}px</small></p><label className="dc-field"><span>{style.name} font family</span><select value={style.fontFamily} onChange={event => updateTypeStyle(style.id, { fontFamily: event.target.value as DesignLayer['fontFamily'] })}><option value="Arial">Arial / sans serif</option><option value="Georgia">Georgia / editorial</option><option value="system-ui">System / modern</option><option value="monospace">Monospace</option></select></label><div className="dc-field-grid"><NumberField label={style.name + ' font size'} value={style.fontSize} min={4} max={1000} onChange={fontSize => updateTypeStyle(style.id, { fontSize })}/><NumberField label={style.name + ' line height'} value={style.lineHeight} min={0.5} max={4} step={0.1} onChange={lineHeight => updateTypeStyle(style.id, { lineHeight })}/></div><label className="dc-field"><span>{style.name} font weight</span><select value={style.fontWeight} onChange={event => updateTypeStyle(style.id, { fontWeight: Number(event.target.value) })}>{[100,200,300,400,500,600,700,800,900].map(weight => <option key={weight} value={weight}>{weight}</option>)}</select></label><IconButton icon={Trash} label={'Remove type style ' + style.name} onClick={() => change(design => ({ ...design, typeStyles: design.typeStyles.filter(item => item.id !== style.id), layers: design.layers.map(layer => layer.typeStyleId === style.id ? { ...layer, typeStyleId: null, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight } : layer) }))}/></div>)}</div>}</aside>
      <section className="dc-work-area" aria-label="Canvas and tools"><div className="dc-toolstrip" role="toolbar" aria-label="Design tools"><div className="dc-tool-group"><IconButton icon={Cursor} label="Select tool (V)" active={!panning} onClick={() => setTool('select')}>Select</IconButton><IconButton icon={Hand} label="Pan tool (H, or hold Space)" active={panning} onClick={() => setTool('hand')}/></div><div className="dc-tool-group"><IconButton icon={FrameCorners} label="Add artboard" onClick={() => setAddBoardOpen(true)}/><IconButton icon={Selection} label="Add frame (F)" onClick={() => insert('frame')}/><IconButton icon={TextT} label="Add text (T)" onClick={() => insert('text')}/><IconButton icon={Square} label="Add rectangle (R)" onClick={() => insert('rectangle')}/><IconButton icon={Circle} label="Add ellipse (O)" onClick={() => insert('ellipse')}/><IconButton icon={ImageIcon} label="Add image" onClick={() => insert('image')}/></div><div className="dc-tool-group dc-history-tools"><IconButton icon={ArrowUUpLeft} label="Undo (Ctrl/⌘ Z)" disabled={!history.past.length} onClick={() => historyMove('undo')}/><IconButton icon={ArrowUUpRight} label="Redo (Ctrl/⌘ Shift Z)" disabled={!history.future.length} onClick={() => historyMove('redo')}/></div></div>
        <div ref={container} className={'dc-stage-host' + (panning ? ' is-panning' : '')} tabIndex={0} aria-label="Design canvas. Use the Layers panel and Properties to edit with a keyboard." onContextMenu={event => event.preventDefault()}>
          <Stage ref={stage} width={size.width} height={size.height} x={view.x} y={view.y} scaleX={view.zoom} scaleY={view.zoom} draggable={panning} onMouseDown={startSelection} onTouchStart={startSelection} onMouseMove={moveSelection} onTouchMove={moveSelection} onMouseUp={finishSelection} onTouchEnd={finishSelection} onMouseLeave={finishSelection} onDragEnd={event => { if (event.target === stage.current) setView(previous => ({ ...previous, x: event.target.x(), y: event.target.y() })); }} onWheel={event => { event.evt.preventDefault(); const pointer = stage.current?.getPointerPosition() || undefined; if (event.evt.ctrlKey || event.evt.metaKey) zoomTo(view.zoom * Math.exp(-event.evt.deltaY * 0.008), pointer); else setView(previous => ({ ...previous, x: previous.x - event.evt.deltaX, y: previous.y - event.evt.deltaY })); }}>
            <Layer>{document.artboards.map(artboard => <RenderArtboard key={artboard.id} document={document} artboard={artboard} interactive={!panning} selectedIds={selected} onSelect={(id, additive) => select(id, additive, true)} onDragEnd={dragEnded} onDragMove={(ids, dx, dy) => { if (snapping) setGuides(snapMove(document, ids, dx, dy, 6 / view.zoom).guides); }} onTransformEnd={transformEnded} onTextEdit={id => { const layer = document.layers.find(layer => layer.id === id); if (layer && !isLayerLocked(document, id)) { setTextEditing(id); setTextDraft(layer.text); } }}/>)}</Layer>
            <Layer listening={false}>{document.artboards.map(artboard => <Text key={artboard.id} x={artboard.x} y={artboard.y - 25 / view.zoom} text={artboard.name + '  /  ' + artboard.width + ' × ' + artboard.height} fontSize={11 / view.zoom} fontFamily="Arial" fill={board?.id === artboard.id ? '#334d3c' : '#606b63'}/>)}{board && guides.map((guide, index) => <Line key={index} points={guidePoints(guide)} stroke="#c56945" strokeWidth={1 / view.zoom} dash={[4 / view.zoom, 4 / view.zoom]}/>)}<Rect ref={marquee} visible={false} fill="#42604c22" stroke="#42604c" strokeWidth={1 / view.zoom}/></Layer>
            <Layer><Transformer ref={transformer} visible={!panning} rotateEnabled={selected.length === 1} flipEnabled={false} borderStroke="#42604c" anchorStroke="#42604c" anchorFill="#ffffff" anchorSize={size.width < 500 ? 14 : 9} anchorCornerRadius={2} keepRatio={proportionalResize} enabledAnchors={proportionalResize ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']} padding={0} boundBoxFunc={(oldBox, newBox) => Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 || Math.abs(newBox.width) / view.zoom > 12000 || Math.abs(newBox.height) / view.zoom > 12000 ? oldBox : newBox}/></Layer>
          </Stage>
          {!document.artboards.length && <div className="dc-empty-state"><span className="dc-empty-symbol"><FrameCorners size={34} weight="light"/></span><p className="dc-eyebrow">A little space. A lot of possibility.</p><h1>Give your idea<br/>a canvas.</h1><p>Add your first screen. Arrange text, images, and shapes.<br/>Make something that feels like you.</p><button className="dc-download" onClick={() => setAddBoardOpen(true)}><Plus size={18}/>Add your first artboard</button><button className="dc-text-action" onClick={() => { const study = editorialStudy(); commit(study); setBoardId(study.artboards[0].id); initialFit.current = true; fit(study.artboards); }}>Or explore an editable design study <span>↗</span></button><button className="dc-text-action" onClick={() => { const study = businessDesign(); commit(study); setBoardId(study.artboards[0].id); initialFit.current = true; fit(study.artboards); }}>Explore a business design</button><small>Your website pages stay in Build.</small></div>}
          {selected.length > 1 && <div className="dc-selection-toolbar"><span>{selected.length} selected</span><IconButton icon={Stack} label="Group selection (Ctrl/⌘ G)" onClick={() => groupSelection()}>Group</IconButton><IconButton icon={Selection} label="Ungroup selection (Ctrl/⌘ Shift G)" onClick={() => groupSelection(true)}>Ungroup</IconButton><IconButton icon={Copy} label="Duplicate selected layers" onClick={duplicateSelection}/><IconButton icon={Trash} label="Delete selected layers" onClick={() => change(design => removeLayers(design, selected))}/></div>}
        </div>
        <div className="dc-canvas-footer"><div className="dc-footer-hint"><span className="dc-status-dot"/>{document.artboards.length ? <span>{selected.length ? selected.length + ' selected' : 'Click a layer to edit'}<small>Hold Space to pan · Shift + click to select more</small></span> : <span>Your next idea starts here.</span>}</div><div className="dc-view-controls"><IconButton icon={Magnet} label="Snap to edges and centers" active={snapping} onClick={() => setSnapping(value => !value)}/><span className="dc-view-divider"/><IconButton icon={Minus} label="Zoom out" onClick={() => zoomTo(view.zoom / 1.25)}/><select aria-label="Canvas zoom" value={Math.max(0.1, Math.round(view.zoom * 1000) / 10)} onChange={event => zoomTo(Number(event.target.value) / 100)}>{[...new Set([Math.max(0.1, Math.round(view.zoom * 1000) / 10),25,50,75,100,150,200])].sort((a,b) => a-b).map(value => <option key={value} value={value}>{value}%</option>)}</select><IconButton icon={Plus} label="Zoom in" onClick={() => zoomTo(view.zoom * 1.25)}/><IconButton icon={ArrowsOut} label="Fit all artboards" disabled={!document.artboards.length} onClick={() => fit()}/></div></div>
      </section>
      <aside className={'dc-right-panel' + (mobilePanel === 'properties' ? ' mobile-open' : '')} aria-label="Design properties"><div className="dc-mobile-panel-heading"><strong>Properties</strong><IconButton icon={X} label="Close properties panel" onClick={() => setMobilePanel(null)}/></div><DesignInspector document={document} layer={selectedLayer} board={board} selectionCount={selected.length} update={updateSelected} updateBoard={patch => board && change(design => updateArtboard(design, board.id, patch))} align={alignment => change(design => alignLayers(design, selected, alignment))} duplicate={duplicateSelection} remove={() => change(design => removeLayers(design, selected))} order={direction => change(design => reorderLayers(design, selected, direction))} saveColor={() => { setStyleName('My color'); setStyleDialog('color'); }} saveType={() => { setStyleName('My typography'); setStyleDialog('type'); }} removeBoard={() => { if (board) { change(design => removeArtboards(design, [board.id])); setSelected([]); } }}/></aside>
    </div>
    <div className="dc-mobile-nav"><IconButton icon={ArrowUUpLeft} label="Undo on mobile" disabled={!history.past.length} onClick={() => historyMove('undo')}/><IconButton icon={ArrowUUpRight} label="Redo on mobile" disabled={!history.future.length} onClick={() => historyMove('redo')}/><IconButton icon={Stack} label="Open layers panel" active={mobilePanel === 'layers'} onClick={() => setMobilePanel(value => value === 'layers' ? null : 'layers')}>Layers</IconButton><IconButton icon={SlidersHorizontal} label="Open properties panel" active={mobilePanel === 'properties'} onClick={() => setMobilePanel(value => value === 'properties' ? null : 'properties')}>Properties</IconButton></div>
    {message && <div className="dc-message" role="status"><span>{message}</span><IconButton icon={X} label="Dismiss canvas message" onClick={() => setMessage('')}/></div>}
    <input ref={imageInput} aria-label="Upload design image" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importImage(file); }}/>
    {addBoardOpen && <Dialog title="A screen for your idea" close={() => setAddBoardOpen(false)}><p className="dc-dialog-intro">Choose a starting size. You can resize and rename it anytime.</p><div className="dc-preset-grid">{presets.map((preset,index) => <button key={preset.name} className={boardPreset === index ? 'is-active' : ''} aria-pressed={boardPreset === index} onClick={() => { setBoardPreset(index); setBoardName(preset.name); setBoardWidth(preset.width); setBoardHeight(preset.height); }}>{preset.name === 'Mobile' ? <DeviceMobile size={22}/> : <Monitor size={22}/>}<strong>{preset.name}</strong><small>{preset.width} × {preset.height}</small></button>)}</div><TextField label="New artboard name" value={boardName} onChange={setBoardName}/><div className="dc-field-grid"><NumberField label="New artboard width" value={boardWidth} min={1} max={12000} onChange={setBoardWidth}/><NumberField label="New artboard height" value={boardHeight} min={1} max={12000} onChange={setBoardHeight}/></div>{document.artboards.length >= MAX_ARTBOARDS && <p role="alert">This design has reached its {MAX_ARTBOARDS} artboard limit.</p>}<footer><button onClick={() => setAddBoardOpen(false)}>Cancel</button><button className="primary" disabled={document.artboards.length >= MAX_ARTBOARDS} onClick={createBoard}>Create artboard</button></footer></Dialog>}
    {textEditing && <Dialog title="Edit your text" close={() => setTextEditing(null)}><label className="dc-field"><span>Your words</span><textarea autoFocus rows={6} value={textDraft} maxLength={20000} onChange={event => setTextDraft(event.target.value)}/></label><footer><button onClick={() => setTextEditing(null)}>Cancel</button><button className="primary" onClick={() => { change(design => updateLayer(design, textEditing, { text: textDraft })); setTextEditing(null); }}>Apply text</button></footer></Dialog>}
    {styleDialog && <Dialog title={styleDialog === 'color' ? 'Save a reusable color' : 'Save a reusable type style'} close={() => setStyleDialog(null)}><p>Apply this style to other layers. Changes in the Styles panel update all layers that use it.</p><TextField label="Style name" value={styleName} onChange={setStyleName}/><footer><button onClick={() => setStyleDialog(null)}>Cancel</button><button className="primary" onClick={addStyle}>Save style</button></footer></Dialog>}
    {exportOpen && <Dialog title="Take your design with you." close={() => { if (!exporting) setExportOpen(false); }} wide><p className="dc-dialog-intro">Keep an editable backup, or share a visual snapshot of your artboards.</p><div className="dc-export-options"><article><DownloadSimple size={26}/><h3>Editable APL</h3><p>Both Design and Build, including images and styles. Import it to continue editing.</p><button disabled={exporting} onClick={() => void exportDesign('apl')}>Download APL backup</button></article><article><FilePng size={26}/><h3>Artboard PNG</h3><p>Full-size images, without editor controls. Multiple artboards download as a ZIP.</p><label className="dc-field"><span>PNG artboards</span><select value={exportScope} onChange={event => setExportScope(event.target.value)}><option value="all">All artboards</option><option value="selected">Current artboard</option></select></label><label className="dc-field"><span>PNG resolution</span><select value={exportScale} onChange={event => setExportScale(Number(event.target.value))}><option value={1}>1× / Original size</option><option value={2}>2× / Double size</option></select></label><button disabled={exporting || !board} onClick={() => void exportDesign('png')}>Download PNG</button></article><article><FilePdf size={26}/><h3>Visual PDF</h3><p>One page per artboard, in order. A visual handoff that can be shared or printed.</p><button disabled={exporting || !board} onClick={() => void exportDesign('pdf')}>Download PDF</button></article></div>{exportError && <p role="alert" className="dc-export-error">{exportError}</p>}{exporting && <p role="status">Preparing your download…</p>}<p className="dc-small-note">PNG and PDF are visual files. APL keeps the editable layers. Use Convert to website to review a responsive page with real links and a contact form.</p></Dialog>}
    {help && <Dialog title="A canvas, without the guesswork." close={() => setHelp(false)} wide><div className="dc-guide-grid"><article><span>01 / Start with a screen</span><h3>Add an artboard.</h3><p>Pick Desktop, Mobile, or your own size. Add several screens to explore a design together.</p></article><article><span>02 / Make it yours</span><h3>Add something. Then select it.</h3><p>Use Text, Shape, Frame, or Image. Drag to move, pull the handles to resize, and use Properties for precise details.</p></article><article><span>03 / Put things in order</span><h3>Layers keep you organized.</h3><p>Shift + click selects more. Group a selection to move it together. Frames clip their content. Use the parent control to put layers inside a frame.</p></article><article><span>04 / Keep your work</span><h3>Save locally. Download a backup.</h3><p>Your design saves in this browser. APL backups preserve both modes; PNG and PDF let you share artboards. Clearing browser data removes local projects.</p></article></div><dl className="dc-shortcuts"><div><dt>Select / Pan</dt><dd><kbd>V</kbd> / <kbd>H</kbd> or hold <kbd>Space</kbd></dd></div><div><dt>Text / Rectangle / Ellipse / Frame</dt><dd><kbd>T</kbd> / <kbd>R</kbd> / <kbd>O</kbd> / <kbd>F</kbd></dd></div><div><dt>Undo / Redo</dt><dd><kbd>Ctrl/⌘ Z</kbd> / <kbd>Ctrl/⌘ Shift Z</kbd></dd></div><div><dt>Duplicate / Group / Ungroup</dt><dd><kbd>Ctrl/⌘ D</kbd> / <kbd>Ctrl/⌘ G</kbd> / <kbd>Ctrl/⌘ Shift G</kbd></dd></div><div><dt>Move precisely</dt><dd>Arrow keys / <kbd>Shift</kbd> for 10 px</dd></div><div><dt>Zoom / Pan</dt><dd><kbd>Ctrl/⌘</kbd> + wheel / wheel</dd></div></dl><p className="dc-small-note">Design is a freeform visual document. Build contains your working website pages. Convert to website guides you through a responsive layout, connections, warnings, and comparison before adding a page to Build.</p><footer><button className="primary" onClick={() => setHelp(false)}>Let's make something</button></footer></Dialog>}
  </main>;
}
