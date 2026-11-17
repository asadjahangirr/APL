import { describe, expect, it } from 'vitest';
import { createNode, createSiteDoc, insertNode, updateNode } from '../src/doc/ops';
import { siteDocSchema, type SiteDoc } from '../src/doc/schema';
import { overrideSummary, viewDoc } from '../src/canvas/breakpointView';
import { designCode, formatCss } from '../src/canvas/code';
import { EditorStore } from '../src/canvas/store';
import { LIBRARY, previewDoc, THEMES } from '../src/library/catalog';

function sample(): SiteDoc {
  const doc = createSiteDoc('Test');
  const root = doc.pages[0].rootId;
  let next = insertNode(doc, createNode('text', { id: 'title', text: 'Hello', sizing: { h: 'fixed', v: 'hug' }, width: 400 }), root);
  next = insertNode(next, createNode('frame', { id: 'box', x: 40, y: 40, width: 300, height: 200 }), root);
  return next;
}

describe('editing at a breakpoint', () => {
  it('stores responsive edits as overrides and leaves the desktop design alone', () => {
    const store = new EditorStore(sample());
    store.setBreakpoint('mobile');
    store.commit(doc => updateNode(doc, 'title', { textStyle: { ...(doc.nodes.title as { textStyle: object }).textStyle, fontSize: 28 }, width: 320 }));
    const { real, doc } = store.getState();
    expect((real.nodes.title as { textStyle: { fontSize: number } }).textStyle.fontSize).toBe(16);
    expect(real.nodes.title.width).toBe(400);
    expect(real.nodes.title.overrides.mobile).toEqual({ textStyle: { fontSize: 28 }, width: 320 });
    expect(real.nodes.title.overrides.tablet).toBeUndefined();
    expect((doc.nodes.title as { textStyle: { fontSize: number } }).textStyle.fontSize).toBe(28);
    expect(siteDocSchema.safeParse(real).success).toBe(true);
    store.setBreakpoint('desktop');
    expect(store.getState().doc).toBe(store.getState().real);
  });

  it('tablet changes carry down to mobile; text and new layers are shared by every size', () => {
    const store = new EditorStore(sample());
    store.setBreakpoint('tablet');
    store.commit(doc => updateNode(doc, 'box', { visible: false }));
    store.commit(doc => updateNode(doc, 'title', { text: 'Hello there' } as never));
    store.commit(doc => insertNode(doc, createNode('rect', { id: 'added' }), doc.pages[0].rootId));
    const real = store.getState().real;
    expect(real.nodes.box.visible).toBe(true);
    expect(real.nodes.box.overrides.tablet).toEqual({ visible: false });
    expect((real.nodes.title as { text: string }).text).toBe('Hello there');
    expect(real.nodes.added.overrides).toEqual({});
    expect(viewDoc(real, 'mobile').nodes.box.visible).toBe(false);
    expect(overrideSummary(real.nodes.box, 'tablet')).toEqual(['visibility']);
  });

  it('undo, redo and reset work on breakpoint edits; the view is cached and the page is device-wide', () => {
    const store = new EditorStore(sample());
    store.setBreakpoint('mobile');
    const root = store.getState().doc.pages[0].rootId;
    expect(store.getState().doc.nodes[root].width).toBe(390);
    expect(viewDoc(store.getState().real, 'mobile')).toBe(store.getState().doc);
    store.commit(doc => updateNode(doc, 'box', { opacity: 0.5 }));
    expect(store.getState().doc.nodes.box.opacity).toBe(0.5);
    store.undo();
    expect(store.getState().real.nodes.box.overrides).toEqual({});
    store.redo();
    expect(store.getState().real.nodes.box.overrides.mobile).toEqual({ opacity: 0.5 });
    // Reset: dropping the override object restores the larger-screen value.
    store.commit(doc => ({ ...doc, nodes: { ...doc.nodes, box: { ...doc.nodes.box, overrides: {} } } }));
    expect(store.getState().doc.nodes.box.opacity).toBe(1);
    expect(store.getState().real.nodes[root].width).toBe(1440);
  });
});

describe('copy code', () => {
  it('produces standalone HTML and a React component for every design', () => {
    for (const item of LIBRARY) {
      const code = designCode(previewDoc(item, THEMES[1]), 'root', item.name);
      expect(code.html, item.id).toContain('<style>');
      expect(code.html).not.toMatch(/class="n-|\.n-[a-z0-9]/);
      expect(code.react).toMatch(/export default function [A-Z][A-Za-z0-9]*\(\)/);
      expect(code.react).toContain('<style>{css}</style>');
    }
  });

  it('uses readable class names, responsive rules, fonts and animation code', () => {
    const code = designCode(previewDoc(LIBRARY.find(item => item.id === 'motion-reveal-cards')!, THEMES[1]), 'root', 'Reveal cards');
    expect(code.html).toContain('<div class="apl-reveal-cards">');
    expect(code.html).toContain('<section class="reveal-features">');
    expect(code.html).toContain('.apl-reveal-cards .reveal-features {');
    expect(code.html).toContain('@media (max-width: 767.98px) {');
    expect(code.html).toContain('fonts.googleapis.com/css2?family=Sora');
    expect(code.html).toContain('@keyframes apl-in-fadeUp');
    expect(code.html).toContain('IntersectionObserver');
    expect(code.react).toContain("import { useEffect, useRef } from 'react';");
    expect(code.react).toContain('className="reveal-features"');
  });

  it('escapes text and exports a single selected layer in a wrapper', () => {
    let doc = createSiteDoc('Test');
    doc = insertNode(doc, createNode('text', { id: 'note', name: 'Note', text: 'a < b & {c}', x: 300, y: 200 }), doc.pages[0].rootId);
    const code = designCode(doc, 'note', 'Note');
    expect(code.html).toContain('<p class="note">a &lt; b &amp; {c}</p>');
    expect(code.react).toContain('<p className="note">{"a < b & {c}"}</p>');
    expect(code.html).not.toContain('left: 300px');
    expect(code.html).toContain('<div class="wrap">');
  });

  it('formats declarations without breaking data URLs', () => {
    expect(formatCss('.a .b{color:red;background:url("data:image/png;base64,AAAA") center / cover no-repeat}')).toBe('.a .b {\n  color: red;\n  background: url("data:image/png;base64,AAAA") center / cover no-repeat;\n}');
  });
});
