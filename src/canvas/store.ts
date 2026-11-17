import { useSyncExternalStore } from 'react';
import type { Breakpoint } from '../doc/breakpoints';
import { syncComponents } from '../doc/components';
import { DocError } from '../doc/ops';
import type { SiteDoc } from '../doc/schema';
import { applyViewChange, viewDoc } from './breakpointView';

export type Tool = 'move' | 'hand' | 'frame' | 'rect' | 'ellipse' | 'text' | 'line' | 'arrow' | 'polygon' | 'star' | 'pen' | 'pencil';
export interface Viewport { x: number; y: number; zoom: number }
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EditorState {
  /** The document as edited at the current breakpoint (overrides applied on Tablet / Mobile). */
  doc: SiteDoc;
  /** The stored document. Identical to `doc` on Desktop. */
  real: SiteDoc;
  breakpoint: Breakpoint;
  pageId: string;
  selection: string[];
  hover: string | null;
  tool: Tool;
  viewport: Viewport;
  editingTextId: string | null;
  saveStatus: SaveStatus;
  notice: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;
const HISTORY_LIMIT = 100;

/**
 * Editor state container with gesture-aware undo history.
 * Documents are immutable, so history entries are cheap structural snapshots.
 */
export class EditorStore {
  private state: EditorState;
  private listeners = new Set<() => void>();
  private past: SiteDoc[] = [];
  private future: SiteDoc[] = [];
  private gestureBase: SiteDoc | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(doc: SiteDoc) {
    this.state = {
      doc, real: doc, breakpoint: 'desktop', pageId: doc.pages[0].id, selection: [], hover: null, tool: 'move',
      viewport: { x: 80, y: 80, zoom: 0.5 }, editingTextId: null, saveStatus: 'idle', notice: null,
      canUndo: false, canRedo: false,
    };
  }

  getState = (): EditorState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  /** Patch editor state. To change the document use `commit` or `load`. */
  set(patch: Partial<Omit<EditorState, 'doc' | 'real' | 'breakpoint'>>): void { this.write(patch); }

  private write(patch: Partial<EditorState>): void {
    this.state = { ...this.state, ...patch, canUndo: false, canRedo: this.future.length > 0 };
    this.state.canUndo = this.past.length > 0 || this.gestureChanged();
    for (const listener of this.listeners) listener();
  }
  /** Replace the stored document and refresh the breakpoint view. */
  private put(real: SiteDoc, patch: Partial<EditorState> = {}): void {
    this.write({ ...patch, real, doc: viewDoc(real, patch.breakpoint ?? this.state.breakpoint) });
  }

  private gestureChanged(): boolean { return this.gestureBase !== null && this.gestureBase !== this.state.real; }

  /** Replace the whole document (open another site). Clears history. */
  load(doc: SiteDoc): void {
    this.past = []; this.future = []; this.gestureBase = null;
    this.put(doc, { pageId: doc.pages[0].id, selection: [], hover: null, editingTextId: null, tool: 'move' });
  }

  /** Design for another screen size. Edits on Tablet / Mobile are stored as overrides for that size. */
  setBreakpoint(breakpoint: Breakpoint): void {
    if (breakpoint === this.state.breakpoint) return;
    this.endGesture();
    this.put(this.state.real, { breakpoint, editingTextId: null, hover: null });
  }

  /**
   * Apply a document change. Inside a gesture (drag/resize/typing) changes are
   * coalesced into one undo step; `silent` changes (measured-size sync) never
   * create history entries.
   */
  commit(change: (doc: SiteDoc) => SiteDoc, options: { silent?: boolean; selection?: string[] } = {}): boolean {
    const { doc, real, breakpoint } = this.state;
    let next: SiteDoc;
    try { next = syncComponents(doc, change(doc)); }
    catch (error) {
      if (error instanceof DocError) { this.notify(error.message); return false; }
      throw error;
    }
    if (next === doc) { if (options.selection) this.set({ selection: options.selection }); return true; }
    const nextReal = breakpoint === 'desktop' ? next : applyViewChange(real, doc, next, breakpoint);
    if (!options.silent && this.gestureBase === null) {
      this.past.push(real);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
      this.future = [];
    }
    this.put(nextReal, options.selection ? { selection: options.selection } : {});
    return true;
  }

  beginGesture(): void { if (this.gestureBase === null) this.gestureBase = this.state.real; }
  endGesture(): void {
    if (this.gestureBase === null) return;
    if (this.gestureBase !== this.state.real) {
      this.past.push(this.gestureBase);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
      this.future = [];
    }
    this.gestureBase = null;
    this.write({});
  }
  /** Abort a gesture, restoring the document as it was before it started. */
  cancelGesture(): void {
    if (this.gestureBase === null) return;
    const base = this.gestureBase;
    this.gestureBase = null;
    this.put(base, { selection: this.validSelection(base, this.state.selection) });
  }
  get inGesture(): boolean { return this.gestureBase !== null; }

  undo(): void {
    this.endGesture();
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.state.real);
    this.restore(previous);
  }
  redo(): void {
    this.endGesture();
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.state.real);
    this.restore(next);
  }
  private restore(doc: SiteDoc): void {
    const pageId = doc.pages.some(page => page.id === this.state.pageId) ? this.state.pageId : doc.pages[0].id;
    this.put(doc, { pageId, selection: this.validSelection(doc, this.state.selection), editingTextId: null });
  }
  private validSelection(doc: SiteDoc, selection: string[]): string[] { return selection.filter(id => doc.nodes[id]); }

  select(ids: string[]): void { this.set({ selection: ids, editingTextId: null }); }
  notify(message: string): void {
    clearTimeout(this.noticeTimer);
    this.set({ notice: message });
    this.noticeTimer = setTimeout(() => this.set({ notice: null }), 4000);
  }
}

export function useEditor<T>(store: EditorStore, selector: (state: EditorState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
