import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { pruneAssets } from '../src/canvas/actions';
import { applyViewChange, viewDoc } from '../src/canvas/breakpointView';
import { designCode } from '../src/canvas/code';
import { buildSiteFiles } from '../src/canvas/exportSite';
import { deleteVersion, listVersions, loadVersion, saveVersion } from '../src/canvas/storage';
import { cloneSubtree, createNode, createSiteDoc, DEFAULT_LAYOUT, insertNode, insertNodes, updateNode } from '../src/doc/ops';
import { siteDocSchema, type SiteDoc, type SiteNode } from '../src/doc/schema';
import { itemById, previewDoc, THEMES } from '../src/library/catalog';
import { pageCss } from '../src/render/css';
import { embedSrc, mapSrc } from '../src/render/element';
import { SitePage } from '../src/render/SitePage';

const live = (doc: SiteDoc) => renderToStaticMarkup(createElement(SitePage, { doc, pageId: doc.pages[0].id, mode: 'responsive', scope: 'site' }));
const canvas = (doc: SiteDoc) => renderToStaticMarkup(createElement(SitePage, { doc, pageId: doc.pages[0].id, mode: { breakpoint: 'desktop' }, scope: 'ed', annotate: true }));
const css = (doc: SiteDoc, motion = false) => pageCss(doc, doc.pages[0].rootId, { scope: 'site', mode: 'responsive', assetUrl: () => undefined, motion });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** A page with an auto-layout column holding the given layers. */
function page(...nodes: SiteNode[]): SiteDoc {
  let doc = createSiteDoc('Test');
  const column = createNode('frame', { id: 'col', name: 'Column', layout: { ...DEFAULT_LAYOUT, mode: 'vertical' }, sizing: { h: 'fill', v: 'hug' }, clip: true });
  doc = insertNode(doc, column, doc.pages[0].rootId);
  for (const node of nodes) doc = insertNode(doc, node, 'col');
  return doc;
}

