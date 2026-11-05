import type { DesignDocument } from '../design/schema';
import type { Project } from '../project/schema';

/** Stable object keys; array order retains authored stacking and reading order. */
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(entry => canonicalJSON(entry ?? null)).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => JSON.stringify(key) + ':' + canonicalJSON((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJSON(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
export function sourceFingerprint(design: DesignDocument, artboardId: string): Promise<string> {
  const layers = design.layers.filter(layer => layer.artboardId === artboardId);
  const references = (field: 'assetId' | 'colorStyleId' | 'typeStyleId') => new Set(layers.flatMap(layer => layer[field] ? [layer[field]!] : []));
  const assets = references('assetId'), colors = references('colorStyleId'), types = references('typeStyleId');
  const ordered = <T extends { id: string }>(values: T[]) => [...values].sort((a, b) => a.id.localeCompare(b.id));
  return fingerprint({ artboard: design.artboards.find(board => board.id === artboardId) ?? null, layers, assets: ordered(design.assets.filter(asset => assets.has(asset.id))), colors: ordered(design.colors.filter(style => colors.has(style.id))), typeStyles: ordered(design.typeStyles.filter(style => types.has(style.id))) });
}
export function targetFingerprint(website: Project, pageId: string, rootIds: readonly string[]): Promise<string> {
  const page = website.pages.find(page => page.id === pageId);
  if (!page) return fingerprint(null);
  const { nodes, ...settings } = page;
  const owned = new Set(rootIds);
  return fingerprint({ settings, nodes: nodes.filter(node => owned.has(node.id)), theme: website.theme, header: page.showHeader !== false && website.shared.header.enabled ? website.shared.header : null, footer: page.showFooter !== false && website.shared.footer.enabled ? website.shared.footer : null });
}
