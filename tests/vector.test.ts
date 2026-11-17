import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { designCode } from '../src/canvas/code';
import { freehandD, penD, penNode, pencilNode, polygonD, shapeNode, simplify, starD } from '../src/canvas/vector';
import { createNode, createSiteDoc, insertNode } from '../src/doc/ops';
import { pathDataSchema, siteDocSchema, type SiteDoc, type SiteNode } from '../src/doc/schema';
import { pageDecls } from '../src/render/css';
import { SitePage } from '../src/render/SitePage';

const patch = { name: 'Shape', x: 10, y: 20, width: 200, height: 100 };
function docWith(node: SiteNode): SiteDoc {
  const doc = createSiteDoc('Test');
  return insertNode(doc, node, doc.pages[0].rootId);
}

describe('vector paths', () => {
  it('builds lines and arrows from the drag direction', () => {
    const down = shapeNode('line', { x: 0, y: 0 }, { x: 200, y: 100 }, false, patch);
    expect(down.path).toBe('M0 0L200 100');
    expect(down.viewBox).toEqual([200, 100]);
    expect(shapeNode('line', { x: 0, y: 100 }, { x: 200, y: 0 }, false, patch).path).toBe('M0 100L200 0');
    // A flat line sits in the middle of its one-pixel box.
    expect(shapeNode('line', { x: 0, y: 5 }, { x: 200, y: 5 }, false, { ...patch, height: 1 }).path).toBe('M0 0.5L200 0.5');
    const arrow = shapeNode('arrow', { x: 0, y: 0 }, { x: 200, y: 0 }, false, { ...patch, height: 1 });
    expect(arrow.path.startsWith('M0 0.5L200 0.5M')).toBe(true);
    expect(arrow.stroke?.weight).toBe(2);
    expect(shapeNode('line', { x: 0, y: 0 }, { x: 0, y: 0 }, true, patch).width).toBe(100);
  });

  it('builds polygons and stars with editable settings', () => {
    expect(polygonD(4)).toBe('M50 0L100 50L50 100L0 50Z');
    expect(starD(5, 0.5).split('L')).toHaveLength(10);
    const star = shapeNode('star', { x: 0, y: 0 }, { x: 100, y: 100 }, false, patch);
    expect(star.shape).toEqual({ kind: 'star', points: 5, inner: 0.45 });
    expect(star.fills).toHaveLength(1);
  });

  it('turns pen anchors into lines and curves, and closes shapes', () => {
    expect(penD([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true)).toBe('M0 0L10 0L10 10L0 0Z');
    expect(penD([{ x: 0, y: 0 }, { x: 10, y: 0, hx: 5, hy: 0 }], false)).toBe('M0 0C0 0 5 0 10 0');
    const node = penNode([{ x: 100, y: 100 }, { x: 160, y: 140 }, { x: 100, y: 180 }], true, { x: 40, y: 40, w: 500, h: 500 }, 'Vector 1', false);
    expect([node.x, node.y, node.width, node.height]).toEqual([60, 60, 60, 80]);
    expect(node.path).toBe('M0 0L60 40L0 80L0 0Z');
    expect(node.fills).toHaveLength(1);
  });

  it('simplifies and smooths freehand strokes', () => {
    const raw = Array.from({ length: 50 }, (_, i) => ({ x: i * 2, y: i % 2 ? 0.2 : 0 }));
    expect(simplify(raw, 1.2)).toHaveLength(2);
    expect(freehandD([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }])).toBe('M0 0Q10 10 15 5L20 0');
    const node = pencilNode([{ x: 5, y: 5 }, { x: 30, y: 40 }, { x: 60, y: 5 }], { x: 0, y: 0, w: 100, h: 100 }, 'Drawing 1', true);
    expect(node.absolute).toBe(true);
    expect(pathDataSchema.safeParse(node.path).success).toBe(true);
  });

  it('rejects path data that is not plain drawing commands', () => {
    expect(pathDataSchema.safeParse('M0 0L10 10Z').success).toBe(true);
    expect(pathDataSchema.safeParse('M0 0"><script>').success).toBe(false);
    expect(siteDocSchema.safeParse(docWith(createNode('vector', { id: 'v', path: 'M0 0 url(x)' }))).success).toBe(false);
  });
});

describe('vector rendering', () => {
  const doc = docWith(createNode('vector', {
    id: 'v', ...patch, path: 'M0 0L200 100', viewBox: [200, 100], fills: [{ type: 'solid', color: '#FF0000', visible: true }],
    stroke: { color: '#111111', weight: 3, align: 'center', style: 'dashed' },
    effects: [{ type: 'dropShadow', x: 0, y: 4, blur: 8, spread: 0, color: '#00000040', visible: true }],
  }));
  const root = doc.pages[0].rootId;

  it('is a valid document and renders an inline SVG', () => {
    expect(siteDocSchema.safeParse(doc).success).toBe(true);
    const html = renderToStaticMarkup(createElement(SitePage, { doc, pageId: doc.pages[0].id, mode: { breakpoint: 'desktop' }, scope: 'site' }));
    expect(html).toContain('<svg class="n-v" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0L200 100" vector-effect="non-scaling-stroke"></path></svg>');
  });

  it('paints with SVG fill and stroke instead of background and outline', () => {
    const decls = pageDecls(doc, root, 'desktop', () => undefined).get('v')!;
    expect(decls.fill).toBe('#FF0000');
    expect(decls.stroke).toBe('#111111');
    expect(decls['stroke-width']).toBe('3px');
    expect(decls['stroke-dasharray']).toBe('9 7.5');
    expect(decls.filter).toBe('drop-shadow(0px 4px 8px #00000040)');
    expect(decls['background-color']).toBeUndefined();
    expect(decls.outline).toBeUndefined();
    expect(decls.width).toBe('200px');
  });

  it('is included in copied code', () => {
    const code = designCode(doc, 'v', 'Shape');
    expect(code.html).toContain('<svg class="shape" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">');
    expect(code.react).toContain('<path d="M0 0L200 100" vectorEffect="non-scaling-stroke" />');
  });
});
