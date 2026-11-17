import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSiteDoc, newId } from '../doc/ops';
import { lumenSample } from '../doc/samples';
import { deleteSelection, insertEmbed, insertImage, pruneAssets, replaceImage } from './actions';
import { copyPayload, parsePayload, pastePayload, pasteTarget, pasteText, type ClipboardPayload } from './arrange';
import { Canvas, type CanvasApi } from './Canvas';
import { designCode, type DesignCode } from './code';
import { CodeDialog } from './CodeDialog';
import { buildCommands, commandFor, eventCombo } from './commands';
import { CommandPalette } from './CommandPalette';
import { DesignPanel } from './DesignPanel';
import { docFonts, loadFonts } from './fonts';
import { insertDesign } from './insertDesign';
import { readImageFile } from './images';
import { LayersPanel } from './LayersPanel';
import type { LibraryItem, Theme } from '../library/catalog';
import { Preview } from './Preview';
import { autoVersion, lastSiteId, listSites, loadSite, saveSite } from './storage';
import { VersionsDialog } from './VersionsDialog';
import { EditorStore, useEditor } from './store';
import { Toolbar, type SiteMenuActions } from './Toolbar';
import './editor.css';

// The library (catalog + browser) loads the first time it is opened.
const LibraryPanel = lazy(() => import('./LibraryPanel').then(module => ({ default: module.LibraryPanel })));

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export default function Editor() {
  const [store, setStore] = useState<EditorStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = lastSiteId();
      const doc = (id ? await loadSite(id).catch(() => null) : null) ?? createSiteDoc('My first site');
      if (!cancelled) setStore(new EditorStore(doc));
    })().catch(() => !cancelled && setError('Your sites could not be opened from this browser’s storage.'));
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap' });
    document.head.append(link);
    document.title = 'APL Editor';
    return () => link.remove();
  }, []);
  if (error) return <div className="ed-boot" role="alert">{error}</div>;
  if (!store) return <div className="ed-boot" role="status">Opening your site…</div>;
  return <EditorShell store={store} />;
}

