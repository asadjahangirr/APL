import type { SiteDoc } from '../doc/schema';

/**
 * Loads the Google Fonts a document uses. Each family is requested once; a
 * family that lacks the usual weights is retried with its default weight only.
 */
const WEIGHTS: Record<string, string> = { 'Instrument Serif': '400', 'Space Grotesk': '400;500;600;700', 'DM Serif Display': '400' };
const requested = new Set<string>(['Inter']); // Inter is loaded by the editor shell.

/** Fonts offered in the font picker. Any other Google Fonts name can still be typed. */
export const FONTS = ['Inter', 'Bricolage Grotesque', 'DM Sans', 'DM Serif Display', 'Fraunces', 'Instrument Serif', 'JetBrains Mono', 'Manrope', 'Outfit', 'Playfair Display', 'Plus Jakarta Sans', 'Sora', 'Space Grotesk', 'Syne'];

export function fontHref(family: string, weights: string | null = WEIGHTS[family] ?? '400;500;600;700;800'): string {
  return `https://fonts.googleapis.com/css2?family=${family.trim().replace(/\s+/g, '+')}${weights ? ':wght@' + weights : ''}&display=swap`;
}

function addLink(family: string, weights: string | null, onError?: () => void): void {
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: fontHref(family, weights) });
  link.dataset.aplFont = family;
  if (onError) link.addEventListener('error', () => { link.remove(); onError(); });
  document.head.append(link);
}

export function loadFonts(families: Iterable<string>): void {
  if (typeof document === 'undefined') return;
  for (const family of families) {
    if (!family || requested.has(family) || !/^[A-Za-z0-9][A-Za-z0-9 ]{0,59}$/.test(family)) continue;
    requested.add(family);
    addLink(family, WEIGHTS[family] ?? '400;500;600;700;800', () => addLink(family, null));
  }
}

/** Font families used by any text layer, including breakpoint overrides. */
export function docFonts(doc: SiteDoc): Set<string> {
  const out = new Set<string>();
  for (const node of Object.values(doc.nodes)) {
    if (node.type !== 'text') continue;
    out.add(node.textStyle.fontFamily);
    for (const override of Object.values(node.overrides)) if (override?.textStyle?.fontFamily) out.add(override.textStyle.fontFamily);
  }
  return out;
}
