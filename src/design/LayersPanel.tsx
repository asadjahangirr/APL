import { useState } from 'react';
import { Circle, Square, TextT, Image, FrameCorners, Stack, Plus, Eye, EyeSlash, LockSimple, LockSimpleOpen, CaretRight, CaretDown, Monitor } from './icons';
import type { Artboard, DesignDocument, DesignLayer } from './schema';
import { IconButton } from './controls';

export const layerIcons = { text: TextT, rectangle: Square, ellipse: Circle, image: Image, frame: FrameCorners, group: Stack };

export default function LayersPanel({ document, activeBoard, selected, chooseBoard, select, update, addBoard }: {
  document: DesignDocument; activeBoard?: Artboard; selected: string[]; chooseBoard: (id: string) => void;
  select: (id: string, additive: boolean) => void; update: (id: string, patch: Partial<DesignLayer>) => void; addBoard: () => void;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  function rows(parentId: string | null, depth: number): React.ReactNode {
    return [...document.layers].reverse().filter(layer => layer.artboardId === activeBoard?.id && layer.parentId === parentId).map(layer => {
      const Icon = layerIcons[layer.type], hasChildren = document.layers.some(child => child.parentId === layer.id), folded = collapsed.includes(layer.id);
      return <div key={layer.id}><div className={'dc-layer-row' + (selected.includes(layer.id) ? ' is-selected' : '') + (!layer.visible ? ' is-hidden' : '')} style={{ paddingLeft: 10 + depth * 14 }}>
        {hasChildren ? <IconButton icon={folded ? CaretRight : CaretDown} label={(folded ? 'Expand ' : 'Collapse ') + layer.name} onClick={() => setCollapsed(ids => folded ? ids.filter(id => id !== layer.id) : [...ids, layer.id])}/> : <span className="dc-tree-spacer"/>}
        <button className="dc-layer-select" aria-label={'Select ' + layer.name} aria-pressed={selected.includes(layer.id)} onClick={event => select(layer.id, event.shiftKey || event.ctrlKey || event.metaKey)}><Icon size={16} aria-hidden="true"/><span>{layer.name}</span></button>
        <IconButton className="dc-row-visibility" icon={layer.visible ? Eye : EyeSlash} label={(layer.visible ? 'Hide ' : 'Show ') + layer.name} onClick={() => update(layer.id, { visible: !layer.visible })}/><IconButton className="dc-row-lock" icon={layer.locked ? LockSimple : LockSimpleOpen} label={(layer.locked ? 'Unlock ' : 'Lock ') + layer.name} onClick={() => update(layer.id, { locked: !layer.locked })}/>
      </div>{hasChildren && !folded && rows(layer.id, depth + 1)}</div>;
    });
  }
  return <><div className="dc-panel-heading"><h2>Artboards</h2><IconButton icon={Plus} label="Add artboard" onClick={addBoard}/></div><div className="dc-boards" role="group" aria-label="Artboards">{document.artboards.map(board => <button key={board.id} className={'dc-board-row' + (activeBoard?.id === board.id ? ' is-selected' : '')} onClick={() => chooseBoard(board.id)} aria-pressed={activeBoard?.id === board.id}><Monitor size={16} aria-hidden="true"/><span>{board.name}<small>{board.width} × {board.height}</small></span><i style={{ background: board.background }}/></button>)}</div><div className="dc-panel-heading dc-layer-heading"><h2>Layers</h2><span>{document.layers.filter(layer => layer.artboardId === activeBoard?.id).length}</span></div><div className="dc-layer-list" role="group" aria-label="Design layers">{rows(null, 0)}{!document.layers.some(layer => layer.artboardId === activeBoard?.id) && <p className="dc-panel-empty">Add text, a shape, or an image.<br/>Your layers will appear here.</p>}</div><div className="dc-layer-help"><kbd>Shift</kbd> + click to select more</div></>;
}
