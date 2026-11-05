import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { newProject } from '../src/project/templates';
import { addPage } from '../src/project/pages';
import { generateProject, type Sources } from '../src/export/generate';

const sources: Sources = {};
function read(dir: string) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next'].includes(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) read(file);
    else sources[file.replaceAll('\\', '/')] = readFileSync(file, 'utf8');
  }
}
read('templates'); read('src/site');
for (const file of ['schema.ts', 'service-schema.ts', 'portfolio-schema.ts', 'article-schema.ts', 'link-schema.ts', 'icon-schema.ts', 'appearance-schema.ts', 'theme.ts']) sources['src/project/' + file] = readFileSync('src/project/' + file, 'utf8');
const decode = (data: Uint8Array) => new TextDecoder().decode(data);
const json = (data: Uint8Array) => JSON.parse(decode(data));

function fixture(contact = false) {
  const p = newProject();
  if (!contact) {
    p.pages[0].nodes = p.pages[0].nodes.filter(node => node.type !== 'Contact');
    p.shared.header.props.target.anchor = '#services';
  }
  p.pages[0].nodes.push({ id: 'service-collection', type: 'ServiceCollection', props: { title: 'Our services', description: 'Explore our work.', mobile: 1, tablet: 2, desktop: 3, gap: 24, design: 'classic', motion: 'none' } });
  const payload = { title: 'Published service', slug: 'published-service', summary: 'Public description', body: 'Published description body.', image: '', imageAlt: '' };
  p.content.services = [{ id: '4bcae2e1-8860-4e43-aaf5-f93f754092d4', draft: { ...payload, title: 'Private future title', summary: 'PRIVATE_DRAFT_SENTINEL', image: 'data:image/png;base64,iVBORw0KGgo=' }, published: payload, revision: 2, publishedRevision: 1 }];
  return p;
}

describe('selective independent Services CMS export', () => {
  it('includes owner backend, services routes and admin without unrelated contact handling', async () => {
    const { files, modules } = await generateProject(fixture(), sources);
    expect(modules).toEqual(['services-cms', 'admin-services']);
    expect(files['app/admin/page.tsx']).toBeDefined();
    expect(files['lib/server.ts']).toBeDefined();
    expect(files['scripts/create-admin.mjs']).toBeDefined();
    expect(files['scripts/import-content.mjs']).toBeDefined();
    expect(files['app/api/admin/services/route.ts']).toBeDefined();
    expect(files['app/services/page.tsx']).toBeDefined();
    expect(files['app/services/[slug]/page.tsx']).toBeDefined();
    expect(files['app/api/services/[id]/image/route.ts']).toBeDefined();
    expect(files['src/site/ServiceDetail.tsx']).toBeDefined();
    expect(files['app/api/contact/route.ts']).toBeUndefined();
    expect(files['app/api/admin/submissions/route.ts']).toBeUndefined();
    expect(files['supabase/migrations/20260926000000_contact.sql']).toBeUndefined();
    expect(json(files['admin-modules.json'])).toEqual({ contact: false, services: true, portfolio: false, articles: false });
    expect(decode(files['.env.example'])).not.toContain('BREVO_');
    expect(decode(files['.env.example'])).not.toContain('CONTACT_');
    expect(decode(files['.env.example'])).toContain('SUPABASE_SECRET_KEY');
    expect(decode(files['supabase/config.toml'])).toMatch(/\[storage\]\s+enabled\s*=\s*true/);
    expect(json(files['package.json']).dependencies.sharp).toBe('0.35.5');
    expect(json(files['package-lock.json']).packages[''].dependencies).toEqual(json(files['package.json']).dependencies);
  });

  it('keeps draft content and unpublished image bytes out of all public data and assets', async () => {
    const p = fixture();
    const { files } = await generateProject(p, sources);
    expect(json(files['site-data.json']).content).toBeUndefined();
    expect(json(files['content-seed.json'])).toEqual(p.content.services);
    expect(json(files['project.apl.json']).content).toEqual(p.content);
    expect(Object.keys(files).filter(file => file.startsWith('public/assets/'))).toEqual([]);
    for (const [file, bytes] of Object.entries(files)) {
      if (['content-seed.json', 'project.apl.json', 'export-manifest.json'].includes(file)) continue;
      expect(decode(bytes), file).not.toContain('PRIVATE_DRAFT_SENTINEL');
      expect(decode(bytes), file).not.toContain('Private future title');
    }
  });

  it('renders CMS pages from current published records without embedding sample records', async () => {
    const { files } = await generateProject(fixture(), sources);
    expect(decode(files['app/page.tsx'])).toContain('const services = await listServices()');
    expect(decode(files['app/page.tsx'])).toContain('items={services}');
    expect(decode(files['app/services/page.tsx'])).toContain('force-dynamic');
    const detail = decode(files['app/services/[slug]/page.tsx']);
    expect(detail).toContain('params: Promise<{ slug: string }>');
    expect(detail).toContain('if (!service) notFound()');
    expect(detail).not.toContain('content-seed');
    expect(json(files['site-navigation.json']).pages).toContainEqual({ id: 'services-cms', label: 'Services', href: '/services' });
    expect(json(files['site-navigation.json']).pages.filter((page: { href: string }) => page.href === '/services')).toHaveLength(1);
  });

  it('combines selected CMS and contact modules without duplicate authentication migrations', async () => {
    const { files, modules } = await generateProject(fixture(true), sources);
    expect(modules).toEqual(['contact', 'admin-inbox', 'services-cms', 'admin-services']);
    expect(files['app/api/contact/route.ts']).toBeDefined();
    expect(files['app/api/admin/submissions/route.ts']).toBeDefined();
    expect(json(files['admin-modules.json'])).toEqual({ contact: true, services: true, portfolio: false, articles: false });
    expect(Object.keys(files).filter(file => /migrations\/.*_auth\.sql$/.test(file))).toHaveLength(1);
  });

  it('excludes saved but unselected collection data and all CMS functionality', async () => {
    const p = fixture(); p.pages[0].nodes = p.pages[0].nodes.filter(node => node.type !== 'ServiceCollection');
    const { files, modules } = await generateProject(p, sources);
    expect(modules).toEqual([]);
    expect(files['content-seed.json']).toBeUndefined();
    expect(files['lib/services.ts']).toBeUndefined();
    expect(files['src/site/ServiceCollection.tsx']).toBeUndefined();
    expect(files['src/site/ServiceDetail.tsx']).toBeUndefined();
    expect(files['admin-modules.json']).toBeUndefined();
    expect(json(files['site-data.json']).content).toBeUndefined();
    expect(json(files['package.json']).dependencies.sharp).toBeUndefined();
    // Next.js itself can still retain Sharp as its own transitive dependency.
    expect(json(files['package-lock.json']).packages[''].dependencies.sharp).toBeUndefined();
  });

  it.each(['/services', '/services/custom'])('blocks CMS route collisions at %s before replacing authored work', async route => {
    const p = addPage(fixture(), 'Existing page', '/existing');
    p.pages[1].path = route;
    await expect(generateProject(p, sources)).rejects.toThrow(/services.*uses/);
  });

  it('permits only fixed CMS dynamic source routes', async () => {
    await expect(generateProject(fixture(), { ...sources, 'templates/cms/app/malicious/[id]/page.tsx': 'bad' })).rejects.toThrow('Unsafe export path');
    await expect(generateProject(fixture(), { ...sources, 'templates/cms/app/services/[anything]/page.tsx': 'bad' })).rejects.toThrow('Unsafe export path');
  });
});
