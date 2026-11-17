import { useEffect, useRef, useState } from 'react';
import type { CanvasApi } from './Canvas';
import { BREAKPOINT_WIDTH, BREAKPOINTS } from '../doc/breakpoints';
import { IconButton, Segmented } from './controls';
import { ArrowUUpLeft, ArrowUUpRight, CaretDown, Circle, Command, Cursor, DeviceMobile, DeviceTablet, FrameCorners, Hand, Image, LineSegment, Monitor, PencilSimple, PenNib, Play, Polygon, Square, SquaresFour, Star, TextT, ArrowUpRight, Code } from './icons';
import type { SiteSummary } from './storage';
import { useEditor, type EditorStore, type Tool } from './store';

interface ToolItem { tool: Tool; label: string; key: string; icon: React.ReactNode }
const MOVE: ToolItem = { tool: 'move', label: 'Move', key: 'V', icon: <Cursor size={17} /> };
const FRAME: ToolItem = { tool: 'frame', label: 'Frame', key: 'F', icon: <FrameCorners size={17} /> };
const TEXT: ToolItem = { tool: 'text', label: 'Text', key: 'T', icon: <TextT size={17} /> };
const HAND: ToolItem = { tool: 'hand', label: 'Hand', key: 'H', icon: <Hand size={17} /> };
/** Shape and drawing tools share one toolbar slot each, as in Figma. */
const SHAPES: ToolItem[] = [
  { tool: 'rect', label: 'Rectangle', key: 'R', icon: <Square size={17} /> },
  { tool: 'line', label: 'Line', key: 'L', icon: <LineSegment size={17} /> },
  { tool: 'arrow', label: 'Arrow', key: 'Shift+L', icon: <ArrowUpRight size={17} /> },
  { tool: 'ellipse', label: 'Ellipse', key: 'O', icon: <Circle size={17} /> },
  { tool: 'polygon', label: 'Polygon', key: 'Y', icon: <Polygon size={17} /> },
  { tool: 'star', label: 'Star', key: 'S', icon: <Star size={17} /> },
];
const DRAWING: ToolItem[] = [
  { tool: 'pen', label: 'Pen', key: 'P', icon: <PenNib size={17} /> },
  { tool: 'pencil', label: 'Pencil', key: 'Shift+P', icon: <PencilSimple size={17} /> },
];

