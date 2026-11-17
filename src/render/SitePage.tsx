import { createElement, useEffect, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import type { Page, SiteDoc } from '../doc/schema';
import { nodeClass, pageCss, vectorGradient, type AssetUrl, type RenderMode } from './css';
import { actionTargets, anchorId, embedFrame, htmlElement, type Inside } from './element';
import { installSite } from './runtime';

/**
 * Renders one page of a SiteDoc as real HTML + CSS.
 * Used by the editor canvas (single breakpoint), preview and exported sites (responsive).
 */
export interface SitePageProps {
  doc: SiteDoc;
  pageId: string;
  mode: RenderMode;
  /** Unique CSS scope class so several renders can coexist on one screen. */
  scope: string;
  assetUrl?: AssetUrl;
  /** Design canvas: adds data-node-id attributes for hit-testing and leaves links inert. */
  annotate?: boolean;
  /** Real links, buttons and form fields (default). Off for static pictures such as library thumbnails. */
  interactive?: boolean;
  /** Play animations (preview and live site). Off on the design canvas. */
  motion?: boolean;
  /** Force light or dark site colors. Unset: follow the visitor's system setting. */
  theme?: 'light' | 'dark';
  /** Address of another page of the site (default: its path). */
  pageHref?: (page: Page) => string;
  /** Preview: called instead of leaving the editor when a page link is clicked. */
  onNavigate?: (pageId: string) => void;
}

export const dataUrlAssets = (doc: SiteDoc): AssetUrl => id => doc.assets[id]?.dataUrl;
const pagePath = (page: Page) => page.path;

interface TreeContext {
  assetUrl: AssetUrl; annotate: boolean; motion: boolean; pageHref: (page: Page) => string;
  /** Real links, buttons and fields (off on the canvas and in thumbnails). */
  interactive: boolean;
  /** Layers that click actions scroll to or show / hide. */
  targets: Set<string>;
}

export function renderTree(doc: SiteDoc, id: string, ctx: TreeContext, inside: Inside = null): ReactNode {
  const node = doc.nodes[id];
  if (!node) return null;
  const props: Record<string, unknown> = { key: id, className: nodeClass(id) };
  if (ctx.annotate) props['data-node-id'] = id;
  if (ctx.motion && node.motion?.enter?.trigger === 'inView') props['data-apl-view'] = '';
  switch (node.type) {
    case 'frame':
    case 'text': {
      // Links, buttons and form fields are real elements on the site and inert on the canvas.
      const element = htmlElement(doc, node, ctx.interactive, inside, ctx.pageHref, ctx.targets);
      const { rows, ...attrs } = element.attrs;
      Object.assign(props, attrs, rows ? { rows: Number(rows) } : {});
      if (element.field) return createElement(element.tag, props);
      if (node.type === 'text') return createElement(element.tag, props, node.text);
      return createElement(element.tag, props, node.children.map(child => renderTree(doc, child, ctx, element.inside)));
    }
    case 'embed': {
      if (ctx.interactive && ctx.targets.has(id)) props.id = anchorId(id);
      const frame = embedFrame(node);
      if (!frame) return createElement('div', props, ctx.annotate ? createElement('div', { className: 'apl-embed apl-embed-empty' }, 'Embed: add a video, map or code in the Design panel') : null);
      const { srcdoc, ...rest } = frame;
      // On the canvas the frame never takes the mouse, so the layer can be selected and moved.
      return createElement('div', props, createElement('iframe', { ...rest, ...(srcdoc !== undefined ? { srcDoc: srcdoc } : {}), className: 'apl-embed', allowFullScreen: true, ...(ctx.annotate ? { tabIndex: -1, style: { pointerEvents: 'none' } } : {}) }));
    }
    case 'image': {
      const src = node.assetId ? ctx.assetUrl(node.assetId) : undefined;
      if (!src) return createElement('div', { ...props, role: node.alt ? 'img' : undefined, 'aria-label': node.alt || undefined, 'aria-hidden': node.alt ? undefined : true });
      return createElement('img', { ...props, src, alt: node.alt, loading: 'lazy', decoding: 'async', draggable: false });
    }
    case 'vector': {
      const gradient = vectorGradient(node);
      const stops = gradient?.stops.map((stop, index) => createElement('stop', { key: index, offset: stop.offset, stopColor: stop.color }));
      const defs = gradient && createElement('defs', { key: 'defs' }, gradient.linear
        ? createElement('linearGradient', { id: gradient.id, x1: gradient.x1, y1: gradient.y1, x2: gradient.x2, y2: gradient.y2 }, stops)
        : createElement('radialGradient', { id: gradient.id }, stops));
      const path = createElement('path', { key: 'path', d: node.path, vectorEffect: 'non-scaling-stroke' });
      if (ctx.interactive && ctx.targets.has(id)) props.id = anchorId(id);
      return createElement('svg', { ...props, viewBox: `0 0 ${node.viewBox[0]} ${node.viewBox[1]}`, preserveAspectRatio: 'none', 'aria-hidden': true }, defs ? [defs, path] : path);
    }
    case 'rect':
    case 'ellipse':
      if (ctx.interactive && ctx.targets.has(id)) props.id = anchorId(id);
      return createElement('div', { ...props, 'aria-hidden': true });
  }
}

export function SitePage({ doc, pageId, mode, scope, assetUrl, annotate = false, interactive = !annotate, motion = false, theme, pageHref, onNavigate }: SitePageProps) {
  const host = useRef<HTMLDivElement>(null);
  const page = doc.pages.find(value => value.id === pageId);
  const resolveAsset = useMemo(() => assetUrl ?? dataUrlAssets(doc), [assetUrl, doc]);
  const modeKey = mode === 'responsive' ? mode : mode.breakpoint;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- modeKey captures mode
  const css = useMemo(() => (page ? pageCss(doc, page.rootId, { scope, mode, assetUrl: resolveAsset, motion }) : ''), [doc, page, scope, modeKey, resolveAsset, motion]);
  // Scroll-triggered animations start when their layer first enters the viewport.
  useEffect(() => {
    if (!motion || !host.current) return;
    const targets = host.current.querySelectorAll('[data-apl-view]:not([data-apl-in])');
    if (!targets.length) return;
    if (typeof IntersectionObserver === 'undefined') { targets.forEach(el => el.setAttribute('data-apl-in', '')); return; }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.setAttribute('data-apl-in', ''); observer.unobserve(entry.target); }
    }, { threshold: 0.15 });
    targets.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [motion, doc, pageId]);
  // "Show / hide a layer" buttons (the same script the exported site runs).
  useEffect(() => (interactive && host.current ? installSite(host.current) : undefined), [interactive]);
  const targets = useMemo(() => actionTargets(doc), [doc]);
  if (!page) return null;
  // In Preview, page links switch pages in place, in-page links scroll smoothly and outside links open in a new tab.
  const onClick = onNavigate ? (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    event.preventDefault();
    const target = anchor.getAttribute('data-apl-page'), href = anchor.getAttribute('href') ?? '';
    if (href.startsWith('#n-')) host.current?.querySelector('#' + CSS.escape(href.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (target) onNavigate(target);
    else if (/^(https?:|mailto:|tel:)/.test(href)) window.open(href, '_blank', 'noopener');
  } : undefined;
  return (
    <div className={scope} ref={host} data-theme={theme} onClick={onClick}>
      <style>{css}</style>
      {renderTree(doc, page.rootId, { assetUrl: resolveAsset, annotate, motion, pageHref: pageHref ?? pagePath, interactive, targets })}
    </div>
  );
}
