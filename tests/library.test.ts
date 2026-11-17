import { describe, expect, it } from 'vitest';
import { createSiteDoc, insertNodes } from '../src/doc/ops';
import { siteDocSchema } from '../src/doc/schema';
import { buildItem, CATEGORIES, categoryCount, LIBRARY, LIBRARY_COUNT, previewDoc, searchLibrary, THEMES } from '../src/library/catalog';
import { pageCss } from '../src/render/css';
import { motionCss } from '../src/render/motion';

describe('design library', () => {
  it('offers more than 1,000 designs with unique ids, in every category', () => {
    expect(LIBRARY_COUNT).toBeGreaterThan(1000);
    expect(new Set(LIBRARY.map(item => item.id)).size).toBe(LIBRARY.length);
    expect(new Set(THEMES.map(theme => theme.id)).size).toBe(THEMES.length);
    for (const category of CATEGORIES) expect(categoryCount(category.id), category.name).toBeGreaterThan(0);
  });

  it('builds every design in every theme as a valid, renderable document', { timeout: 120_000 }, () => {
    for (const theme of THEMES) for (const item of LIBRARY) {
      const doc = previewDoc(item, theme);
      const parsed = siteDocSchema.safeParse(doc);
      expect(parsed.success, `${item.id} in ${theme.id}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues[0])}`).toBe(true);
      expect(pageCss(doc, 'root', { scope: 'lib', mode: 'responsive', assetUrl: () => undefined, motion: true }).length).toBeGreaterThan(100);
    }
  });

  it('gives every design fresh layer ids so it can be inserted repeatedly', () => {
    const item = LIBRARY.find(value => value.id === 'hero-centered')!;
    let doc = createSiteDoc('Test');
    const root = doc.pages[0].rootId;
    for (let i = 0; i < 3; i++) for (const nodes of buildItem(item, THEMES[0])) doc = insertNodes(doc, nodes, root);
    expect(doc.nodes[root].children).toHaveLength(3);
    expect(siteDocSchema.safeParse(doc).success).toBe(true);
  });

  it('includes responsive overrides', () => {
    const doc = previewDoc(LIBRARY.find(value => value.id === 'feature-cards')!, THEMES[0]);
    const css = pageCss(doc, 'root', { scope: 'lib', mode: 'responsive', assetUrl: () => undefined });
    expect(css).toContain('@media (max-width: 767.98px)');
    expect(css).toMatch(/grid-template-columns:repeat\(1,/);
  });

  it('searches by name, tag and category', () => {
    expect(searchLibrary('pricing', 'all').length).toBeGreaterThan(3);
    expect(searchLibrary('marquee', 'all').every(item => item.category === 'motion' || item.category === 'page')).toBe(true);
    expect(searchLibrary('', 'nav').every(item => item.category === 'nav')).toBe(true);
    expect(searchLibrary('zzzz', 'all')).toHaveLength(0);
  });
});

describe('motion css', () => {
  it('emits only the keyframes in use and pauses scroll-triggered layers until seen', () => {
    const doc = previewDoc(LIBRARY.find(value => value.id === 'motion-reveal-cards')!, THEMES[0]);
    const css = motionCss(doc, 'root', 'site');
    expect(css).toContain('@keyframes apl-in-fadeUp');
    expect(css).not.toContain('apl-loop-spin');
    expect(css).toContain(':not([data-apl-in]){animation-play-state:paused}');
    expect(css).toContain('prefers-reduced-motion');
  });
  it('chains a loop after the enter animation and leaves static pages untouched', () => {
    const doc = previewDoc(LIBRARY.find(value => value.id === 'motion-float-hero')!, THEMES[0]);
    expect(motionCss(doc, 'root', 'site')).toMatch(/apl-in-zoomIn 700ms cubic-bezier\([^)]+\) 300ms backwards,apl-loop-float 5000ms ease-in-out 1000ms infinite/);
    expect(motionCss(previewDoc(LIBRARY.find(value => value.id === 'el-badges')!, THEMES[0]), 'root', 'site')).toBe('');
  });
  it('is off on the design canvas', () => {
    const doc = previewDoc(LIBRARY.find(value => value.id === 'motion-pulse-cta')!, THEMES[0]);
    expect(pageCss(doc, 'root', { scope: 'site', mode: { breakpoint: 'desktop' }, assetUrl: () => undefined })).not.toContain('@keyframes');
  });
});
