import { describe, expect, it } from 'vitest';
import { createArtboard, createLayer, designSchema, emptyDesign, MAX_DESIGN_DEPTH } from '../src/design/schema';

function fixture() {
  const design = emptyDesign();
  design.artboards.push(createArtboard({ id: 'desktop', name: 'Home desktop' }), createArtboard({ id: 'mobile', name: 'Home mobile', x: 1600, width: 390, height: 844 }));
  design.assets.push({ id: 'picture', name: 'A local raster', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 16, height: 16 });
  design.colors.push({ id: 'ink', name: 'Ink', value: '#22342a' });
  design.typeStyles.push({ id: 'title', name: 'Title', fontFamily: 'Georgia', fontSize: 64, fontWeight: 400, lineHeight: 1.1 });
  design.layers.push(
    createLayer('frame', 'desktop', { id: 'hero', width: 1200, height: 800 }),
    createLayer('text', 'desktop', { id: 'heading', parentId: 'hero', text: 'A design that stays editable', colorStyleId: 'ink', typeStyleId: 'title' }),
    createLayer('image', 'mobile', { id: 'mobile-image', assetId: 'picture' }),
  );
  return design;
}

describe('Design document validation', () => {
  it('round trips distinct artboards, parent associations, raster assets and reusable styles without mutation', () => {
    const original = fixture(), copy = structuredClone(original);
    expect(designSchema.parse(JSON.parse(JSON.stringify(original)))).toEqual(copy);
    expect(original).toEqual(copy);
    expect(designSchema.parse(emptyDesign())).toEqual(emptyDesign());
  });

  it('rejects unknown versions, properties and layer kinds', () => {
    const design = fixture();
    expect(() => designSchema.parse({ ...design, version: 2 })).toThrow();
    expect(() => designSchema.parse({ ...design, remoteScript: 'https://example.test' })).toThrow();
    expect(() => designSchema.parse({ ...design, layers: [{ ...design.layers[0], type: 'html' }] })).toThrow();
  });

  it('rejects duplicate IDs across collections, dangling references and unsupported style associations', () => {
    const design = fixture();
    expect(() => designSchema.parse({ ...design, colors: [{ ...design.colors[0], id: 'heading' }] })).toThrow();
    for (const patch of [{ artboardId: 'missing' }, { parentId: 'missing' }, { assetId: 'missing' }, { colorStyleId: 'missing' }, { typeStyleId: 'missing' }]) {
      expect(() => designSchema.parse({ ...design, layers: [{ ...design.layers[0], ...patch }] })).toThrow();
    }
    expect(() => designSchema.parse({ ...design, layers: [{ ...design.layers[0], typeStyleId: 'title' }] })).toThrow();
    expect(() => designSchema.parse({ ...design, layers: [{ ...design.layers[0], assetId: 'picture' }] })).toThrow();
  });

  it('rejects cross-artboard parents, noncontainer parents, cycles and excessive nesting', () => {
    const design = fixture();
    expect(() => designSchema.parse({ ...design, layers: design.layers.map(layer => layer.id === 'mobile-image' ? { ...layer, parentId: 'hero' } : layer) })).toThrow();
    expect(() => designSchema.parse({ ...design, layers: design.layers.map(layer => layer.id === 'hero' ? { ...layer, parentId: 'heading' } : layer) })).toThrow();
    const a = createLayer('group', 'desktop', { id: 'a', parentId: 'b' });
    const b = createLayer('group', 'desktop', { id: 'b', parentId: 'a' });
    expect(() => designSchema.parse({ ...design, layers: [a, b] })).toThrow(/cycle/);
    const nested = Array.from({ length: MAX_DESIGN_DEPTH + 2 }, (_, index) => createLayer('group', 'desktop', { id: `g${index}`, parentId: index === 0 ? null : `g${index - 1}` }));
    expect(() => designSchema.parse({ ...design, layers: nested.slice(0, MAX_DESIGN_DEPTH + 1) })).not.toThrow();
    expect(() => designSchema.parse({ ...design, layers: nested })).toThrow(/nest/);
  });

  it('rejects nonfinite geometry, remote or executable images, malformed base64, and byte limits', () => {
    const design = fixture();
    for (const patch of [{ x: Infinity }, { width: 0 }, { opacity: 2 }, { fill: 'url(javascript:evil)' }]) {
      expect(() => designSchema.parse({ ...design, layers: [{ ...design.layers[0], ...patch }] })).toThrow();
    }
    for (const dataUrl of ['https://example.test/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,', 'data:image/png;base64,abc', `data:image/png;base64,${'A'.repeat(3_000_000)}`]) {
      expect(designSchema.safeParse({ ...design, assets: [{ ...design.assets[0], dataUrl }] }).success).toBe(false);
    }
    expect(designSchema.safeParse({ ...design, assets: [{ ...design.assets[0], width: 12_000, height: 12_000 }] }).success).toBe(false);
    const assets = Array.from({ length: 8 }, (_, index) => ({ ...design.assets[0], id: `asset${index}`, dataUrl: `data:image/png;base64,${'A'.repeat(2_800_000)}` }));
    expect(() => designSchema.parse({ ...design, layers: [], assets })).toThrow(/20 MB/);
  });

  it('bounds the total decoded pixel budget across individually valid compressed images', () => {
    const design = fixture();
    const assets = Array.from({ length: 3 }, (_, index) => ({ ...design.assets[0], id: `large${index}`, width: 6000, height: 4000 }));
    expect(designSchema.safeParse({ ...design, layers: [], assets: assets.slice(0, 2) }).success).toBe(true);
    expect(() => designSchema.parse({ ...design, layers: [], assets })).toThrow(/64 million pixels/);
  });
});
