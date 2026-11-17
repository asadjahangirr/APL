import { addPage, pathForName } from '../doc/ops';
import { createComponent, deleteSelection, duplicateSelection, nudge, selectAll, selectChildren, selectParent, toggleAutoLayout } from './actions';
import { align, copyStyle, distribute, pasteStyle, reorderSelection, selectSibling, toggleLocked, toggleVisible, ungroupSelection, wrapSelection, type Measure } from './arrange';
import type { CanvasApi } from './Canvas';
import type { EditorStore, Tool } from './store';

/**
 * Single registry for keyboard shortcuts, the command palette and menu hints.
 * Keys are written like 'mod+shift+g' (mod = Ctrl, or ⌘ on macOS).
 */
export interface Command {
  id: string;
  label: string;
  group: 'Tools' | 'Edit' | 'Select' | 'Arrange' | 'Align' | 'View' | 'Pages';
  keys?: string[];
  run: () => void;
  /** Hidden from the palette (e.g. arrow nudges). */
  hidden?: boolean;
}

export interface CommandContext {
  store: EditorStore;
  canvas: () => CanvasApi | null;
  measure: Measure;
  pickImage: () => void;
  openPreview: () => void;
  openPalette: () => void;
  openLibrary: () => void;
  copyCode?: () => void;
  exportSite?: () => void;
  openVersions?: () => void;
  insertEmbed?: (kind: 'video' | 'map' | 'code') => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
}

const CODE_KEYS: Record<string, string> = {
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Slash: '/', Backslash: '\\', Comma: ',', Period: '.',
  Escape: 'escape', Enter: 'enter', NumpadEnter: 'enter', Delete: 'delete', Backspace: 'backspace', Tab: 'tab', Space: 'space',
  ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', NumpadAdd: '=', NumpadSubtract: '-',
};

