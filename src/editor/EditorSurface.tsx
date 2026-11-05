import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { Puck, createUsePuck, type UiState } from '@puckeditor/core';
import '@puckeditor/core/no-external.css';
import { config, createConfig, toEditor, fromEditor, type EditorData } from './config';
import { DocumentHistory } from './history';
import LayoutOutline from './LayoutOutline';
import type { Project } from '../project/schema';
import { Code, Stack } from '../design/icons';

type HistoryControls = { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean; name: string };
const HistoryContext = createContext<HistoryControls>(null!);
const ActionsContext = createContext<{ components?: () => void; code?: (nodeId?: string) => void }>({});
const useEditor = createUsePuck<typeof config>();
function useHistoryShortcuts(doc: Document | undefined) {
  const controls = useContext(HistoryContext);
  useEffect(() => {
    if (!doc) return;
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.getModifierState('AltGraph')) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (key === 'y' || event.shiftKey) controls.redo(); else controls.undo();
    };
    doc.addEventListener('keydown', handler, true);
    return () => doc.removeEventListener('keydown', handler, true);
  }, [doc, controls]);
}
function EditorHeader() {
  const h = useContext(HistoryContext);
  const actions = useContext(ActionsContext);
  const selectedId = useEditor(state => state.selectedItem?.props.id);
  const dispatch = useEditor(s => s.dispatch);
  const left = useEditor(s => s.appState.ui.leftSideBarVisible);
  const right = useEditor(s => s.appState.ui.rightSideBarVisible);
  const count = useEditor(s => s.appState.data.root.props?.body?.length ?? 0);
  useHistoryShortcuts(document);
  return <header className="editor-toolbar">
    <button aria-label="Toggle left sidebar" aria-pressed={left} onClick={() => dispatch({ type: 'setUi', ui: { leftSideBarVisible: !left } })}>Blocks</button>
    <h2>{h.name} <span>/</span></h2>
    <button disabled={count >= 60} onClick={() => { dispatch({ type: 'insert', componentType: 'Section', destinationIndex: count, destinationZone: 'root:body' }); dispatch({ type: 'setUi', ui: { itemSelector: { index: count, zone: 'root:body' } } }); }}>Add layout</button>
    <button disabled={!h.canUndo} onClick={h.undo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
    <button disabled={!h.canRedo} onClick={h.redo} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
    {actions.components && <button onClick={actions.components}><Stack size={17}/>Components</button>}
    {actions.code && <button onClick={() => actions.code?.(selectedId)}><Code size={17}/>Copy code</button>}
    <button aria-label="Toggle right sidebar" aria-pressed={right} onClick={() => dispatch({ type: 'setUi', ui: { rightSideBarVisible: !right } })}>Settings</button>
  </header>;
}
function EditorFrame({ children, document: doc }: { children: ReactNode; document?: Document }) {
  useHistoryShortcuts(doc);
  const selectedId = useEditor(state => state.selectedItem?.props.id);
  useEffect(() => {
    if (!doc?.defaultView || !selectedId) return;
    const frame = doc.defaultView.requestAnimationFrame(() => {
      doc.querySelector<HTMLElement>('[data-puck-component="' + selectedId + '"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => doc.defaultView?.cancelAnimationFrame(frame);
  }, [doc, selectedId]);
  return <>{children}</>;
}
const overrides = { header: EditorHeader, iframe: EditorFrame, outline: LayoutOutline };
const viewports = [{ width: 390, height: 'auto' as const, label: 'Mobile' }, { width: 768, height: 'auto' as const, label: 'Tablet' }, { width: 1280, height: 'auto' as const, label: 'Desktop' }];
const permissions = { duplicate: false };

export default function EditorSurface({ project, pageId, onChange, openComponents, copyCode }: { project: Project; pageId: string; onChange: (data: EditorData, convert: typeof fromEditor) => void; openComponents?: () => void; copyCode?: (nodeId?: string) => void }) {
  const [history] = useState(() => new DocumentHistory(toEditor(project, pageId)));
  const [seed, setSeed] = useState(() => ({ revision: 0, data: history.current }));
  const [, refresh] = useReducer(n => n + 1, 0);
  const latest = useRef(onChange); latest.current = onChange;
  const ui = useRef<Partial<UiState>>({});
  const changed = useCallback((data: EditorData) => {
    if (history.record(data)) { refresh(); latest.current(data, fromEditor); }
  }, [history]);
  const restore = useCallback((direction: -1 | 1) => {
    const data = history.move(direction);
    if (!data) return;
    // Remount from our immutable snapshot so library indexes cannot retain stale props.
    setSeed(previous => ({ revision: previous.revision + 1, data }));
    latest.current(data, fromEditor);
  }, [history]);
  return <ActionsContext.Provider value={{ components: openComponents, code: copyCode }}><HistoryContext.Provider value={{ name: project.pages.find(page => page.id === pageId)!.name, canUndo: history.canUndo, canRedo: history.canRedo, undo: () => restore(-1), redo: () => restore(1) }}>
    <Puck key={seed.revision} config={createConfig(project, pageId)} data={seed.data} onChange={changed}
      onAction={(_, next) => { ui.current = { leftSideBarVisible: next.ui.leftSideBarVisible, rightSideBarVisible: next.ui.rightSideBarVisible, viewports: next.ui.viewports }; }}
      ui={ui.current} height="calc(100dvh - 174px)" overrides={overrides} viewports={viewports} permissions={permissions}/>
  </HistoryContext.Provider></ActionsContext.Provider>;
}
