import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { Group, Rect, Ellipse, Text, Image as CanvasImage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { MAX_DESIGN_IMAGE_PIXELS, MAX_DESIGN_TOTAL_IMAGE_PIXELS, type Artboard, type DesignAsset, type DesignDocument, type DesignLayer } from './schema';
import { embeddedImageDimensions } from './image-validation';

// A decoded image is shared by the live scene and its exported counterpart.
// A short cache prevents repeatedly decoding the same imported image on edits.
const decodedImages = new Map<string, HTMLImageElement>();
const decodingImages = new Map<string, Promise<HTMLImageElement>>();
const MAX_CACHED_IMAGES = 60;
const MAX_CACHED_IMAGE_PIXELS = MAX_DESIGN_TOTAL_IMAGE_PIXELS;

/**
 * Use the Transformer's resize/rotation handles while the model-driven renderer
 * owns multi-selection dragging. Konva's native drag proxy would otherwise
 * start a competing drag session on each selected node and commit it twice.
 * The namespace accessor is typed by the pinned Konva version; browser gesture
 * tests cover this integration when upgrading it.
 */
export function attachDesignTransformer(transformer: Konva.Transformer, nodes: Konva.Node[]) {
  if (typeof transformer._getEventNamespace !== 'function') {
    throw new Error('This canvas engine version does not support APL selection controls. Restore the supported Konva version before editing.');
  }
  transformer.nodes(nodes);
  const namespace = transformer._getEventNamespace();
  for (const node of nodes) node.off(`dragstart.${namespace} dragmove.${namespace}`);
  return transformer;
}

export async function loadDesignImage(asset: DesignAsset): Promise<HTMLImageElement> {
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(asset.dataUrl)) {
    throw new Error(`${asset.name}: choose an embedded PNG, JPEG or WebP image.`);
  }
  if (asset.width * asset.height > MAX_DESIGN_IMAGE_PIXELS) {
    throw new Error(`${asset.name}: resize this image to at most 24 million pixels before importing it.`);
  }
  const encoded = embeddedImageDimensions(asset.dataUrl);
  if (encoded.width * encoded.height > MAX_DESIGN_IMAGE_PIXELS) {
    throw new Error(`${asset.name}: resize this image to at most 24 million pixels before importing it.`);
  }
  if (encoded.width !== asset.width || encoded.height !== asset.height) {
    throw new Error(`${asset.name}: the image dimensions do not match its saved asset.`);
  }
  const existing = decodedImages.get(asset.dataUrl);
  if (existing) {
    if (existing.naturalWidth !== asset.width || existing.naturalHeight !== asset.height) {
      throw new Error(`${asset.name}: the image dimensions do not match its saved asset.`);
    }
    decodedImages.delete(asset.dataUrl);
    decodedImages.set(asset.dataUrl, existing);
    return existing;
  }
  let pending = decodingImages.get(asset.dataUrl);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new globalThis.Image();
      const timeout = window.setTimeout(() => reject(new Error(`${asset.name}: the image took too long to load.`)), 15_000);
      image.onload = () => {
        window.clearTimeout(timeout);
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error(`${asset.name}: this image could not be decoded.`));
          return;
        }
        resolve(image);
      };
      image.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error(`${asset.name}: this image could not be decoded.`));
      };
      image.src = asset.dataUrl;
    }).then(image => {
      // Keep the most recent images without allowing a history of imports to
      // retain unlimited decoded bitmap memory.
      let pixels = [...decodedImages.values()].reduce((sum, value) => sum + value.naturalWidth * value.naturalHeight, 0);
      while (decodedImages.size && (decodedImages.size >= MAX_CACHED_IMAGES || pixels + image.naturalWidth * image.naturalHeight > MAX_CACHED_IMAGE_PIXELS)) {
        const key = decodedImages.keys().next().value!;
        const oldest = decodedImages.get(key)!;
        pixels -= oldest.naturalWidth * oldest.naturalHeight;
        decodedImages.delete(key);
      }
      decodedImages.set(asset.dataUrl, image);
      return image;
    }).finally(() => decodingImages.delete(asset.dataUrl));
    decodingImages.set(asset.dataUrl, pending);
  }
  const image = await pending;
  if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) {
    throw new Error(`${asset.name}: the image dimensions do not match its saved asset.`);
  }
  return image;
}

