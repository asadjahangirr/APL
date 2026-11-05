import { useState } from 'react';
import { createUsePuck } from '@puckeditor/core';
import { config, type EditorData } from './config';
import './LayoutOutline.css';

const useEditor = createUsePuck<typeof config>();
type EditorNode = EditorData['content'][number];
type ContainerNode = Extract<EditorNode, { type: 'Section' | 'Columns' | 'Column' }>;
type Insertable = 'Heading' | 'Paragraph' | 'Image' | 'Button' | 'Icon' | 'Columns' | 'Column';
const leaves: Insertable[] = ['Heading', 'Paragraph', 'Image', 'Button', 'Icon'];

function isContainer(node: EditorNode): node is ContainerNode {
  return node.type === 'Section' || node.type === 'Columns' || node.type === 'Column';
}

function labelFor(node: EditorNode, index: number): string {
  const title = config.components[node.type].label ?? node.type;
  if (node.type === 'Column') return `${title} ${index + 1}`;
  const text = node.type === 'Heading' || node.type === 'Paragraph' ? node.props.text : node.type === 'Button' || node.type === 'Icon' ? node.props.label : '';
  const summary = text.trim().replace(/\s+/g, ' ');
  return summary ? `${title}: ${summary.length > 34 ? summary.slice(0, 33) + '\u2026' : summary}` : title;
}

function AddContent({ node, label }: { node: ContainerNode; label: string }) {
  const dispatch = useEditor(state => state.dispatch);
  const allowed: Insertable[] = node.type === 'Columns' ? ['Column'] : node.type === 'Section' ? [...leaves, 'Columns'] : leaves;
  const [choice, setChoice] = useState<Insertable>(node.type === 'Columns' ? 'Column' : 'Paragraph');
  const max = node.type === 'Columns' ? 4 : 20;
  const full = node.props.items.length >= max;
  const selected = allowed.includes(choice) ? choice : allowed[0];
  const insert = () => {
    if (full || !allowed.includes(selected)) return;
    const index = node.props.items.length, zone = `${node.props.id}:items`;
    dispatch({ type: 'insert', componentType: selected, destinationIndex: index, destinationZone: zone });
    dispatch({ type: 'setUi', ui: { itemSelector: { index, zone } } });
  };
  return <div className="layout-outline-add">
    {node.type === 'Columns' ? <button type="button" disabled={full} onClick={insert}>Add column</button> : <>
      <select aria-label={`Element to add to ${label}`} value={selected} disabled={full} onChange={event => setChoice(event.target.value as Insertable)}>
        {allowed.map(type => <option key={type} value={type}>{config.components[type].label ?? type}</option>)}
      </select>
      <button type="button" disabled={full} aria-label={`Add ${config.components[selected].label ?? selected} to ${label}`} onClick={insert}>Add</button>
    </>}
    {full && <small role="status">{max} {node.type === 'Columns' ? 'columns' : 'elements'} maximum.</small>}
  </div>;
}

function OutlineRow({ node, index, count, zone }: { node: EditorNode; index: number; count: number; zone: string }) {
  const dispatch = useEditor(state => state.dispatch);
  const selected = useEditor(state => state.selectedItem?.props.id === node.props.id);
  const [expanded, setExpanded] = useState(true);
  const container = isContainer(node), label = labelFor(node, index);
  const select = (nextIndex = index) => dispatch({ type: 'setUi', ui: { itemSelector: { index: nextIndex, zone } } });
  const move = (direction: -1 | 1) => {
    const destinationIndex = index + direction;
    if (destinationIndex < 0 || destinationIndex >= count) return;
    dispatch({ type: 'move', sourceIndex: index, sourceZone: zone, destinationIndex, destinationZone: zone });
    select(destinationIndex);
  };
  return <li className="layout-outline-item">
    <div className="layout-outline-row" data-selected={selected || undefined}>
      {container ? <button className="layout-outline-toggle" type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`} onClick={() => setExpanded(value => !value)}>{expanded ? '\u2212' : '+'}</button> : <span className="layout-outline-leaf" aria-hidden="true">{'\u00b7'}</span>}
      <button className="layout-outline-select" type="button" aria-label={`Select ${label}`} aria-pressed={selected} title={label} onClick={() => select()}>{label}</button>
      <span className="layout-outline-moves">
        <button type="button" aria-label={`Move ${label} up`} title="Move up" disabled={index === 0} onClick={() => move(-1)}>{'\u2191'}</button>
        <button type="button" aria-label={`Move ${label} down`} title="Move down" disabled={index === count - 1} onClick={() => move(1)}>{'\u2193'}</button>
      </span>
    </div>
    {container && expanded && <div className="layout-outline-children">
      <OutlineList nodes={node.props.items} zone={`${node.props.id}:items`}/>
      <AddContent node={node} label={label}/>
    </div>}
  </li>;
}

function OutlineList({ nodes, zone }: { nodes: EditorNode[]; zone: string }) {
  return <ul className="layout-outline-list">{nodes.map((node, index) => <OutlineRow key={node.props.id} node={node} index={index} count={nodes.length} zone={zone}/>)}</ul>;
}

/** Uses Puck's public state/actions while keeping its unused default zone out of the UI. */
export default function LayoutOutline() {
  const nodes = useEditor(state => state.appState.data.root.props?.body ?? []);
  return <section className="layout-outline" aria-label="Page structure">
    <h2>Page structure</h2>
    <p>Select an element to edit it. Use the arrows to change its order.</p>
    {nodes.length ? <OutlineList nodes={nodes} zone="root:body"/> : <p>Add a layout or drag a section into the page to begin.</p>}
  </section>;
}
