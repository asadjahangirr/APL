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
function fixture(all = false) {
  const project = newProject();
  if (!all) {
    project.pages[0].nodes = project.pages[0].nodes.filter(node => node.type !== 'Contact');
    project.shared.header.props.target.anchor = '#services';
  }
  project.pages[0].nodes.push({
    id: 'portfolio-collection', type: 'PortfolioCollection',
    props: { title: 'Selected work', description: 'Visit our project websites.', mobile: 1, tablet: 2, desktop: 3, gap: 24, design: 'gallery', motion: 'lift' },
  });
  const published = { title: 'Published portfolio project', summary: 'Public work description', category: 'Brand identity', externalUrl: 'https://portfolio.example/work', image: '', imageAlt: '' };
  project.content.portfolio = [{
    id: '63060fd5-4543-4fc4-87e8-fb6659b91a18',
    draft: { ...published, title: 'Private portfolio future title', summary: 'PORTFOLIO_PRIVATE_SENTINEL', externalUrl: '', image: 'data:image/png;base64,iVBORw0KGgo=' },
    published, revision: 2, publishedRevision: 1,
  }];
  if (all) {
    project.pages[0].nodes.push({ id: 'service-collection', type: 'ServiceCollection', props: { title: 'Services', description: '', mobile: 1, tablet: 2, desktop: 3, gap: 24, design: 'classic', motion: 'none' } });
    const payload = { title: 'Retained service', slug: 'retained-service', summary: 'Service summary.', body: 'Service body.', image: '', imageAlt: '' };
    project.content.services = [{ id: '4bcae2e1-8860-4e43-aaf5-f93f754092d4', draft: payload, published: payload, revision: 1, publishedRevision: 1 }];
  }
  return project;
}

