import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { designCode } from '../src/canvas/code';
import { planInsert } from '../src/canvas/insertDesign';
import { guessInputType, upgradeInteractive } from '../src/doc/interactive';
import { addPage, createNode, createSiteDoc, DEFAULT_LAYOUT, insertNodes } from '../src/doc/ops';
import { siteDocSchema, type SiteDoc } from '../src/doc/schema';
import { itemById, LIBRARY, previewDoc, THEMES } from '../src/library/catalog';
import { SitePage } from '../src/render/SitePage';

const live = (doc: SiteDoc) => renderToStaticMarkup(createElement(SitePage, { doc, pageId: doc.pages[0].id, mode: 'responsive', scope: 'site' }));
const canvas = (doc: SiteDoc) => renderToStaticMarkup(createElement(SitePage, { doc, pageId: doc.pages[0].id, mode: { breakpoint: 'desktop' }, scope: 'ed', annotate: true }));
const design = (id: string) => previewDoc(itemById(id)!, THEMES[0]);

/** Interactive elements found inside another interactive element (invalid HTML that breaks clicks). */
function nestedInteractive(html: string): string[] {
  const stack: string[] = [], problems: string[] = [];
  for (const match of html.matchAll(/<(\/?)(a|button|label|input|textarea)\b[^>]*>/g)) {
    const [, close, tag] = match;
    if (close) { stack.pop(); continue; }
    if (stack.some(open => open === 'a' || open === 'button') || (tag === 'label' && stack.includes('label'))) problems.push(`${tag} inside ${stack.join(' > ')}`);
    if (tag !== 'input') stack.push(tag);
  }
  return problems;
}

describe('buttons, links and form fields are real elements on the site', () => {
  it('renders library buttons as <button> on the site and plain boxes on the canvas', () => {
    const doc = design('btn-offer');
    const html = live(doc);
    expect(html.match(/<button class="n-[^"]+" type="button">/g)).toHaveLength(3);
    expect(html).toContain('Claim offer</span></button>');
    expect(canvas(doc)).not.toContain('<button');
    // The base styles make them look clickable and keep the designed look.
    expect(html).toContain('.site :where(button,a,label){cursor:pointer');
    expect(html).toContain('appearance:none');
  });

  it('turns form fields into labelled inputs with the right type, and message boxes into text areas', () => {
    const html = live(design('el-inputs'));
    expect(html).toMatch(/<label class="n-[^"]+"><input class="n-[^"]+" placeholder="you@company.com" type="email"\/><\/label>/);
    expect(html).toContain('type="password"');
    expect(html).toMatch(/<textarea[^>]*placeholder="Write a few lines…"[^>]*rows="1"/);
    const editor = canvas(design('el-inputs'));
    expect(editor).not.toMatch(/<(input|textarea|label)\b/);
    expect(editor).toContain('you@company.com</span>');
  });

  it('makes nav links real links and names icon-only buttons for screen readers', () => {
    const html = live(design('nav-simple'));
    expect(html).toMatch(/<a class="n-[^"]+" href="#">/);
    expect(html).toMatch(/<button class="n-[^"]+" type="button" aria-label="Menu">/);
  });

  it('never nests links, buttons or fields inside each other in any library design', { timeout: 120_000 }, () => {
    for (const item of LIBRARY) {
      const problems = nestedInteractive(live(previewDoc(item, THEMES[0])));
      expect(problems, item.id).toEqual([]);
    }
  });

  it('keeps a linked button a single link, with its inner link flattened', () => {
    let doc = createSiteDoc('Test');
    const root = doc.pages[0].rootId;
    const label = createNode('text', { id: 'label', text: 'Go', tag: 'span', link: { type: 'url', href: '/inner', newTab: false } });
    const button = createNode('frame', { id: 'btn', name: 'Go button', tag: 'button', layout: { ...DEFAULT_LAYOUT, mode: 'horizontal' }, link: { type: 'url', href: 'https://example.com', newTab: true } });
    doc = insertNodes(doc, [{ ...button, children: ['label'] }, { ...label, parentId: 'btn' }], root);
    const html = live(doc);
    expect(html).toContain('<a class="n-btn" href="https://example.com" target="_blank" rel="noopener noreferrer"><span class="n-label">Go</span></a>');
    expect(nestedInteractive(html)).toEqual([]);
  });

  it('copies the same elements into HTML and React code', () => {
    const doc = design('el-inputs');
    const code = designCode(doc, doc.nodes.root.children[0], 'Fields');
    expect(code.html).toMatch(/<input class="[^"]+" placeholder="you@company.com" type="email">/);
    expect(code.html).toContain('<label class=');
    expect(code.react).toMatch(/<textarea className="[^"]+" placeholder="Write a few lines…" rows=\{1\} \/>/);
    const offer = design('btn-offer');
    const buttons = designCode(offer, offer.nodes.root.children[0], 'Buttons');
    expect(buttons.html).toContain('<button class="tada-button" type="button">');
  });

  it('points placeholder links at pages with the same name when a design is inserted', () => {
    let doc = createSiteDoc('Test');
    doc = addPage(doc, 'Pricing', '/pricing');
    const pricing = doc.pages.find(page => page.name === 'Pricing')!;
    const { doc: next } = planInsert(doc, doc.pages[0].rootId, [], itemById('nav-simple')!, THEMES[0]);
    const links = Object.values(next.nodes).filter(node => node.type === 'text' && node.link);
    expect(links.find(node => node.type === 'text' && node.text === 'Pricing')?.link).toEqual({ type: 'page', pageId: pricing.id });
    expect(links.find(node => node.type === 'text' && node.text === 'Product')?.link).toEqual({ type: 'url', href: '#', newTab: false });
  });

  it('upgrades designs saved before buttons and fields were real elements', () => {
    const fresh = design('el-inputs');
    // Turn the doc back into the old shape: div buttons and span placeholders.
    const old: SiteDoc = { ...fresh, nodes: Object.fromEntries(Object.entries(fresh.nodes).map(([id, node]) => [id,
      node.type === 'text' && (node.tag === 'input' || node.tag === 'textarea') ? { ...node, tag: 'span', inputType: undefined, sizing: { ...node.sizing, h: 'hug' } } : node])) };
    expect(live(old)).not.toContain('<input');
    const upgraded = upgradeInteractive(old);
    expect(siteDocSchema.safeParse(upgraded).success).toBe(true);
    expect(live(upgraded)).toContain('type="email"');
    expect(live(upgraded)).toContain('<textarea');
    expect(upgradeInteractive(upgraded)).toBe(upgraded);
    expect(upgradeInteractive(fresh)).toBe(fresh);
  });

  it('guesses field types from labels and placeholders', () => {
    expect(guessInputType('Work email jane@company.com')).toBe('email');
    expect(guessInputType('Password ••••••••')).toBe('password');
    expect(guessInputType('Search projects…')).toBe('search');
    expect(guessInputType('Full name Jane Doe')).toBe('text');
  });
});
