import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addPage, ancestorIds, moveNode, pathForName, removePage, updateNode, updatePage } from '../doc/ops';
import type { SiteDoc, SiteNode } from '../doc/schema';
import { CaretDown, CaretRight, BezierCurve, Code, Circle, Eye, EyeSlash, File, FrameCorners, Image, Lock, LockOpen, Plus, Square, TextT, Trash } from './icons';
import { IconButton } from './controls';
import { useEditor, type EditorStore } from './store';

const ICON: Record<SiteNode['type'], ReactNode> = {
  frame: <FrameCorners size={14} />, text: <TextT size={14} />, rect: <Square size={14} />, ellipse: <Circle size={14} />, image: <Image size={14} />, vector: <BezierCurve size={14} />, embed: <Code size={14} />,
};
type Drop = { id: string; position: 'before' | 'after' | 'inside' };

/** Where a dragged layer would land, or null if the drop is invalid. */
export function resolveLayerDrop(doc: SiteDoc, dragged: string, drop: Drop, rootId: string): { parentId: string; index: number } | null {
  const target = doc.nodes[drop.id];
  if (!target || dragged === drop.id || ancestorIds(doc, drop.id).includes(dragged)) return null;
  if (drop.position === 'inside' || drop.id === rootId) {
    if (target.type !== 'frame') return null;
    // Layers panel lists children top-most first; "inside" means on top.
    return { parentId: target.id, index: target.children.filter(id => id !== dragged).length };
  }
  const parent = doc.nodes[target.parentId!];
  const siblings = parent.children.filter(id => id !== dragged);
  const at = siblings.indexOf(drop.id);
  // Panel order is reversed (front-most layer on top): "before" in the panel = later in children.
  return { parentId: parent.id, index: drop.position === 'before' ? at + 1 : at };
}

