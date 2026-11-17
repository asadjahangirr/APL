import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Page, SiteDoc } from '../doc/schema';
import { installSite } from '../render/runtime';
import { SitePage } from '../render/SitePage';
import { docFonts, fontHref } from './fonts';

/**
 * Export the whole site as plain files: one HTML page per site page, images as
 * separate files and a short read-me. The pages are produced by the same
 * renderer as the canvas and Preview, so they look the same. No build step is
 * needed: open index.html, or upload the folder to any web host.
 */

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** File path of a page inside the export ("/" → index.html, "/about" → about/index.html). */
export const pageFile = (page: Page) => (page.path === '/' ? 'index.html' : page.path.slice(1) + '/index.html');
const depth = (page: Page) => (page.path === '/' ? 0 : page.path.split('/').length - 1);

const OBSERVER = `(function () {
  var targets = document.querySelectorAll('[data-apl-view]');
  if (!('IntersectionObserver' in window)) { targets.forEach(function (el) { el.setAttribute('data-apl-in', ''); }); return; }
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.setAttribute('data-apl-in', ''); seen.unobserve(entry.target); } });
  }, { threshold: 0.15 });
  targets.forEach(function (el) { seen.observe(el); });
})();`;

/** Animation between pages (cross-document view transitions; browsers without them just switch pages). */
const TRANSITIONS = {
  fade: '@view-transition{navigation:auto}',
  slide: '@view-transition{navigation:auto}::view-transition-old(root){animation:apl-out .35s ease both}::view-transition-new(root){animation:apl-in .35s ease both}@keyframes apl-out{to{opacity:0;translate:-48px 0}}@keyframes apl-in{from{opacity:0;translate:48px 0}}',
} as const;

function dataUrlBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function buildSiteFiles(doc: SiteDoc): Record<string, string | Uint8Array> {
  const files: Record<string, string | Uint8Array> = {};
  const assetFile = (id: string) => `assets/${id}.${EXT[doc.assets[id].mime] ?? 'png'}`;
  for (const asset of Object.values(doc.assets)) files[assetFile(asset.id)] = dataUrlBytes(asset.dataUrl);
  const fonts = [...docFonts(doc)].sort();
  const settings = doc.settings ?? {};
  const site = settings.siteUrl?.replace(/\/+$/, '');
  const asset = (id: string | undefined) => (id && doc.assets[id] ? assetFile(id) : undefined);
  const favicon = asset(settings.favicon), social = asset(settings.socialImage);
  const transition = settings.transition && settings.transition !== 'none' ? TRANSITIONS[settings.transition] : '';

  for (const page of doc.pages) {
    const up = '../'.repeat(depth(page));
    const url = site ? site + (page.path === '/' ? '/' : page.path + '/') : undefined;
    const title = escapeHtml(page.title || page.name);
    const body = renderToStaticMarkup(createElement(SitePage, {
      doc, pageId: page.id, mode: 'responsive', scope: 'site', motion: true,
      assetUrl: (id: string) => (doc.assets[id] ? up + assetFile(id) : undefined),
      pageHref: (target: Page) => up + pageFile(target),
    }));
    files[pageFile(page)] = [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${title}</title>`,
      ...(page.description ? [`<meta name="description" content="${escapeHtml(page.description)}">`] : []),
      // Social previews (link cards on WhatsApp, X, LinkedIn, Slack…).
      `<meta property="og:title" content="${title}">`,
      ...(page.description ? [`<meta property="og:description" content="${escapeHtml(page.description)}">`] : []),
      `<meta property="og:site_name" content="${escapeHtml(doc.name)}">`,
      '<meta property="og:type" content="website">',
      ...(url ? [`<link rel="canonical" href="${escapeHtml(url)}">`, `<meta property="og:url" content="${escapeHtml(url)}">`] : []),
      ...(social ? [`<meta property="og:image" content="${escapeHtml(site ? site + '/' + social : up + social)}">`, '<meta name="twitter:card" content="summary_large_image">'] : []),
      ...(favicon ? [`<link rel="icon" href="${up + favicon}">`] : []),
      '<meta name="color-scheme" content="light dark">',
      ...(fonts.length ? ['<link rel="preconnect" href="https://fonts.googleapis.com">', '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>', ...fonts.map(family => `<link href="${fontHref(family).replace(/&/g, '&amp;')}" rel="stylesheet">`)] : []),
      `<style>html,body{margin:0}html{scroll-behavior:smooth}body{-webkit-font-smoothing:antialiased}@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}${transition}</style>`,
      ...(settings.headCode?.trim() ? [settings.headCode.trim()] : []),
      '</head>',
      '<body>',
      body,
      ...(body.includes('data-apl-view') ? [`<script>${OBSERVER}</script>`] : []),
      ...(body.includes('data-apl-toggle') ? [`<script>(${installSite.toString()})(document);</script>`] : []),
      '</body>',
      '</html>',
      '',
    ].join('\n');
  }
  // Search engines: robots.txt always, a sitemap once the site's address is known.
  files['robots.txt'] = ['User-agent: *', 'Allow: /', ...(site ? [`Sitemap: ${site}/sitemap.xml`] : []), ''].join('\n');
  if (site) {
    files['sitemap.xml'] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...doc.pages.map(page => `  <url><loc>${escapeHtml(site + (page.path === '/' ? '/' : page.path + '/'))}</loc></url>`),
      '</urlset>',
      '',
    ].join('\n');
  }
  files['README.txt'] = [
    `${doc.name} — exported from APL`,
    '',
    'Open index.html in a browser to see the site.',
    'To publish it, upload this whole folder to any web host (Netlify, Vercel, GitHub Pages, cPanel, …).',
    '',
    'Pages:',
    ...doc.pages.map(page => `  ${page.path.padEnd(24)} ${pageFile(page)}`),
    '',
    'The pages are plain HTML and CSS. They adapt to tablet and phone screens, load their fonts from Google Fonts,',
    'and follow the visitor\'s light or dark setting if the site defines dark colors.',
    '',
  ].join('\n');
  return files;
}

/** Zip the site and hand it to the browser as a download. */
export async function downloadSite(doc: SiteDoc): Promise<string> {
  const { zipSync, strToU8 } = await import('fflate');
  const files = buildSiteFiles(doc);
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([path, content]) => [path, typeof content === 'string' ? strToU8(content) : content])));
  const name = (doc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site') + '.zip';
  const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: 'application/zip' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
