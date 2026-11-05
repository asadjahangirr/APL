import { designSchema, type DesignDocument } from './schema';

export const DESIGN_HISTORY_LIMIT = 50;
export const MAX_DESIGN_HISTORY_BYTES = 64_000_000;
export interface DesignHistory {
  past: DesignDocument[];
  present: DesignDocument;
  future: DesignDocument[];
}

// History owns immutable parsed snapshots, so byte measurements can be reused across gestures.
const byteSizes = new WeakMap<DesignDocument, number>();
function bytes(design: DesignDocument): number {
  const cached = byteSizes.get(design);
  if (cached !== undefined) return cached;
  const size = new TextEncoder().encode(JSON.stringify(design)).byteLength;
  byteSizes.set(design, size);
  return size;
}
function sameDesign(first: DesignDocument, second: DesignDocument): boolean {
  if (first === second) return true;
  if (first.assets.length !== second.assets.length) return false;
  if (first.assets.some((asset, index) => {
    const next = second.assets[index];
    return asset.id !== next.id || asset.name !== next.name || asset.dataUrl !== next.dataUrl || asset.width !== next.width || asset.height !== next.height;
  })) return false;
  return JSON.stringify({ ...first, assets: [] }) === JSON.stringify({ ...second, assets: [] });
}
function bounded(history: DesignHistory): DesignHistory {
  const past = [...history.past], future = [...history.future];
  while (past.length > DESIGN_HISTORY_LIMIT) past.shift();
  while (future.length > DESIGN_HISTORY_LIMIT) future.pop();
  let total = bytes(history.present) + past.reduce((sum, item) => sum + bytes(item), 0) + future.reduce((sum, item) => sum + bytes(item), 0);
  while (total > MAX_DESIGN_HISTORY_BYTES && (past.length || future.length)) {
    const removed = past.length ? past.shift()! : future.pop()!;
    total -= bytes(removed);
  }
  return { past, present: history.present, future };
}

export function createHistory(design: DesignDocument): DesignHistory {
  return { past: [], present: designSchema.parse(design), future: [] };
}
export function commitHistory(history: DesignHistory, design: DesignDocument): DesignHistory {
  const present = designSchema.parse(design);
  if (sameDesign(history.present, present)) return history;
  return bounded({ past: [...history.past, history.present], present, future: [] });
}
export function undoHistory(history: DesignHistory): DesignHistory {
  if (!history.past.length) return history;
  return bounded({ past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] });
}
export function redoHistory(history: DesignHistory): DesignHistory {
  if (!history.future.length) return history;
  return bounded({ past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) });
}