describe('selective independent external-link Portfolio CMS export', () => {
  it('includes its own owner backend without unrelated Services or contact modules', async () => {
    const { files, modules } = await generateProject(fixture(), sources);
    expect(modules).toEqual(['portfolio-cms', 'admin-portfolio']);
    for (const file of [
      'app/admin/page.tsx', 'app/admin/PortfolioAdmin.tsx', 'lib/server.ts', 'lib/portfolio.ts',
      'app/api/admin/portfolio/route.ts', 'app/api/admin/portfolio/image/route.ts',
      'app/api/portfolio/[id]/image/route.ts', 'scripts/create-admin.mjs',
      'scripts/import-portfolio.mjs', 'supabase/migrations/20260929000000_portfolio.sql',
      'scripts/setup-content.mjs',
      'tests/portfolio-cms.mjs', 'src/site/PortfolioCollection.tsx',
    ]) expect(files[file], file).toBeDefined();
    for (const file of [
      'app/api/contact/route.ts', 'app/api/admin/submissions/route.ts', 'app/api/admin/services/route.ts',
      'app/admin/ServicesAdmin.tsx', 'lib/services.ts', 'scripts/import-content.mjs',
      'supabase/migrations/20260928000000_services.sql', 'tests/services-cms.mjs',
      'app/services/page.tsx', 'app/portfolio/page.tsx', 'app/portfolio/[slug]/page.tsx',
    ]) expect(files[file], file).toBeUndefined();
    expect(json(files['admin-modules.json'])).toEqual({ contact: false, services: false, portfolio: true, articles: false });
    expect(decode(files['.env.example'])).toContain('SUPABASE_SECRET_KEY');
    expect(decode(files['.env.example'])).not.toContain('BREVO_');
    expect(decode(files['supabase/config.toml'])).toMatch(/\[storage\]\s+enabled\s*=\s*true/);
    expect(json(files['package.json']).dependencies.sharp).toBe('0.35.5');
    expect(json(files['package-lock.json']).packages[''].dependencies).toEqual(json(files['package.json']).dependencies);
    expect(json(files['package.json']).scripts['setup:content']).toBeTruthy();
  });

  it('keeps unpublished data and cover bytes private while preserving owner backup', async () => {
    const project = fixture();
    const { files } = await generateProject(project, sources);
    expect(json(files['portfolio-seed.json'])).toEqual(project.content.portfolio);
    expect(json(files['project.apl.json']).content).toEqual(project.content);
    expect(json(files['site-data.json']).content).toBeUndefined();
    expect(Object.keys(files).filter(file => file.startsWith('public/assets/'))).toEqual([]);
    for (const [file, bytes] of Object.entries(files)) {
      if (['portfolio-seed.json', 'project.apl.json', 'export-manifest.json'].includes(file)) continue;
      expect(decode(bytes), file).not.toContain('PORTFOLIO_PRIVATE_SENTINEL');
      expect(decode(bytes), file).not.toContain('Private portfolio future title');
    }
  });

  it('renders selected collections from current database publications without an internal case-study route', async () => {
    const { files } = await generateProject(fixture(), sources);
    expect(decode(files['app/page.tsx'])).toContain('listPortfolio');
    expect(decode(files['app/page.tsx'])).toContain('force-dynamic');
    expect(decode(files['app/page.tsx'])).not.toContain('portfolio-seed');
    expect(json(files['site-navigation.json']).pages.some((entry: { href: string }) => entry.href === '/portfolio')).toBe(false);
    expect(Object.keys(files).filter(file => /^app\/portfolio\//.test(file))).toEqual([]);
  });

  it('combines all selected modules and preserves independent content seed contracts', async () => {
    const project = fixture(true);
    const { files, modules } = await generateProject(project, sources);
    expect(modules).toEqual(['contact', 'admin-inbox', 'services-cms', 'admin-services', 'portfolio-cms', 'admin-portfolio']);
    expect(json(files['admin-modules.json'])).toEqual({ contact: true, services: true, portfolio: true, articles: false });
    expect(json(files['content-seed.json'])).toEqual(project.content.services);
    expect(json(files['portfolio-seed.json'])).toEqual(project.content.portfolio);
    expect(files['app/api/contact/route.ts']).toBeDefined();
    expect(files['app/api/admin/services/route.ts']).toBeDefined();
    expect(Object.keys(files).filter(file => /migrations\/.*_auth\.sql$/.test(file))).toHaveLength(1);
    expect(decode(files['app/admin/Modules.tsx'])).toContain('PortfolioAdmin');
    expect(decode(files['app/admin/Modules.tsx'])).toContain('ServicesAdmin');
    expect(decode(files['app/admin/Modules.tsx'])).toContain('Inbox');
  });

  it('omits saved but unselected portfolio functionality from a static export', async () => {
    const project = fixture();
    project.pages[0].nodes = project.pages[0].nodes.filter(node => node.type !== 'PortfolioCollection');
    const { files, modules } = await generateProject(project, sources);
    expect(modules).toEqual([]);
    expect(files['portfolio-seed.json']).toBeUndefined();
    expect(files['app/admin/PortfolioAdmin.tsx']).toBeUndefined();
    expect(files['app/api/admin/portfolio/route.ts']).toBeUndefined();
    expect(files['tests/portfolio-cms.mjs']).toBeUndefined();
    expect(files['src/site/PortfolioCollection.tsx']).toBeUndefined();
    expect(files['lib/portfolio.ts']).toBeUndefined();
    expect(json(files['package.json']).dependencies.sharp).toBeUndefined();
    expect(json(files['site-data.json']).content).toBeUndefined();
    expect(json(files['project.apl.json']).content.portfolio).toEqual(project.content.portfolio);
  });

  it('lets the owner author /portfolio because external cards do not reserve public routes', async () => {
    const project = addPage(fixture(), 'Portfolio introduction', '/portfolio');
    const { files } = await generateProject(project, sources);
    expect(decode(files['app/portfolio/page.tsx'])).toContain('page = site.pages[1]');
    expect(files['app/portfolio/[slug]/page.tsx']).toBeUndefined();
  });

  it('rejects arbitrary dynamic paths while accepting the fixed public image endpoint', async () => {
    await expect(generateProject(fixture(), {
      ...sources, 'templates/portfolio/app/portfolio/[malicious]/page.tsx': 'bad',
    })).rejects.toThrow('Unsafe export path');
  });
});