/** Normalized combo for a keyboard event, using physical keys so Alt/Shift combos work on every layout. */
export function eventCombo(event: Pick<KeyboardEvent, 'code' | 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string {
  const code = event.code ?? '';
  const base = code.startsWith('Key') ? code.slice(3).toLowerCase()
    : code.startsWith('Digit') ? code.slice(5)
    : code.startsWith('Numpad') && /\d$/.test(code) ? code.slice(-1)
    : CODE_KEYS[code] ?? event.key.toLowerCase();
  return (event.ctrlKey || event.metaKey ? 'mod+' : '') + (event.altKey ? 'alt+' : '') + (event.shiftKey ? 'shift+' : '') + base;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const KEY_LABELS: Record<string, string> = { mod: IS_MAC ? '⌘' : 'Ctrl', alt: IS_MAC ? '⌥' : 'Alt', shift: IS_MAC ? '⇧' : 'Shift', escape: 'Esc', enter: 'Enter', delete: 'Del', backspace: '⌫', tab: 'Tab', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓' };
export function formatCombo(combo: string): string {
  return combo.split('+').map(part => KEY_LABELS[part] ?? part.toUpperCase()).join(IS_MAC ? '' : '+');
}

export function buildCommands(ctx: CommandContext): Command[] {
  const { store, measure } = ctx;
  const tool = (id: Tool, label: string, key: string): Command => ({ id: 'tool.' + id, label, group: 'Tools', keys: [key], run: () => store.set({ tool: id }) });
  const nudges: Command[] = (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'] as const).flatMap(key => {
    const [dx, dy] = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
    return [
      { id: 'nudge.' + key, label: 'Nudge', group: 'Arrange' as const, keys: [key], hidden: true, run: () => nudge(store, dx, dy) },
      { id: 'nudge10.' + key, label: 'Nudge 10px', group: 'Arrange' as const, keys: ['shift+' + key], hidden: true, run: () => nudge(store, dx * 10, dy * 10) },
    ];
  });
  const pages: Command[] = store.getState().doc.pages.map(page => ({
    id: 'page.' + page.id, label: `Go to page: ${page.name}`, group: 'Pages' as const,
    run: () => store.set({ pageId: page.id, selection: [], hover: null, editingTextId: null }),
  }));
  return [
    tool('move', 'Move tool', 'v'), tool('frame', 'Frame tool', 'f'), tool('rect', 'Rectangle tool', 'r'),
    tool('ellipse', 'Ellipse tool', 'o'), tool('text', 'Text tool', 't'), tool('hand', 'Hand tool', 'h'),
    tool('line', 'Line tool', 'l'), tool('arrow', 'Arrow tool', 'shift+l'), tool('polygon', 'Polygon tool', 'y'), tool('star', 'Star tool', 's'),
    tool('pen', 'Pen tool (click for corners, drag for curves)', 'p'), tool('pencil', 'Pencil tool (freehand)', 'shift+p'),
    { id: 'image', label: 'Place image…', group: 'Tools', keys: ['mod+shift+k'], run: ctx.pickImage },
    { id: 'embed-video', label: 'Embed a video (YouTube, Vimeo) or web page', group: 'Tools', run: () => ctx.insertEmbed?.('video') },
    { id: 'embed-map', label: 'Embed a map', group: 'Tools', run: () => ctx.insertEmbed?.('map') },
    { id: 'embed-code', label: 'Embed custom code (HTML, CSS, JS)', group: 'Tools', run: () => ctx.insertEmbed?.('code') },
    { id: 'versions', label: 'Version history…', group: 'Edit', keys: ['mod+alt+s'], run: () => ctx.openVersions?.() },
    { id: 'library', label: 'Open design library (heroes, navbars, pricing, animations…)', group: 'Tools', keys: ['shift+i'], run: ctx.openLibrary },

    { id: 'undo', label: 'Undo', group: 'Edit', keys: ['mod+z'], run: () => store.undo() },
    { id: 'redo', label: 'Redo', group: 'Edit', keys: ['mod+shift+z', 'mod+y'], run: () => store.redo() },
    { id: 'copy', label: 'Copy', group: 'Edit', run: ctx.copy },
    { id: 'cut', label: 'Cut', group: 'Edit', run: ctx.cut },
    { id: 'paste', label: 'Paste', group: 'Edit', run: ctx.paste },
    { id: 'duplicate', label: 'Duplicate', group: 'Edit', keys: ['mod+d'], run: () => duplicateSelection(store) },
    { id: 'delete', label: 'Delete', group: 'Edit', keys: ['delete', 'backspace'], run: () => deleteSelection(store) },
    { id: 'copy-style', label: 'Copy properties', group: 'Edit', keys: ['mod+alt+c'], run: () => copyStyle(store) },
    { id: 'paste-style', label: 'Paste properties', group: 'Edit', keys: ['mod+alt+v'], run: () => pasteStyle(store) },
    { id: 'save', label: 'Save', group: 'Edit', keys: ['mod+s'], hidden: true, run: () => store.notify('APL saves automatically in this browser.') },

    { id: 'select-all', label: 'Select all', group: 'Select', keys: ['mod+a'], run: () => selectAll(store) },
    { id: 'escape', label: 'Select parent', group: 'Select', keys: ['escape'], run: () => { if (store.getState().tool !== 'move') store.set({ tool: 'move' }); else selectParent(store); } },
    { id: 'enter', label: 'Select children / edit text', group: 'Select', keys: ['enter'], run: () => {
      const { doc, selection } = store.getState();
      const node = selection.length === 1 ? doc.nodes[selection[0]] : undefined;
      if (node?.type === 'text') ctx.canvas()?.startTextEditing(node.id); else selectChildren(store);
    } },
    { id: 'next-sibling', label: 'Select next layer', group: 'Select', keys: ['tab'], run: () => selectSibling(store, 1) },
    { id: 'previous-sibling', label: 'Select previous layer', group: 'Select', keys: ['shift+tab'], run: () => selectSibling(store, -1) },

    { id: 'group', label: 'Group selection', group: 'Arrange', keys: ['mod+g'], run: () => wrapSelection(store, measure, 'group') },
    { id: 'frame-selection', label: 'Frame selection', group: 'Arrange', keys: ['mod+alt+g'], run: () => wrapSelection(store, measure, 'frame') },
    { id: 'ungroup', label: 'Ungroup', group: 'Arrange', keys: ['mod+shift+g'], run: () => ungroupSelection(store, measure) },
    { id: 'auto-layout', label: 'Add / remove auto layout', group: 'Arrange', keys: ['shift+a'], run: () => toggleAutoLayout(store, measure) },
    { id: 'forward', label: 'Bring forward', group: 'Arrange', keys: ['mod+]'], run: () => reorderSelection(store, 'forward') },
    { id: 'backward', label: 'Send backward', group: 'Arrange', keys: ['mod+['], run: () => reorderSelection(store, 'backward') },
    { id: 'front', label: 'Bring to front', group: 'Arrange', keys: ['mod+shift+]'], run: () => reorderSelection(store, 'front') },
    { id: 'back', label: 'Send to back', group: 'Arrange', keys: ['mod+shift+['], run: () => reorderSelection(store, 'back') },
    { id: 'toggle-visible', label: 'Show / hide selection', group: 'Arrange', keys: ['mod+shift+h'], run: () => toggleVisible(store) },
    { id: 'toggle-lock', label: 'Lock / unlock selection', group: 'Arrange', keys: ['mod+shift+l'], run: () => toggleLocked(store) },
    ...nudges,

    { id: 'align-left', label: 'Align left', group: 'Align', keys: ['alt+a'], run: () => align(store, measure, 'left') },
    { id: 'align-hcenter', label: 'Align horizontal centers', group: 'Align', keys: ['alt+h'], run: () => align(store, measure, 'hcenter') },
    { id: 'align-right', label: 'Align right', group: 'Align', keys: ['alt+d'], run: () => align(store, measure, 'right') },
    { id: 'align-top', label: 'Align top', group: 'Align', keys: ['alt+w'], run: () => align(store, measure, 'top') },
    { id: 'align-vcenter', label: 'Align vertical centers', group: 'Align', keys: ['alt+v'], run: () => align(store, measure, 'vcenter') },
    { id: 'align-bottom', label: 'Align bottom', group: 'Align', keys: ['alt+s'], run: () => align(store, measure, 'bottom') },
    { id: 'distribute-h', label: 'Distribute horizontal spacing', group: 'Align', keys: ['alt+shift+h'], run: () => distribute(store, measure, 'h') },
    { id: 'distribute-v', label: 'Distribute vertical spacing', group: 'Align', keys: ['alt+shift+v'], run: () => distribute(store, measure, 'v') },

    { id: 'zoom-in', label: 'Zoom in', group: 'View', keys: ['mod+=', 'mod+shift+='], run: () => ctx.canvas()?.zoomBy(1.25) },
    { id: 'zoom-out', label: 'Zoom out', group: 'View', keys: ['mod+-'], run: () => ctx.canvas()?.zoomBy(0.8) },
    { id: 'zoom-100', label: 'Zoom to 100%', group: 'View', keys: ['mod+0'], run: () => ctx.canvas()?.setZoom(1) },
    { id: 'zoom-fit', label: 'Zoom to fit page', group: 'View', keys: ['shift+1'], run: () => ctx.canvas()?.fitPage() },
    { id: 'zoom-selection', label: 'Zoom to selection', group: 'View', keys: ['shift+2'], run: () => ctx.canvas()?.zoomToSelection() },
    { id: 'preview', label: 'Preview', group: 'View', keys: ['mod+alt+p'], run: ctx.openPreview },
    { id: 'bp-desktop', label: 'Design for desktop', group: 'View', keys: ['alt+1'], run: () => store.setBreakpoint('desktop') },
    { id: 'bp-tablet', label: 'Design for tablet', group: 'View', keys: ['alt+2'], run: () => store.setBreakpoint('tablet') },
    { id: 'bp-mobile', label: 'Design for phone', group: 'View', keys: ['alt+3'], run: () => store.setBreakpoint('mobile') },
    { id: 'create-component', label: 'Create component', group: 'Edit', keys: ['mod+alt+k'], run: () => createComponent(store, measure) },
    { id: 'export-site', label: 'Export website (download files)', group: 'View', run: () => ctx.exportSite?.() },
    { id: 'copy-code', label: 'Copy code (HTML or React) for the selection', group: 'Edit', run: () => ctx.copyCode?.() },
    { id: 'palette', label: 'Command palette', group: 'View', keys: ['mod+/', 'mod+k'], run: ctx.openPalette },

    { id: 'add-page', label: 'Add page', group: 'Pages', run: () => {
      const name = `Page ${store.getState().doc.pages.length + 1}`;
      if (store.commit(doc => addPage(doc, name, pathForName(doc, name)))) store.set({ pageId: store.getState().doc.pages.at(-1)!.id, selection: [] });
    } },
    ...pages,
  ];
}

/** Find the command bound to a key combo. */
export function commandFor(commands: Command[], combo: string): Command | undefined {
  return commands.find(command => command.keys?.includes(combo));
}

/** Palette filtering: every query word must appear in the label or group. */
export function filterCommands(commands: Command[], query: string): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter(command => !command.hidden && words.every(word => (command.label + ' ' + command.group).toLowerCase().includes(word)));
}
