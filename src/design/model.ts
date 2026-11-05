import { artboardSchema, createLayer, designSchema, layerSchema, type Artboard, type DesignDocument, type DesignLayer } from './schema';

export interface Bounds { x: number; y: number; width: number; height: number }
export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type LayerOrder = 'front' | 'back' | 'forward' | 'backward';
export interface SnapGuide { axis: 'x' | 'y'; position: number }
const checked = (design: DesignDocument) => designSchema.parse(design);

/** Deleting an image frees its asset only after the last referencing layer is removed. */
function releaseRemovedAssets(design: DesignDocument, layers: DesignLayer[]): DesignDocument['assets'] {
  const remainingIds = new Set(layers.map(layer => layer.id));
  const candidates = new Set(design.layers.filter(layer => !remainingIds.has(layer.id) && layer.assetId !== null).map(layer => layer.assetId));
  const referenced = new Set(layers.map(layer => layer.assetId));
  return design.assets.filter(asset => !candidates.has(asset.id) || referenced.has(asset.id));
}

export function descendants(design: DesignDocument, id: string): DesignLayer[] {
  const result: DesignLayer[] = [];
  const parents = new Set([id]);
  let previous = -1;
  while (parents.size !== previous) {
    previous = parents.size;
    for (const layer of design.layers) if (layer.parentId !== null && parents.has(layer.parentId)) parents.add(layer.id);
  }
  for (const layer of design.layers) if (layer.id !== id && parents.has(layer.id)) result.push(layer);
  return result;
}

/** Selecting a group and its child performs the operation once, at the selected root. */
export function selectionRoots(design: DesignDocument, ids: readonly string[]): DesignLayer[] {
  const selected = new Set(ids);
  const byId = new Map(design.layers.map(layer => [layer.id, layer]));
  return design.layers.filter(layer => {
    if (!selected.has(layer.id)) return false;
    let parent = layer.parentId;
    while (parent !== null) {
      if (selected.has(parent)) return false;
      parent = byId.get(parent)?.parentId ?? null;
    }
    return true;
  });
}

