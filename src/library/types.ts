import type { Kit, Tree } from './kit';

export const CATEGORIES = [
  { id: 'page', name: 'Full pages' },
  { id: 'nav', name: 'Navigation bars' },
  { id: 'hero', name: 'Heroes' },
  { id: 'feature', name: 'Features' },
  { id: 'proof', name: 'Logos & stats' },
  { id: 'testimonial', name: 'Testimonials' },
  { id: 'pricing', name: 'Pricing' },
  { id: 'cta', name: 'Calls to action' },
  { id: 'faq', name: 'FAQ' },
  { id: 'content', name: 'Blog & team' },
  { id: 'gallery', name: 'Galleries' },
  { id: 'contact', name: 'Contact' },
  { id: 'shop', name: 'Shop' },
  { id: 'auth', name: 'Sign in & sign up' },
  { id: 'sidebar', name: 'Sidebars' },
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'button', name: 'Buttons' },
  { id: 'element', name: 'Elements' },
  { id: 'motion', name: 'Animated' },
  { id: 'footer', name: 'Footers' },
] as const;
export type CategoryId = typeof CATEGORIES[number]['id'];

/**
 * section: a full-width band stacked on the page. element: a small piece placed
 * inside the selected frame. page: several sections added in one go.
 */
export type ItemKind = 'section' | 'element' | 'page';

export interface LibraryItem {
  id: string;
  name: string;
  category: CategoryId;
  kind: ItemKind;
  /** Width the design is previewed at. */
  width: number;
  tags: string[];
  build: (k: Kit) => Tree[];
}

const KIND: Partial<Record<CategoryId, ItemKind>> = { page: 'page', element: 'element', sidebar: 'element', button: 'element' };

export function define(category: CategoryId, id: string, name: string, tags: string, build: (k: Kit) => Tree | Tree[], options: { kind?: ItemKind; width?: number } = {}): LibraryItem {
  const kind = options.kind ?? KIND[category] ?? 'section';
  return {
    id, name, category, kind, width: options.width ?? (kind === 'element' ? 560 : 1440), tags: tags.split(' ').filter(Boolean),
    build: k => { const out = build(k); return Array.isArray(out) ? out : [out]; },
  };
}
