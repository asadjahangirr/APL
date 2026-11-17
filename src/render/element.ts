import type { EmbedNode, Page, SiteDoc, SiteNode } from '../doc/schema';

/**
 * Which HTML element a frame or text layer becomes, shared by the renderer
 * (canvas, Preview, exported site) and copied code so they always agree.
 *
 * On the live site (`live`):
 * - a layer with a click action becomes a link (<a href>);
 * - a frame whose element is Button becomes a real <button>;
 * - a text layer whose element is Input or Text area becomes a real form field,
 *   with its text as the placeholder, and the box holding it becomes a <label>
 *   so a click anywhere in the box focuses the field.
 * - "scroll to a layer" is an in-page link (#anchor) and "show / hide a layer"
 *   is a <button> that the site script (render/runtime) wires up; the layers they
 *   point at get an id.
 * Interactive elements never nest: inside a link or button, inner links,
 * buttons and fields stay plain, and inside a button every layer is a <span>
 * (buttons may only hold inline content).
 *
 * On the design canvas nothing is interactive: buttons stay boxes and fields
 * show their placeholder as text, so selecting and editing work as usual.
 * The element never changes the look: every layer's display comes from its class.
 */
export type Inside = null | 'link' | 'button';
export interface Element {
  tag: string;
  attrs: Record<string, string>;
  /** Context for this layer's children. */
  inside: Inside;
  /** A form field: rendered without children, its text is the placeholder. */
  field: boolean;
}

/** The id attribute of a layer that a click action points at. */
export const anchorId = (id: string) => 'n-' + id;

/** Layers that some click action scrolls to or shows / hides. */
export function actionTargets(doc: SiteDoc): Set<string> {
  const out = new Set<string>();
  for (const node of Object.values(doc.nodes)) if ((node.link?.type === 'scroll' || node.link?.type === 'toggle') && doc.nodes[node.link.targetId]) out.add(node.link.targetId);
  return out;
}

export const isField = (node: SiteNode | undefined): boolean => node?.type === 'text' && (node.tag === 'input' || node.tag === 'textarea');

/** Text of a layer and everything inside it. */
function textOf(doc: SiteDoc, id: string): string {
  const node = doc.nodes[id];
  if (!node) return '';
  return node.type === 'text' ? node.text : node.children.map(child => textOf(doc, child)).join(' ');
}

export function htmlElement(doc: SiteDoc, node: SiteNode, live: boolean, inside: Inside, pageHref: (page: Page) => string, targets?: Set<string>): Element {
  const attrs: Record<string, string> = {};
  if (live && targets?.has(node.id)) attrs.id = anchorId(node.id);
  if (live && !inside && node.link && (node.type === 'frame' || node.type === 'text') && !isField(node)) {
    const link = node.link;
    if (link.type === 'page') {
      const target = doc.pages.find(page => page.id === link.pageId);
      if (target) return { tag: 'a', attrs: { ...attrs, href: pageHref(target), 'data-apl-page': target.id }, inside: 'link', field: false };
    } else if (link.type === 'scroll' || link.type === 'toggle') {
      const target = doc.nodes[link.targetId];
      if (target && link.type === 'scroll') return { tag: 'a', attrs: { ...attrs, href: '#' + anchorId(target.id) }, inside: 'link', field: false };
      if (target) {
        // Expanded when the layer starts out visible (on the largest screen).
        Object.assign(attrs, { type: 'button', 'data-apl-toggle': anchorId(target.id), 'aria-controls': anchorId(target.id), 'aria-expanded': String(target.visible) });
        if (!/[\p{L}\p{N}]/u.test(textOf(doc, node.id))) attrs['aria-label'] = node.name.replace(/\s*button$/i, '') || 'Show or hide';
        return { tag: 'button', attrs, inside: 'button', field: false };
      }
    } else {
      attrs.href = link.href;
      if (link.newTab) { attrs.target = '_blank'; attrs.rel = 'noopener noreferrer'; }
      return { tag: 'a', attrs, inside: 'link', field: false };
    }
  }
  if (node.type === 'frame') {
    if (node.tag === 'button') {
      if (!live || inside) return { tag: inside === 'button' ? 'span' : 'div', attrs, inside, field: false };
      attrs.type = 'button';
      // Icon-only buttons (glyphs, no words) are named after their layer for screen readers.
      if (!/[\p{L}\p{N}]/u.test(textOf(doc, node.id))) attrs['aria-label'] = node.name.replace(/\s*button$/i, '') || 'Button';
      return { tag: 'button', attrs, inside: 'button', field: false };
    }
    if (inside === 'button') return { tag: 'span', attrs, inside, field: false };
    if (live && !inside && node.children.filter(child => isField(doc.nodes[child])).length === 1) return { tag: 'label', attrs, inside, field: false };
    return { tag: node.tag, attrs, inside, field: false };
  }
  if (node.type === 'text') {
    if (isField(node)) {
      if (!live || inside) return { tag: 'span', attrs, inside, field: false };
      attrs.placeholder = node.text;
      if (node.tag === 'input') attrs.type = node.inputType ?? 'text';
      else attrs.rows = '1';
      return { tag: node.tag, attrs, inside, field: true };
    }
    return { tag: inside === 'button' ? 'span' : node.tag, attrs, inside, field: false };
  }
  return { tag: 'div', attrs, inside, field: false };
}

/**
 * The iframe for an embed layer. Addresses of YouTube and Vimeo videos become
 * their player addresses; custom code runs in a sandbox with no access to the
 * page around it. Null while the layer is still empty.
 */
export function embedFrame(node: EmbedNode): { src?: string; srcdoc?: string; sandbox?: string; allow?: string; title: string; loading: 'lazy'; referrerPolicy?: string } | null {
  if (node.kind === 'code') {
    if (!node.code.trim()) return null;
    return { srcdoc: node.code, sandbox: 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox', title: node.name, loading: 'lazy' };
  }
  if (!node.url) return null;
  return { src: embedSrc(node.url), title: node.name, loading: 'lazy', referrerPolicy: 'strict-origin-when-cross-origin', allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write' };
}

/** Player address for a pasted video link (other addresses are used as they are). */
export function embedSrc(url: string): string {
  const youtube = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(url);
  if (youtube) return 'https://www.youtube-nocookie.com/embed/' + youtube[1];
  const vimeo = /^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/.exec(url);
  if (vimeo) return 'https://player.vimeo.com/video/' + vimeo[1];
  return url;
}

/** Google Maps address for a place or street address (no account or key needed). */
export const mapSrc = (place: string) => 'https://www.google.com/maps?q=' + encodeURIComponent(place.trim()) + '&output=embed';
