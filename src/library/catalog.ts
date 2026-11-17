import { createNode, DEFAULT_LAYOUT } from '../doc/ops';
import type { SiteDoc, SiteNode } from '../doc/schema';
import { activityCard, APP, chartCard, sidebar, statCards, tableCard, topbar } from './blocks/app';
import { BUTTONS } from './blocks/buttons';
import { CONTENT } from './blocks/content';
import { MARKETING } from './blocks/marketing';
import { MOTION } from './blocks/motion';
import { MORE_MOTION } from './blocks/motion2';
import { flatten, kit, solid } from './kit';
import { THEMES, type Theme } from './themes';
import { CATEGORIES, define, type CategoryId, type LibraryItem } from './types';

/**
 * The design library: every layout below can be built in any theme, so the
 * number of ready-to-insert designs is layouts × themes.
 */

const BLOCKS: LibraryItem[] = [...MARKETING, ...CONTENT, ...APP, ...BUTTONS, ...MOTION, ...MORE_MOTION];
const block = (id: string): LibraryItem => {
  const item = BLOCKS.find(value => value.id === id);
  if (!item) throw new Error(`Unknown library design: ${id}`);
  return item;
};
/** A full page is a list of sections added in order. */
const page = (id: string, name: string, tags: string, parts: string[]): LibraryItem => define('page', id, name, tags, k => parts.flatMap(part => block(part).build(k)));

const PAGES: LibraryItem[] = [
  page('page-saas', 'SaaS landing page', 'software product startup home', ['nav-simple', 'hero-product', 'logos-row', 'feature-cards', 'feature-split', 'quote-cards', 'pricing-three', 'faq-list', 'cta-banner', 'footer-columns']),
  page('page-launch', 'AI product launch', 'startup gradient modern home', ['nav-pill', 'hero-glow', 'motion-logo-marquee', 'feature-bento', 'stats-inverse', 'quote-wall', 'cta-gradient', 'footer-simple']),
  page('page-agency', 'Agency home', 'studio creative bold home', ['nav-minimal', 'hero-bigtype', 'gallery-projects', 'feature-steps', 'quote-single', 'cta-split', 'footer-wordmark']),
  page('page-portfolio', 'Portfolio', 'personal work editorial home', ['nav-centered', 'hero-editorial', 'gallery-masonry', 'stats-row', 'contact-split', 'footer-centered']),
  page('page-animated', 'Animated landing page', 'motion scroll reveal home', ['nav-pill', 'motion-float-hero', 'motion-logo-marquee', 'motion-reveal-cards', 'motion-slide-split', 'motion-stats-pop', 'motion-pulse-cta', 'footer-simple']),
  page('page-pricing', 'Pricing page', 'plans compare', ['nav-simple', 'pricing-three', 'pricing-table', 'faq-grid', 'cta-centered', 'footer-columns']),
  page('page-about', 'About page', 'company team story', ['nav-centered', 'hero-inverse', 'stats-split', 'team-grid', 'feature-list', 'cta-banner', 'footer-inverse']),
  page('page-blog', 'Blog home', 'journal articles news', ['nav-minimal', 'blog-featured', 'blog-cards', 'cta-newsletter', 'footer-simple']),
  page('page-shop', 'Shop home', 'store ecommerce products', ['nav-store', 'shop-categories', 'shop-grid', 'rating-strip', 'footer-newsletter']),
  page('page-contact', 'Contact page', 'support message location', ['nav-simple', 'contact-split', 'contact-location', 'faq-split', 'footer-simple']),
  page('page-waitlist', 'Waitlist page', 'coming soon signup launch', ['nav-pill', 'hero-capture', 'feature-minimal', 'footer-centered']),
  define('page', 'page-dashboard', 'Dashboard app', 'admin panel analytics sidebar', k => k.row({ name: 'App', tag: 'main', w: 'fill', bg: k.t.alt }, [
    sidebar(k, { h: 'fill', minH: 900, r: 0, hideT: true }),
    k.col({ name: 'Content', w: 'fill', pad: 32, mpad: 16, gap: 20 }, [topbar(k), statCards(k), k.row({ gap: 20, w: 'fill', stack: true }, [chartCard(k), k.col({ w: 'fill', maxW: 380, mobile: { maxWidth: null } }, [activityCard(k)])]), tableCard(k)]),
  ])),
];

export const LIBRARY: LibraryItem[] = [...PAGES, ...BLOCKS];
export const LIBRARY_COUNT = LIBRARY.length * THEMES.length;
export { CATEGORIES, THEMES };
export type { CategoryId, LibraryItem, Theme };

export const itemById = (id: string): LibraryItem | undefined => LIBRARY.find(value => value.id === id);
export const categoryCount = (id: CategoryId): number => LIBRARY.filter(item => item.category === id).length;

/** Search by name, category and tags; every word must match. */
export function searchLibrary(query: string, category: CategoryId | 'all'): LibraryItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return LIBRARY.filter(item => {
    if (category !== 'all' && item.category !== category) return false;
    const haystack = `${item.name} ${item.category} ${item.tags.join(' ')}`.toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

/** Build a design as layer subtrees (each root first, ready for insertNodes). */
export function buildItem(item: LibraryItem, theme: Theme): SiteNode[][] {
  return item.build(kit(theme)).map(flatten);
}

/** Font families a theme needs. */
export const themeFonts = (theme: Theme): string[] => [...new Set([theme.head, theme.body])];

/** A one-page document showing a single design, used for thumbnails and tests. */
export function previewDoc(item: LibraryItem, theme: Theme): SiteDoc {
  const subtrees = buildItem(item, theme);
  const element = item.kind === 'element';
  const root = createNode('frame', {
    id: 'root', name: item.name, tag: 'main', width: item.width, height: 900, sizing: { h: 'fill', v: 'hug' }, clip: false, fills: solid(theme.bg),
    layout: { ...DEFAULT_LAYOUT, mode: 'vertical', alignCross: element ? 'center' : 'start', padding: element ? [40, 32, 40, 32] : [0, 0, 0, 0] },
    children: subtrees.map(nodes => nodes[0].id),
  });
  const nodes: Record<string, SiteNode> = { root };
  for (const subtree of subtrees) subtree.forEach((node, index) => { nodes[node.id] = index === 0 ? { ...node, parentId: 'root' } : node; });
  return { version: 1, id: 'library-preview', name: item.name, pages: [{ id: 'page', name: 'Preview', path: '/', rootId: 'root', title: item.name, description: '' }], nodes, assets: {} };
}