export function isLayerLocked(design: DesignDocument, id: string): boolean {
  const byId = new Map(design.layers.map(layer => [layer.id, layer]));
  let current = byId.get(id);
  while (current) {
    if (current.locked) return true;
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return false;
}

function rectBounds(layer: DesignLayer): Bounds {
  const angle = layer.rotation * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const points = [[0, 0], [layer.width, 0], [0, layer.height], [layer.width, layer.height]].map(([x, y]) => ({ x: layer.x + x * c - y * s, y: layer.y + x * s + y * c }));
  const x = Math.min(...points.map(point => point.x)), y = Math.min(...points.map(point => point.y));
  return { x, y, width: Math.max(...points.map(point => point.x)) - x, height: Math.max(...points.map(point => point.y)) - y };
}

export function layerBounds(design: DesignDocument, ids: readonly string[]): Bounds | null {
  const roots = selectionRoots(design, ids);
  if (!roots.length) return null;
  const bounds = roots.map(rectBounds);
  const x = Math.min(...bounds.map(value => value.x)), y = Math.min(...bounds.map(value => value.y));
  return { x, y, width: Math.max(...bounds.map(value => value.x + value.width)) - x, height: Math.max(...bounds.map(value => value.y + value.height)) - y };
}

export function addArtboard(design: DesignDocument, artboard: Artboard): DesignDocument {
  return checked({ ...design, artboards: [...design.artboards, artboardSchema.parse(artboard)] });
}
export function updateArtboard(design: DesignDocument, id: string, patch: Partial<Omit<Artboard, 'id'>>): DesignDocument {
  if (!design.artboards.some(board => board.id === id)) return design;
  return checked({ ...design, artboards: design.artboards.map(board => board.id === id ? artboardSchema.parse({ ...board, ...patch, id }) : board) });
}
export function removeArtboards(design: DesignDocument, ids: readonly string[]): DesignDocument {
  const removed = new Set(ids);
  const layers = design.layers.filter(layer => !removed.has(layer.artboardId));
  return checked({ ...design, artboards: design.artboards.filter(board => !removed.has(board.id)), layers, assets: releaseRemovedAssets(design, layers) });
}
export function addLayer(design: DesignDocument, layer: DesignLayer): DesignDocument {
  return checked({ ...design, layers: [...design.layers, layerSchema.parse(layer)] });
}
export function updateLayer(design: DesignDocument, id: string, patch: Partial<Omit<DesignLayer, 'id' | 'type'>>): DesignDocument {
  if (!design.layers.some(layer => layer.id === id)) return design;
  return checked({ ...design, layers: design.layers.map(layer => layer.id === id ? layerSchema.parse({ ...layer, ...patch, id, type: layer.type }) : layer) });
}
export function removeLayers(design: DesignDocument, ids: readonly string[]): DesignDocument {
  const removed = new Set<string>();
  for (const root of selectionRoots(design, ids)) {
    if (isLayerLocked(design, root.id)) continue;
    removed.add(root.id);
    for (const child of descendants(design, root.id)) removed.add(child.id);
  }
  if (!removed.size) return design;
  const layers = design.layers.filter(layer => !removed.has(layer.id));
  return checked({ ...design, layers, assets: releaseRemovedAssets(design, layers) });
}

export function moveLayers(design: DesignDocument, ids: readonly string[], dx: number, dy: number): DesignDocument {
  if (dx === 0 && dy === 0) return design;
  const moved = new Set<string>();
  for (const root of selectionRoots(design, ids)) {
    if (isLayerLocked(design, root.id)) continue;
    moved.add(root.id);
    for (const child of descendants(design, root.id)) moved.add(child.id);
  }
  return moved.size ? checked({ ...design, layers: design.layers.map(layer => moved.has(layer.id) ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer) }) : design;
}

/** Child coordinates share the artboard plane; inherited parent rotation is local, as in Konva groups. */
export function transformLayer(design: DesignDocument, id: string, patch: Partial<Pick<DesignLayer, 'x' | 'y' | 'width' | 'height' | 'rotation'>>): DesignDocument {
  const root = design.layers.find(layer => layer.id === id);
  if (!root || isLayerLocked(design, id)) return design;
  const geometry = { ...root, ...patch };
  if (root.type === 'group') {
    const widthChanged = patch.width !== undefined, heightChanged = patch.height !== undefined;
    if (widthChanged && !heightChanged) geometry.height = root.height * geometry.width / root.width;
    else if (heightChanged && !widthChanged) geometry.width = root.width * geometry.height / root.height;
    else if (widthChanged && heightChanged) {
      const scaleX = geometry.width / root.width, scaleY = geometry.height / root.height;
      if (Math.abs(scaleX - scaleY) > 0.000001 * Math.max(1, Math.abs(scaleX), Math.abs(scaleY))) {
        throw new Error('Groups keep their proportions when resized. Change width or height, or resize with matching proportions.');
      }
      // Normalize tiny floating-point differences from a canvas transform.
      geometry.height = root.height * scaleX;
    }
    if (Math.abs(geometry.width / root.width - 1) < 1e-9) {
      // Rotating a canvas node can report a scale infinitesimally different from one.
      geometry.width = root.width;
      geometry.height = root.height;
    }
  }
  const next = layerSchema.parse(geometry);
  const scale = root.type === 'group' ? next.width / root.width : 1;
  const children = new Set(descendants(design, id).map(layer => layer.id));
  const styles = new Map(design.typeStyles.map(style => [style.id, style]));
  return checked({ ...design, layers: design.layers.map(layer => {
    if (layer.id === id) return next;
    if (!children.has(layer.id)) return layer;
    // A frame is a clipping box. A group scales its complete composition.
    const transformed = {
      ...layer,
      x: next.x + (layer.x - root.x) * scale,
      y: next.y + (layer.y - root.y) * scale,
      width: layer.width * scale, height: layer.height * scale,
      strokeWidth: layer.strokeWidth * scale, radius: layer.radius * scale,
    };
    if (layer.type !== 'text' || scale === 1) return transformed;
    const style = layer.typeStyleId ? styles.get(layer.typeStyleId) : undefined;
    return {
      ...transformed,
      fontFamily: style?.fontFamily ?? layer.fontFamily,
      fontWeight: style?.fontWeight ?? layer.fontWeight,
      lineHeight: style?.lineHeight ?? layer.lineHeight,
      fontSize: (style?.fontSize ?? layer.fontSize) * scale,
      typeStyleId: null,
    };
  }) });
}

export function duplicateLayers(design: DesignDocument, ids: readonly string[], offset = 24): DesignDocument {
  const roots = selectionRoots(design, ids);
  if (!roots.length) return design;
  const selected = new Set<string>();
  for (const root of roots) {
    selected.add(root.id);
    for (const layer of descendants(design, root.id)) selected.add(layer.id);
  }
  const nextIds = new Map([...selected].map(id => [id, crypto.randomUUID()]));
  const clones = design.layers.filter(layer => selected.has(layer.id)).map(layer => ({
    ...layer, id: nextIds.get(layer.id)!, name: `${layer.name.slice(0, 95)} copy`,
    parentId: layer.parentId === null ? null : nextIds.get(layer.parentId) ?? layer.parentId,
    x: layer.x + offset, y: layer.y + offset, locked: false,
  }));
  return checked({ ...design, layers: [...design.layers, ...clones] });
}

/** Each sibling list reorders independently, preserving selected relative order and descendants. */
export function reorderLayers(design: DesignDocument, ids: readonly string[], direction: LayerOrder): DesignDocument {
  const selected = new Set(selectionRoots(design, ids).filter(layer => !isLayerLocked(design, layer.id)).map(layer => layer.id));
  if (!selected.size) return design;
  const siblings = new Map<string, DesignLayer[]>();
  for (const layer of design.layers) {
    const key = `${layer.artboardId}:${layer.parentId ?? ''}`;
    siblings.set(key, [...siblings.get(key) ?? [], layer]);
  }
  for (const [key, layers] of siblings) {
    if (direction === 'front' || direction === 'back') {
      const chosen = layers.filter(layer => selected.has(layer.id)), rest = layers.filter(layer => !selected.has(layer.id));
      siblings.set(key, direction === 'front' ? [...rest, ...chosen] : [...chosen, ...rest]);
    } else if (direction === 'forward') {
      for (let index = layers.length - 2; index >= 0; index--) if (selected.has(layers[index].id) && !selected.has(layers[index + 1].id)) [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
    } else {
      for (let index = 1; index < layers.length; index++) if (selected.has(layers[index].id) && !selected.has(layers[index - 1].id)) [layers[index - 1], layers[index]] = [layers[index], layers[index - 1]];
    }
  }
  const indices = new Map<string, number>();
  return checked({ ...design, layers: design.layers.map(layer => {
    const key = `${layer.artboardId}:${layer.parentId ?? ''}`;
    const index = indices.get(key) ?? 0;
    indices.set(key, index + 1);
    return siblings.get(key)![index];
  }) });
}

export function groupLayers(design: DesignDocument, ids: readonly string[], name = 'Group'): DesignDocument {
  const roots = selectionRoots(design, ids);
  if (roots.length < 2) return design;
  if (roots.some(layer => layer.artboardId !== roots[0].artboardId || layer.parentId !== roots[0].parentId)) throw new Error('Group layers from the same artboard and parent.');
  if (roots.some(layer => isLayerLocked(design, layer.id))) throw new Error('Unlock these layers before grouping them.');
  const bounds = layerBounds(design, roots.map(layer => layer.id))!;
  const group = createLayer('group', roots[0].artboardId, { ...bounds, parentId: roots[0].parentId, name });
  const selected = new Set(roots.map(layer => layer.id));
  const last = Math.max(...roots.map(layer => design.layers.indexOf(layer)));
  const layers = design.layers.map(layer => selected.has(layer.id) ? { ...layer, parentId: group.id } : layer);
  layers.splice(last + 1, 0, group);
  return checked({ ...design, layers });
}

export function ungroupLayers(design: DesignDocument, ids: readonly string[]): DesignDocument {
  let current = design;
  for (const id of ids) {
    const group = current.layers.find(layer => layer.id === id && layer.type === 'group');
    if (!group || isLayerLocked(current, id)) continue;
    const affected = new Set(descendants(current, group.id).map(layer => layer.id));
    const angle = group.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const direct = current.layers.filter(layer => layer.parentId === id);
    const translations = new Map<string, { x: number; y: number }>();
    for (const child of direct) {
      const x = child.x - group.x, y = child.y - group.y;
      const translation = { x: group.x + x * c - y * s - child.x, y: group.y + x * s + y * c - child.y };
      translations.set(child.id, translation);
      for (const nested of descendants(current, child.id)) translations.set(nested.id, translation);
    }
    current = checked({ ...current, layers: current.layers.filter(layer => layer.id !== id).map(layer => {
      if (!affected.has(layer.id)) return layer;
      const translation = translations.get(layer.id)!;
      return {
        ...layer,
        x: layer.x + translation.x, y: layer.y + translation.y,
        parentId: layer.parentId === id ? group.parentId : layer.parentId,
        rotation: layer.parentId === id ? ((layer.rotation + group.rotation) % 360 + 360) % 360 : layer.rotation,
        visible: layer.parentId === id ? layer.visible && group.visible : layer.visible,
        opacity: layer.parentId === id ? layer.opacity * group.opacity : layer.opacity,
      };
    }) });
  }
  return current;
}

export function alignLayers(design: DesignDocument, ids: readonly string[], alignment: Alignment): DesignDocument {
  const roots = selectionRoots(design, ids).filter(layer => !isLayerLocked(design, layer.id));
  if (!roots.length) return design;
  if (roots.some(layer => layer.artboardId !== roots[0].artboardId || layer.parentId !== roots[0].parentId)) throw new Error('Align layers from the same artboard and parent.');
  const board = design.artboards.find(value => value.id === roots[0].artboardId)!;
  const parent = roots[0].parentId === null ? null : design.layers.find(value => value.id === roots[0].parentId)!;
  const target = roots.length === 1 ? parent ?? { x: 0, y: 0, width: board.width, height: board.height } : layerBounds(design, roots.map(layer => layer.id))!;
  let current = design;
  for (const layer of roots) {
    const bounds = rectBounds(layer);
    const dx = alignment === 'left' ? target.x - bounds.x : alignment === 'center' ? target.x + target.width / 2 - bounds.x - bounds.width / 2 : alignment === 'right' ? target.x + target.width - bounds.x - bounds.width : 0;
    const dy = alignment === 'top' ? target.y - bounds.y : alignment === 'middle' ? target.y + target.height / 2 - bounds.y - bounds.height / 2 : alignment === 'bottom' ? target.y + target.height - bounds.y - bounds.height : 0;
    current = moveLayers(current, [layer.id], dx, dy);
  }
  return current;
}

export function snapMove(design: DesignDocument, ids: readonly string[], dx: number, dy: number, threshold = 6): { dx: number; dy: number; guides: SnapGuide[] } {
  const roots = selectionRoots(design, ids);
  const bounds = layerBounds(design, ids);
  if (!bounds || !roots.length || roots.some(layer => layer.artboardId !== roots[0].artboardId || layer.parentId !== roots[0].parentId)) return { dx, dy, guides: [] };
  const excluded = new Set<string>();
  for (const root of roots) { excluded.add(root.id); for (const layer of descendants(design, root.id)) excluded.add(layer.id); }
  const board = design.artboards.find(value => value.id === roots[0].artboardId)!;
  const parent = roots[0].parentId === null ? null : design.layers.find(layer => layer.id === roots[0].parentId)!;
  const targets: Bounds[] = [parent ?? { x: 0, y: 0, width: board.width, height: board.height }, ...design.layers.filter(layer => layer.artboardId === board.id && layer.parentId === roots[0].parentId && !excluded.has(layer.id) && layer.visible).map(rectBounds)];
  const guides: SnapGuide[] = [];
  for (const axis of ['x', 'y'] as const) {
    const size = axis === 'x' ? 'width' : 'height';
    const delta = axis === 'x' ? dx : dy;
    const edges = [bounds[axis] + delta, bounds[axis] + delta + bounds[size] / 2, bounds[axis] + delta + bounds[size]];
    let correction: { distance: number; position: number } | undefined;
    for (const target of targets) for (const position of [target[axis], target[axis] + target[size] / 2, target[axis] + target[size]]) for (const edge of edges) {
      const distance = position - edge;
      if (Math.abs(distance) <= threshold && (!correction || Math.abs(distance) < Math.abs(correction.distance))) correction = { distance, position };
    }
    if (correction) {
      if (axis === 'x') dx += correction.distance; else dy += correction.distance;
      guides.push({ axis, position: correction.position });
    }
  }
  return { dx, dy, guides };
}
