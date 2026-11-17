import { readdirSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createNode, createSiteDoc, DEFAULT_LAYOUT, insertNode, updateNode } from '../src/doc/ops';
import { lumenSample } from '../src/doc/samples';
import type { SiteDoc, SiteNode } from '../src/doc/schema';
import { nodeDecls, pageCss, pageDecls } from '../src/render/css';
import { resolveNode } from '../src/render/resolve';
import { SitePage } from '../src/render/SitePage';

const none = () => undefined;
const ctx = (parent: SiteNode | null, parentIsRoot = false) => ({ breakpoint: 'desktop' as const, parent, parentIsRoot, assetUrl: none });
const parentFrame = (mode: 'none' | 'horizontal' | 'vertical' | 'grid', width = 1000, height = 500) =>
  createNode('frame', { id: 'p', width, height, layout: { ...DEFAULT_LAYOUT, mode } });

describe('node → CSS mapping', () => {
  it('renders the page root at full viewport width', () => {
    const root = createNode('frame', { height: 900, sizing: { h: 'fill', v: 'fixed' } });
    expect(nodeDecls(root, ctx(null))).toMatchObject({ position: 'relative', width: '100%', 'min-height': '900px', display: 'block' });
  });

  it('maps auto layout to flexbox with gap, padding and alignment', () => {
    const frame = createNode('frame', { layout: { ...DEFAULT_LAYOUT, mode: 'horizontal', gap: 12, padding: [8, 16, 8, 16], alignMain: 'spaceBetween', alignCross: 'center' } });
    expect(nodeDecls(frame, ctx(parentFrame('none')))).toMatchObject({
      display: 'flex', 'flex-direction': 'row', 'column-gap': '12px', padding: '8px 16px 8px 16px', 'justify-content': 'space-between', 'align-items': 'center', 'flex-wrap': 'nowrap',
    });
    const grid = createNode('frame', { layout: { ...DEFAULT_LAYOUT, mode: 'grid', gridColumns: 3, gap: 24, counterGap: 16 } });
    expect(nodeDecls(grid, ctx(parentFrame('none')))).toMatchObject({ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', 'column-gap': '24px', 'row-gap': '16px' });
  });

  it('maps fixed / hug / fill sizing inside auto layout', () => {
    const row = parentFrame('horizontal');
    expect(nodeDecls(createNode('rect', { width: 120, height: 40 }), ctx(row))).toMatchObject({ flex: '0 0 auto', width: '120px', height: '40px', position: 'relative' });
    expect(nodeDecls(createNode('rect', { sizing: { h: 'fill', v: 'fill' } }), ctx(row))).toMatchObject({ flex: '1 1 0px', width: 'auto', 'min-width': '0', 'align-self': 'stretch' });
    const column = parentFrame('vertical');
    expect(nodeDecls(createNode('text', { sizing: { h: 'fill', v: 'hug' } }), ctx(column))).toMatchObject({ width: '100%', height: 'auto', flex: '0 0 auto', 'white-space': 'pre-wrap' });
    expect(nodeDecls(createNode('text'), ctx(column))).toMatchObject({ width: 'auto', 'white-space': 'pre' });
    // Hug is only meaningful for text and auto-layout frames.
    expect(nodeDecls(createNode('rect', { width: 50, sizing: { h: 'hug', v: 'hug' } }), ctx(column))).toMatchObject({ width: '50px' });
  });

  it('maps constraints for freely positioned layers', () => {
    const parent = parentFrame('none', 1000, 500);
    const at = (constraints: SiteNode['constraints']) => nodeDecls(createNode('rect', { x: 100, y: 50, width: 200, height: 100, constraints }), ctx(parent));
    expect(at({ h: 'left', v: 'top' })).toMatchObject({ position: 'absolute', left: '100px', top: '50px', width: '200px', height: '100px' });
    expect(at({ h: 'right', v: 'bottom' })).toMatchObject({ right: '700px', bottom: '350px' });
    expect(at({ h: 'leftRight', v: 'topBottom' })).toMatchObject({ left: '100px', right: '700px', width: 'auto', top: '50px', bottom: '350px', height: 'auto' });
    expect(at({ h: 'center', v: 'center' })).toMatchObject({ left: 'calc(50% + -300px)', top: 'calc(50% + -150px)', transform: 'translate(-50%, -50%)' });
    expect(at({ h: 'scale', v: 'scale' })).toMatchObject({ left: '10%', width: '20%', top: '10%', height: '20%' });
    // Children of the page root measure from the breakpoint width.
    const root = parentFrame('none', 100, 500);
    expect(nodeDecls(createNode('rect', { x: 1240, width: 100, constraints: { h: 'right', v: 'top' } }), ctx(root, true))).toMatchObject({ right: '100px' });
    // Absolute layers inside auto layout ignore the flow.
    expect(nodeDecls(createNode('rect', { absolute: true }), ctx(parentFrame('vertical')))).toMatchObject({ position: 'absolute' });
  });

  it('maps paints, strokes, effects, radius, rotation, opacity and visibility', () => {
    const rect = createNode('rect', {
      fills: [
        { type: 'solid', color: '#FF0000', visible: true },
        { type: 'linear', angle: 90, stops: [{ offset: 1, color: '#00000000' }, { offset: 0, color: '#000000' }], visible: true },
        { type: 'solid', color: '#00FF00', visible: false },
      ],
      stroke: { color: '#111111', weight: 2, align: 'inside', style: 'dashed' },
      effects: [{ type: 'dropShadow', x: 0, y: 4, blur: 8, spread: 0, color: '#00000033', visible: true }, { type: 'backgroundBlur', radius: 10, visible: true }],
      radius: [4, 8, 12, 16], rotation: 15, opacity: 0.5,
    });
    const decls = nodeDecls(rect, ctx(parentFrame('none')));
    expect(decls.background).toBe('linear-gradient(90deg, #000000 0%, #00000000 100%), linear-gradient(#FF0000, #FF0000)');
    expect(decls).toMatchObject({ outline: '2px dashed #111111', 'outline-offset': '-2px', 'box-shadow': '0px 4px 8px 0px #00000033', 'backdrop-filter': 'blur(10px)', 'border-radius': '4px 8px 12px 16px', transform: 'rotate(15deg)', opacity: '0.5' });
    expect(nodeDecls(createNode('ellipse'), ctx(parentFrame('none')))['border-radius']).toBe('50%');
    expect(nodeDecls(createNode('rect', { visible: false }), ctx(parentFrame('none'))).display).toBe('none');
    const gradientText = createNode('text', { fills: [{ type: 'linear', angle: 0, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#FFFFFF' }], visible: true }] });
    expect(nodeDecls(gradientText, ctx(parentFrame('none')))).toMatchObject({ color: 'transparent', 'background-clip': 'text' });
  });

  it('ignores unsafe asset URLs', () => {
    const rect = createNode('rect', { fills: [{ type: 'image', assetId: 'a', fit: 'cover', visible: true }, { type: 'solid', color: '#000000', visible: true }] });
    const decls = nodeDecls(rect, { ...ctx(parentFrame('none')), assetUrl: () => 'x") ; } body { display:none' });
    expect(decls.background).toBe('linear-gradient(#000000, #000000)');
    const ok = nodeDecls(rect, { ...ctx(parentFrame('none')), assetUrl: () => '/assets/photo.png' });
    expect(ok.background).toContain('url("/assets/photo.png") center / cover no-repeat');
  });
});

describe('breakpoints', () => {
  it('resolves tablet then mobile overrides with shallow nested merges', () => {
    const doc = lumenSample();
    const features = doc.nodes.features;
    const desktop = resolveNode(features, 'desktop');
    expect(desktop.type === 'frame' && desktop.layout.gridColumns).toBe(3);
    const tablet = resolveNode(features, 'tablet'), mobile = resolveNode(features, 'mobile');
    expect(tablet.type === 'frame' && [tablet.layout.gridColumns, tablet.layout.gap]).toEqual([2, 24]);
    expect(mobile.type === 'frame' && [mobile.layout.gridColumns, mobile.layout.gap, mobile.layout.mode]).toEqual([1, 16, 'grid']);
    expect(features.overrides.tablet?.layout).toEqual({ gridColumns: 2, padding: [72, 40, 72, 40] }); // source untouched
  });

  it('emits desktop-first media queries containing only differences, with resets', () => {
    const css = pageCss(lumenSample(), 'home', { scope: 'site', mode: 'responsive', assetUrl: none });
    const [base, tablet, mobile] = css.split('@media');
    expect(base).toContain('.site .n-features{display:grid');
    expect(tablet).toContain('(max-width: 1023.98px)');
    expect(tablet).toMatch(/\.site \.n-features\{[^}]*grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
    expect(tablet).toContain('.site .n-headline{font-size:56px}');
    expect(tablet).not.toContain('n-footer{'); // unchanged at tablet
    expect(mobile).toContain('(max-width: 767.98px)');
    expect(mobile).toContain('.site .n-links{display:none}');
    expect(mobile).toMatch(/\.site \.n-footer\{[^}]*flex-direction:column/);
    expect(mobile).toMatch(/\.site \.n-headline\{[^}]*font-size:40px/);
  });

  it('a fixed-breakpoint stylesheet equals that breakpoint\'s resolved declarations', () => {
    const doc = lumenSample();
    const css = pageCss(doc, 'home', { scope: 'm', mode: { breakpoint: 'mobile' }, assetUrl: none });
    expect(css).not.toContain('@media');
    expect(css).toMatch(/\.m \.n-links\{display:none;/);
    expect(pageDecls(doc, 'home', 'mobile', none).get('features')?.['grid-template-columns']).toBe('repeat(1, minmax(0, 1fr))');
  });

  it('rejects unsafe scope names', () => {
    expect(() => pageCss(lumenSample(), 'home', { scope: 'x{}', mode: 'responsive', assetUrl: none })).toThrow();
  });
});

describe('React renderer', () => {
  it('renders semantic HTML with escaped text and scoped CSS', () => {
    let doc: SiteDoc = lumenSample();
    doc = updateNode(doc, 'lede', { text: '<script>alert(1)</script>' } as never);
    const html = renderToStaticMarkup(createElement(SitePage, { doc, pageId: 'page-home', mode: 'responsive', scope: 'site' }));
    expect(html).toContain('<main class="n-home">');
    expect(html).toContain('<nav class="n-nav">');
    expect(html).toContain('<h1 class="n-headline">We design calm');
    expect(html).toContain('<h3 class="n-card-1-title">');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('<div class="n-glow" aria-hidden="true">');
    expect(html).not.toContain('data-node-id');
    const annotated = renderToStaticMarkup(createElement(SitePage, { doc, pageId: 'page-home', mode: { breakpoint: 'desktop' }, scope: 'ed', annotate: true }));
    expect(annotated).toContain('data-node-id="hero"');
  });

  it('renders images with alt text and placeholders for empty images', () => {
    const base = createSiteDoc();
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    let doc: SiteDoc = { ...base, assets: { pic: { id: 'pic', name: 'Pic', mime: 'image/png', dataUrl, width: 1, height: 1 } } };
    doc = insertNode(doc, createNode('image', { id: 'photo', assetId: 'pic', alt: 'A calm studio' }), doc.pages[0].rootId);
    doc = insertNode(doc, createNode('image', { id: 'empty' }), doc.pages[0].rootId);
    const html = renderToStaticMarkup(createElement(SitePage, { doc, pageId: doc.pages[0].id, mode: 'responsive', scope: 'site' }));
    expect(html).toContain(`<img class="n-photo" src="${dataUrl}" alt="A calm studio"`);
    expect(html).toContain('<div class="n-empty" aria-hidden="true">');
  });
});

describe('renderer portability', () => {
  it('only imports react, sibling render modules, breakpoint constants and schema types', () => {
    const dir = new URL('../src/render/', import.meta.url);
    for (const file of readdirSync(dir)) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      for (const [, typeOnly, specifier] of source.matchAll(/^import\s+(type\s+)?[^'"]*from\s+'([^']+)'/gm)) {
        const allowed = specifier === 'react' || specifier.startsWith('./') || specifier === '../doc/breakpoints' || (typeOnly && specifier === '../doc/schema');
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
    }
  });
});
