import type { EditorData } from './config';

function encode(data: EditorData) {
  // Nested slots live in root/body props. Ignore Puck's internal indexes and empty zones.
  return JSON.stringify({ root: data.root, content: data.content });
}
function changedPaths(a: unknown, b: unknown, path = ''): string[] {
  if (a === b) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [path];
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
    .flatMap(key => changedPaths(left[key], right[key], `${path}/${key}`));
}

/** Own immutable snapshots, independent of the editor library's mutable state. */
export class DocumentHistory {
  private snapshots: string[];
  private index = 0;
  private lastEdit = -Infinity;
  private lastPaths = '';
  constructor(initial: EditorData) { this.snapshots = [encode(initial)]; }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.snapshots.length - 1; }
  get current(): EditorData { return JSON.parse(this.snapshots[this.index]); }
  record(data: EditorData, now = Date.now()): boolean {
    const snapshot = encode(data), previous = this.snapshots[this.index];
    if (snapshot === previous) return false;
    const paths = changedPaths(JSON.parse(previous), JSON.parse(snapshot)).join('|');
    const group = !this.canRedo && this.index > 0 && now - this.lastEdit < 750 && paths === this.lastPaths;
    this.snapshots = this.snapshots.slice(0, this.index + 1);
    if (group) this.snapshots[this.index] = snapshot;
    else { this.snapshots.push(snapshot); this.index++; }
    // Bound memory as well as count; always retain the current and previous state.
    while (this.snapshots.length > 50 || (this.snapshots.length > 2 && this.snapshots.reduce((n, s) => n + s.length * 2, 0) > 20_000_000)) {
      this.snapshots.shift(); this.index--;
    }
    this.lastEdit = now; this.lastPaths = paths;
    return true;
  }
  move(direction: -1 | 1): EditorData | null {
    if (direction === -1 ? !this.canUndo : !this.canRedo) return null;
    this.index += direction; this.lastEdit = -Infinity; this.lastPaths = '';
    return this.current;
  }
}
