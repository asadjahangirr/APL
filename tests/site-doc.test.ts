import { describe, expect, it } from 'vitest';
import { siteDocSchema, type SiteDoc } from '../src/doc/schema';
import {
  addPage, cloneSubtree, createNode, createSiteDoc, DocError, insertNode, insertNodes, moveNode, removeNodes, removePage,
  subtreeIds, updateNode, updateOverride, clearOverride, validateDoc, ancestorIds, pageOf,
} from '../src/doc/ops';
import { lumenSample } from '../src/doc/samples';

const rootOf = (doc: SiteDoc) => doc.pages[0].rootId;

describe('SiteDoc schema', () => {
  it('accepts a fresh document and the sample site, and round-trips through JSON', () => {
    const fresh = createSiteDoc('Test');
    expect(siteDocSchema.parse(JSON.parse(JSON.stringify(fresh)))).toEqual(fresh);
    const sample = lumenSample();
    expect(siteDocSchema.parse(JSON.parse(JSON.stringify(sample)))).toEqual(sample);
    expect(Object.keys(sample.nodes).length).toBeGreaterThan(20);
  });

  it('rejects values that could inject CSS or markup', () => {
    const doc = createSiteDoc();
    const text = createNode('text', { id: 'evil' });
    const bad = (patch: object) => insertNode(doc, { ...text, ...patch } as never, rootOf(doc));
    expect(siteDocSchema.safeParse(bad({ fills: [{ type: 'solid', color: 'red;background:url(x)', visible: true }] })).success).toBe(false);
    expect(siteDocSchema.safeParse(bad({ textStyle: { ...text.textStyle, fontFamily: 'Inter"}body{display:none' } })).success).toBe(false);
    expect(siteDocSchema.safeParse(bad({ tag: 'script' })).success).toBe(false);
    expect(siteDocSchema.safeParse(bad({ onClick: 'alert(1)' })).success).toBe(false);
    expect(siteDocSchema.safeParse({ ...doc, assets: { a: { id: 'a', name: 'x', mime: 'image/png', dataUrl: 'javascript:alert(1)', width: 1, height: 1 } } }).success).toBe(false);
  });

  it('enforces tree integrity, page roots, unique paths and a home page', () => {
    const base = createSiteDoc();
    const withRect = insertNode(base, createNode('rect', { id: 'r' }), rootOf(base));
    expect(validateDoc(withRect)).toBeTruthy();
    // child not listed by parent
    expect(siteDocSchema.safeParse({ ...withRect, nodes: { ...withRect.nodes, [rootOf(base)]: { ...withRect.nodes[rootOf(base)], children: [] } } }).success).toBe(false);
    // non-frame with children
    expect(siteDocSchema.safeParse({ ...withRect, nodes: { ...withRect.nodes, r: { ...withRect.nodes.r, children: ['x'] } } }).success).toBe(false);
    // orphan top-level node
    expect(siteDocSchema.safeParse({ ...base, nodes: { ...base.nodes, o: createNode('rect', { id: 'o' }) } }).success).toBe(false);
    // missing home page / duplicate paths
    expect(siteDocSchema.safeParse({ ...base, pages: [{ ...base.pages[0], path: '/about' }] }).success).toBe(false);
    expect(() => addPage(base, 'Again', '/')).toThrow(DocError);
    expect(siteDocSchema.safeParse(addPage(base, 'Admin', '/admin')).success).toBe(false);
  });

  it('rejects layout overrides on non-frames and missing image assets', () => {
    const base = createSiteDoc();
    const withText = insertNode(base, createNode('text', { id: 't', overrides: { mobile: { layout: { gap: 4 } } } }), rootOf(base));
    expect(siteDocSchema.safeParse(withText).success).toBe(false);
    const withImage = insertNode(base, createNode('image', { id: 'i', assetId: 'missing' }), rootOf(base));
    expect(siteDocSchema.safeParse(withImage).success).toBe(false);
  });
});

describe('document operations', () => {
  it('inserts, reorders, reparents and removes subtrees immutably', () => {
    const base = createSiteDoc();
    const root = rootOf(base);
    let doc = insertNode(base, createNode('frame', { id: 'card' }), root);
    doc = insertNode(doc, createNode('text', { id: 'a' }), 'card');
    doc = insertNode(doc, createNode('text', { id: 'b' }), 'card', 0);
    expect(doc.nodes.card.children).toEqual(['b', 'a']);
    expect(base.nodes[root].children).toEqual([]); // original untouched
    doc = moveNode(doc, 'a', 'card', 0);
    expect(doc.nodes.card.children).toEqual(['a', 'b']);
    doc = moveNode(doc, 'a', root);
    expect(doc.nodes[root].children).toEqual(['card', 'a']);
    expect(doc.nodes.a.parentId).toBe(root);
    expect(ancestorIds(doc, 'b')).toEqual(['card', root]);
    expect(pageOf(doc, 'b')?.path).toBe('/');
    expect(() => moveNode(doc, 'card', 'card')).toThrow(DocError);
    expect(() => moveNode(doc, root, 'card')).toThrow(DocError);
    expect(() => insertNode(doc, createNode('text', { id: 'c' }), 'a')).toThrow(DocError);
    doc = removeNodes(doc, ['card', 'b']);
    expect(Object.keys(doc.nodes).sort()).toEqual(['a', root].sort());
    expect(() => removeNodes(doc, [root])).toThrow(DocError);
    validateDoc(doc);
  });

  it('clones subtrees with fresh, consistent ids', () => {
    const doc = lumenSample();
    let counter = 0;
    const copy = cloneSubtree(doc, 'card-1', () => 'copy' + counter++);
    expect(copy).toHaveLength(subtreeIds(doc, 'card-1').length);
    expect(copy[0].parentId).toBeNull();
    const pasted = insertNodes(doc, copy, 'features');
    validateDoc(pasted);
    expect(pasted.nodes.features.children).toHaveLength(4);
  });

  it('patches overrides, merges nested objects and clears them', () => {
    const doc = lumenSample();
    let next = updateOverride(doc, 'hero', 'mobile', { layout: { gap: 4 } });
    expect(next.nodes.hero.overrides.mobile?.layout).toEqual({ padding: [64, 24, 80, 24], gap: 4 });
    next = clearOverride(next, 'hero', 'mobile', 'layout');
    expect(next.nodes.hero.overrides.mobile).toEqual({ width: 390 });
    next = clearOverride(next, 'hero', 'mobile');
    expect(next.nodes.hero.overrides.mobile).toBeUndefined();
    expect(() => updateNode(doc, 'hero', { parentId: null })).toThrow(DocError);
    validateDoc(updateNode(doc, 'headline', { text: 'Hello' } as never));
  });

  it('adds and removes pages but protects the home page', () => {
    let doc = addPage(createSiteDoc(), 'About', '/about');
    validateDoc(doc);
    expect(doc.pages).toHaveLength(2);
    expect(() => removePage(doc, doc.pages[0].id)).toThrow(DocError);
    doc = removePage(doc, doc.pages[1].id);
    expect(doc.pages).toHaveLength(1);
    expect(Object.keys(doc.nodes)).toHaveLength(1);
  });
});
