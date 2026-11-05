import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Konva from 'konva';
import { Layer, Stage, Transformer } from 'react-konva';
import { RenderArtboard, attachDesignTransformer } from '../../src/design/DesignScene';
import { moveLayers, selectionRoots, transformLayer } from '../../src/design/model';
import type { DesignDocument } from '../../src/design/schema';

/** Browser-only test fixture, not imported by the shipped editor. */
export function mountInteractionFixture(container: HTMLDivElement, initial: DesignDocument, initialSelection: string[], zoom: number) {
  let present = initial;
  let liveStage: Konva.Stage | null = null;
  const root = createRoot(container);
  function Fixture() {
    const [document, setDocument] = useState(initial);
    const [selected, setSelected] = useState(initialSelection);
    const [, setPreview] = useState({ dx: 0, dy: 0 });
    const handles = useRef<Konva.Transformer>(null);
    const roots = selectionRoots(document, selected);
    const proportional = roots.length > 1 || roots.some(layer => layer.type === 'group');
    present = document;
    useEffect(() => {
      const transformer = handles.current;
      if (!transformer || !liveStage) return;
      attachDesignTransformer(transformer, selectionRoots(document, selected).flatMap(layer => {
        const node = liveStage!.findOne((node: Konva.Node) => node.id() === layer.id);
        return node ? [node] : [];
      }));
      transformer.getLayer()?.batchDraw();
    }, [document, selected]);
    return <Stage ref={node => { liveStage = node; }} width={640} height={360} x={20} y={20} scaleX={zoom} scaleY={zoom}>
      <Layer>{document.artboards.map(artboard => <RenderArtboard key={artboard.id} document={document} artboard={artboard} selectedIds={selected} interactive
        onSelect={(id, additive) => setSelected(ids => additive ? ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] : ids.includes(id) && ids.length > 1 ? ids : [id])}
        onDragMove={(_ids, dx, dy) => setPreview({ dx, dy })}
        onDragEnd={(ids, dx, dy, deltas) => setDocument(previous => deltas ? ids.reduce((next, id) => moveLayers(next, [id], deltas[id].dx, deltas[id].dy), previous) : moveLayers(previous, ids, dx, dy))}
        onTransformEnd={(id, patch) => { const next = transformLayer(present, id, patch); present = next; setDocument(next); }}
      />)}</Layer>
      <Layer><Transformer ref={handles} keepRatio={proportional} enabledAnchors={proportional ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : undefined} rotateEnabled={selected.length === 1} flipEnabled={false} anchorSize={9}/></Layer>
    </Stage>;
  }
  flushSync(() => root.render(<Fixture/>));
  return {
    snapshot: () => structuredClone(present),
    nodeBounds: (id: string) => liveStage!.findOne((node: Konva.Node) => node.id() === id)!.getClientRect(),
    nodePosition: (id: string) => liveStage!.findOne((node: Konva.Node) => node.id() === id)!.getAbsolutePosition(),
    unmount: () => { flushSync(() => root.unmount()); container.remove(); },
  };
}