export function isLayerVisible(layer: DesignLayer, layers: ReadonlyMap<string, DesignLayer>): boolean {
  let current: DesignLayer | undefined = layer;
  const visited = new Set<string>();
  while (current) {
    if (!current.visible || visited.has(current.id)) return false;
    visited.add(current.id);
    current = current.parentId ? layers.get(current.parentId) : undefined;
  }
  return true;
}

export async function preloadDesignImages(document: DesignDocument, artboardId: string): Promise<void> {
  const layers = new Map(document.layers.map(layer => [layer.id, layer]));
  const assets = new Map(document.assets.map(asset => [asset.id, asset]));
  const required = new Map<string, DesignAsset>();
  for (const layer of document.layers) {
    if (layer.artboardId !== artboardId || layer.type !== 'image' || !isLayerVisible(layer, layers)) continue;
    if (!layer.assetId) throw new Error(`${layer.name}: choose an image before exporting this artboard.`);
    const asset = assets.get(layer.assetId);
    if (!asset) throw new Error(`${layer.name}: its saved image asset is missing.`);
    required.set(asset.id, asset);
  }
  if ([...required.values()].reduce((sum, asset) => sum + asset.width * asset.height, 0) > MAX_CACHED_IMAGE_PIXELS) {
    throw new Error('This artboard contains too much decoded image data to export safely. Resize its images so their combined dimensions fit within 64 million pixels.');
  }
  // Sequential decoding keeps peak decoded-image memory bounded while avoiding
  // any missing-image race in the PNG/PDF renderer.
  for (const asset of required.values()) await loadDesignImage(asset);
}

type SelectionEvent = KonvaEventObject<MouseEvent | TouchEvent>;
type LayerDragEvent = KonvaEventObject<globalThis.DragEvent>;

export interface RenderArtboardProps {
  document: DesignDocument;
  artboard: Artboard;
  interactive?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string, additive: boolean) => void;
  onDragEnd?: (ids: string[], dx: number, dy: number, localDeltas?: Record<string, { dx: number; dy: number }>) => void;
  onDragMove?: (ids: string[], dx: number, dy: number) => void;
  onTransformEnd?: (id: string, patch: Partial<DesignLayer>) => void;
  onTextEdit?: (id: string) => void;
}

interface DragSession {
  ids: string[];
  nodes: { node: Konva.Node; position: { x: number; y: number }; absolute: { x: number; y: number }; parentInverse: Konva.Transform }[];
  original: { x: number; y: number };
  parentInverse: Konva.Transform;
  delta: { x: number; y: number };
  localDeltas: Record<string, { dx: number; dy: number }>;
  mixedParents: boolean;
}

function rootSelection(ids: string[], layers: DesignLayer[]): string[] {
  const selected = new Set(ids);
  const byId = new Map(layers.map(layer => [layer.id, layer]));
  return ids.filter(id => {
    if (byId.get(id)?.locked) return false;
    let parent = byId.get(id)?.parentId;
    while (parent) {
      if (selected.has(parent) || byId.get(parent)?.locked) return false;
      parent = byId.get(parent)?.parentId;
    }
    return true;
  });
}

function roundedClip(context: Konva.Context, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(r, 0);
  context.lineTo(width - r, 0);
  context.quadraticCurveTo(width, 0, width, r);
  context.lineTo(width, height - r);
  context.quadraticCurveTo(width, height, width - r, height);
  context.lineTo(r, height);
  context.quadraticCurveTo(0, height, 0, height - r);
  context.lineTo(0, r);
  context.quadraticCurveTo(0, 0, r, 0);
  context.closePath();
}