function EditorShell({ store }: { store: EditorStore }) {
  const canvas = useRef<CanvasApi>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const clipboard = useRef<ClipboardPayload | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [palette, setPalette] = useState(false);
  const [library, setLibrary] = useState(false);
  const [code, setCode] = useState<{ title: string; code: DesignCode } | null>(null);
  const [versions, setVersions] = useState(false);
  const real = useEditor(store, state => state.real);
  const doc = useEditor(store, state => state.doc);
  const pageId = useEditor(store, state => state.pageId);
  const notice = useEditor(store, state => state.notice);
  const measure = useCallback((id: string) => canvas.current?.measureWorld(id) ?? null, []);

  // Load the Google Fonts the site uses.
  useEffect(() => { loadFonts(docFonts(doc)); }, [doc]);

  // ── Autosave ───────────────────────────────────────────────────────────────
  const pending = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = store.getState().real;
    const flush = async () => {
      const current = store.getState().real;
      try { await saveSite(pruneAssets(current)); pending.current = store.getState().real !== current; store.set({ saveStatus: 'saved' }); void autoVersion(pruneAssets(current)).catch(() => undefined); }
      catch { pending.current = false; store.set({ saveStatus: 'error' }); store.notify('Your latest changes could not be saved in this browser. Keep this tab open and try again.'); }
    };
    const unsubscribe = store.subscribe(() => {
      const current = store.getState().real;
      if (current === last) return;
      last = current;
      pending.current = true;
      if (store.getState().saveStatus !== 'saving') store.set({ saveStatus: 'saving' });
      clearTimeout(timer);
      timer = setTimeout(flush, 500);
    });
    const beforeUnload = (event: BeforeUnloadEvent) => { if (pending.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    void saveSite(pruneAssets(last)).then(() => store.set({ saveStatus: 'saved' }), () => store.set({ saveStatus: 'error' }));
    return () => { unsubscribe(); clearTimeout(timer); window.removeEventListener('beforeunload', beforeUnload); if (pending.current) void flush(); };
  }, [store]);

  // ── Images & pasted content ────────────────────────────────────────────────
  /** Container + world point for new content: the selected frame (or paste target), centered on screen. */
  const placement = useCallback(() => {
    const state = store.getState();
    const page = state.doc.pages.find(value => value.id === state.pageId)!;
    const { parentId } = pasteTarget(state.doc, state.selection, page.rootId);
    const container = canvas.current?.measureWorld(parentId) ?? { x: 0, y: 0, w: 1440, h: 900 };
    return { containerId: parentId, container, at: canvas.current?.centerWorld() ?? { x: container.x + container.w / 2, y: container.y + 200 } };
  }, [store]);

  const addImages = useCallback(async (files: File[], at?: { x: number; y: number }) => {
    const target = placement();
    let point = at ?? target.at;
    for (const file of files) {
      try {
        const asset = await readImageFile(file);
        if (replaceTarget.current) { replaceImage(store, replaceTarget.current, asset); replaceTarget.current = null; return; }
        insertImage(store, asset, target.containerId, target.container, point);
        point = { x: point.x + 24, y: point.y + 24 };
      } catch (error) { store.notify(error instanceof Error ? error.message : 'That image could not be added.'); }
    }
  }, [placement, store]);
  const pickImage = useCallback((replaceId?: string) => { replaceTarget.current = replaceId ?? null; fileInput.current?.click(); }, []);

  // ── Clipboard (real copy/cut/paste events; works across tabs and sites) ────
  const copy = useCallback((event?: ClipboardEvent) => {
    const { doc: current, selection } = store.getState();
    const payload = copyPayload(current, selection);
    if (!payload) return false;
    clipboard.current = payload;
    const text = JSON.stringify(payload);
    if (event?.clipboardData) { event.clipboardData.setData('text/plain', text); event.preventDefault(); }
    else void navigator.clipboard?.writeText(text).catch(() => undefined);
    return true;
  }, [store]);
  const pasteFromText = useCallback((text: string) => {
    const payload = parsePayload(text);
    if (payload) { pastePayload(store, payload); return; }
    const target = placement();
    pasteText(store, text, target.containerId, target.container, target.at);
  }, [placement, store]);
  const pasteFromMenu = useCallback(async () => {
    try { const text = await navigator.clipboard.readText(); if (text) { pasteFromText(text); return; } } catch { /* permission denied: use the in-app copy */ }
    if (clipboard.current) pastePayload(store, clipboard.current);
    else store.notify('Use Ctrl+V to paste from your clipboard.');
  }, [pasteFromText, store]);
  useEffect(() => {
    const blocked = (event: Event) => isTyping(event.target) || store.getState().editingTextId !== null || previewing || palette || library || code !== null || versions;
    const onCopy = (event: ClipboardEvent) => { if (!blocked(event)) copy(event); };
    const onCut = (event: ClipboardEvent) => { if (!blocked(event) && copy(event)) deleteSelection(store); };
    const onPaste = (event: ClipboardEvent) => {
      if (blocked(event) || !event.clipboardData) return;
      const images = [...event.clipboardData.files].filter(file => file.type.startsWith('image/'));
      const text = event.clipboardData.getData('text/plain');
      event.preventDefault();
      if (images.length) void addImages(images);
      else if (text) pasteFromText(text);
    };
    window.addEventListener('copy', onCopy); window.addEventListener('cut', onCut); window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('copy', onCopy); window.removeEventListener('cut', onCut); window.removeEventListener('paste', onPaste); };
  }, [addImages, copy, pasteFromText, palette, previewing, library, code, versions, store]);

  // ── Design library ─────────────────────────────────────────────────────────
  const insertFromLibrary = useCallback((item: LibraryItem, theme: Theme) => {
    // Library designs carry their own tablet and phone settings, so they are always added to the base design.
    const breakpoint = store.getState().breakpoint;
    if (breakpoint !== 'desktop') store.setBreakpoint('desktop');
    const target = placement();
    const inserted = insertDesign(store, item, theme, { x: target.at.x - target.container.x - 120, y: target.at.y - target.container.y - 60 });
    if (breakpoint !== 'desktop') store.setBreakpoint(breakpoint);
    if (!inserted) return;
    setLibrary(false);
    store.notify(item.kind === 'page' ? `Added the “${item.name}” page. Every layer is editable; press Preview to see it move and resize.` : `Added “${item.name}”.`);
    // Bring new sections into view once they have been laid out.
    if (item.kind !== 'element') requestAnimationFrame(() => requestAnimationFrame(() => (item.kind === 'page' ? canvas.current?.fitPage() : canvas.current?.zoomToSelection())));
  }, [placement, store]);

  /** Show copy-ready code for a layer (default: the selection, or the whole page). */
  const showCode = useCallback((id?: string) => {
    const state = store.getState();
    const page = state.real.pages.find(value => value.id === state.pageId) ?? state.real.pages[0];
    const node = state.real.nodes[id ?? state.selection[0] ?? page.rootId];
    if (node) setCode({ title: node.name, code: designCode(state.real, node.id, node.name) });
  }, [store]);

  const exportSite = useCallback(async () => {
    try {
      const { downloadSite } = await import('./exportSite');
      const name = await downloadSite(pruneAssets(store.getState().real));
      store.notify(`Downloaded ${name}. Unzip it and open index.html, or upload the folder to any web host.`);
    } catch { store.notify('The website could not be exported. Please try again.'); }
  }, [store]);

  // ── Site menu ──────────────────────────────────────────────────────────────
  const menu: SiteMenuActions = useMemo(() => ({
    newSite: () => store.load(createSiteDoc('Untitled site')),
    openSample: () => store.load({ ...lumenSample(), id: newId(), name: 'Lumen Studio (sample)' }),
    openSite: async id => { const site = await loadSite(id); if (site) store.load(site); else store.notify('That site could not be opened.'); },
    listSites,
    openVersions: () => setVersions(true),
  }), [store]);

  // ── Commands & keyboard shortcuts ──────────────────────────────────────────
  const commands = useMemo(() => buildCommands({
    store, measure, canvas: () => canvas.current, pickImage: () => pickImage(),
    openPreview: () => setPreviewing(true), openPalette: () => setPalette(true), openLibrary: () => setLibrary(true), copyCode: () => showCode(), exportSite: () => void exportSite(),
    openVersions: () => setVersions(true), insertEmbed: kind => { const target = placement(); insertEmbed(store, kind, target.containerId, target.container, target.at); },
    copy: () => { if (copy()) store.notify('Copied.'); }, cut: () => { if (copy()) deleteSelection(store); }, paste: () => void pasteFromMenu(),
  // Page commands are rebuilt when pages change.
  }), [store, measure, pickImage, copy, pasteFromMenu, showCode, exportSite, placement, doc.pages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || store.getState().editingTextId || previewing || palette || library || code !== null || versions) return;
      const command = commandFor(commands, eventCombo(event));
      if (!command) return;
      event.preventDefault();
      command.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commands, palette, previewing, library, code, versions, store]);

  return (
    <div className="ed-app">
      <Toolbar store={store} canvas={canvas} onImage={() => pickImage()} onEmbed={() => commands.find(command => command.id === 'embed-video')?.run()} onPreview={() => setPreviewing(true)} onPalette={() => setPalette(true)} onLibrary={() => setLibrary(true)} onExport={() => void exportSite()} menu={menu} />
      <div className="ed-main">
        <aside className="ed-left" aria-label="Pages and layers"><LayersPanel store={store} /></aside>
        <main className="ed-center"
          onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
          onDrop={event => {
            const files = [...event.dataTransfer.files].filter(file => file.type.startsWith('image/'));
            if (!files.length) return;
            event.preventDefault();
            void addImages(files, canvas.current?.clientToWorld(event.clientX, event.clientY));
          }}>
          <Canvas ref={canvas} store={store} />
          {notice && <div className="ed-toast" role="alert">{notice}</div>}
        </main>
        <aside className="ed-right" aria-label="Design"><DesignPanel store={store} measure={measure} onReplaceImage={id => pickImage(id)} onCode={showCode} /></aside>
      </div>
      <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple
        onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; void addImages(replaceTarget.current ? files.slice(0, 1) : files); }} />
      {previewing && <Preview doc={real} pageId={pageId} onClose={() => setPreviewing(false)} />}
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {code && <CodeDialog title={code.title} code={code.code} onClose={() => setCode(null)} />}
      {versions && <VersionsDialog store={store} onClose={() => setVersions(false)} />}
      {library && <Suspense fallback={null}><LibraryPanel onInsert={insertFromLibrary} onClose={() => setLibrary(false)} /></Suspense>}
    </div>
  );
}
