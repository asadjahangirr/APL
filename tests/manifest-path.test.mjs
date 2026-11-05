import { describe, it, expect } from 'vitest';
import { safeManifestPath } from '../templates/base/scripts/manifest-path.mjs';

describe('export verification file boundaries', () => {
  it('allows ordinary generated files and only the fixed CMS dynamic routes', () => {
    for (const file of ['.env.example', 'package-lock.json', 'app/about/page.tsx', 'app/services/[slug]/page.tsx', 'app/api/services/[id]/image/route.ts', 'app/api/portfolio/[id]/image/route.ts', 'app/api/services/[id]/link/route.ts', 'app/api/articles/[id]/link/route.ts', 'app/api/portfolio/[id]/link/route.ts']) expect(safeManifestPath(file), file).toBe(true);
  });
  it('rejects traversal, ambiguous Windows paths, arbitrary dynamic routes and secret files', () => {
    for (const file of ['', '/app/page.tsx', 'C:/secret.txt', '../secret', 'app/../secret', 'app/./page.tsx', 'app//page.tsx', 'app\\page.tsx', 'app/NUL.txt', 'app/route.', '.env', '.env.local', 'lib/.env', 'app/[owner]/page.tsx', 'app/[slug]/page.tsx', 'app/services/[...slug]/page.tsx']) expect(safeManifestPath(file), file).toBe(false);
  });
});
