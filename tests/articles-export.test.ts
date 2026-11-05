import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { newProject } from '../src/project/templates';
import { generateProject, type Sources } from '../src/export/generate';

const sources: Sources = {};
function read(dir: string) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) read(file);
    else sources[file.replaceAll('\\', '/')] = readFileSync(file, 'utf8');
  }
}
read('templates'); read('src/site');
for (const file of ['schema.ts', 'service-schema.ts', 'portfolio-schema.ts', 'article-schema.ts', 'link-schema.ts', 'icon-schema.ts', 'appearance-schema.ts', 'theme.ts']) sources['src/project/' + file] = readFileSync('src/project/' + file, 'utf8');
const decode = (value: Uint8Array) => new TextDecoder().decode(value);
const json = (value: Uint8Array) => JSON.parse(decode(value));
function fixture() {
  const project = newProject();
  project.pages[0].nodes = project.pages[0].nodes.filter(node => node.type !== 'Contact');
  project.shared.header.props.target.anchor = '#services';
  project.pages[0].nodes.push({ id: 'articles', type: 'ArticleCollection', props: { title: 'Field notes', description: '', mobile: 1, tablet: 2, desktop: 2, gap: 24, design: 'tiles', motion: 'none' } });
  const published = { title: 'First article', slug: 'first-article', summary: 'Public summary', body: 'Public body.', image: '', imageAlt: '' };
  project.content.articles = [{ id: '4a444faa-3886-4dd9-b264-e2544d968a72', draft: { ...published, title: 'PRIVATE_NEXT_TITLE', body: 'PRIVATE_DRAFT_SENTINEL' }, published, revision: 2, publishedRevision: 1 }];
  return project;
}

describe('selective independent Articles export', () => {
  it('carries common-section and shared-footer recipes into exported source data', async () => {
    const project = fixture();
    project.shared.footer.props.design = 'framed';
    const services = project.pages[0].nodes.find(node => node.type === 'Services');
    if (!services || services.type !== 'Services') throw new Error('Fixture needs static Services');
    services.props.design = 'numbered';
    project.pages[0].nodes.push({ id: 'story', type: 'Text', props: { title: 'A deliberate story', body: 'The owner wrote this.', align: 'left', design: 'editorial' } });
    const { files } = await generateProject(project, sources);
    const data = json(files['site-data.json']);
    expect(data.shared.footer.props.design).toBe('framed');
    expect(data.pages[0].nodes.find((node: { type: string }) => node.type === 'Services').props.design).toBe('numbered');
    expect(data.pages[0].nodes.find((node: { type: string }) => node.type === 'Text').props.design).toBe('editorial');
    expect(files['src/site/Footer.tsx']).toBeDefined();
    expect(files['src/site/Services.tsx']).toBeDefined();
    expect(files['src/site/Text.tsx']).toBeDefined();
    expect(decode(files['app/globals.css'])).toContain('.text-section[data-design="editorial"]');
  });

  it('includes public pages, owner admin, migration, image routes and verifier', async () => {
    const project = fixture();
    const { files, modules } = await generateProject(project, sources);
    expect(modules).toEqual(['articles-cms', 'admin-articles']);
    for (const file of ['app/articles/page.tsx', 'app/articles/[slug]/page.tsx', 'app/api/admin/articles/route.ts', 'app/api/admin/articles/image/route.ts', 'app/api/articles/[id]/image/route.ts', 'app/admin/ArticlesAdmin.tsx', 'lib/articles.ts', 'scripts/import-articles.mjs', 'supabase/migrations/20260930000000_articles.sql', 'tests/articles-cms.mjs']) expect(files[file], file).toBeDefined();
    expect(files['app/api/contact/route.ts']).toBeUndefined();
    expect(files['lib/services.ts']).toBeUndefined();
    expect(files['lib/portfolio.ts']).toBeUndefined();
    expect(json(files['admin-modules.json'])).toEqual({ contact: false, services: false, portfolio: false, articles: true });
    expect(json(files['site-data.json']).content).toBeUndefined();
    expect(json(files['articles-seed.json'])).toEqual(project.content.articles);
    expect(json(files['site-navigation.json']).pages).toContainEqual({ id: 'articles-cms', label: 'Articles', href: '/articles' });
    expect(decode(files['app/page.tsx'])).toContain('const articles = await listArticles()');
    expect(decode(files['app/articles/[slug]/page.tsx'])).toContain('if (!article) notFound()');
    for (const [file, bytes] of Object.entries(files)) {
      if (['articles-seed.json', 'project.apl.json', 'export-manifest.json'].includes(file)) continue;
      expect(decode(bytes), file).not.toContain('PRIVATE_DRAFT_SENTINEL');
    }
  });

  it('does not export Articles functionality when the collection is unselected', async () => {
    const project = fixture();
    project.pages[0].nodes = project.pages[0].nodes.filter(node => node.type !== 'ArticleCollection');
    const { files, modules } = await generateProject(project, sources);
    expect(modules).toEqual([]);
    for (const file of ['articles-seed.json', 'lib/articles.ts', 'src/site/ArticleCollection.tsx', 'app/articles/page.tsx', 'app/api/admin/articles/route.ts', 'tests/articles-cms.mjs']) expect(files[file], file).toBeUndefined();
  });
});