/** One toolbar slot for several tools: the button picks the last used tool, the caret opens the list. */
function ToolGroup({ store, tool, items, name }: { store: EditorStore; tool: Tool; items: ToolItem[]; name: string }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(items[0].tool);
  const ref = useDismiss(open, () => setOpen(false));
  const active = items.find(item => item.tool === tool);
  useEffect(() => { if (active) setLast(active.tool); }, [active]);
  const shown = active ?? items.find(item => item.tool === last)!;
  return (
    <div className="ed-menu ed-tool-group" ref={ref}>
      <IconButton label={shown.label} shortcut={shown.key} active={!!active} onClick={() => store.set({ tool: shown.tool })}>{shown.icon}</IconButton>
      <button type="button" className="ed-tool-caret" aria-label={name} title={name} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><CaretDown size={9} weight="bold" /></button>
      {open && (
        <div className="ed-menu-list" role="menu">
          {items.map(item => (
            <button key={item.tool} role="menuitem" onClick={() => { store.set({ tool: item.tool }); setOpen(false); }}>
              <span className="ed-tool-item">{item.icon} {item.label}</span><kbd>{item.key}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface SiteMenuActions {
  newSite(): void;
  openSample(): void;
  openSite(id: string): void;
  listSites(): Promise<SiteSummary[]>;
  openVersions(): void;
}

export function Toolbar({ store, canvas, onImage, onEmbed, onPreview, onPalette, onLibrary, onExport, menu }: {
  store: EditorStore; canvas: React.RefObject<CanvasApi | null>; onImage: () => void; onEmbed: () => void; onPreview: () => void; onPalette: () => void; onLibrary: () => void; onExport: () => void; menu: SiteMenuActions;
}) {
  const tool = useEditor(store, state => state.tool);
  const zoom = useEditor(store, state => state.viewport.zoom);
  const canUndo = useEditor(store, state => state.canUndo);
  const canRedo = useEditor(store, state => state.canRedo);
  const saveStatus = useEditor(store, state => state.saveStatus);
  const breakpoint = useEditor(store, state => state.breakpoint);
  const siteName = useEditor(store, state => state.doc.name);
  const pageName = useEditor(store, state => (state.doc.pages.find(page => page.id === state.pageId) ?? state.doc.pages[0]).name);

  return (
    <header className="ed-toolbar">
      <div className="ed-toolbar-left">
        <SiteMenu menu={menu} />
        <div className="ed-tools" role="toolbar" aria-label="Tools">
          {[MOVE, FRAME].map(item => (
            <IconButton key={item.tool} label={item.label} shortcut={item.key} active={tool === item.tool} onClick={() => store.set({ tool: item.tool })}>{item.icon}</IconButton>
          ))}
          <ToolGroup store={store} tool={tool} items={SHAPES} name="Shape tools" />
          <ToolGroup store={store} tool={tool} items={DRAWING} name="Drawing tools" />
          {[TEXT, HAND].map(item => (
            <IconButton key={item.tool} label={item.label} shortcut={item.key} active={tool === item.tool} onClick={() => store.set({ tool: item.tool })}>{item.icon}</IconButton>
          ))}
          <IconButton label="Image" shortcut="Ctrl+Shift+K" onClick={onImage}><Image size={17} /></IconButton>
          <IconButton label="Embed video, map or code" onClick={onEmbed}><Code size={17} /></IconButton>
        </div>
        <button type="button" className="ed-btn ed-library-btn" onClick={onLibrary} title="Design library (Shift+I)"><SquaresFour size={15} /> Library</button>
      </div>
      <div className="ed-toolbar-center">
        <div className="ed-title" title={`${siteName} / ${pageName}`}><span className="ed-muted">{siteName} /</span> {pageName}</div>
        <Segmented label="Screen size to design for" value={breakpoint} onChange={value => store.setBreakpoint(value)} options={BREAKPOINTS.map(bp => [bp,
          bp === 'desktop' ? <Monitor size={15} key={bp} /> : bp === 'tablet' ? <DeviceTablet size={15} key={bp} /> : <DeviceMobile size={15} key={bp} />,
          bp === 'desktop' ? 'Design for desktop' : bp === 'tablet' ? `Design for tablet (${BREAKPOINT_WIDTH.tablet}px)` : `Design for phone (${BREAKPOINT_WIDTH.mobile}px)`] as const)} />
      </div>
      <div className="ed-toolbar-right">
        <IconButton label="Command palette" shortcut="Ctrl+K" onClick={onPalette}><Command size={16} /></IconButton>
        <IconButton label="Undo" shortcut="Ctrl+Z" disabled={!canUndo} onClick={() => store.undo()}><ArrowUUpLeft size={16} /></IconButton>
        <IconButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => store.redo()}><ArrowUUpRight size={16} /></IconButton>
        <ZoomMenu zoom={zoom} canvas={canvas} />
        <span className={'ed-save ed-save-' + saveStatus} role="status" aria-live="polite">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Not saved' : ''}
        </span>
        <button type="button" className="ed-btn" onClick={onExport} title="Download the website as files you can open or upload to any host">Export</button>
        <button type="button" className="ed-btn ed-btn-primary" onClick={onPreview} title="Preview (Ctrl+Alt+P)"><Play size={14} weight="fill" /> Preview</button>
      </div>
    </header>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return ref;
}

function ZoomMenu({ zoom, canvas }: { zoom: number; canvas: React.RefObject<CanvasApi | null> }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const run = (action: () => void) => { action(); setOpen(false); };
  return (
    <div className="ed-menu" ref={ref}>
      <button type="button" className="ed-menu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{Math.round(zoom * 100)}% <CaretDown size={10} /></button>
      {open && (
        <div className="ed-menu-list" role="menu">
          <button role="menuitem" onClick={() => run(() => canvas.current?.zoomBy(1.25))}>Zoom in <kbd>Ctrl +</kbd></button>
          <button role="menuitem" onClick={() => run(() => canvas.current?.zoomBy(0.8))}>Zoom out <kbd>Ctrl −</kbd></button>
          <button role="menuitem" onClick={() => run(() => canvas.current?.setZoom(1))}>Zoom to 100% <kbd>Ctrl 0</kbd></button>
          <button role="menuitem" onClick={() => run(() => canvas.current?.fitPage())}>Fit page <kbd>Shift 1</kbd></button>
          <button role="menuitem" onClick={() => run(() => canvas.current?.zoomToSelection())}>Zoom to selection <kbd>Shift 2</kbd></button>
        </div>
      )}
    </div>
  );
}

function SiteMenu({ menu }: { menu: SiteMenuActions }) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const ref = useDismiss(open, () => setOpen(false));
  useEffect(() => { if (open) menu.listSites().then(setSites).catch(() => setSites([])); }, [open, menu]);
  const run = (action: () => void) => { setOpen(false); action(); };
  return (
    <div className="ed-menu" ref={ref}>
      <button type="button" className="ed-logo" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title="Site menu">
        <span className="ed-logo-mark" aria-hidden="true">A</span><CaretDown size={10} />
      </button>
      {open && (
        <div className="ed-menu-list" role="menu">
          <button role="menuitem" onClick={() => run(menu.newSite)}>New blank site</button>
          <button role="menuitem" onClick={() => run(menu.openSample)}>Open sample site (Lumen Studio)</button>
          {sites.length > 0 && <div className="ed-menu-label">Recent sites</div>}
          {sites.slice(0, 8).map(site => (
            <button role="menuitem" key={site.id} onClick={() => run(() => menu.openSite(site.id))}>
              {site.name} <small>{new Date(site.updatedAt).toLocaleDateString()}</small>
            </button>
          ))}
          <div className="ed-menu-sep" />
          <button role="menuitem" onClick={() => run(menu.openVersions)}>Version history…</button>
        </div>
      )}
    </div>
  );
}