describe('click actions: scroll to a layer, show / hide a layer', () => {
  it('turns FAQ questions into show / hide buttons wired to their answers', () => {
    const doc = previewDoc(itemById('faq-list')!, THEMES[0]);
    const html = live(doc);
    const toggles = [...html.matchAll(/<button class="n-[^"]+" type="button" data-apl-toggle="(n-[^"]+)" aria-controls="\1" aria-expanded="(true|false)">/g)];
    expect(toggles.length).toBeGreaterThan(3);
    expect(toggles[0][2]).toBe('true');
    expect(toggles.slice(1).every(match => match[2] === 'false')).toBe(true);
    // Every answer has the id its button points at, and a rule for its flipped state.
    const sheet = css(doc);
    for (const [, id] of toggles) {
      expect(html).toContain(`id="${id}"`);
      expect(sheet).toMatch(new RegExp(`\\.site \\.${id}\\[data-apl-flip\\]\\{display:(none|block)\\}`));
    }
    expect(canvas(doc)).not.toContain('data-apl-toggle');
  });

  it('shows a hidden layer with its own layout when flipped, per screen size', () => {
    const menu = createNode('frame', { id: 'menu', name: 'Menu', visible: false, layout: { ...DEFAULT_LAYOUT, mode: 'vertical' }, overrides: { mobile: { layout: { mode: 'grid' } } } });
    const button = createNode('frame', { id: 'open', name: 'Menu button', tag: 'button', layout: { ...DEFAULT_LAYOUT, mode: 'horizontal' }, link: { type: 'toggle', targetId: 'menu' } });
    const sheet = css(page(button, menu));
    expect(sheet).toContain('.site .n-menu[data-apl-flip]{display:flex}');
    expect(sheet).toMatch(/@media \(max-width: 767\.98px\)\{[^]*?\.site \.n-menu\[data-apl-flip\]\{display:grid\}/);
  });

  it('scrolls with an in-page link to an anchored layer', () => {
    const target = createNode('frame', { id: 'pricing', name: 'Pricing' });
    const link = createNode('text', { id: 'go', text: 'See pricing', link: { type: 'scroll', targetId: 'pricing' } });
    const html = live(page(link, target));
    expect(html).toContain('<a class="n-go" href="#n-pricing">See pricing</a>');
    expect(html).toContain('id="n-pricing"');
  });

  it('keeps documents valid when a click target is deleted, and does nothing for it', () => {
    const doc = page(createNode('text', { id: 'go', text: 'Go', link: { type: 'toggle', targetId: 'gone' } }));
    expect(siteDocSchema.safeParse(doc).success).toBe(true);
    expect(live(doc)).toContain('<p class="n-go">Go</p>');
  });

  it('copies click targets with the layers: a duplicated question opens its own answer', () => {
    const doc = previewDoc(itemById('faq-list')!, THEMES[0]);
    const question = Object.values(doc.nodes).find(node => node.link?.type === 'toggle')!;
    const item = doc.nodes[question.parentId!];
    const copy = cloneSubtree(doc, item.id);
    const copiedQuestion = copy.find(node => node.link?.type === 'toggle')!;
    const copiedAnswer = copy.find(node => node.name === 'Answer')!;
    expect(copiedQuestion.link).toEqual({ type: 'toggle', targetId: copiedAnswer.id });
  });

  it('includes the show / hide script in copied code, using readable names', () => {
    const doc = previewDoc(itemById('faq-list')!, THEMES[0]);
    const code = designCode(doc, doc.nodes.root.children[0], 'FAQ');
    expect(code.html).toMatch(/data-apl-toggle="n-answer(-\d+)?"/);
    expect(code.html).toContain("addEventListener('click', toggle)");
    expect(code.html).toMatch(/\.answer(-\d+)?\[data-apl-flip\]/);
    expect(code.react).toContain('onClick={toggle}');
    expect(code.react).toContain('function toggle(event)');
  });
});

describe('layout and style features', () => {
  it('sticks layers in auto layout, with sticky turned off by a phone override', () => {
    const header = createNode('frame', { id: 'bar', name: 'Bar', sticky: 12, overrides: { mobile: { sticky: null } } });
    const sheet = css(page(header));
    expect(sheet).toMatch(/\.site \.n-bar\{[^}]*position:sticky[^}]*top:12px[^}]*z-index:5/);
    expect(sheet).toMatch(/@media \(max-width: 767.98px\)\{[^]*\.site \.n-bar\{position:relative;top:auto;z-index:unset\}/);
    // Frames clip with overflow:clip so sticky layers inside them keep working.
    expect(sheet).toMatch(/\.site \.n-col\{[^}]*overflow:clip/);
  });

  it('makes frames scroll sideways with snapping items (carousels)', () => {
    const track = createNode('frame', { id: 'track', name: 'Track', scroll: 'x', snap: true, layout: { ...DEFAULT_LAYOUT, mode: 'horizontal' } });
    let doc = page(track);
    doc = insertNode(doc, createNode('rect', { id: 'slide' }), 'track');
    const sheet = css(doc);
    expect(sheet).toMatch(/\.site \.n-track\{[^}]*overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory/);
    expect(sheet).toMatch(/\.site \.n-slide\{[^}]*scroll-snap-align:start/);
  });

  it('applies blend modes, cursors and line limits', () => {
    const text = createNode('text', { id: 't', text: 'Long text', maxLines: 2, blend: 'multiply', cursor: 'help' });
    const sheet = css(page(text));
    expect(sheet).toMatch(/\.site \.n-t\{display:-webkit-box;[^}]*-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden/);
    expect(sheet).toMatch(/\.site \.n-t\{[^}]*mix-blend-mode:multiply;cursor:help/);
  });

  it('ties scroll effects to the scroll position where browsers support it', () => {
    const doc = previewDoc(itemById('motion-parallax-gallery')!, THEMES[0]);
    const sheet = css(doc, true);
    expect(sheet).toMatch(/@supports \(animation-timeline: view\(\)\)\{\n[^]*animation-timeline:view\(\);animation-range:cover 0% cover 100%/);
    expect(sheet).toMatch(/@keyframes apl-sc-[\w-]+\{from\{translate:0 84px\}to\{translate:0 -84px\}\}/);
    expect(css(doc, false)).not.toContain('animation-timeline');
  });
});

describe('embeds: videos, maps and custom code', () => {
  it('turns video links into player addresses', () => {
    expect(embedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(embedSrc('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(embedSrc('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(embedSrc('https://example.com/widget')).toBe('https://example.com/widget');
    expect(mapSrc('Eiffel Tower, Paris')).toBe('https://www.google.com/maps?q=Eiffel%20Tower%2C%20Paris&output=embed');
  });

  it('renders code in a sandbox that cannot reach the page, and inert frames on the canvas', () => {
    const code = createNode('embed', { id: 'e', kind: 'code', code: '<b onclick="x()">Hi</b>', url: '' });
    const html = live(page(code));
    expect(html).toContain('srcDoc="&lt;b onclick=');
    expect(html).toContain('sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"');
    expect(html).not.toContain('allow-same-origin');
    expect(canvas(page(code))).toContain('pointer-events:none');
    const empty = createNode('embed', { id: 'v', kind: 'url', url: '', code: '' });
    expect(canvas(page(empty))).toContain('Embed: add a video');
    expect(live(page(empty))).not.toContain('Embed: add');
    expect(siteDocSchema.safeParse(page(code, empty)).success).toBe(true);
  });

  it('copies embeds into HTML and React code', () => {
    const doc = page(createNode('embed', { id: 'video', name: 'Video', kind: 'url', url: 'https://youtu.be/dQw4w9WgXcQ', code: '' }));
    const code = designCode(doc, 'video', 'Video');
    expect(code.html).toContain('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(code.react).toContain('allowFullScreen');
  });
});

describe('publishing settings', () => {
  const settingsDoc = () => {
    let doc = previewDoc(itemById('faq-list')!, THEMES[0]);
    doc = { ...doc, pages: [{ ...doc.pages[0], path: '/', title: 'Help', description: 'Answers' }] };
    const icon = { id: 'icon', name: 'Icon', mime: 'image/png' as const, dataUrl: PNG, width: 1, height: 1 };
    return { ...doc, assets: { icon }, settings: { transition: 'slide' as const, siteUrl: 'https://example.com/', favicon: 'icon', socialImage: 'icon', headCode: '<meta name="verify" content="abc">' } };
  };

  it('exports icons, social previews, transitions, head code, sitemap and the toggle script', () => {
    const doc = settingsDoc();
    expect(siteDocSchema.safeParse(doc).success).toBe(true);
    const files = buildSiteFiles(doc);
    const index = files['index.html'] as string;
    expect(index).toContain('<link rel="icon" href="assets/icon.png">');
    expect(index).toContain('<meta property="og:image" content="https://example.com/assets/icon.png">');
    expect(index).toContain('<link rel="canonical" href="https://example.com/">');
    expect(index).toContain('@view-transition{navigation:auto}');
    expect(index).toContain('<meta name="verify" content="abc">');
    expect(index).toMatch(/<script>\(function installSite|<script>\(function [\w$]*\(/);
    expect(files['sitemap.xml']).toContain('<loc>https://example.com/</loc>');
    expect(files['robots.txt']).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('keeps setting images when unused images are cleaned up, and rejects missing ones', () => {
    const doc = settingsDoc();
    expect(pruneAssets(doc).assets.icon).toBeDefined();
    expect(siteDocSchema.safeParse({ ...doc, assets: {} }).success).toBe(false);
  });

  it('keeps site settings changed while designing for tablet or phone', () => {
    const real = createSiteDoc('Test');
    const before = viewDoc(real, 'mobile');
    const after = { ...before, settings: { transition: 'fade' as const } };
    expect(applyViewChange(real, before, after, 'mobile').settings).toEqual({ transition: 'fade' });
  });
});

describe('version history', () => {
  it('saves, lists, restores and deletes versions of a site', async () => {
    const doc = createSiteDoc('Versioned');
    const first = await saveVersion(doc, 'First');
    const changed = updateNode(doc, doc.pages[0].rootId, { name: 'Changed' });
    await saveVersion(changed, 'Second');
    const versions = await listVersions(doc.id);
    expect(versions.map(version => version.name)).toEqual(['Second', 'First']);
    expect((await loadVersion(first.id))?.nodes[doc.pages[0].rootId].name).toBe('Home');
    await deleteVersion(first.id);
    expect((await listVersions(doc.id)).map(version => version.name)).toEqual(['Second']);
    expect(await listVersions('other-site')).toEqual([]);
  });

  it('keeps only the newest 20 automatic versions', async () => {
    const doc = createSiteDoc('Busy');
    for (let i = 0; i < 23; i++) await saveVersion(doc, 'Auto ' + i, true);
    const versions = await listVersions(doc.id);
    expect(versions).toHaveLength(20);
    expect(versions.some(version => version.name === 'Auto 0')).toBe(false);
  }, 30_000);
});

// Keep insertNodes imported for future multi-layer fixtures.
void insertNodes;