export function LayersPanel({ store }: { store: EditorStore }) {
  const doc = useEditor(store, state => state.doc);
  const pageId = useEditor(store, state => state.pageId);
  const selection = useEditor(store, state => state.selection);
  const hover = useEditor(store, state => state.hover);
  const page = doc.pages.find(value => value.id === pageId) ?? doc.pages[0];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);

  // Reveal selected layers.
  useEffect(() => {
    const open = selection.flatMap(id => (doc.nodes[id] ? ancestorIds(doc, id) : []));
    if (open.some(id => collapsed.has(id))) setCollapsed(previous => new Set([...previous].filter(id => !open.includes(id))));
  }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const out: { node: SiteNode; depth: number }[] = [];
    const visit = (id: string, depth: number) => {
      const node = doc.nodes[id];
      if (!node) return;
      out.push({ node, depth });
      if (!collapsed.has(id)) for (const child of [...node.children].reverse()) visit(child, depth + 1);
    };
    visit(page.rootId, 0);
    return out;
  }, [doc, page.rootId, collapsed]);

  const select = (id: string, additive: boolean) => {
    if (additive) store.select(selection.includes(id) ? selection.filter(value => value !== id) : [...selection, id]);
    else store.select([id]);
  };
  const toggle = (id: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const newPage = () => {
    const name = `Page ${doc.pages.length + 1}`;
    if (store.commit(current => addPage(current, name, pathForName(current, name)))) {
      const created = store.getState().doc.pages.at(-1)!;
      store.set({ pageId: created.id, selection: [] });
    }
  };

  return (
    <div className="ed-layers">
      <section className="ed-pages" aria-label="Pages">
        <header><h3>Pages</h3><IconButton label="Add page" onClick={newPage}><Plus size={14} /></IconButton></header>
        <ul>
          {doc.pages.map(value => (
            <li key={value.id} className={value.id === page.id ? 'is-current' : ''}>
              {renaming === value.id ? (
                <RenameInput initial={value.name} onDone={name => { setRenaming(null); if (name) store.commit(current => updatePage(current, value.id, { name: name.slice(0, 60) })); }} />
              ) : (
                <button type="button" className="ed-page-btn" onClick={() => store.set({ pageId: value.id, selection: [], hover: null, editingTextId: null })} onDoubleClick={() => setRenaming(value.id)}>
                  <File size={14} /> <span>{value.name}</span> <small>{value.path}</small>
                </button>
              )}
              {value.path !== '/' && (
                <IconButton label={`Delete page ${value.name}`} className="ed-row-action" onClick={() => {
                  if (!window.confirm(`Delete the page "${value.name}" and everything on it? You can undo this.`)) return;
                  if (store.commit(current => removePage(current, value.id)) && value.id === page.id) store.set({ pageId: store.getState().doc.pages[0].id, selection: [] });
                }}><Trash size={13} /></IconButton>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="ed-tree" aria-label="Layers">
        <header><h3>Layers</h3></header>
        <ul role="tree" aria-multiselectable="true" onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrop(null); }}>
          {rows.map(({ node, depth }) => {
            const isRoot = node.id === page.rootId;
            const selected = selection.includes(node.id);
            const dropClass = drop?.id === node.id ? ' drop-' + drop.position : '';
            return (
              <li key={node.id} role="treeitem" aria-selected={selected} aria-level={depth + 1} aria-expanded={node.children.length ? !collapsed.has(node.id) : undefined}
                className={'ed-row' + (selected ? ' is-selected' : '') + (hover === node.id ? ' is-hover' : '') + (!node.visible ? ' is-hidden' : '') + (node.component || node.instanceOf ? ' is-component' : '') + dropClass}
                style={{ paddingLeft: 6 + depth * 14 }}
                draggable={!isRoot && renaming !== node.id}
                onDragStart={event => { setDragged(node.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', node.name); }}
                onDragEnd={() => { setDragged(null); setDrop(null); }}
                onDragOver={event => {
                  if (!dragged) return;
                  const box = event.currentTarget.getBoundingClientRect(), y = (event.clientY - box.top) / box.height;
                  const position: Drop['position'] = isRoot ? 'inside' : node.type === 'frame' && y > 0.25 && y < 0.75 ? 'inside' : y < 0.5 ? 'before' : 'after';
                  if (!resolveLayerDrop(doc, dragged, { id: node.id, position }, page.rootId)) { setDrop(null); return; }
                  event.preventDefault();
                  if (drop?.id !== node.id || drop.position !== position) setDrop({ id: node.id, position });
                }}
                onDrop={event => {
                  event.preventDefault();
                  const target = dragged && drop ? resolveLayerDrop(doc, dragged, drop, page.rootId) : null;
                  if (dragged && target) store.commit(current => moveNode(current, dragged, target.parentId, target.index), { selection: [dragged] });
                  setDragged(null); setDrop(null);
                }}
                onMouseEnter={() => store.set({ hover: node.id })} onMouseLeave={() => store.set({ hover: null })}
                onClick={event => select(node.id, event.shiftKey || event.metaKey || event.ctrlKey)}
                onDoubleClick={() => setRenaming(node.id)}
              >
                <span className="ed-caret">
                  {node.children.length > 0 && (
                    <button type="button" aria-label={collapsed.has(node.id) ? 'Expand' : 'Collapse'} onClick={event => { event.stopPropagation(); toggle(node.id); }}>
                      {collapsed.has(node.id) ? <CaretRight size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                    </button>
                  )}
                </span>
                <span className="ed-row-icon">{isRoot ? <File size={14} /> : ICON[node.type]}</span>
                {renaming === node.id
                  ? <RenameInput initial={node.name} onDone={name => { setRenaming(null); if (name) store.commit(current => updateNode(current, node.id, { name: name.slice(0, 120) })); }} />
                  : <span className="ed-row-name">{node.name}</span>}
                {!isRoot && <span className="ed-row-tools" onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
                  <IconButton label={node.locked ? 'Unlock' : 'Lock'} className={node.locked ? 'is-on' : ''} onClick={() => store.commit(current => updateNode(current, node.id, { locked: !node.locked }))}>
                    {node.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                  </IconButton>
                  <IconButton label={node.visible ? 'Hide' : 'Show'} className={!node.visible ? 'is-on' : ''} onClick={() => store.commit(current => updateNode(current, node.id, { visible: !node.visible }))}>
                    {node.visible ? <Eye size={12} /> : <EyeSlash size={12} />}
                  </IconButton>
                </span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (name: string | null) => { if (done.current) return; done.current = true; onDone(name); };
  return (
    <input className="ed-rename" autoFocus value={value} aria-label="Name" onChange={event => setValue(event.target.value)}
      onFocus={event => event.currentTarget.select()} onClick={event => event.stopPropagation()}
      onBlur={() => finish(value.trim() || null)}
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') finish(value.trim() || null); if (event.key === 'Escape') finish(null); }} />
  );
}
