import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { designCode } from '../src/canvas/code';
import { buildSiteFiles, pageFile } from '../src/canvas/exportSite';
import { EditorStore } from '../src/canvas/store';
import { detachInstance, instancesOf, instantiate } from '../src/doc/components';
import { addPage, createNode, createSiteDoc, insertNode, insertNodes, updateNode } from '../src/doc/ops';
import { linkSchema, siteDocSchema, type SiteDoc } from '../src/doc/schema';
import { addVariable, removeVariable, updateVariable } from '../src/doc/variables';
import { LIBRARY, previewDoc, THEMES } from '../src/library/catalog';
import { pageCss, pageDecls } from '../src/render/css';
import { SitePage } from '../src/render/SitePage';

const solid = (color: string) => [{ type: 'solid' as const, color, visible: true }];
function twoPages(): SiteDoc {
  let doc = addPage(createSiteDoc('Acme Studio'), 'About', '/about');
  const [home, about] = doc.pages;
  doc = insertNode(doc, createNode('text', { id: 'to-about', text: 'About us', link: { type: 'page', pageId: about.id } }), home.rootId);
  doc = insertNode(doc, createNode('text', { id: 'out', text: 'Docs', link: { type: 'url', href: 'https://example.com/docs', newTab: true } }), home.rootId);
  doc = insertNode(doc, createNode('text', { id: 'to-home', text: 'Home', link: { type: 'page', pageId: home.id } }), about.rootId);
  return doc;
}
const render = (doc: SiteDoc, pageId: string, props: object = {}) => renderToStaticMarkup(createElement(SitePage, { doc, pageId, mode: 'responsive', scope: 'site', ...props }));

describe('links', () => {
  it('render as anchors on the site and stay inert on the design canvas', () => {
    const doc = twoPages();
    expect(siteDocSchema.safeParse(doc).success).toBe(true);
    const html = render(doc, doc.pages[0].id);
    expect(html).toContain(`<a class="n-to-about" href="/about" data-apl-page="${doc.pages[1].id}">About us</a>`);
    expect(html).toContain('<a class="n-out" href="https://example.com/docs" target="_blank" rel="noopener noreferrer">Docs</a>');
    expect(render(doc, doc.pages[0].id, { annotate: true })).not.toContain('<a ');
  });
  it('only accepts safe addresses', () => {
    const ok = (href: string) => linkSchema.safeParse({ type: 'url', href, newTab: false }).success;
    expect(ok('https://example.com')).toBe(true);
    expect(ok('mailto:hi@example.com')).toBe(true);
    expect(ok('/pricing')).toBe(true);
    expect(ok('javascript:alert(1)')).toBe(false);
    expect(ok('https://x.com/"><script>')).toBe(false);
  });
});

describe('export website', () => {
  it('writes one page per file with relative links, fonts and a read-me', () => {
    const doc = twoPages();
    const files = buildSiteFiles(doc);
    expect(Object.keys(files).sort()).toEqual(['README.txt', 'about/index.html', 'index.html', 'robots.txt']);
    const home = files['index.html'] as string, about = files['about/index.html'] as string;
    expect(home.startsWith('<!doctype html>')).toBe(true);
    expect(home).toContain('<title>Acme Studio</title>');
    expect(home).toContain('href="about/index.html"');
    expect(about).toContain('href="../index.html"');
    expect(home).toContain('fonts.googleapis.com/css2?family=Inter');
    expect(buildSiteFiles(previewDoc(LIBRARY.find(item => item.id === 'feature-cards')!, THEMES[0]))['index.html']).toContain('@media (max-width: 767.98px)');
    expect(pageFile(doc.pages[1])).toBe('about/index.html');
  });
  it('writes images as files and includes animation code only when needed', () => {
    let doc = createSiteDoc('Shop');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    doc = { ...doc, assets: { pic: { id: 'pic', name: 'Pic', mime: 'image/png', dataUrl: png, width: 1, height: 1 } } };
    doc = insertNode(doc, createNode('image', { id: 'photo', assetId: 'pic', alt: 'A dot' }), doc.pages[0].rootId);
    const files = buildSiteFiles(doc);
    expect(files['assets/pic.png']).toBeInstanceOf(Uint8Array);
    expect((files['assets/pic.png'] as Uint8Array)[1]).toBe(0x50); // "P" of the PNG signature
    expect(files['index.html']).toContain('src="assets/pic.png"');
    expect(files['index.html']).not.toContain('IntersectionObserver');
    const animated = buildSiteFiles(previewDoc(LIBRARY.find(item => item.id === 'motion-reveal-cards')!, THEMES[0]));
    expect(animated['index.html']).toContain('IntersectionObserver');
    expect(animated['index.html']).toContain('@keyframes apl-in-fadeUp');
  });
});

