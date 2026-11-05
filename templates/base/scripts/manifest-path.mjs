// Next's dynamic folders are fixed generator templates, never user route input.
const dynamicFiles = new Set([
  'app/services/[slug]/page.tsx',
  'app/api/services/[id]/image/route.ts',
  'app/api/portfolio/[id]/image/route.ts',
  'app/articles/[slug]/page.tsx',
  'app/api/articles/[id]/image/route.ts',
  'app/api/services/[id]/link/route.ts',
  'app/api/articles/[id]/link/route.ts',
  'app/api/portfolio/[id]/link/route.ts',
]);

export function safeManifestPath(file) {
  if (typeof file !== 'string' || !file || file.length > 240) return false;
  const ordinary = file.replace(/\[(slug|id)\]/g, '$1');
  if ((file.includes('[') || file.includes(']')) && !dynamicFiles.has(file)) return false;
  if (!/^[a-zA-Z0-9_./-]+$/.test(ordinary)) return false;
  return ordinary.split('/').every(segment => segment && segment !== '.' && segment !== '..'
    && !segment.endsWith('.') && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(segment)
    && !/^\.env(?!\.example$)/.test(segment));
}
