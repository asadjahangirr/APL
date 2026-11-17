import { createNode, DEFAULT_LAYOUT, subtreeIds } from '../doc/ops';
import type { Page, SiteDoc, SiteNode } from '../doc/schema';
import { pageCss, vectorGradient } from '../render/css';
import { actionTargets, anchorId, embedFrame, htmlElement, type Inside } from '../render/element';
import { remapLink } from '../doc/interactive';
import { fontHref } from './fonts';

/**
 * Copy-ready code for a design: a standalone HTML + CSS snippet and a React
 * component. Both use the same stylesheet the site renderer produces
 * (responsive media queries and animations included), with readable class names.
 */
export interface DesignCode { html: string; react: string }

const kebab = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const pascal = (value: string) => {
  const name = kebab(value).split('-').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join('');
  return /^[A-Z]/.test(name) ? name : 'Design' + name; // component names cannot start with a digit
};

/** Split declarations on `;` outside parentheses (data URLs contain semicolons). */
function declarations(body: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '(') depth++; else if (c === ')') depth--;
    else if (c === ';' && depth === 0) { out.push(body.slice(start, i)); start = i + 1; }
  }
  if (start < body.length) out.push(body.slice(start));
  return out.filter(Boolean);
}
export function formatCss(css: string): string {
  const out: string[] = [];
  let pad = '';
  for (const line of css.split('\n')) {
    if (line === '}') { pad = ''; out.push('}'); continue; }
    if (line.startsWith('@media') && line.endsWith('{')) { out.push('', line.replace('){', ') {')); pad = '  '; continue; }
    const rule = /^([^@{][^{]*)\{(.*)\}$/.exec(line);
    if (!rule) { out.push(pad + line); continue; }
    out.push(`${pad}${rule[1].replace(/,/g, ', ')} {`, ...declarations(rule[2]).map(decl => `${pad}  ${decl.replace(/^([a-z-]+):/, '$1: ')};`), `${pad}}`);
  }
  return out.join('\n').trim();
}

/** A one-page document whose root holds just the layer to export, with readable ids. */
function exportDoc(source: SiteDoc, nodeId: string): { doc: SiteDoc; rootId: string } {
  const isRoot = source.pages.some(page => page.rootId === nodeId);
  const ids = subtreeIds(source, nodeId);
  const used = new Set<string>(['wrap']);
  const names = new Map<string, string>();
  for (const id of ids) {
    let base = kebab(source.nodes[id].name).slice(0, 36) || source.nodes[id].type;
    if (/^[0-9]/.test(base)) base = 'l-' + base;
    let name = base, n = 2;
    while (used.has(name)) name = `${base}-${n++}`;
    used.add(name); names.set(id, name);
  }
  const nodes: Record<string, SiteNode> = {};
  for (const id of ids) {
    const node = source.nodes[id];
    nodes[names.get(id)!] = remapLink({ ...node, id: names.get(id)!, parentId: id === nodeId ? null : names.get(node.parentId!)!, children: node.children.map(child => names.get(child)!) } as SiteNode, names);
  }
  let rootId = names.get(nodeId)!;
  if (!isRoot) {
    // Standalone layers sit in a plain wrapper so they keep their own size.
    nodes[rootId] = { ...nodes[rootId], parentId: 'wrap', absolute: false } as SiteNode;
    nodes.wrap = createNode('frame', { id: 'wrap', name: 'Wrap', children: [rootId], fills: [], clip: false, sizing: { h: 'fill', v: 'hug' }, layout: { ...DEFAULT_LAYOUT, mode: 'vertical' } });
    rootId = 'wrap';
  }
  return { rootId, doc: { ...source, pages: [{ id: 'page', name: 'Page', path: '/', rootId, title: '', description: '' }], nodes } };
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (value: string) => escapeHtml(value).replace(/"/g, '&quot;');

function markup(doc: SiteDoc, id: string, depth: number, jsx: boolean, out: string[], pages: Page[], targets: Set<string>, inside: Inside = null): void {
  const node = doc.nodes[id], pad = '  '.repeat(depth);
  // Same element rules as the live site: links, real buttons, form fields and click actions.
  const element = node.type === 'frame' || node.type === 'text' ? htmlElement({ ...doc, pages }, node, true, inside, page => page.path, targets) : null;
  const tag = element?.tag ?? 'div';
  const own = element?.attrs ?? (targets.has(id) ? { id: anchorId(id) } : {});
  const attrs = Object.entries(own).filter(([key]) => key !== 'data-apl-page')
    .map(([key, value]) => (jsx && key === 'rows' ? ` rows={${value}}` : ` ${key}="${escapeAttr(value)}"`)).join('');
  const cls = `${jsx ? 'className' : 'class'}="${id}"${attrs}${node.motion?.enter?.trigger === 'inView' ? ' data-apl-view=""' : ''}`;
  if (element?.field) {
    out.push(tag === 'input' ? `${pad}<input ${cls}${jsx ? ' />' : '>'}` : jsx ? `${pad}<textarea ${cls} />` : `${pad}<textarea ${cls}></textarea>`);
  } else if (node.type === 'frame') {
    if (!node.children.length) { out.push(jsx ? `${pad}<${tag} ${cls} />` : `${pad}<${tag} ${cls}></${tag}>`); return; }
    out.push(`${pad}<${tag} ${cls}>`);
    for (const child of node.children) markup(doc, child, depth + 1, jsx, out, pages, targets, element?.inside ?? inside);
    out.push(`${pad}</${tag}>`);
  } else if (node.type === 'text') {
    const text = jsx ? (/[{}<>&\n]/.test(node.text) ? `{${JSON.stringify(node.text)}}` : node.text) : escapeHtml(node.text);
    out.push(`${pad}<${tag} ${cls}>${text}</${tag}>`);
  } else if (node.type === 'image' && node.assetId && doc.assets[node.assetId]) {
    out.push(`${pad}<img ${cls} src="${doc.assets[node.assetId].dataUrl}" alt="${escapeAttr(node.alt)}"${jsx ? ' />' : '>'}`);
  } else if (node.type === 'embed') {
    const frame = embedFrame(node);
    if (!frame) { out.push(jsx ? `${pad}<div ${cls} />` : `${pad}<div ${cls}></div>`); return; }
    const src = frame.srcdoc !== undefined ? (jsx ? ` srcDoc={${JSON.stringify(frame.srcdoc)}}` : ` srcdoc="${escapeAttr(frame.srcdoc)}"`) : ` src="${escapeAttr(frame.src!)}"`;
    const extra = [frame.sandbox && ` sandbox="${frame.sandbox}"`, frame.allow && ` allow="${frame.allow}"`, ` title="${escapeAttr(frame.title)}"`, ' loading="lazy"', jsx ? ' allowFullScreen' : ' allowfullscreen'].filter(Boolean).join('');
    const style = jsx ? ' style={{ display: \'block\', width: \'100%\', height: \'100%\', border: 0 }}' : ' style="display:block;width:100%;height:100%;border:0"';
    out.push(`${pad}<div ${cls}>`, `${pad}  <iframe${src}${extra}${style}${jsx ? ' />' : '></iframe>'}`, `${pad}</div>`);
  } else if (node.type === 'vector') {
    const gradient = vectorGradient(node);
    out.push(`${pad}<svg ${cls} viewBox="0 0 ${node.viewBox[0]} ${node.viewBox[1]}" preserveAspectRatio="none" aria-hidden="true">`);
    if (gradient) {
      const name = gradient.linear ? 'linearGradient' : 'radialGradient';
      out.push(`${pad}  <defs>`, `${pad}    <${name} id="${gradient.id}"${gradient.linear ? ` x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}"` : ''}>`,
        ...gradient.stops.map(stop => `${pad}      <stop offset="${stop.offset}" ${jsx ? 'stopColor' : 'stop-color'}="${stop.color}"${jsx ? ' />' : '></stop>'}`), `${pad}    </${name}>`, `${pad}  </defs>`);
    }
    out.push(
      `${pad}  <path d="${node.path}" ${jsx ? 'vectorEffect' : 'vector-effect'}="non-scaling-stroke"${jsx ? ' />' : '></path>'}`, `${pad}</svg>`);
  } else {
    out.push(jsx ? `${pad}<div ${cls} aria-hidden="true" />` : `${pad}<div ${cls} aria-hidden="true"></div>`);
  }
}

/** Show / hide buttons: flips the target layer (the stylesheet decides what that means per screen size). */
const TOGGLE = `function toggle(event) {
  const button = event.target.closest('[data-apl-toggle]');
  if (!button) return;
  const target = event.currentTarget.querySelector('#' + CSS.escape(button.getAttribute('data-apl-toggle')));
  if (!target) return;
  target.toggleAttribute('data-apl-flip');
  button.setAttribute('aria-expanded', String(getComputedStyle(target).display !== 'none'));
}`;

const OBSERVER = (root: string) => `const seen = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { entry.target.setAttribute('data-apl-in', ''); seen.unobserve(entry.target); }
}, { threshold: 0.15 });
${root}.querySelectorAll('[data-apl-view]').forEach(el => seen.observe(el));`;

export function designCode(source: SiteDoc, nodeId: string, title: string): DesignCode {
  const { doc, rootId } = exportDoc(source, nodeId);
  const scope = ('apl-' + (kebab(title) || 'design')).slice(0, 48).replace(/-+$/, '');
  const css = formatCss(pageCss(doc, rootId, { scope, mode: 'responsive', assetUrl: id => doc.assets[id]?.dataUrl, motion: true }).replace(/\.n-/g, '.'));
  const ids = subtreeIds(doc, rootId);
  const fonts = [...new Set(ids.map(id => doc.nodes[id]).flatMap(node => (node.type === 'text' ? [node.textStyle.fontFamily] : [])))];
  const links = fonts.map(family => `<link href="${fontHref(family)}" rel="stylesheet">`);
  const inView = ids.some(id => doc.nodes[id].motion?.enter?.trigger === 'inView');
  const targets = actionTargets(doc);
  const toggles = ids.some(id => doc.nodes[id].link?.type === 'toggle' && targets.has((doc.nodes[id].link as { targetId: string }).targetId));

  const html: string[] = [`<!-- ${title} · made with APL -->`];
  if (links.length) html.push('<link rel="preconnect" href="https://fonts.googleapis.com">', '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>', ...links);
  html.push('<style>', css, '</style>', '', `<div class="${scope}">`);
  markup(doc, rootId, 1, false, html, source.pages, targets);
  html.push('</div>');
  if (inView) html.push('', '<script>', '// Starts scroll animations when a layer comes into view.', OBSERVER(`document.querySelector('.${scope}')`), '</script>');
  if (toggles) html.push('', '<script>', '// Show / hide buttons.', TOGGLE, `document.querySelector('.${scope}').addEventListener('click', toggle);`, '</script>');

  const body: string[] = [];
  markup(doc, rootId, 3, true, body, source.pages, targets);
  const name = pascal(title);
  const react = [
    `// ${title} · made with APL`,
    ...(links.length ? ['// Fonts: add to your <head>', ...links.map(link => '//   ' + link)] : []),
    ...(inView ? ["import { useEffect, useRef } from 'react';", ''] : ['']),
    `export default function ${name}() {`,
    ...(inView ? ['  const root = useRef(null);', '  useEffect(() => {', ...OBSERVER('root.current').split('\n').map(line => '    ' + line), '    return () => seen.disconnect();', '  }, []);', ''] : []),
    '  return (',
    `    <div className="${scope}"${inView ? ' ref={root}' : ''}${toggles ? ' onClick={toggle}' : ''}>`,
    '      <style>{css}</style>',
    ...body,
    '    </div>',
    '  );',
    '}',
    ...(toggles ? ['', '// Show / hide buttons.', TOGGLE] : []),
    '',
    'const css = `',
    css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'),
    '`;',
  ];
  return { html: html.join('\n'), react: react.join('\n') + '\n' };
}