describe('site colors', () => {
  it('layers follow a color variable, with dark values for dark mode', () => {
    let doc = createSiteDoc('Test');
    const root = doc.pages[0].rootId;
    const added = addVariable(doc, 'Brand', '#2563EB');
    doc = updateVariable(added.doc, added.id, { dark: '#93C5FD' });
    doc = insertNode(doc, createNode('rect', { id: 'box', fills: [{ type: 'solid', color: '#2563EB', visible: true, variable: added.id }], stroke: { color: '#2563EB', weight: 1, align: 'inside', style: 'solid', variable: added.id } }), root);
    expect(siteDocSchema.safeParse(doc).success).toBe(true);
    const decls = pageDecls(doc, root, 'desktop', () => undefined).get('box')!;
    expect(decls['background-color']).toBe(`var(--c-${added.id}, #2563EB)`);
    expect(decls.outline).toContain(`var(--c-${added.id}, #2563EB)`);
    const css = pageCss(doc, root, { scope: 'site', mode: 'responsive', assetUrl: () => undefined });
    expect(css).toContain(`.site{--c-${added.id}:#2563EB}`);
    expect(css).toContain(`.site[data-theme="dark"]{--c-${added.id}:#93C5FD}`);
    expect(css).toContain(`@media (prefers-color-scheme: dark){.site:not([data-theme]){--c-${added.id}:#93C5FD}}`);
    expect(render(doc, doc.pages[0].id, { theme: 'dark' })).toContain('<div class="site" data-theme="dark">');

    // Changing the light value updates the stored fallback; removing the color leaves a plain fill.
    doc = updateVariable(doc, added.id, { light: '#111111' });
    expect(doc.nodes.box.fills[0]).toMatchObject({ color: '#111111', variable: added.id });
    doc = removeVariable(doc, added.id);
    expect(doc.nodes.box.fills[0]).toEqual({ type: 'solid', color: '#111111', visible: true });
    expect(doc.nodes.box.stroke).not.toHaveProperty('variable');
    expect(pageCss(doc, root, { scope: 'site', mode: 'responsive', assetUrl: () => undefined })).not.toContain('--c-');
  });
});

describe('components', () => {
  function withButton() {
    let doc = createSiteDoc('Test');
    const root = doc.pages[0].rootId;
    doc = insertNode(doc, createNode('frame', { id: 'btn', name: 'Button', x: 20, y: 20, width: 120, height: 40, fills: solid('#111111'), component: true }), root);
    doc = insertNode(doc, createNode('text', { id: 'label', text: 'Buy now', fills: solid('#FFFFFF') }), 'btn');
    return { doc, root };
  }

  it('instances follow their main component but keep their own text, place and size', () => {
    const { doc, root } = withButton();
    const store = new EditorStore(doc);
    store.commit(current => insertNodes(current, instantiate(current, 'btn'), root));
    const instance = () => instancesOf(store.getState().doc, 'btn')[0];
    const label = () => store.getState().doc.nodes[instance().children[0]] as { id: string; text: string; fills: unknown; sourceId?: string };
    expect(instance().component).toBeUndefined();
    expect(label().sourceId).toBe('label');

    const labelId = label().id;
    store.commit(current => updateNode(current, instance().id, { x: 300, width: 200 }));
    store.commit(current => updateNode(current, labelId, { text: 'Learn more' }));
    // Edit the main: color, label styling and a new layer.
    store.commit(current => updateNode(current, 'btn', { fills: solid('#2563EB') }));
    store.commit(current => updateNode(current, 'label', { fills: solid('#FFFF00'), text: 'Buy today' }));
    store.commit(current => insertNode(current, createNode('rect', { id: 'dot', width: 8, height: 8 }), 'btn'));

    expect(instance().fills).toEqual(solid('#2563EB'));
    expect([instance().x, instance().width]).toEqual([300, 200]);
    expect(label().id).toBe(labelId); // layer ids are stable across updates
    expect(label().text).toBe('Learn more');
    expect(label().fills).toEqual(solid('#FFFF00'));
    expect(instance().children).toHaveLength(2);
    expect(siteDocSchema.safeParse(store.getState().doc).success).toBe(true);

    // One undo step reverts the main and its instances together.
    store.undo();
    expect(instance().children).toHaveLength(1);
  });

  it('detached instances stop following the main component', () => {
    const { doc, root } = withButton();
    const store = new EditorStore(doc);
    store.commit(current => insertNodes(current, instantiate(current, 'btn'), root));
    const id = instancesOf(store.getState().doc, 'btn')[0].id;
    store.commit(current => detachInstance(current, id));
    store.commit(current => updateNode(current, 'btn', { fills: solid('#FF0000') }));
    expect(store.getState().doc.nodes[id].fills).toEqual(solid('#111111'));
    expect(instancesOf(store.getState().doc, 'btn')).toHaveLength(0);
  });
});

describe('gradient-filled vectors', () => {
  it('define an SVG gradient and reference it, on the site and in copied code', () => {
    let doc = createSiteDoc('Test');
    doc = insertNode(doc, createNode('vector', { id: 'star', name: 'Star', path: 'M0 0L100 0L50 100Z', fills: [{ type: 'linear', angle: 90, stops: [{ offset: 0, color: '#FF0000' }, { offset: 1, color: '#0000FF' }], visible: true }] }), doc.pages[0].rootId);
    expect(pageDecls(doc, doc.pages[0].rootId, 'desktop', () => undefined).get('star')!.fill).toBe('url(#g-star)');
    const html = render(doc, doc.pages[0].id);
    expect(html).toContain('<linearGradient id="g-star" x1="0%" y1="50%" x2="100%" y2="50%"><stop offset="0%" stop-color="#FF0000"></stop><stop offset="100%" stop-color="#0000FF"></stop></linearGradient>');
    expect(designCode(doc, 'star', 'Star').react).toContain('<stop offset="100%" stopColor="#0000FF" />');
  });
});