function setFrameBounds(node: Konva.Group, strokeWidth: number, stroke: string) {
  // Konva's default Group bounds merge every child, including clipped content.
  // A frame's handles follow its actual clipped rectangle instead. Public
  // transforms project that rectangle into the requested coordinate space.
  node.getClientRect = (config = {}) => {
    const inset = config.skipStroke || stroke === 'transparent' ? 0 : strokeWidth / 2;
    const rect = { x: -inset, y: -inset, width: node.width() + inset * 2, height: node.height() + inset * 2 };
    if (config.skipTransform) return rect;
    const transform = node.getAbsoluteTransform(config.relativeTo);
    const points = [
      { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
      { x: rect.x, y: rect.y + rect.height }, { x: rect.x + rect.width, y: rect.y + rect.height },
    ].map(point => transform.point(point));
    const x = Math.min(...points.map(point => point.x)), y = Math.min(...points.map(point => point.y));
    return { x, y, width: Math.max(...points.map(point => point.x)) - x, height: Math.max(...points.map(point => point.y)) - y };
  };
}

function LayerImage({ layer, asset }: { layer: DesignLayer; asset: DesignAsset | undefined }) {
  const [state, setState] = useState<{ image?: HTMLImageElement; failed?: boolean }>(() => ({
    image: asset ? decodedImages.get(asset.dataUrl) : undefined,
  }));
  useEffect(() => {
    let active = true;
    if (!asset) { setState({ failed: true }); return; }
    const cached = decodedImages.get(asset.dataUrl);
    if (cached) setState({ image: cached });
    else {
      setState({});
      void loadDesignImage(asset).then(image => { if (active) setState({ image }); })
        .catch(() => { if (active) setState({ failed: true }); });
    }
    return () => { active = false; };
  }, [asset]);
  const image = state.image;
  let crop: { x: number; y: number; width: number; height: number } | undefined;
  if (image) {
    const ratio = Math.max(layer.width / image.naturalWidth, layer.height / image.naturalHeight);
    const width = layer.width / ratio;
    const height = layer.height / ratio;
    crop = { x: (image.naturalWidth - width) / 2, y: (image.naturalHeight - height) / 2, width, height };
  }
  return <Group clipFunc={context => roundedClip(context, layer.width, layer.height, layer.radius)} listening={false}>
    {image ? <CanvasImage image={image} crop={crop} width={layer.width} height={layer.height} /> : <>
      <Rect width={layer.width} height={layer.height} fill={state.failed ? '#f7e8e5' : '#e9eeeb'} />
      <Text x={12} y={12} width={Math.max(1, layer.width - 24)} text={state.failed ? 'Image unavailable' : 'Loading image…'} fontSize={14} fontFamily="Arial" fill="#626d66" />
    </>}
  </Group>;
}

interface DesignNodeProps extends RenderArtboardProps {
  layer: DesignLayer;
  parentOrigin: { x: number; y: number };
  lockedAncestor: boolean;
  selectedAncestor: boolean;
}

function DesignNode(props: DesignNodeProps) {
  const { document, layer, artboard, interactive = false, selectedIds = [], parentOrigin, lockedAncestor, selectedAncestor } = props;
  const drag = useRef<DragSession | null>(null);
  const frameNode = useRef<Konva.Group | null>(null);
  const hitArea = useRef<Konva.Rect | null>(null);
  const surface = useRef<Konva.Rect | null>(null);
  if (!layer.visible) return null;
  const locked = lockedAncestor || layer.locked;
  const x = layer.x - parentOrigin.x;
  const y = layer.y - parentOrigin.y;
  const colorStyle = layer.colorStyleId ? document.colors.find(style => style.id === layer.colorStyleId) : undefined;
  const typeStyle = layer.typeStyleId ? document.typeStyles.find(style => style.id === layer.typeStyleId) : undefined;
  const fill = colorStyle?.value ?? layer.fill;
  const commonShape = { width: layer.width, height: layer.height, fill, stroke: layer.stroke, strokeWidth: layer.strokeWidth, listening: false };
  const choose = (event: SelectionEvent) => {
    const native = event.evt;
    const additive = 'shiftKey' in native && (native.shiftKey || native.ctrlKey || native.metaKey);
    if (selectedAncestor && !additive) {
      let ancestor = layer.parentId;
      while (ancestor && !selectedIds.includes(ancestor)) ancestor = document.layers.find(parent => parent.id === ancestor)?.parentId ?? null;
      if (ancestor) {
        // Let the event reach the selected ancestor's native drag listener.
        // Its own choose handler stops bubbling at that ancestor.
        event.cancelBubble = false;
        props.onSelect?.(ancestor, false);
        return;
      }
    }
    event.cancelBubble = true;
    props.onSelect?.(layer.id, Boolean(additive));
  };
  const beginDrag = (event: LayerDragEvent) => {
    if (event.target.id() !== layer.id) return;
    event.cancelBubble = true;
    const stage = event.target.getStage();
    const parent = event.target.getParent();
    if (!stage || !parent) return;
    const ids = rootSelection(selectedIds.includes(layer.id) ? selectedIds : [layer.id], document.layers);
    const nodes = ids.flatMap(id => {
      const node = stage.findOne((node: Konva.Node) => node.id() === id);
      const parent = node?.getParent();
      return node && parent ? [{ node, position: node.position(), absolute: node.getAbsolutePosition(), parentInverse: parent.getAbsoluteTransform().copy().invert() }] : [];
    });
    const draggableIds = nodes.map(item => item.node.id());
    const parentIds = new Set(document.layers.filter(layer => draggableIds.includes(layer.id)).map(layer => layer.parentId));
    drag.current = { ids: draggableIds, nodes, original: event.target.getAbsolutePosition(), parentInverse: parent.getAbsoluteTransform().copy().invert(), delta: { x: 0, y: 0 }, localDeltas: {}, mixedParents: parentIds.size > 1 };
  };
  const moveDrag = (event: LayerDragEvent) => {
    if (event.target.id() !== layer.id || !drag.current) return;
    event.cancelBubble = true;
    const session = drag.current;
    const current = event.target.getAbsolutePosition();
    const screenDelta = { x: current.x - session.original.x, y: current.y - session.original.y };
    // Stored coordinates live before inherited ancestor rotation. Screen delta
    // must pass through the source parent's inverse, rather than just Stage zoom.
    const from = session.parentInverse.point(session.original);
    const to = session.parentInverse.point(current);
    session.delta = { x: to.x - from.x, y: to.y - from.y };
    for (const item of session.nodes) {
      const before = item.parentInverse.point(item.absolute);
      const after = item.parentInverse.point({ x: item.absolute.x + screenDelta.x, y: item.absolute.y + screenDelta.y });
      session.localDeltas[item.node.id()] = { dx: after.x - before.x, dy: after.y - before.y };
      if (item.node !== event.target) item.node.setAbsolutePosition({ x: item.absolute.x + screenDelta.x, y: item.absolute.y + screenDelta.y });
    }
    props.onDragMove?.(session.ids, session.delta.x, session.delta.y);
  };
  const finishDrag = (event: LayerDragEvent) => {
    if (event.target.id() !== layer.id || !drag.current) return;
    moveDrag(event);
    const session = drag.current;
    for (const item of session.nodes) item.node.position(item.position);
    // React receives the committed document after temporary Konva movement has
    // been reset, so undo, save and export always use model coordinates.
    drag.current = null;
    props.onDragEnd?.(session.ids, session.delta.x, session.delta.y, session.mixedParents ? session.localDeltas : undefined);
  };
  const resizeFrame = (node: Konva.Group, width: number, height: number) => {
    node.size({ width, height });
    hitArea.current?.size({ width, height });
    surface.current?.size({ width, height });
  };
  const previewTransform = (event: KonvaEventObject<Event>) => {
    if (event.target.id() !== layer.id || layer.type !== 'frame') return;
    event.cancelBubble = true;
    const node = event.currentTarget as unknown as Konva.Group;
    // A frame resizes its clipping boundary, not its contents. Bake each
    // incremental scale into its bounds so children and corner radii keep the
    // same size throughout the live gesture as in the committed document.
    const width = Math.max(1, node.width() * node.scaleX());
    const height = Math.max(1, node.height() * node.scaleY());
    node.scale({ x: 1, y: 1 });
    resizeFrame(node, width, height);
  };
  const transform = (event: KonvaEventObject<Event>) => {
    if (event.target.id() !== layer.id) return;
    event.cancelBubble = true;
    const node = event.currentTarget as unknown as Konva.Group;
    const patch = {
      x: node.x() + parentOrigin.x,
      y: node.y() + parentOrigin.y,
      width: Math.max(1, (layer.type === 'frame' ? node.width() : layer.width) * node.scaleX()),
      height: Math.max(1, (layer.type === 'frame' ? node.height() : layer.height) * node.scaleY()),
      rotation: node.rotation(),
    };
    node.scale({ x: 1, y: 1 });
    node.position({ x, y });
    node.rotation(layer.rotation);
    if (layer.type === 'frame') resizeFrame(node, layer.width, layer.height);
    props.onTransformEnd?.(layer.id, patch);
  };
  const children = document.layers.filter(child => child.parentId === layer.id);
  return <Group
    ref={node => { frameNode.current = node; if (node && layer.type === 'frame') setFrameBounds(node, layer.strokeWidth, layer.stroke); }}
    id={layer.id} name="design-layer" x={x} y={y} width={layer.width} height={layer.height}
    rotation={layer.rotation} opacity={layer.opacity} listening={interactive && !locked}
    draggable={interactive && !locked && !selectedAncestor}
    onMouseDown={choose} onTouchStart={choose}
    onClick={event => { event.cancelBubble = true; }} onTap={event => { event.cancelBubble = true; }}
    onDblClick={event => { event.cancelBubble = true; if (layer.type === 'text') props.onTextEdit?.(layer.id); }}
    onDblTap={event => { event.cancelBubble = true; if (layer.type === 'text') props.onTextEdit?.(layer.id); }}
    onDragStart={beginDrag} onDragMove={moveDrag} onDragEnd={finishDrag} onTransform={previewTransform} onTransformEnd={transform}
  >
    {/* The bounds provide a predictable hit area and minimum transformer bounds. */}
    <Rect ref={hitArea} width={layer.width} height={layer.height} fill="rgba(0,0,0,0)" listening={interactive && !locked} />
    {(layer.type === 'rectangle' || layer.type === 'frame') && <Rect ref={surface} {...commonShape} cornerRadius={layer.radius} />}
    {layer.type === 'ellipse' && <Ellipse x={layer.width / 2} y={layer.height / 2} radiusX={layer.width / 2} radiusY={layer.height / 2} fill={fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} listening={false} />}
    {layer.type === 'text' && <Text {...commonShape} text={layer.text} fontFamily={typeStyle?.fontFamily ?? layer.fontFamily} fontSize={typeStyle?.fontSize ?? layer.fontSize} fontStyle={String(typeStyle?.fontWeight ?? layer.fontWeight)} lineHeight={typeStyle?.lineHeight ?? layer.lineHeight} align={layer.textAlign} wrap="word" />}
    {layer.type === 'image' && <>
      <LayerImage layer={layer} asset={document.assets.find(asset => asset.id === layer.assetId)} />
      {layer.strokeWidth > 0 && <Rect width={layer.width} height={layer.height} cornerRadius={layer.radius} stroke={layer.stroke} strokeWidth={layer.strokeWidth} listening={false} />}
    </>}
    {children.length > 0 && <Group clipFunc={layer.type === 'frame' ? context => roundedClip(context, frameNode.current?.width() ?? layer.width, frameNode.current?.height() ?? layer.height, layer.radius) : undefined}>
      {children.map(child => <DesignNode key={child.id} {...props} layer={child} parentOrigin={{ x: layer.x, y: layer.y }} lockedAncestor={locked} selectedAncestor={selectedAncestor || selectedIds.includes(layer.id)} />)}
    </Group>}
  </Group>;
}

/** The same scene tree is used by the editor and offscreen visual exports. */
export function RenderArtboard(props: RenderArtboardProps) {
  const { document, artboard } = props;
  return <Group id={`artboard:${artboard.id}`} x={artboard.x} y={artboard.y} width={artboard.width} height={artboard.height}>
    <Rect name="artboard-background" width={artboard.width} height={artboard.height} fill={artboard.background} listening={props.interactive ?? false} />
    <Group clipX={0} clipY={0} clipWidth={artboard.width} clipHeight={artboard.height}>
      {document.layers.filter(layer => layer.artboardId === artboard.id && layer.parentId === null).map(layer => <DesignNode key={layer.id} {...props} layer={layer} parentOrigin={{ x: 0, y: 0 }} lockedAncestor={false} selectedAncestor={false} />)}
    </Group>
  </Group>;
}

export default RenderArtboard;
